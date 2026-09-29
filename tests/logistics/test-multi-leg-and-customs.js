// tests/logistics/test-multi-leg-and-customs.js
// SwiftTrack Logistics: Multi-Leg Shipment Orchestration & Cross-Border Customs Suite
const assert = require('node:assert');
const { db } = require('../../server/db/database.js');
const shipmentService = require('../../server/services/shipmentService.js');
const transportService = require('../../server/services/transportService.js');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`[PASS] [PASS] ${name}`);
    } catch (err) {
        console.error(`[FAIL] [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

async function runSuite() {
    console.log('\n============================================================');
    console.log('  SWIFTTRACK LOGISTICS: MULTI-LEG & CROSS-BORDER SUITE');
    console.log('============================================================\n');

    const adminUser = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Super Admin' };

    // Hubs: Nairobi (1), Nakuru (3 or insert if needed), Mombasa (2)
    let hub1 = db.prepare('SELECT * FROM branches WHERE id = 1').get();
    let hub2 = db.prepare('SELECT * FROM branches WHERE id = 2').get();
    let hub3 = db.prepare("SELECT * FROM branches WHERE code = 'NAK-01'").get();

    if (!hub3) {
        const res = db.prepare(`
            INSERT INTO branches (name, code, city, address, phone, email, is_hub, is_active)
            VALUES ('Nakuru Transit Hub', 'NAK-01', 'Nakuru', 'Nakuru Highway', '+254700000003', 'nakuru@swifttrack.co.ke', 1, 1)
        `).run();
        hub3 = db.prepare('SELECT * FROM branches WHERE id = ?').get(res.lastInsertRowid);
    }

    let testDriver = db.prepare('SELECT * FROM drivers LIMIT 1').get();
    let testVehicle = db.prepare('SELECT * FROM vehicles LIMIT 1').get();

    let multiLegShipment;
    let run1;
    let run2;

    // -------------------------------------------------------------
    // TEST 1: Multi-Leg Shipment Booking (Nairobi -> Nakuru -> Mombasa)
    // -------------------------------------------------------------
    await runTest('1. Multi-Leg Consignment Booking: Creates 2 sequential legs with PENDING status', async () => {
        multiLegShipment = shipmentService.createShipment({
            origin_hub_id: hub1.id,
            destination_hub_id: hub2.id,
            sender: { name: 'EAC Exporters Nairobi', phone: '+254711000111', address: 'Industrial Area', city: 'Nairobi' },
            recipient: { name: 'Coastal Traders Mombasa', phone: '+254722000222', address: 'Mombasa Port Rd', city: 'Mombasa' },
            service_type: 'STANDARD',
            parcels: [
                { weight_kg: 8.0, length_cm: 30, width_cm: 30, height_cm: 30, description: 'Textile Samples' }
            ],
            legs: [
                { origin_hub_id: hub1.id, destination_hub_id: hub3.id }, // Leg 1: Nairobi -> Nakuru
                { origin_hub_id: hub3.id, destination_hub_id: hub2.id }  // Leg 2: Nakuru -> Mombasa
            ]
        }, adminUser);

        assert.ok(multiLegShipment.id, 'Shipment ID must exist');
        assert.strictEqual(multiLegShipment.status, 'BOOKED');

        const legs = shipmentService.getShipmentLegs(multiLegShipment.id);
        assert.strictEqual(legs.length, 2, 'Shipment must have exactly 2 routing legs');
        assert.strictEqual(legs[0].leg_sequence, 1);
        assert.strictEqual(legs[0].origin_hub_id, hub1.id);
        assert.strictEqual(legs[0].destination_hub_id, hub3.id);
        assert.strictEqual(legs[0].status, 'PENDING');

        assert.strictEqual(legs[1].leg_sequence, 2);
        assert.strictEqual(legs[1].origin_hub_id, hub3.id);
        assert.strictEqual(legs[1].destination_hub_id, hub2.id);
        assert.strictEqual(legs[1].status, 'PENDING');
    });

    // -------------------------------------------------------------
    // TEST 2: Active Leg Retrieval
    // -------------------------------------------------------------
    await runTest('2. Active Leg Discovery: Returns Leg 1 as current active leg awaiting dispatch', async () => {
        const activeLeg = shipmentService.getActiveLeg(multiLegShipment.id);
        assert.ok(activeLeg, 'Active leg must exist');
        assert.strictEqual(activeLeg.leg_sequence, 1, 'First active leg sequence must be 1');
        assert.strictEqual(activeLeg.origin_hub_id, hub1.id);
    });

    // -------------------------------------------------------------
    // TEST 3: Leg 1 Manifesting, Loading & Dispatch (Nairobi -> Nakuru)
    // -------------------------------------------------------------
    await runTest('3. Leg 1 Transport Execution: Adds to manifest, locks, dispatches, and moves IN_TRANSIT', async () => {
        run1 = transportService.createTransportRun({
            origin_hub_id: hub1.id,
            destination_hub_id: hub3.id,
            driver_id: testDriver.id,
            vehicle_id: testVehicle.id,
            notes: 'Leg 1 Nairobi to Nakuru linehaul'
        }, adminUser);

        // Assign to Manifest
        transportService.addShipmentToManifest(run1.id, multiLegShipment.id, adminUser);

        // Lock & Load
        transportService.lockManifest(run1.id, adminUser);
        let shp = shipmentService.getShipmentById(multiLegShipment.id);
        assert.strictEqual(shp.status, 'LOADED');

        // Dispatch
        transportService.dispatchTransportRun(run1.id, adminUser);
        shp = shipmentService.getShipmentById(multiLegShipment.id);
        assert.strictEqual(shp.status, 'IN_TRANSIT');
    });

    // -------------------------------------------------------------
    // TEST 4: Destination Arrival at Intermediate Transit Hub (Nakuru)
    // -------------------------------------------------------------
    await runTest('4. Intermediate Transit Arrival: Completes Leg 1, sets AT_HUB, and auto-activates Leg 2', async () => {
        const arrivalResult = transportService.arriveTransportRun(run1.id, adminUser);
        assert.strictEqual(arrivalResult.status, 'ARRIVED');

        // Receive manifest at Nakuru
        transportService.receiveManifest(run1.manifest.id, [multiLegShipment.id], adminUser);

        const legs = shipmentService.getShipmentLegs(multiLegShipment.id);
        assert.strictEqual(legs[0].status, 'COMPLETED', 'Leg 1 must be marked COMPLETED');
        assert.ok(legs[0].actual_arrival, 'Leg 1 actual arrival must be timestamped');

        assert.strictEqual(legs[1].status, 'PENDING', 'Leg 2 must be activated to PENDING');

        const shp = shipmentService.getShipmentById(multiLegShipment.id);
        assert.strictEqual(shp.status, 'AT_HUB', 'Shipment status must be AT_HUB at transit facility');
        assert.strictEqual(shp.current_hub_id, hub3.id, 'Current hub must be Nakuru Hub');

        // Check timeline for TRANSIT_HUB_ARRIVAL
        const transitEvent = shp.timeline.find(e => e.event_code === 'TRANSIT_HUB_ARRIVAL');
        assert.ok(transitEvent, 'Timeline must record TRANSIT_HUB_ARRIVAL event');
    });

    // -------------------------------------------------------------
    // TEST 5: Intermediate Hub Manifest Queue Visibility
    // -------------------------------------------------------------
    await runTest('5. Transit Manifest Queue: Nakuru dispatcher queries shipments awaiting manifest for Leg 2', async () => {
        const awaitingList = shipmentService.getShipmentsAwaitingManifest(hub3.id, hub2.id);
        assert.ok(Array.isArray(awaitingList), 'Must return array of awaiting shipments');
        assert.ok(awaitingList.some(s => s.id === multiLegShipment.id), 'Shipment must appear in Nakuru -> Mombasa manifest queue');
    });

    // -------------------------------------------------------------
    // TEST 6: Leg 2 Transport Execution & Final Arrival at Mombasa
    // -------------------------------------------------------------
    await runTest('6. Final Leg 2 Execution: Nakuru -> Mombasa dispatch and arrival marks final destination reached', async () => {
        run2 = transportService.createTransportRun({
            origin_hub_id: hub3.id,
            destination_hub_id: hub2.id,
            driver_id: testDriver.id,
            vehicle_id: testVehicle.id,
            notes: 'Leg 2 Nakuru to Mombasa linehaul'
        }, adminUser);

        transportService.addShipmentToManifest(run2.id, multiLegShipment.id, adminUser);
        transportService.lockManifest(run2.id, adminUser);
        transportService.dispatchTransportRun(run2.id, adminUser);

        // Arrive & receive at Mombasa (final destination!)
        transportService.arriveTransportRun(run2.id, adminUser);
        transportService.receiveManifest(run2.manifest.id, [multiLegShipment.id], adminUser);

        const legs = shipmentService.getShipmentLegs(multiLegShipment.id);
        assert.strictEqual(legs[0].status, 'COMPLETED');
        assert.strictEqual(legs[1].status, 'COMPLETED');

        const finalShp = shipmentService.getShipmentById(multiLegShipment.id);
        assert.strictEqual(finalShp.status, 'AT_HUB');
        assert.strictEqual(finalShp.current_hub_id, hub2.id);

        const destEvent = finalShp.timeline.find(e => e.event_code === 'ARRIVED_AT_DESTINATION_HUB');
        assert.ok(destEvent, 'Timeline must record ARRIVED_AT_DESTINATION_HUB event');
    });

    // -------------------------------------------------------------
    // TEST 7: Cross-Border Customs Lifecycle (SUBMIT -> INSPECT -> HOLD -> CLEAR -> RELEASE)
    // -------------------------------------------------------------
    await runTest('7. Cross-Border Customs Lifecycle: Full inspection, hold, exception, clearance, and release workflow', async () => {
        // Book a cross-border shipment (Nairobi -> Namanga Border -> Arusha Hub)
        const crossBorderShp = shipmentService.createShipment({
            origin_hub_id: hub1.id,
            destination_hub_id: hub2.id,
            sender: { name: 'Kenya Exporters', phone: '+254700999000', address: 'Nairobi', city: 'Nairobi' },
            recipient: { name: 'Tanzania Importers', phone: '+255700888000', address: 'Arusha Road', city: 'Arusha' },
            parcels: [{ weight_kg: 15.0, length_cm: 40, width_cm: 40, height_cm: 40 }],
            legs: [
                { origin_hub_id: hub1.id, destination_hub_id: hub2.id, is_cross_border: true, border_post_name: 'Namanga Border Post' }
            ]
        }, adminUser);

        const legs = shipmentService.getShipmentLegs(crossBorderShp.id);
        const crossBorderLeg = legs[0];
        assert.strictEqual(crossBorderLeg.is_cross_border, 1);

        // 1. Submit Customs Declaration
        const subResult = transportService.submitCustomsDeclaration(crossBorderLeg.id, {
            customs_doc_number: 'EAC-CUST-889900',
            border_post_name: 'Namanga One-Stop Border Post'
        }, adminUser);
        assert.strictEqual(subResult.customs_status, 'SUBMITTED');

        // 2. Customs Physical Inspection
        const inspectResult = transportService.inspectCustomsLeg(crossBorderLeg.id, {
            inspector_name: 'KRA Customs Officer M. Otieno'
        }, adminUser);
        assert.strictEqual(inspectResult.customs_status, 'INSPECTION');

        // 3. Customs Hold & Auto-Exception Generation
        const holdResult = transportService.holdCustomsLeg(crossBorderLeg.id, {
            reason: 'Phytosanitary permit verification required by KEPHIS'
        }, adminUser);
        assert.strictEqual(holdResult.customs_status, 'CUSTOMS_HOLD');

        // Verify exception created in database
        const exc = db.prepare("SELECT * FROM exceptions WHERE shipment_id = ? AND exception_type = 'CUSTOMS_HOLD'").get(crossBorderShp.id);
        assert.ok(exc, 'Customs hold must automatically spawn an operational exception record');
        assert.strictEqual(exc.severity, 'HIGH');

        // 4. Customs Clearance
        const clearResult = transportService.clearCustomsLeg(crossBorderLeg.id, {
            clearance_number: 'KEPHIS-VERIFIED-4411'
        }, adminUser);
        assert.strictEqual(clearResult.customs_status, 'CLEARED');

        // 5. Release from Border
        const releaseResult = transportService.releaseCustomsLeg(crossBorderLeg.id, adminUser);
        assert.strictEqual(releaseResult.customs_status, 'RELEASED');

        // Verify tracking timeline contains full customs audit trail
        const timeline = db.prepare('SELECT event_code FROM tracking_events WHERE shipment_id = ? ORDER BY id ASC').all(crossBorderShp.id);
        const eventCodes = timeline.map(e => e.event_code);
        assert.ok(eventCodes.includes('CUSTOMS_SUBMITTED'), 'Timeline must include CUSTOMS_SUBMITTED');
        assert.ok(eventCodes.includes('CUSTOMS_INSPECTION'), 'Timeline must include CUSTOMS_INSPECTION');
        assert.ok(eventCodes.includes('CUSTOMS_CLEARED'), 'Timeline must include CUSTOMS_CLEARED');
        assert.ok(eventCodes.includes('CUSTOMS_RELEASED'), 'Timeline must include CUSTOMS_RELEASED');
    });

    console.log(`\n============================================================`);
    console.log(`[SUCCESS] ALL ${passedTests}/${totalTests} MULTI-LEG & CUSTOMS TESTS PASSED!`);
    console.log(`============================================================\n`);
}

runSuite().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
