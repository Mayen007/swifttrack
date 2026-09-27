// tests/logistics/test-physical-custody.js
// SwiftTrack Logistics: Stage 4 Physical Custody & Hub Operations Verification Suite
const assert = require('node:assert');
const crypto = require('node:crypto');
const { db } = require('../../server/db/database.js');
const custodyService = require('../../server/services/custodyService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const transportService = require('../../server/services/transportService.js');

console.log('============================================================');
console.log('📦  SWIFTTRACK LOGISTICS: STAGE 4 PHYSICAL CUSTODY SUITE');
console.log('============================================================\n');

let passedTests = 0;
const totalTests = 8;

const adminUser = { id: 1, roleName: 'SUPER_ADMIN', fullName: 'Super Admin', branchId: 1 };
const dispatcherUser = { id: 4, roleName: 'DISPATCHER', fullName: 'Nairobi Dispatcher', branchId: 1 };
const driverUser = { id: 5, roleName: 'DRIVER', fullName: 'David Kamau', branchId: 1 };

try {
    // -------------------------------------------------------------
    // TEST 1: Single & Bulk Offline Barcode Scan Events with Idempotency
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Single & Bulk Offline Barcode Scans with Idempotency...');
    
    // Create test shipment
    const shp1 = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Juma Mwangi', phone: '+254711000101', address: 'Kenyatta Ave 12', city: 'Nairobi' },
        recipient: { name: 'Amina Ali', phone: '+254722000202', address: 'Moi Ave 45', city: 'Mombasa' },
        service_type: 'EXPRESS',
        parcels: [{ weight_kg: 3.5, length_cm: 20, width_cm: 20, height_cm: 20, description: 'Electronics' }]
    }, adminUser);

    assert.strictEqual(shp1.status, 'BOOKED');

    const scanUuid = crypto.randomUUID();
    const scan1 = custodyService.recordScanEvent({
        scan_uuid: scanUuid,
        barcode: shp1.tracking_number,
        scan_type: 'INTAKE',
        hub_id: 1,
        location_desc: 'Nairobi Intake Desk #2',
        device_id: 'SCANNER-PDA-01'
    }, adminUser);

    assert.ok(scan1.id, 'Scan event should have an ID');
    assert.strictEqual(scan1.scan_uuid, scanUuid);
    assert.strictEqual(scan1.scan_type, 'INTAKE');

    // Verify shipment transitioned to AT_ORIGIN_HUB
    const updatedShp1 = shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(updatedShp1.status, 'AT_ORIGIN_HUB', 'Shipment should transition to AT_ORIGIN_HUB upon INTAKE scan');

    // Test Idempotency / Deduplication (BR-013, BR-014)
    const duplicateScan = custodyService.recordScanEvent({
        scan_uuid: scanUuid,
        barcode: shp1.tracking_number,
        scan_type: 'INTAKE',
        hub_id: 1
    }, adminUser);

    assert.strictEqual(duplicateScan.is_duplicate, true, 'Duplicate scan_uuid must be recognized');
    assert.strictEqual(duplicateScan.id, scan1.id, 'Duplicate scan must return existing record');

    // Test Batch Sync (Mobile Offline Scans)
    const batchResult = custodyService.recordBatchScans([
        { scan_uuid: crypto.randomUUID(), barcode: shp1.tracking_number, scan_type: 'SORT', hub_id: 1 },
        { scan_uuid: scanUuid, barcode: shp1.tracking_number, scan_type: 'INTAKE', hub_id: 1 } // Duplicate
    ], adminUser);

    assert.strictEqual(batchResult.total, 2);
    assert.strictEqual(batchResult.processed, 1);
    assert.strictEqual(batchResult.duplicates, 1);

    const postSortShp = shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(postSortShp.status, 'SORTED', 'Shipment should transition to SORTED');

    passedTests++;
    console.log('✓ [PASS] 1. Single & Bulk Offline Barcode Scans: Verified with idempotency deduplication\n');

    // -------------------------------------------------------------
    // TEST 2: Scan Events Immutability Trigger
    // -------------------------------------------------------------
    console.log('▶ TEST 2: Scan Events Immutability Trigger...');

    let updateBlocked = false;
    try {
        db.prepare('UPDATE scan_events SET barcode = ? WHERE id = ?').run('MALICIOUS_OVERWRITE', scan1.id);
    } catch (err) {
        updateBlocked = err.message.includes('immutable chain-of-custody ledger');
    }
    assert.strictEqual(updateBlocked, true, 'Database trigger must block UPDATE on scan_events');

    let deleteBlocked = false;
    try {
        db.prepare('DELETE FROM scan_events WHERE id = ?').run(scan1.id);
    } catch (err) {
        deleteBlocked = err.message.includes('immutable chain-of-custody ledger');
    }
    assert.strictEqual(deleteBlocked, true, 'Database trigger must block DELETE on scan_events');

    passedTests++;
    console.log('✓ [PASS] 2. Scan Events Immutability: SQL triggers block UPDATE and DELETE\n');

    // -------------------------------------------------------------
    // TEST 3: Custody Transfer Handoff (HND-)
    // -------------------------------------------------------------
    console.log('▶ TEST 3: Custody Transfer Handoff (Agent to Driver)...');

    const handoffResult = custodyService.recordHandoff({
        shipment_id: shp1.id,
        handoff_type: 'HUB_TO_DRIVER',
        releasing_actor_type: 'AGENT',
        releasing_actor_id: adminUser.id,
        releasing_actor_name: adminUser.fullName,
        receiving_actor_type: 'DRIVER',
        receiving_actor_id: driverUser.id,
        receiving_actor_name: driverUser.fullName,
        package_condition: 'GOOD',
        seal_number: 'SEAL-KE-8899',
        verification_method: 'SIGNATURE',
        signature_data: 'data:image/svg+xml;base64,PHN2Zz5zaWduYXR1cmU8L3N2Zz4=',
        notes: 'Handed over in optimal condition'
    }, adminUser);

    const handoff = handoffResult.handoff;
    assert.ok(handoff.handoff_number.startsWith('HND-'), 'Handoff number must start with HND-');
    assert.strictEqual(handoff.package_condition, 'GOOD');
    assert.strictEqual(handoff.receiving_actor_name, driverUser.fullName);
    assert.strictEqual(handoffResult.discrepancy, null, 'Clean handoff must not create discrepancy');

    // Verify tracking event was appended
    const updatedShpDetails = shipmentService.getShipmentById(shp1.id);
    const handoffEvent = updatedShpDetails.timeline.find(e => e.event_code === 'CUSTODY_HANDOFF');
    assert.ok(handoffEvent, 'Shipment timeline must include CUSTODY_HANDOFF event');

    passedTests++;
    console.log('✓ [PASS] 3. Chain of Custody Handoff: Recorded with digital signature & verification\n');

    // -------------------------------------------------------------
    // TEST 4: Damaged Package Intake & Auto-Discrepancy Creation
    // -------------------------------------------------------------
    console.log('▶ TEST 4: Damaged Package Intake & Auto-Discrepancy Creation...');

    const shpDamaged = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Peter Otieno', phone: '+254733111222', address: 'Industrial Area Gate 4', city: 'Nairobi' },
        recipient: { name: 'Grace M.', phone: '+254744333444', address: 'Nyali Beach Rd 10', city: 'Mombasa' },
        service_type: 'STANDARD',
        parcels: [{ weight_kg: 5.0, description: 'Glassware' }]
    }, adminUser);

    const damagedHandoff = custodyService.recordHandoff({
        shipment_id: shpDamaged.id,
        handoff_type: 'INTAKE_TO_HUB',
        releasing_actor_type: 'CUSTOMER',
        releasing_actor_name: 'Peter Otieno',
        receiving_actor_type: 'AGENT',
        receiving_actor_id: adminUser.id,
        receiving_actor_name: adminUser.fullName,
        package_condition: 'DAMAGED_CRUSHED',
        verification_method: 'VISUAL_INSPECTION',
        notes: 'Outer box crushed and glass rattling inside'
    }, adminUser);

    assert.ok(damagedHandoff.discrepancy, 'Damaged package must automatically spawn a discrepancy record');
    assert.ok(damagedHandoff.discrepancy.discrepancy_number.startsWith('DISC-'), 'Discrepancy number must start with DISC-');
    assert.strictEqual(damagedHandoff.discrepancy.discrepancy_type, 'DAMAGED_PACKAGE');
    assert.strictEqual(damagedHandoff.discrepancy.severity, 'HIGH');
    assert.strictEqual(damagedHandoff.discrepancy.status, 'OPEN');

    passedTests++;
    console.log('✓ [PASS] 4. Damaged Package Intake: Automatically spawns tracked discrepancy record\n');

    // -------------------------------------------------------------
    // TEST 5: Hub Receiving Session Opening & Station Bay Assignment
    // -------------------------------------------------------------
    console.log('▶ TEST 5: Hub Receiving Session Opening & Station Bay Assignment...');

    const session = custodyService.openReceivingSession({
        hub_id: 2,
        station_bay: 'Bay 3 - Coastal Inbound Sorting',
        notes: 'Evening transport run intake'
    }, adminUser);

    assert.ok(session.session_number.startsWith('RCV-'), 'Session number must start with RCV-');
    assert.strictEqual(session.status, 'IN_PROGRESS');
    assert.strictEqual(session.station_bay, 'Bay 3 - Coastal Inbound Sorting');
    assert.strictEqual(session.scanned_packages_count, 0);

    passedTests++;
    console.log('✓ [PASS] 5. Hub Receiving Session: Opened with designated sorting bay\n');

    // -------------------------------------------------------------
    // TEST 6: Inbound Package Scans & Manifest Expected-vs-Received Tracking
    // -------------------------------------------------------------
    console.log('▶ TEST 6: Inbound Package Scans & Expected-vs-Received Tracking...');

    // Plan route, run, and manifest with 2 shipments
    const mShp1 = shipmentService.createShipment({
        origin_hub_id: 1, destination_hub_id: 2,
        sender: { name: 'Shipper A', phone: '+254711111111', address: 'Westlands Mall', city: 'Nairobi' },
        recipient: { name: 'Consignee A', phone: '+254722222222', address: 'Digo Rd 12', city: 'Mombasa' },
        parcels: [{ weight_kg: 2.0, description: 'Books' }]
    }, adminUser);

    const mShp2 = shipmentService.createShipment({
        origin_hub_id: 1, destination_hub_id: 2,
        sender: { name: 'Shipper B', phone: '+254733333333', address: 'Kilimani Plaza', city: 'Nairobi' },
        recipient: { name: 'Consignee B', phone: '+254744444444', address: 'Nkrumah Rd 55', city: 'Mombasa' },
        parcels: [{ weight_kg: 4.0, description: 'Shoes' }]
    }, adminUser);

    const unexpectedShp = shipmentService.createShipment({
        origin_hub_id: 1, destination_hub_id: 2,
        sender: { name: 'Shipper C', phone: '+254755555555', address: 'Upper Hill Towers', city: 'Nairobi' },
        recipient: { name: 'Consignee C', phone: '+254766666666', address: 'Bamburi Complex', city: 'Mombasa' },
        parcels: [{ weight_kg: 1.0, description: 'Documents' }]
    }, adminUser);

    const route = transportService.createRoute({
        code: `RT-PCUST-${Date.now().toString().slice(-4)}`,
        name: 'Custody Test Corridor',
        origin_hub_id: 1,
        destination_hub_id: 2,
        distance_km: 480.0,
        estimated_duration_hours: 8.0,
        is_cross_border: false
    }, adminUser);

    const run = transportService.createTransportRun({
        route_leg_id: route.legs[0].id,
        origin_hub_id: 1,
        destination_hub_id: 2,
        driver_id: driverUser.id,
        vehicle_id: 1
    }, dispatcherUser);

    transportService.addShipmentToManifest(run.id, mShp1.id, dispatcherUser);
    transportService.addShipmentToManifest(run.id, mShp2.id, dispatcherUser);
    transportService.lockManifest(run.id, dispatcherUser);
    transportService.dispatchTransportRun(run.id, { departure_odometer_km: 12000 }, dispatcherUser);

    // Open receiving session attached to this manifest
    const manifestSession = custodyService.openReceivingSession({
        hub_id: 2,
        transport_run_id: run.id,
        manifest_id: run.manifest.id,
        station_bay: 'Bay 1 - High Priority Freight'
    }, adminUser);

    assert.strictEqual(manifestSession.expected_packages_count, 2, 'Expected package count must reflect manifest');

    // Scan expected package 1
    const scanItem1 = custodyService.scanReceivingItem(manifestSession.id, {
        barcode: mShp1.tracking_number,
        condition: 'GOOD'
    }, adminUser);

    assert.strictEqual(scanItem1.item.is_expected, 1, 'Manifested item must be marked is_expected = 1');
    assert.strictEqual(scanItem1.discrepancy, null);

    // Check shipment updated to AT_HUB
    const atHubShp1 = shipmentService.getShipmentById(mShp1.id);
    assert.strictEqual(atHubShp1.status, 'AT_HUB');
    assert.strictEqual(atHubShp1.current_hub_id, 2);

    // Scan unexpected package (not on manifest)
    const scanItemUnexpected = custodyService.scanReceivingItem(manifestSession.id, {
        barcode: unexpectedShp.tracking_number,
        condition: 'GOOD'
    }, adminUser);

    assert.strictEqual(scanItemUnexpected.item.is_expected, 0, 'Unmanifested item must be marked is_expected = 0');
    assert.ok(scanItemUnexpected.discrepancy, 'Unexpected package must trigger an overage discrepancy');
    assert.strictEqual(scanItemUnexpected.discrepancy.discrepancy_type, 'UNEXPECTED_OVERAGE');

    passedTests++;
    console.log('✓ [PASS] 6. Inbound Package Scans: Reconciled against manifest with overage detection\n');

    // -------------------------------------------------------------
    // TEST 7: Completing Receiving Session & Missing Manifest Discrepancy (BR-006)
    // -------------------------------------------------------------
    console.log('▶ TEST 7: Complete Receiving Session & Missing Manifest Item Discrepancy...');

    // Complete session without scanning mShp2
    const completeRes = custodyService.completeReceivingSession(manifestSession.id, {
        notes: 'Unload completed with one missing item'
    }, adminUser);

    assert.strictEqual(completeRes.missing_items_count, 1, 'Should detect 1 missing manifest item');
    assert.strictEqual(completeRes.session.status, 'DISCREPANCY_FLAGGED', 'Session must be DISCREPANCY_FLAGGED');
    
    const missingDisc = completeRes.missing_discrepancies[0];
    assert.strictEqual(missingDisc.discrepancy_type, 'MISSING_MANIFEST_ITEM');
    assert.strictEqual(missingDisc.severity, 'HIGH');
    assert.strictEqual(missingDisc.shipment_id, mShp2.id);

    // Verify mShp2 status updated to EXCEPTION
    const missingShp = shipmentService.getShipmentById(mShp2.id);
    assert.strictEqual(missingShp.status, 'EXCEPTION', 'Missing manifest item must transition to EXCEPTION');

    passedTests++;
    console.log('✓ [PASS] 7. Receiving Session Completion: Auto-flags missing items with EXCEPTION state\n');

    // -------------------------------------------------------------
    // TEST 8: Discrepancy Investigation & Resolution Lifecycle
    // -------------------------------------------------------------
    console.log('▶ TEST 8: Discrepancy Investigation & Resolution Lifecycle...');

    const resolvedDisc = custodyService.resolveDiscrepancy(missingDisc.id, {
        resolution_action: 'FOUND_AND_MERGED',
        resolution_notes: 'Package was located in Bay 2 sorting buffer and returned to delivery route'
    }, adminUser);

    assert.strictEqual(resolvedDisc.status, 'RESOLVED');
    assert.strictEqual(resolvedDisc.resolution_action, 'FOUND_AND_MERGED');
    assert.ok(resolvedDisc.resolved_at, 'Resolved at timestamp must be set');
    assert.strictEqual(resolvedDisc.investigator_user_id, adminUser.id);

    // Verify tracking timeline received DISCREPANCY_RESOLVED event
    const missingShpDetails = shipmentService.getShipmentById(mShp2.id);
    const resolveEvent = missingShpDetails.timeline.find(e => e.event_code === 'DISCREPANCY_RESOLVED');
    assert.ok(resolveEvent, 'Shipment must receive DISCREPANCY_RESOLVED tracking event');

    passedTests++;
    console.log('✓ [PASS] 8. Discrepancy Investigation: Full lifecycle resolution with audit timeline\n');

    console.log('============================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} PHYSICAL CUSTODY & HUB OPERATIONS TESTS PASSED!`);
    console.log('============================================================\n');

} catch (error) {
    console.error(`\n❌ TEST SUITE FAILED at Test #${passedTests + 1}:`);
    console.error(error);
    process.exit(1);
}
