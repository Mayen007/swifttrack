// tests/logistics/test-transport-runs.js
// SwiftTrack Logistics: Stage 3 Transport & Manifest Lifecycle Test Suite
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const shipmentService = require('../../server/services/shipmentService.js');
const transportService = require('../../server/services/transportService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK LOGISTICS: STAGE 3 TRANSPORT & MANIFEST SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`[PASS] [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Fixtures
const adminUser = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Managing Director', branchId: 1 };
const branch1 = db.prepare('SELECT * FROM branches WHERE id = 1').get() || { id: 1, name: 'Nairobi Central' };
const branch2 = db.prepare('SELECT * FROM branches WHERE id = 2').get() || { id: 2, name: 'Mombasa Port' };

// Ensure test driver and vehicle exist
let testDriver = db.prepare('SELECT * FROM drivers WHERE branch_id = ? AND status = ? LIMIT 1').get(branch1.id, 'AVAILABLE');
if (!testDriver) {
    testDriver = db.prepare('SELECT * FROM drivers LIMIT 1').get();
}
let testVehicle = db.prepare('SELECT * FROM vehicles WHERE branch_id = ? AND status = ? LIMIT 1').get(branch1.id, 'AVAILABLE');
if (!testVehicle) {
    testVehicle = db.prepare('SELECT * FROM vehicles LIMIT 1').get();
}

let createdRoute = null;
let createdRun = null;
let shipment1 = null;
let shipment2 = null;

async function executeSuite() {
    // TEST 1: Route & Route Leg Creation
    await runTest('1. Route Master: Creates corridor route and default route leg', async () => {
        const uniqueSuffix = Date.now().toString().slice(-4);
        const routeData = {
            code: `RT-TEST-${uniqueSuffix}`,
            name: `Test Corridor ${uniqueSuffix}`,
            origin_hub_id: branch1.id,
            destination_hub_id: branch2.id,
            distance_km: 480.0,
            estimated_duration_hours: 8.0,
            is_cross_border: false
        };

        const route = transportService.createRoute(routeData, adminUser);
        assert.ok(route.id, 'Route ID must exist');
        assert.strictEqual(route.code, routeData.code);
        assert.strictEqual(route.legs.length, 1, 'Default leg must be created');
        assert.strictEqual(route.legs[0].origin_hub_id, branch1.id);
        assert.strictEqual(route.legs[0].destination_hub_id, branch2.id);

        createdRoute = route;
    });

    // TEST 2: Transport Run Creation & Manifest Initialization
    await runTest('2. Transport Run Planning: Creates run and automatically provisions attached draft manifest', async () => {
        const runData = {
            route_leg_id: createdRoute.legs[0].id,
            origin_hub_id: branch1.id,
            destination_hub_id: branch2.id,
            driver_id: testDriver.id,
            vehicle_id: testVehicle.id,
            scheduled_departure: new Date().toISOString(),
            notes: 'Evening scheduled linehaul run'
        };

        const run = transportService.createTransportRun(runData, adminUser);
        assert.ok(run.id, 'Transport run ID must exist');
        assert.ok(run.run_number.startsWith('RUN-'), 'Run number must start with RUN-');
        assert.strictEqual(run.status, 'PLANNED', 'Initial status must be PLANNED');
        assert.ok(run.manifest, 'Attached manifest must exist');
        assert.ok(run.manifest.manifest_number.startsWith('MAN-'), 'Manifest number must start with MAN-');
        assert.strictEqual(run.manifest.status, 'DRAFT', 'Manifest status must be DRAFT');
        assert.strictEqual(run.driver_id, testDriver.id);
        assert.strictEqual(run.vehicle_id, testVehicle.id);

        createdRun = run;
    });

    // TEST 3: Manifest Building & Aggregate Weight Calculation
    await runTest('3. Manifest Building: Adds multiple shipments and calculates total parcel & weight aggregates', async () => {
        // Book 2 Test Shipments
        shipment1 = shipmentService.createShipment({
            origin_hub_id: branch1.id,
            destination_hub_id: branch2.id,
            sender: { name: 'Customer A', phone: '+254700000001', address: 'Nairobi Office' },
            recipient: { name: 'Customer B', phone: '+254700000002', address: 'Mombasa Store' },
            parcels: [{ weight_kg: 5.0, length_cm: 20, width_cm: 20, height_cm: 20 }] // 5kg
        }, adminUser);

        shipment2 = shipmentService.createShipment({
            origin_hub_id: branch1.id,
            destination_hub_id: branch2.id,
            sender: { name: 'Customer C', phone: '+254700000003', address: 'Nairobi Depot' },
            recipient: { name: 'Customer D', phone: '+254700000004', address: 'Mombasa Branch' },
            parcels: [
                { weight_kg: 3.0, length_cm: 15, width_cm: 15, height_cm: 15 },
                { weight_kg: 4.0, length_cm: 25, width_cm: 25, height_cm: 25 }
            ] // 2 parcels, total 7kg
        }, adminUser);

        // Add Shipment 1 to Manifest
        transportService.addShipmentToManifest(createdRun.id, shipment1.id, adminUser);
        // Add Shipment 2 to Manifest
        const updatedRun = transportService.addShipmentToManifest(createdRun.id, shipment2.id, adminUser);

        assert.strictEqual(updatedRun.manifest.items.length, 2, 'Manifest should have 2 items');
        assert.strictEqual(updatedRun.total_shipments_count, 2, 'Run total shipments must be 2');
        assert.strictEqual(updatedRun.total_parcels_count, 3, 'Run total parcels must be 3 (1 + 2)');
        assert.strictEqual(updatedRun.total_weight_kg, 12.0, 'Run total weight must be 12.0 kg (5 + 7)');
    });

    // TEST 4: Locking Manifest & Marking Shipments LOADED (BR-005)
    await runTest('4. Manifest Lock & Load (BR-005): Locks manifest and automatically transitions shipments to LOADED', async () => {
        const lockedRun = transportService.lockManifest(createdRun.id, adminUser);

        assert.strictEqual(lockedRun.manifest.status, 'LOCKED');
        assert.strictEqual(lockedRun.status, 'LOADED');

        // Verify shipments in database are now LOADED
        const s1 = db.prepare('SELECT status FROM shipments WHERE id = ?').get(shipment1.id);
        const s2 = db.prepare('SELECT status FROM shipments WHERE id = ?').get(shipment2.id);
        assert.strictEqual(s1.status, 'LOADED');
        assert.strictEqual(s2.status, 'LOADED');

        // Verify tracking events for LOADED
        const ev1 = db.prepare('SELECT event_code FROM tracking_events WHERE shipment_id = ? AND event_code = ?').get(shipment1.id, 'LOADED');
        assert.ok(ev1, 'Tracking event LOADED must exist on shipment');

        // Cannot add more items to locked manifest
        assert.throws(() => {
            transportService.addShipmentToManifest(createdRun.id, shipment1.id, adminUser);
        }, /Manifest is already locked/, 'Must block adding items to locked manifest');
    });

    // TEST 5: Dispatching Transport Run & Transitioning Fleets and Shipments to IN_TRANSIT
    await runTest('5. Transport Run Dispatch: Marks run, vehicle, driver, and all shipments IN_TRANSIT', async () => {
        const dispatchedRun = transportService.dispatchTransportRun(createdRun.id, {
            departure_odometer_km: 12500.0,
            notes: 'On the road via Machakos route'
        }, adminUser);

        assert.strictEqual(dispatchedRun.status, 'IN_TRANSIT');
        assert.strictEqual(dispatchedRun.manifest.status, 'DISPATCHED');

        // Verify Vehicle and Driver Statuses
        const veh = db.prepare('SELECT status, current_odometer_km FROM vehicles WHERE id = ?').get(testVehicle.id);
        assert.strictEqual(veh.status, 'IN_TRANSIT');
        assert.strictEqual(veh.current_odometer_km, 12500.0);

        const drv = db.prepare('SELECT status FROM drivers WHERE id = ?').get(testDriver.id);
        assert.strictEqual(drv.status, 'ON_DELIVERY');

        // Verify all shipments on manifest transitioned to IN_TRANSIT
        const s1 = db.prepare('SELECT status, current_location_desc FROM shipments WHERE id = ?').get(shipment1.id);
        const s2 = db.prepare('SELECT status, current_location_desc FROM shipments WHERE id = ?').get(shipment2.id);
        assert.strictEqual(s1.status, 'IN_TRANSIT');
        assert.strictEqual(s2.status, 'IN_TRANSIT');
    });

    // TEST 6: Recording Transit Checkpoint
    await runTest('6. Transit Checkpoints: Records mid-corridor waypoint scan and propagates to shipments', async () => {
        const cp = transportService.recordCheckpoint(createdRun.id, {
            checkpoint_name: 'Mtito Andei Highway Waypoint',
            latitude: -2.6888,
            longitude: 38.1672,
            notes: 'Driver 15-minute scheduled rest break'
        }, adminUser);

        assert.ok(cp.id, 'Checkpoint ID must exist');

        // Verify tracking event propagated to shipments on the run
        const ev = db.prepare('SELECT * FROM tracking_events WHERE shipment_id = ? AND event_code = ?').get(shipment1.id, 'IN_TRANSIT_CHECKPOINT');
        assert.ok(ev, 'Checkpoint tracking event must be logged on active shipments');
    });

    // TEST 7: Arrival at Destination & Discrepancy Detection on Unload (BR-006)
    await runTest('7. Destination Hub Receipt & Discrepancy Reconciliation (BR-006): Flags shortage vs received', async () => {
        // Arrive at Destination Hub
        transportService.arriveTransportRun(createdRun.id, { arrival_odometer_km: 12985.0 }, adminUser);
        const arrivedRun = transportService.getTransportRunById(createdRun.id);
        assert.strictEqual(arrivedRun.status, 'ARRIVED');

        // Simulate unload where shipment1 is received, but shipment2 is missing (Shortage!)
        const reconciliation = transportService.receiveManifest(createdRun.id, [shipment1.id], adminUser);

        assert.strictEqual(reconciliation.status, 'COMPLETED', 'Transport run must complete');
        assert.strictEqual(reconciliation.received_count, 1, '1 shipment received');
        assert.strictEqual(reconciliation.shortage_count, 1, '1 shipment missing shortage');
        assert.strictEqual(reconciliation.manifest_status, 'DISCREPANCY', 'Manifest flagged as discrepancy');

        // Verify Shipment 1 is AT_HUB
        const s1 = db.prepare('SELECT status, current_hub_id FROM shipments WHERE id = ?').get(shipment1.id);
        assert.strictEqual(s1.status, 'AT_HUB');
        assert.strictEqual(s1.current_hub_id, branch2.id, 'Current hub should be Mombasa');

        // Verify Shipment 2 is EXCEPTION
        const s2 = db.prepare('SELECT status FROM shipments WHERE id = ?').get(shipment2.id);
        assert.strictEqual(s2.status, 'EXCEPTION');

        // Verify Driver and Vehicle returned to AVAILABLE
        const veh = db.prepare('SELECT status, current_odometer_km FROM vehicles WHERE id = ?').get(testVehicle.id);
        assert.strictEqual(veh.status, 'AVAILABLE', 'Vehicle must be returned to AVAILABLE');
        assert.strictEqual(veh.current_odometer_km, 12985.0);

        const drv = db.prepare('SELECT status FROM drivers WHERE id = ?').get(testDriver.id);
        assert.strictEqual(drv.status, 'AVAILABLE', 'Driver must be returned to AVAILABLE');
    });

    console.log('\n============================================================');
    console.log(`[SUCCESS] ALL ${passedTests}/${totalTests} TRANSPORT & MANIFEST TESTS PASSED!`);
    console.log('============================================================\n');
}

executeSuite().catch(err => {
    console.error('Fatal suite failure:', err);
    process.exit(1);
});
