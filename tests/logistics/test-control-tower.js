// tests/logistics/test-control-tower.js
// SwiftTrack Logistics: Stage 8 Operations Control Tower & Network Telemetry Test Suite
const assert = require('node:assert');
const { db } = require('../../server/db/database.js');
const controlTowerService = require('../../server/services/controlTowerService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const transportService = require('../../server/services/transportService.js');
const custodyService = require('../../server/services/custodyService.js');
const deliveryExecutionService = require('../../server/services/deliveryExecutionService.js');
const codService = require('../../server/services/codService.js');

console.log('============================================================');
console.log('🗼  SWIFTTRACK LOGISTICS: STAGE 8 OPERATIONS CONTROL TOWER');
console.log('============================================================\n');

let passedTests = 0;
const totalTests = 10;

// Test Actors
const superAdmin = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Super Admin', branchId: 1 };
const managerNairobi = { id: 2, roleName: 'BRANCH_MANAGER', username: 'manager.nairobi', fullName: 'David Ochieng', branchId: 1 };
const dispatcherNairobi = { id: 3, roleName: 'DISPATCHER', username: 'dispatcher.nairobi', fullName: 'Faith Wanjiku', branchId: 1 };

const testDriver = db.prepare('SELECT * FROM drivers LIMIT 1').get();
const testVehicle = db.prepare('SELECT * FROM vehicles LIMIT 1').get();

try {
    // -------------------------------------------------------------
    // TEST 1: Global Live Operational Telemetry Summary
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Global Live Operational Telemetry Summary ("What is happening now?")...');
    const summary = controlTowerService.getLiveOperationalSummary({}, superAdmin);

    assert.ok(summary, 'Summary must be returned');
    assert.strictEqual(summary.is_global, true, 'Super Admin summary must be global');
    assert.ok(summary.now, 'Summary must contain now section');
    assert.ok(summary.now.lifecycle, 'Summary must contain lifecycle breakdown');
    assert.ok(typeof summary.now.total_shipments_recorded === 'number');
    assert.ok(typeof summary.now.volume.total_parcels === 'number');
    assert.ok(typeof summary.now.volume.total_weight_kg === 'number');
    assert.ok(typeof summary.now.volume.freight_revenue_kes === 'number');
    console.log(`  ✔ Global summary: Total Shipments Recorded: ${summary.now.total_shipments_recorded}, Active: ${summary.now.active_pipeline_shipments}, Total Weight: ${summary.now.volume.total_weight_kg} kg`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 2: Network Performance KPIs & Rates
    // -------------------------------------------------------------
    console.log('▶ TEST 2: Network Performance KPIs (Delivery Success, COD Reconciliation)...');
    assert.ok(summary.performance, 'Performance section must exist');
    assert.ok(typeof summary.performance.delivery_success_rate_pct === 'number', 'Delivery success rate must be a number');
    assert.ok(summary.performance.delivery_success_rate_pct >= 0 && summary.performance.delivery_success_rate_pct <= 100);
    assert.ok(typeof summary.performance.cod_reconciliation_rate_pct === 'number', 'COD reconciliation rate must be a number');
    assert.ok(typeof summary.performance.avg_delivery_attempts === 'number');
    console.log(`  ✔ Performance KPIs: Delivery Success: ${summary.performance.delivery_success_rate_pct}%, COD Recon: ${summary.performance.cod_reconciliation_rate_pct}%, Avg Attempts: ${summary.performance.avg_delivery_attempts}`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 3: Branch-Scoped Telemetry Isolation
    // -------------------------------------------------------------
    console.log('▶ TEST 3: Branch-Scoped Telemetry (Hub Isolation for Branch Managers)...');
    const branch1Summary = controlTowerService.getLiveOperationalSummary({}, managerNairobi);
    assert.strictEqual(branch1Summary.is_global, false);
    assert.strictEqual(branch1Summary.scoped_hub_id, 1, 'Manager Nairobi must be scoped to Hub 1');
    assert.ok(branch1Summary.now.total_shipments_recorded <= summary.now.total_shipments_recorded);
    console.log(`  ✔ Branch isolation verified: Hub 1 active volume: ${branch1Summary.now.active_pipeline_shipments} (strictly isolated from network total)`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 4: Actionable Alerts Generation ("What needs attention?")
    // -------------------------------------------------------------
    console.log('▶ TEST 4: Actionable Alerts Generation ("What needs attention?")...');
    
    // Inject a test physical discrepancy
    const testShipment = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'CT Sender', phone: '+254711888999', address: 'CBD', city: 'Nairobi' },
        recipient: { name: 'CT Recipient', phone: '+254722888999', address: 'Nyali', city: 'Mombasa' },
        parcels: [{ weight_kg: 2.5, length_cm: 20, width_cm: 20, height_cm: 15 }]
    }, superAdmin);

    const testDiscrepancy = custodyService.createDiscrepancy({
        discrepancy_type: 'MANIFEST_SHORTAGE',
        severity: 'HIGH',
        shipment_id: testShipment.id,
        hub_id: 1,
        description: 'Package listed on manifest but not found in receiving cage'
    }, dispatcherNairobi);

    const alertsData = controlTowerService.getOperationalAlerts({}, superAdmin);
    assert.ok(alertsData.total_alerts > 0, 'Alerts queue must not be empty');
    assert.ok(alertsData.alerts.some(a => a.id === `DISC-${testDiscrepancy.id}`), 'Created discrepancy must appear in alerts queue');
    
    const discAlert = alertsData.alerts.find(a => a.id === `DISC-${testDiscrepancy.id}`);
    assert.strictEqual(discAlert.severity, 'HIGH');
    assert.strictEqual(discAlert.category, 'PHYSICAL_DISCREPANCY');
    assert.strictEqual(discAlert.entity_id, testDiscrepancy.id);
    assert.ok(discAlert.action_prompt, 'Action prompt must be present');
    console.log(`  ✔ Alert queue verified: ${alertsData.total_alerts} alerts detected (${alertsData.critical_count} Critical, ${alertsData.high_count} High)`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 5: Alert Filtering by Severity
    // -------------------------------------------------------------
    console.log('▶ TEST 5: Alert Queue Filtering by Severity...');
    const highAlerts = controlTowerService.getOperationalAlerts({ severity: 'HIGH' }, superAdmin);
    assert.ok(highAlerts.alerts.every(a => a.severity === 'HIGH'), 'All returned alerts must have severity HIGH');
    console.log(`  ✔ Filtered HIGH severity alerts: ${highAlerts.total_alerts} items returned`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 6: Active Transport Corridors & In-Transit Telemetry
    // -------------------------------------------------------------
    console.log('▶ TEST 6: Active Transport Corridors & In-Transit Telemetry ("What is moving?")...');
    
    // Create an active transport run
    const route = db.prepare('SELECT * FROM routes WHERE origin_hub_id = 1 AND destination_hub_id = 2 LIMIT 1').get() ||
        transportService.createRoute({
            code: 'NRB-MSA-CT',
            name: 'Nairobi to Mombasa Express Corridor',
            origin_hub_id: 1,
            destination_hub_id: 2,
            distance_km: 485,
            estimated_duration_hours: 8
        }, superAdmin);

    const routeLeg = db.prepare('SELECT * FROM route_legs WHERE route_id = ? LIMIT 1').get(route.id);

    const run = transportService.createTransportRun({
        route_leg_id: routeLeg.id,
        origin_hub_id: 1,
        destination_hub_id: 2,
        driver_id: testDriver.id,
        vehicle_id: testVehicle.id,
        scheduled_departure: new Date().toISOString()
    }, dispatcherNairobi);

    // Add shipment to manifest, lock manifest, and dispatch the run
    transportService.addShipmentToManifest(run.id, testShipment.id, dispatcherNairobi);
    transportService.lockManifest(run.manifest.id, { notes: 'Manifest locked for CT test' }, dispatcherNairobi);
    transportService.dispatchTransportRun(run.id, { departure_odometer_km: 120500 }, dispatcherNairobi);

    const corridorsData = controlTowerService.getActiveCorridorTelemetry(superAdmin);
    assert.ok(corridorsData.total_active_runs > 0, 'Active runs must be detected');
    assert.ok(corridorsData.runs.some(r => r.id === run.id), 'Dispatched run must appear in active runs list');

    const activeRun = corridorsData.runs.find(r => r.id === run.id);
    assert.strictEqual(activeRun.status, 'IN_TRANSIT');
    assert.strictEqual(activeRun.plate_number, testVehicle.registration_number);
    assert.ok(corridorsData.corridors.length > 0, 'Corridor summaries must be aggregated');
    console.log(`  ✔ Active transport telemetry: ${corridorsData.total_active_runs} runs active across ${corridorsData.corridors.length} corridors`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 7: Station-by-Station Hub Network Telemetry
    // -------------------------------------------------------------
    console.log('▶ TEST 7: Station-by-Station Hub Network Telemetry...');
    const hubTelemetry = controlTowerService.getHubNetworkTelemetry(superAdmin);
    assert.ok(hubTelemetry.hubs_count >= 2, 'Must report on at least 2 hubs');
    
    const nairobiHub = hubTelemetry.hubs.find(h => h.hub_code === 'NRB-HQ');
    assert.ok(nairobiHub, 'Nairobi Central Hub must be reported');
    assert.ok(typeof nairobiHub.on_hand_shipments === 'number');
    assert.ok(typeof nairobiHub.inbound_shipments === 'number');
    assert.ok(typeof nairobiHub.outbound_shipments === 'number');
    assert.ok(typeof nairobiHub.open_discrepancies === 'number');
    console.log(`  ✔ Station telemetry: Hub ${nairobiHub.hub_code}: ${nairobiHub.on_hand_shipments} on-hand (${nairobiHub.on_hand_weight_kg} kg), ${nairobiHub.inbound_shipments} inbound, ${nairobiHub.open_discrepancies} open alerts`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 8: Fast-Resolution of Discrepancy Alert via Control Tower
    // -------------------------------------------------------------
    console.log('▶ TEST 8: Fast-Resolution of Discrepancy Alert via Control Tower...');
    const resolveResult = controlTowerService.resolveAlert('DISCREPANCY', testDiscrepancy.id, {
        action: 'SHORTAGE_CONFIRMED_INSURANCE_FILED',
        notes: 'Carton misplaced at origin loading dock; insurance claim filed by dispatcher'
    }, dispatcherNairobi);

    assert.strictEqual(resolveResult.success, true);
    
    // Verify discrepancy status updated to RESOLVED
    const updatedDisc = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(testDiscrepancy.id);
    assert.strictEqual(updatedDisc.status, 'RESOLVED');
    assert.ok(updatedDisc.resolved_at);

    // Verify it drops off the active alerts list
    const updatedAlerts = controlTowerService.getOperationalAlerts({}, superAdmin);
    assert.ok(!updatedAlerts.alerts.some(a => a.id === `DISC-${testDiscrepancy.id}`), 'Resolved discrepancy must drop off active alert queue');
    console.log('  ✔ Discrepancy successfully resolved from Control Tower and evicted from active alert queue');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 9: Acknowledgment of Delivery Failure Alert
    // -------------------------------------------------------------
    console.log('▶ TEST 9: Acknowledgment of Delivery Failure Alert...');
    
    // Create shipment and delivery task that fails
    const failShipment = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 1,
        sender: { name: 'Sender D', phone: '+254711333444', address: 'CBD', city: 'Nairobi' },
        recipient: { name: 'Recipient E', phone: '+254722333444', address: 'Industrial Area', city: 'Nairobi' },
        parcels: [{ weight_kg: 1.0, length_cm: 10, width_cm: 10, height_cm: 10 }]
    }, superAdmin);

    const failDelivery = deliveryExecutionService.createDeliveryTask({
        shipment_id: failShipment.id,
        destination_address: 'Industrial Area Gate 3',
        destination_city: 'Nairobi',
        max_attempts: 1
    }, superAdmin);

    deliveryExecutionService.assignDeliveryTask(failDelivery.id, {
        driver_id: testDriver.id,
        vehicle_id: testVehicle.id
    }, superAdmin);

    // Record failed attempt reaching max_attempts -> transitions to RETURN_TO_HUB
    deliveryExecutionService.recordDeliveryAttempt(failDelivery.id, {
        status: 'FAILED',
        failure_reason: 'PREMISES_CLOSED',
        failure_notes: 'Gate locked after business hours'
    }, superAdmin);

    // Verify delivery alert exists
    const alertsBefore = controlTowerService.getOperationalAlerts({}, superAdmin);
    const delAlert = alertsBefore.alerts.find(a => a.id === `DLV-${failDelivery.id}`);
    assert.ok(delAlert, 'Failed delivery must generate an operational alert');
    assert.strictEqual(delAlert.severity, 'CRITICAL');

    // Acknowledge alert
    const ackResult = controlTowerService.resolveAlert('DELIVERY', failDelivery.id, {
        notes: 'Rescheduling delivery for tomorrow 09:00 AM'
    }, dispatcherNairobi);
    assert.strictEqual(ackResult.success, true);
    console.log(`  ✔ Delivery failure alert acknowledged with rescheduling notes`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 10: Public Customer Milestone Tracking (PRD Section 21)
    // -------------------------------------------------------------
    console.log('▶ TEST 10: Public Customer Milestone Tracking Lookup...');
    const pubTracking = shipmentService.getPublicTracking(testShipment.tracking_number);
    assert.ok(pubTracking, 'Tracking data must be returned');
    assert.strictEqual(pubTracking.tracking_number, testShipment.tracking_number);
    assert.ok(pubTracking.origin.city, 'Origin city must be present');
    assert.ok(pubTracking.destination.city, 'Destination city must be present');
    assert.ok(Array.isArray(pubTracking.timeline), 'Timeline milestones must be array');
    assert.ok(pubTracking.timeline.length > 0, 'Timeline must have at least one milestone');
    
    // Ensure PII is stripped: sender/recipient phone & street addresses must NOT be exposed
    assert.strictEqual(pubTracking.sender_phone, undefined, 'Sender phone must not be exposed');
    assert.strictEqual(pubTracking.recipient_phone, undefined, 'Recipient phone must not be exposed');
    assert.strictEqual(pubTracking.sender_address, undefined, 'Sender address must not be exposed');
    assert.strictEqual(pubTracking.recipient_address, undefined, 'Recipient address must not be exposed');
    console.log(`  ✔ Public customer tracking verified for ${pubTracking.tracking_number} with PII stripped and ${pubTracking.timeline.length} milestones`);
    passedTests++;

    console.log('\n============================================================');
    console.log(`✅  ALL ${passedTests}/${totalTests} CONTROL TOWER TESTS PASSED!`);
    console.log('============================================================\n');
} catch (error) {
    console.error('\n❌  TEST FAILED WITH EXCEPTION:', error);
    process.exit(1);
}
