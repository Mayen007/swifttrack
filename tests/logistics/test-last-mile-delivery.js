// tests/logistics/test-last-mile-delivery.js
// SwiftTrack Logistics: Stage 5 Last-Mile Delivery, Attempts, POD & Exceptions Verification Suite
const assert = require('node:assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const shipmentService = require('../../server/services/shipmentService.js');
const deliveryExecutionService = require('../../server/services/deliveryExecutionService.js');

async function runSuite() {
    console.log('============================================================');
    console.log('  SWIFTTRACK LOGISTICS: STAGE 5 LAST-MILE DELIVERY SUITE');
    console.log('============================================================\n');

    let passedTests = 0;
    const totalTests = 9;

    const adminUser = { id: 1, roleName: 'SUPER_ADMIN', fullName: 'Super Admin', branchId: 1 };
    const dispatcherUser = { id: 4, roleName: 'DISPATCHER', fullName: 'Nairobi Dispatcher', branchId: 1 };
    const driverUser = { id: 5, roleName: 'DRIVER', fullName: 'David Kamau', branchId: 1 };

    let testDriver = await dbAdapter.get('SELECT * FROM drivers WHERE user_id = ?', [driverUser.id]) || await dbAdapter.get('SELECT * FROM drivers LIMIT 1');
    let testVehicle = await dbAdapter.get('SELECT * FROM vehicles WHERE branch_id = 1 LIMIT 1') || await dbAdapter.get('SELECT * FROM vehicles LIMIT 1');

    // -------------------------------------------------------------
    // TEST 1: Delivery Task Creation Linked to Shipment
    // -------------------------------------------------------------
    console.log('> TEST 1: Delivery Task Creation Linked to Shipment...');

    const shp1 = await shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 1,
        sender: { name: 'Safaricom HQ', phone: '+254722000000', address: 'Waiyaki Way', city: 'Nairobi' },
        recipient: { name: 'Mary Wanjiku', phone: '+254711223344', address: 'Apartment 4B, Kilimani Rd', city: 'Nairobi' },
        service_type: 'SAME_DAY',
        parcels: [{ weight_kg: 1.5, length_cm: 15, width_cm: 15, height_cm: 10, description: 'Smartphone' }]
    }, adminUser);

    const deliveryTask = await deliveryExecutionService.createDeliveryTask({
        shipment_id: shp1.id,
        priority: 'HIGH',
        max_attempts: 3,
        pod_required_methods: 'SIGNATURE,GPS'
    }, dispatcherUser);

    assert.ok(deliveryTask.id, 'Delivery task should have an ID');
    assert.ok(deliveryTask.delivery_number.startsWith('DEL-'), 'Delivery number must start with DEL-');
    assert.strictEqual(deliveryTask.status, 'PENDING_ASSIGNMENT');
    assert.strictEqual(deliveryTask.recipient_name, 'Mary Wanjiku');
    assert.strictEqual(deliveryTask.destination_address, 'Apartment 4B, Kilimani Rd');
    assert.strictEqual(deliveryTask.attempt_count, 0);

    // Verify shipment transitioned to READY_FOR_DELIVERY
    const updatedShp1 = await shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(updatedShp1.status, 'READY_FOR_DELIVERY');

    // Verify tracking event
    const event = updatedShp1.timeline.find(e => e.event_code === 'DELIVERY_CREATED');
    assert.ok(event, 'Shipment timeline must include DELIVERY_CREATED event');

    passedTests++;
    console.log('[PASS] [PASS] 1. Delivery Task Creation: Linked to shipment and scheduled for destination\n');

    // -------------------------------------------------------------
    // TEST 2: Dispatcher Assignment to Driver and Vehicle
    // -------------------------------------------------------------
    console.log('> TEST 2: Dispatcher Assignment to Driver and Vehicle...');

    const assignedTask = await deliveryExecutionService.assignDeliveryTask(deliveryTask.id, {
        driver_id: testDriver.id,
        vehicle_id: testVehicle.id
    }, dispatcherUser);

    assert.strictEqual(assignedTask.status, 'ASSIGNED');
    assert.strictEqual(assignedTask.driver_id, testDriver.id);
    assert.strictEqual(assignedTask.vehicle_id, testVehicle.id);

    // Verify tracking event
    const shpAssigned = await shipmentService.getShipmentById(shp1.id);
    const assignEvent = shpAssigned.timeline.find(e => e.event_code === 'DELIVERY_ASSIGNED');
    assert.ok(assignEvent, 'Shipment timeline must include DELIVERY_ASSIGNED event');

    passedTests++;
    console.log('[PASS] [PASS] 2. Driver & Vehicle Assignment: Successfully assigned and tracked\n');

    // -------------------------------------------------------------
    // TEST 3: Driver Starts Delivery Run
    // -------------------------------------------------------------
    console.log('> TEST 3: Driver Starts Delivery Run...');

    const startedTask = await deliveryExecutionService.startDelivery(deliveryTask.id, driverUser);

    assert.strictEqual(startedTask.status, 'IN_TRANSIT');

    // Verify shipment transitioned to OUT_FOR_DELIVERY
    const shpStarted = await shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(shpStarted.status, 'OUT_FOR_DELIVERY');

    const outEvent = shpStarted.timeline.find(e => e.event_code === 'OUT_FOR_DELIVERY');
    assert.ok(outEvent, 'Shipment timeline must include OUT_FOR_DELIVERY event');

    passedTests++;
    console.log('[PASS] [PASS] 3. Out for Delivery: Driver started delivery and synchronized shipment state\n');

    // -------------------------------------------------------------
    // TEST 4: Failed Delivery Attempt Requires Reason (Rule BR-008)
    // -------------------------------------------------------------
    console.log('> TEST 4: Failed Delivery Attempt Requires Reason (Rule BR-008)...');

    let reasonValidationBlocked = false;
    try {
        await deliveryExecutionService.recordDeliveryAttempt(deliveryTask.id, {
            status: 'FAILED'
            // Missing failure_reason
        }, driverUser);
    } catch (err) {
        reasonValidationBlocked = err.message.includes('BR-008 Violation');
    }
    assert.strictEqual(reasonValidationBlocked, true, 'Rule BR-008: Must throw error if failure_reason is omitted');

    // Record legitimate Attempt #1
    const attempt1Result = await deliveryExecutionService.recordDeliveryAttempt(deliveryTask.id, {
        status: 'FAILED',
        failure_reason: 'RECIPIENT_UNAVAILABLE',
        failure_notes: 'Phone rang with no answer, security guard said recipient not at home',
        latitude: -1.2921,
        longitude: 36.8219
    }, driverUser);

    assert.strictEqual(attempt1Result.attempt.attempt_number, 1);
    assert.strictEqual(attempt1Result.attempt.status, 'FAILED');
    assert.strictEqual(attempt1Result.attempt.failure_reason, 'RECIPIENT_UNAVAILABLE');
    assert.strictEqual(attempt1Result.delivery.attempt_count, 1);
    assert.strictEqual(attempt1Result.delivery.status, 'RESCHEDULED');

    // Verify tracking event
    const shpAttempt1 = await shipmentService.getShipmentById(shp1.id);
    const attemptEvent = shpAttempt1.timeline.find(e => e.event_code === 'DELIVERY_ATTEMPT_FAILED');
    assert.ok(attemptEvent, 'Timeline must include DELIVERY_ATTEMPT_FAILED event');

    passedTests++;
    console.log('[PASS] [PASS] 4. Failed Attempt Validation: Enforces BR-008 reason requirement & rescheduling\n');

    // -------------------------------------------------------------
    // TEST 5: Multi-Attempt Threshold & Auto-Exception (Rule EXC-005)
    // -------------------------------------------------------------
    console.log('> TEST 5: Multi-Attempt Threshold & Auto-Exception...');

    // Attempt #2: Customer requested reschedule
    const attempt2Result = await deliveryExecutionService.recordDeliveryAttempt(deliveryTask.id, {
        status: 'FAILED',
        failure_reason: 'CUSTOMER_REQUESTED_RESCHEDULE',
        failure_notes: 'Customer called and requested delivery tomorrow morning'
    }, driverUser);

    assert.strictEqual(attempt2Result.attempt.attempt_number, 2);
    assert.strictEqual(attempt2Result.delivery.attempt_count, 2);
    assert.strictEqual(attempt2Result.delivery.status, 'RESCHEDULED');

    // Attempt #3: Max attempts reached (Final failure)
    const attempt3Result = await deliveryExecutionService.recordDeliveryAttempt(deliveryTask.id, {
        status: 'FAILED',
        failure_reason: 'RECIPIENT_REFUSED',
        failure_notes: 'Recipient stated order was cancelled and refused acceptance'
    }, driverUser);

    assert.strictEqual(attempt3Result.attempt.attempt_number, 3);
    assert.strictEqual(attempt3Result.delivery.attempt_count, 3);
    assert.strictEqual(attempt3Result.delivery.status, 'RETURN_TO_HUB', 'Max attempts must transition delivery to RETURN_TO_HUB');

    // Verify shipment transitioned to DELIVERY_FAILED
    const shpFailed = await shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(shpFailed.status, 'DELIVERY_FAILED', 'Shipment must transition to DELIVERY_FAILED');

    // Verify auto-generated exception
    assert.ok(attempt3Result.exception, 'Max failure must auto-generate an operational exception');
    assert.ok(attempt3Result.exception.exception_number.startsWith('EXC-'), 'Exception number must start with EXC-');
    assert.strictEqual(attempt3Result.exception.exception_type, 'DELIVERY_FAILURE');
    assert.strictEqual(attempt3Result.exception.severity, 'HIGH');
    assert.strictEqual(attempt3Result.exception.status, 'OPEN');

    passedTests++;
    console.log('[PASS] [PASS] 5. Max Attempts Reached: Transitions to RETURN_TO_HUB and auto-generates exception\n');

    // -------------------------------------------------------------
    // TEST 6: Return-to-Hub Reception Workflow
    // -------------------------------------------------------------
    console.log('> TEST 6: Return-to-Hub Reception Workflow...');

    const returnedTask = await deliveryExecutionService.processReturnToHub(deliveryTask.id, {
        notes: 'Driver handed back package to Station Bay 1'
    }, adminUser);

    assert.strictEqual(returnedTask.status, 'RETURN_RECEIVED');

    const shpReturned = await shipmentService.getShipmentById(shp1.id);
    assert.strictEqual(shpReturned.status, 'RETURNED', 'Shipment status must transition to RETURNED');

    const returnEvent = shpReturned.timeline.find(e => e.event_code === 'RETURNED_TO_HUB');
    assert.ok(returnEvent, 'Shipment timeline must include RETURNED_TO_HUB event');

    passedTests++;
    console.log('[PASS] [PASS] 6. Return-to-Hub Reception: Package safely received back into facility inventory\n');

    // -------------------------------------------------------------
    // TEST 7: Successful Delivery Completion with Multi-Factor POD (Rule BR-007)
    // -------------------------------------------------------------
    console.log('> TEST 7: Successful Delivery with Multi-Factor POD (Rule BR-007)...');

    const shp2 = await shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 1,
        sender: { name: 'Twiga Foods', phone: '+254700111222', address: 'Enterprise Rd', city: 'Nairobi' },
        recipient: { name: 'Kipchoge Keino', phone: '+254700333444', address: 'Eldoret Way 14', city: 'Nairobi' },
        parcels: [{ weight_kg: 2.0, description: 'Sporting Goods' }]
    }, adminUser);

    const successfulDelivery = await deliveryExecutionService.createDeliveryTask({
        shipment_id: shp2.id,
        pod_required_methods: 'SIGNATURE,GPS'
    }, dispatcherUser);

    await deliveryExecutionService.assignDeliveryTask(successfulDelivery.id, {
        driver_id: testDriver.id,
        vehicle_id: testVehicle.id
    }, dispatcherUser);

    await deliveryExecutionService.startDelivery(successfulDelivery.id, driverUser);

    // Test POD validation: Missing GPS should fail
    let podGpsBlocked = false;
    try {
        await deliveryExecutionService.completeDeliveryWithPOD(successfulDelivery.id, {
            recipient_name: 'Kipchoge Keino',
            signature_data: 'data:image/svg+xml;base64,signature'
            // Missing latitude, longitude
        }, driverUser);
    } catch (err) {
        podGpsBlocked = err.message.includes('BR-007 Violation');
    }
    assert.strictEqual(podGpsBlocked, true, 'Rule BR-007: Missing required POD evidence (GPS) must fail');

    // Complete with full valid POD
    const completeResult = await deliveryExecutionService.completeDeliveryWithPOD(successfulDelivery.id, {
        recipient_name: 'Kipchoge Keino',
        recipient_phone: '+254700333444',
        signature_data: 'data:image/svg+xml;base64,PHN2Zz5zaWduYXR1cmU8L3N2Zz4=',
        otp_code: '4892',
        otp_verified: true,
        latitude: -1.286389,
        longitude: 36.817223,
        notes: 'Handed directly to recipient at front door'
    }, driverUser);

    assert.strictEqual(completeResult.delivery.status, 'DELIVERED');
    assert.ok(completeResult.delivery.actual_delivery_at);
    assert.ok(completeResult.pod);
    assert.strictEqual(completeResult.pod.recipient_name, 'Kipchoge Keino');
    assert.strictEqual(Boolean(completeResult.pod.otp_verified), true);

    // Verify shipment transitioned to DELIVERED
    const shpDelivered = await shipmentService.getShipmentById(shp2.id);
    assert.strictEqual(shpDelivered.status, 'DELIVERED');

    const deliveredEvent = shpDelivered.timeline.find(e => e.event_code === 'DELIVERED');
    assert.ok(deliveredEvent, 'Shipment timeline must include DELIVERED event');

    passedTests++;
    console.log('[PASS] [PASS] 7. Proof of Delivery: Legally verified with signature, OTP, and GPS capture\n');

    // -------------------------------------------------------------
    // TEST 8: Proof of Delivery Immutability Enforcement (Rule POD-005)
    // -------------------------------------------------------------
    console.log('> TEST 8: Proof of Delivery Immutability Enforcement (Rule POD-005)...');

    let updatePodBlocked = false;
    try {
        await dbAdapter.run('UPDATE proof_of_delivery SET recipient_name = ? WHERE id = ?', ['Fraudulent Name', completeResult.pod.id]);
    } catch (err) {
        updatePodBlocked = err.message.includes('Audit Violation');
    }
    assert.strictEqual(updatePodBlocked, true, 'Database trigger must block UPDATE on proof_of_delivery');

    let deletePodBlocked = false;
    try {
        await dbAdapter.run('DELETE FROM proof_of_delivery WHERE id = ?', [completeResult.pod.id]);
    } catch (err) {
        deletePodBlocked = err.message.includes('Audit Violation');
    }
    assert.strictEqual(deletePodBlocked, true, 'Database trigger must block DELETE on proof_of_delivery');

    passedTests++;
    console.log('[PASS] [PASS] 8. POD Immutability: SQL triggers block UPDATE and DELETE on evidence records\n');

    // -------------------------------------------------------------
    // TEST 9: Operational Exception Investigation & Resolution Lifecycle
    // -------------------------------------------------------------
    console.log('> TEST 9: Operational Exception Investigation & Resolution Lifecycle...');

    const resolvedException = await deliveryExecutionService.resolveException(attempt3Result.exception.id, {
        root_cause: 'Recipient phone was unreachable and customer refused acceptance upon late contact',
        resolution_notes: 'Shipment safely returned to Nairobi hub. Shipper notified to arrange alternate pickup.'
    }, adminUser);

    assert.strictEqual(resolvedException.status, 'RESOLVED');
    assert.ok(resolvedException.resolved_at);
    assert.ok(resolvedException.root_cause.includes('unreachable'));

    // Verify tracking event
    const finalShp1 = await shipmentService.getShipmentById(shp1.id);
    const excResolvedEvent = finalShp1.timeline.find(e => e.event_code === 'EXCEPTION_RESOLVED');
    assert.ok(excResolvedEvent, 'Timeline must record EXCEPTION_RESOLVED event');

    passedTests++;
    console.log('[PASS] [PASS] 9. Exception Resolution: Complete investigation and resolution audit trail\n');

    console.log('============================================================');
    console.log(`[SUCCESS] ALL ${passedTests}/${totalTests} LAST-MILE DELIVERY TESTS PASSED!`);
    console.log('============================================================\n');
}

runSuite().then(() => {
    process.exit(0);
}).catch(error => {
    console.error(`\n[FAIL] TEST SUITE FAILED:`);
    console.error(error);
    process.exit(1);
});
