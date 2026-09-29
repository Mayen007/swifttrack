// tests/logistics/test-offline-sync.js
// SwiftTrack Logistics: Durable Offline Operations & Idempotent Replay Verification Suite
const assert = require('node:assert');
const crypto = require('node:crypto');
const { db } = require('../../server/db/database.js');
const shipmentService = require('../../server/services/shipmentService.js');
const custodyService = require('../../server/services/custodyService.js');
const deliveryExecutionService = require('../../server/services/deliveryExecutionService.js');
const offlineSyncService = require('../../server/services/offlineSyncService.js');

console.log('============================================================');
console.log('  SWIFTTRACK LOGISTICS: DURABLE OFFLINE OPERATIONS SUITE');
console.log('============================================================\n');

let passedTests = 0;
const totalTests = 7;

const adminUser = { id: 1, roleName: 'SUPER_ADMIN', fullName: 'Super Admin', branchId: 1 };
const dispatcherUser = { id: 4, roleName: 'DISPATCHER', fullName: 'Nairobi Dispatcher', branchId: 1 };
const driverUser = { id: 5, roleName: 'DRIVER', fullName: 'David Kamau', branchId: 1 };

let testDriver = db.prepare('SELECT * FROM drivers LIMIT 1').get();
let testVehicle = db.prepare('SELECT * FROM vehicles LIMIT 1').get();

try {
    const testDeviceId = 'PDA-ZEBRA-TEST-' + crypto.randomBytes(4).toString('hex');
    const appVersion = 'v2.4.1-field';

    // -------------------------------------------------------------
    // TEST 1: Offline Barcode Scan Operation (SCAN)
    // -------------------------------------------------------------
    console.log('> TEST 1: Ingesting Offline Barcode Scan with Durable Audit...');

    const shp1 = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Offline Client Ltd', phone: '+254711999888', address: 'Industrial Area', city: 'Nairobi' },
        recipient: { name: 'Mombasa Port Ops', phone: '+254722888777', address: 'Port Gate 2', city: 'Mombasa' },
        service_type: 'STANDARD',
        parcels: [{ weight_kg: 5.0, length_cm: 25, width_cm: 20, height_cm: 15, description: 'Spare Parts' }]
    }, adminUser);

    assert.strictEqual(shp1.status, 'BOOKED');

    const scanOpId = 'OP-SCAN-' + crypto.randomUUID();
    const batch1 = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            {
                operation_id: scanOpId,
                operation_type: 'SCAN',
                client_timestamp: new Date().toISOString(),
                payload: {
                    barcode: shp1.tracking_number,
                    scan_type: 'INTAKE',
                    hub_id: 1,
                    location_desc: 'Off-grid Warehouse Bay 4'
                }
            }
        ]
    };

    const res1 = offlineSyncService.processOfflineSyncBatch(batch1, adminUser);
    assert.strictEqual(res1.total_operations, 1);
    assert.strictEqual(res1.processed_count, 1);
    assert.strictEqual(res1.duplicate_count, 0);
    assert.strictEqual(res1.error_count, 0);
    assert.strictEqual(res1.operations[0].status, 'ACKNOWLEDGED');

    // Verify shipment transitioned to AT_ORIGIN_HUB
    const updatedShp1 = shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(updatedShp1.status, 'AT_ORIGIN_HUB');

    // Verify sync log entry exists
    const log1 = db.prepare('SELECT * FROM offline_sync_logs WHERE client_operation_id = ?').get(scanOpId);
    assert.ok(log1, 'offline_sync_logs must contain entry for client operation');
    assert.strictEqual(log1.status, 'PROCESSED');
    assert.strictEqual(log1.device_id, testDeviceId);

    passedTests++;
    console.log('[PASS] [PASS] 1. Offline Scan: Ingested, persisted to log, and shipment moved to AT_ORIGIN_HUB\n');

    // -------------------------------------------------------------
    // TEST 2: Offline Custody Transfer Operation (CUSTODY_HANDOFF)
    // -------------------------------------------------------------
    console.log('> TEST 2: Ingesting Offline Custody Transfer...');

    const handoffOpId = 'OP-HANDOFF-' + crypto.randomUUID();
    const batch2 = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            {
                operation_id: handoffOpId,
                operation_type: 'CUSTODY_HANDOFF',
                client_timestamp: new Date().toISOString(),
                payload: {
                    shipment_id: shp1.id,
                    hub_id: 1,
                    releasing_actor_type: 'AGENT',
                    releasing_actor_id: adminUser.id,
                    releasing_actor_name: adminUser.fullName,
                    receiving_actor_type: 'DRIVER',
                    receiving_actor_id: testDriver.id,
                    receiving_actor_name: 'David Kamau',
                    package_condition: 'GOOD',
                    notes: 'Offline transfer at loading dock'
                }
            }
        ]
    };

    const res2 = offlineSyncService.processOfflineSyncBatch(batch2, adminUser);
    assert.strictEqual(res2.processed_count, 1);
    assert.strictEqual(res2.operations[0].status, 'ACKNOWLEDGED');

    const log2 = db.prepare('SELECT * FROM offline_sync_logs WHERE client_operation_id = ?').get(handoffOpId);
    assert.ok(log2);
    assert.strictEqual(log2.status, 'PROCESSED');

    passedTests++;
    console.log('[PASS] [PASS] 2. Offline Custody Transfer: Successfully transferred physical custody off-network\n');

    // -------------------------------------------------------------
    // TEST 3: Offline Delivery Attempt (DELIVERY_ATTEMPT)
    // -------------------------------------------------------------
    console.log('> TEST 3: Ingesting Offline Delivery Attempt...');

    const shpDelivery = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 1,
        sender: { name: 'Fast Delivery Nairobi', phone: '+254711333444', address: 'Westlands', city: 'Nairobi' },
        recipient: { name: 'Grace M.', phone: '+254722555666', address: 'Riverside Drive 12', city: 'Nairobi' },
        service_type: 'EXPRESS',
        parcels: [{ weight_kg: 2.0, length_cm: 10, width_cm: 10, height_cm: 10, description: 'Medical Supplies' }]
    }, adminUser);

    const deliveryTask = deliveryExecutionService.createDeliveryTask({
        shipment_id: shpDelivery.id,
        priority: 'HIGH',
        max_attempts: 1
    }, dispatcherUser);

    deliveryExecutionService.assignDeliveryTask(deliveryTask.id, {
        driver_id: testDriver.id,
        vehicle_id: testVehicle.id
    }, dispatcherUser);

    deliveryExecutionService.startDelivery(deliveryTask.id, driverUser);

    // Verify shipment is OUT_FOR_DELIVERY
    const outShp = shipmentService.getShipmentById(shpDelivery.id);
    assert.strictEqual(outShp.status, 'OUT_FOR_DELIVERY');

    const attemptOpId = 'OP-ATTEMPT-' + crypto.randomUUID();
    const batch3 = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            {
                operation_id: attemptOpId,
                operation_type: 'DELIVERY_ATTEMPT',
                client_timestamp: new Date().toISOString(),
                payload: {
                    delivery_id: deliveryTask.id,
                    status: 'FAILED',
                    failure_reason: 'RECIPIENT_UNAVAILABLE',
                    failure_notes: 'Gate locked, no response to phone calls',
                    latitude: -1.268,
                    longitude: 36.805
                }
            }
        ]
    };

    const res3 = offlineSyncService.processOfflineSyncBatch(batch3, driverUser);
    assert.strictEqual(res3.processed_count, 1);
    assert.strictEqual(res3.operations[0].status, 'ACKNOWLEDGED');

    const updatedTask = deliveryExecutionService.getDeliveryById(deliveryTask.id);
    assert.strictEqual(updatedTask.attempt_count, 1);
    assert.strictEqual(updatedTask.status, 'RETURN_TO_HUB');

    const failedShp = shipmentService.getShipmentById(shpDelivery.id);
    assert.strictEqual(failedShp.status, 'DELIVERY_FAILED');

    passedTests++;
    console.log('[PASS] [PASS] 3. Offline Delivery Attempt: Recorded attempt, marked FAILED_ATTEMPT and DELIVERY_FAILED\n');

    // -------------------------------------------------------------
    // TEST 4: Idempotent Replay Deduplication
    // -------------------------------------------------------------
    console.log('> TEST 4: Verifying Idempotent Replay Deduplication...');

    // Combine previous operations into a single replay batch
    const replayBatch = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            batch1.operations[0],
            batch2.operations[0],
            batch3.operations[0]
        ]
    };

    const replayRes = offlineSyncService.processOfflineSyncBatch(replayBatch, adminUser);

    assert.strictEqual(replayRes.total_operations, 3);
    assert.strictEqual(replayRes.processed_count, 0, 'No new operations should be processed on replay');
    assert.strictEqual(replayRes.duplicate_count, 3, 'All 3 operations must be flagged DUPLICATE');
    assert.strictEqual(replayRes.error_count, 0);

    for (const op of replayRes.operations) {
        assert.strictEqual(op.status, 'DUPLICATE');
        assert.ok(op.server_id, 'Duplicate response must include original server log ID');
        assert.ok(op.result !== undefined, 'Duplicate response should provide cached result');
    }

    // Verify task attempt count did NOT increment again
    const taskAfterReplay = deliveryExecutionService.getDeliveryById(deliveryTask.id);
    assert.strictEqual(taskAfterReplay.attempt_count, 1, 'Attempt count must remain 1 after replay');

    passedTests++;
    console.log('[PASS] [PASS] 4. Idempotent Replay: Deduplicated 3/3 operations without side-effects or state mutation\n');

    // -------------------------------------------------------------
    // TEST 5: Driver Location Telemetry Sync (DRIVER_LOCATION)
    // -------------------------------------------------------------
    console.log('> TEST 5: Ingesting Offline Driver Location Telemetry...');

    const locationOpId = 'OP-LOC-' + crypto.randomUUID();
    const batchLoc = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            {
                operation_id: locationOpId,
                operation_type: 'DRIVER_LOCATION',
                client_timestamp: new Date().toISOString(),
                payload: {
                    latitude: -1.2921,
                    longitude: 36.8219
                }
            }
        ]
    };

    // Driver user id is 5, which corresponds to testDriver
    const resLoc = offlineSyncService.processOfflineSyncBatch(batchLoc, driverUser);
    assert.strictEqual(resLoc.processed_count, 1);
    assert.strictEqual(resLoc.operations[0].status, 'ACKNOWLEDGED');

    const updatedDriver = db.prepare('SELECT current_latitude, current_longitude FROM drivers WHERE id = ?').get(testDriver.id);
    assert.strictEqual(updatedDriver.current_latitude, -1.2921);
    assert.strictEqual(updatedDriver.current_longitude, 36.8219);

    passedTests++;
    console.log('[PASS] [PASS] 5. Location Telemetry: Successfully synchronized driver GPS location offline\n');

    // -------------------------------------------------------------
    // TEST 6: Validation, Rejection, and Error Isolation
    // -------------------------------------------------------------
    console.log('> TEST 6: Testing Validation Rejections & Fault Isolation...');

    const badBatch = {
        device_id: testDeviceId,
        app_version: appVersion,
        operations: [
            {
                // Missing operation_id
                operation_type: 'SCAN',
                payload: { barcode: 'XYZ' }
            },
            {
                // Invalid operation type
                operation_id: 'OP-INVALID-' + crypto.randomUUID(),
                operation_type: 'UNSUPPORTED_TYPE',
                payload: {}
            }
        ]
    };

    const resBad = offlineSyncService.processOfflineSyncBatch(badBatch, adminUser);
    assert.strictEqual(resBad.total_operations, 2);
    assert.strictEqual(resBad.processed_count, 0);
    assert.strictEqual(resBad.error_count, 2);

    assert.strictEqual(resBad.operations[0].status, 'REJECTED');
    assert.strictEqual(resBad.operations[1].status, 'FAILED');

    passedTests++;
    console.log('[PASS] [PASS] 6. Fault Isolation: Handled missing IDs and invalid types without crashing batch\n');

    // -------------------------------------------------------------
    // TEST 7: Offline Sync Stats & Reporting
    // -------------------------------------------------------------
    console.log('> TEST 7: Checking Offline Sync Statistics API...');

    const stats = offlineSyncService.getOfflineSyncStats(testDeviceId);
    assert.ok(stats.stats && Array.isArray(stats.stats));
    assert.ok(stats.recent && Array.isArray(stats.recent));

    const totalProcessed = stats.stats
        .filter(s => s.status === 'PROCESSED')
        .reduce((sum, s) => sum + s.total_count, 0);
    assert.ok(totalProcessed >= 3, `Expected at least 3 processed ops, got ${totalProcessed}`);

    passedTests++;
    console.log('[PASS] [PASS] 7. Offline Stats: Accurate telemetry aggregation by device and operation type\n');

    console.log('============================================================');
    console.log(`[SUCCESS] ALL ${passedTests}/${totalTests} OFFLINE SYNC TESTS PASSED!`);
    console.log('============================================================\n');

} catch (err) {
    console.error('\n[FAIL] TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
}
