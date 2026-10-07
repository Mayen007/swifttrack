// tests/logistics/test-cod-settlement.js
// SwiftTrack Logistics: Stage 7 COD Settlement & Financial Reconciliation Test Suite
const assert = require('node:assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const codService = require('../../server/services/codService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const deliveryExecutionService = require('../../server/services/deliveryExecutionService.js');

console.log('============================================================');
console.log('  SWIFTTRACK LOGISTICS: STAGE 7 COD SETTLEMENT SUITE');
console.log('============================================================\n');

let passedTests = 0;
const totalTests = 11;

// Load test actors
const superAdmin = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Super Admin', branchId: 1 };
const managerNairobi = { id: 2, roleName: 'BRANCH_MANAGER', username: 'manager.nairobi', fullName: 'David Ochieng (Nairobi Manager)', branchId: 1 };
const managerMombasa = { id: 6, roleName: 'BRANCH_MANAGER', username: 'manager.mombasa', fullName: 'Hassan Mwadime (Mombasa Manager)', branchId: 2 };
const cashierNairobi = { id: 4, roleName: 'CASHIER', username: 'cashier.nairobi', fullName: 'Kevin Mutua (Senior Cashier)', branchId: 1 };
const driverNairobi = { id: 5, roleName: 'DRIVER', username: 'driver.nairobi', fullName: 'Joseph Kiprop (Lead Driver)', branchId: 1 };

async function run() {
    try {
        const testDriver = await dbAdapter.get('SELECT * FROM drivers WHERE user_id = ?', [driverNairobi.id]) || await dbAdapter.get('SELECT * FROM drivers LIMIT 1');
        const testVehicle = await dbAdapter.get('SELECT * FROM vehicles WHERE branch_id = 1 LIMIT 1') || await dbAdapter.get('SELECT * FROM vehicles LIMIT 1');

        // -------------------------------------------------------------
        // TEST 1: Auto-Initialization of Expected COD Settlement on Booking
        // -------------------------------------------------------------
        console.log('> TEST 1: Auto-initialization of COD Settlement on Shipment Booking...');
        const codBooking = await shipmentService.createShipment({
            origin_hub_id: 1,
            destination_hub_id: 2,
            sender: { name: 'Apex Electronics', phone: '+254711999888', address: 'Luthuli Avenue', city: 'Nairobi' },
            recipient: { name: 'Mombasa Mobile Tech', phone: '+254722888777', address: 'Digo Road', city: 'Mombasa' },
            service_type: 'STANDARD',
            cod_amount: 8500.00,
            parcels: [{
                weight_kg: 3.5,
                length_cm: 25,
                width_cm: 20,
                height_cm: 15,
                package_type: 'BOX',
                description: 'Smartphone consignments'
            }]
        }, superAdmin);

        assert.ok(codBooking.id, 'Shipment must be created');
        
        // Check that cod_settlements record was auto-initialized
        const settlement1 = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [codBooking.id]);
        assert.ok(settlement1, 'COD settlement record must be auto-created for positive cod_amount');
        assert.ok(settlement1.settlement_number.startsWith('COD-'), 'Settlement number must start with COD-');
        assert.strictEqual(settlement1.status, 'PENDING_COLLECTION');
        assert.strictEqual(Number(settlement1.expected_amount), 8500.00);
        assert.strictEqual(Number(settlement1.collected_amount), 0.00);
        assert.strictEqual(Number(settlement1.remitted_amount), 0.00);
        assert.strictEqual(Number(settlement1.variance_amount), 0.00);
        assert.strictEqual(settlement1.currency, 'KES');
        assert.strictEqual(Number(settlement1.hub_id), 2, 'Settlement destination hub must be Mombasa (Branch 2)');

        console.log(`  [PASS] Settlement ${settlement1.settlement_number} auto-initialized with expected KES ${settlement1.expected_amount} at Hub 2`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 2: Direct Creation / Retrieval of COD Settlement
        // -------------------------------------------------------------
        console.log('> TEST 2: Manual / Programmatic Expected Settlement Creation...');
        const manualShipment = await shipmentService.createShipment({
            origin_hub_id: 1,
            destination_hub_id: 1,
            sender: { name: 'Westlands Hardware', phone: '+254711222333', address: 'Westlands', city: 'Nairobi' },
            recipient: { name: 'Kilimani Construction', phone: '+254722333444', address: 'Argwings Kodhek', city: 'Nairobi' },
            cod_amount: 12000.00,
            parcels: [{ weight_kg: 10.0, length_cm: 40, width_cm: 30, height_cm: 20 }]
        }, superAdmin);

        // Call createExpectedSettlement (idempotent / retrieval)
        const directSettlement = await codService.createExpectedSettlement({
            shipment_id: manualShipment.id,
            expected_amount: 12000.00,
            hub_id: 1
        }, superAdmin);

        assert.ok(directSettlement.id, 'Settlement must exist');
        assert.strictEqual(Number(directSettlement.expected_amount), 12000.00);
        assert.strictEqual(directSettlement.status, 'PENDING_COLLECTION');
        console.log(`  [PASS] Direct settlement creation verified (Settlement ID: ${directSettlement.id}, Amount: KES ${directSettlement.expected_amount})`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 3: Full Recipient Collection Recording
        // -------------------------------------------------------------
        console.log('> TEST 3: Record COD Collection from Recipient (Full Amount via M-Pesa)...');
        const collectedSettlement = await codService.recordCollection(settlement1.id, {
            collected_amount: 8500.00,
            collection_method: 'MPESA',
            collection_reference: 'MPESA-QZX789012'
        }, driverNairobi);

        assert.strictEqual(Number(collectedSettlement.collected_amount), 8500.00);
        assert.strictEqual(collectedSettlement.status, 'COLLECTED');
        assert.strictEqual(Number(collectedSettlement.variance_amount), 0.00);
        assert.strictEqual(collectedSettlement.collection_method, 'MPESA');
        assert.strictEqual(collectedSettlement.collection_reference, 'MPESA-QZX789012');
        assert.ok(collectedSettlement.collected_at, 'collected_at must be populated');

        // Verify COD_COLLECTED tracking event was recorded
        const collectEvent = await dbAdapter.get(`
            SELECT * FROM tracking_events 
            WHERE shipment_id = ? AND event_code = 'COD_COLLECTED'
        `, [codBooking.id]);
        assert.ok(collectEvent, 'COD_COLLECTED tracking event must be logged');
        assert.ok(collectEvent.description.includes('KES 8500.00 via MPESA'));
        console.log(`  [PASS] Full collection recorded with M-Pesa ref MPESA-QZX789012 and tracking event logged`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 4: Remittance of Collected Funds to Hub Finance
        // -------------------------------------------------------------
        console.log('> TEST 4: Remit Collected COD Funds to Hub Finance Depot...');
        const remittedSettlement = await codService.recordRemittance(settlement1.id, {
            remitted_amount: 8500.00,
            remittance_method: 'BANK_DEPOSIT',
            remittance_reference: 'KCB-DEP-445566'
        }, driverNairobi);

        assert.strictEqual(Number(remittedSettlement.remitted_amount), 8500.00);
        assert.strictEqual(remittedSettlement.status, 'REMITTED');
        assert.strictEqual(remittedSettlement.remittance_method, 'BANK_DEPOSIT');
        assert.strictEqual(remittedSettlement.remittance_reference, 'KCB-DEP-445566');
        assert.ok(remittedSettlement.remitted_at, 'remitted_at must be populated');

        // Verify COD_REMITTED tracking event
        const remitEvent = await dbAdapter.get(`
            SELECT * FROM tracking_events 
            WHERE shipment_id = ? AND event_code = 'COD_REMITTED'
        `, [codBooking.id]);
        assert.ok(remitEvent, 'COD_REMITTED tracking event must be logged');
        console.log(`  [PASS] Remittance recorded via BANK_DEPOSIT with ref KCB-DEP-445566`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 5: Discrepancy & Variance Tracking on Partial Collection
        // -------------------------------------------------------------
        console.log('> TEST 5: Discrepancy & Variance Tracking on Partial Collection...');
        const partialShipment = await shipmentService.createShipment({
            origin_hub_id: 1,
            destination_hub_id: 1,
            sender: { name: 'Kenya Books', phone: '+254711555666', address: 'Moi Avenue', city: 'Nairobi' },
            recipient: { name: 'School Supplies Ltd', phone: '+254722666777', address: 'Parklands', city: 'Nairobi' },
            cod_amount: 5000.00,
            parcels: [{ weight_kg: 2.0, length_cm: 20, width_cm: 20, height_cm: 10 }]
        }, superAdmin);

        const partialSettlement = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [partialShipment.id]);
        assert.strictEqual(Number(partialSettlement.expected_amount), 5000.00);

        // Recipient only pays 4,500 (variance = -500.00)
        const partialCollected = await codService.recordCollection(partialSettlement.id, {
            collected_amount: 4500.00,
            collection_method: 'CASH'
        }, cashierNairobi);

        assert.strictEqual(Number(partialCollected.collected_amount), 4500.00);
        assert.strictEqual(Number(partialCollected.variance_amount), -500.00, 'Variance must equal collected - expected = -500.00');
        assert.strictEqual(partialCollected.status, 'DISCREPANT', 'Status must transition to DISCREPANT when variance != 0');
        console.log(`  [PASS] Partial collection discrepancy identified: Expected KES 5000, Collected KES 4500 -> Variance KES -500.00 (Status: DISCREPANT)`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 6: Rule BR-010 Violation - Mandatory Justification for Variances
        // -------------------------------------------------------------
        console.log('> TEST 6: Rule BR-010: Mandatory Justification for Variances Guard...');
        
        // Remit what was collected
        await codService.recordRemittance(partialSettlement.id, {
            remitted_amount: 4500.00,
            remittance_method: 'CASH_DROP',
            remittance_reference: 'FLOAT-DROP-01'
        }, cashierNairobi);

        // Attempt reconciliation WITHOUT variance_reason -> MUST FAIL
        await assert.rejects(async () => {
            await codService.reconcileSettlement(partialSettlement.id, {
                reconciliation_notes: 'Trying to reconcile without reason'
            }, managerNairobi);
        }, (err) => {
            return err.message.includes('BR-010') && err.message.includes('Mandatory variance justification');
        }, 'Must reject reconciliation of discrepant settlement without variance_reason');
        console.log('  [PASS] Silent variance override strictly blocked by BR-010 guard (variance_reason required)');
        passedTests++;

        // -------------------------------------------------------------
        // TEST 7: Successful Reconciliation with Valid Justification
        // -------------------------------------------------------------
        console.log('> TEST 7: Successful Reconciliation with Formal Variance Justification...');
        const reconciledSettlement = await codService.reconcileSettlement(partialSettlement.id, {
            reconciliation_notes: 'Audited against cashier till tape',
            variance_reason: 'Recipient returned 1 damaged textbook; KES 500 credit memo approved by Branch Manager David'
        }, managerNairobi);

        assert.strictEqual(reconciledSettlement.status, 'RECONCILED');
        assert.strictEqual(reconciledSettlement.reconciled_by_user_id, managerNairobi.id);
        assert.ok(reconciledSettlement.reconciled_at, 'reconciled_at must be populated');
        assert.ok(reconciledSettlement.variance_reason.includes('damaged textbook'));

        // Verify COD_RECONCILED tracking event
        const reconEvent = await dbAdapter.get(`
            SELECT * FROM tracking_events 
            WHERE shipment_id = ? AND event_code = 'COD_RECONCILED'
        `, [partialShipment.id]);
        assert.ok(reconEvent, 'COD_RECONCILED tracking event must be logged');
        console.log(`  [PASS] Settlement reconciled and closed with signed variance justification: "${reconciledSettlement.variance_reason.slice(0, 45)}..."`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 8: Vertical Privilege Escalation Block (Cashier & Driver Blocked)
        // -------------------------------------------------------------
        console.log('> TEST 8: Vertical Privilege Escalation Block on Reconciliation...');
        
        // Create new settlement for testing role enforcement
        const roleShipment = await shipmentService.createShipment({
            origin_hub_id: 1,
            destination_hub_id: 1,
            sender: { name: 'Sender A', phone: '+254711000111', address: 'Street A', city: 'Nairobi' },
            recipient: { name: 'Recipient B', phone: '+254722000222', address: 'Street B', city: 'Nairobi' },
            cod_amount: 3000.00,
            parcels: [{ weight_kg: 1.0, length_cm: 10, width_cm: 10, height_cm: 10 }]
        }, superAdmin);
        const roleSettlement = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [roleShipment.id]);

        await codService.recordCollection(roleSettlement.id, { collected_amount: 3000.00, collection_method: 'CASH' }, cashierNairobi);
        await codService.recordRemittance(roleSettlement.id, { remitted_amount: 3000.00, remittance_method: 'CASH_DROP' }, cashierNairobi);

        // Cashier attempt to reconcile -> Must fail
        await assert.rejects(async () => {
            await codService.reconcileSettlement(roleSettlement.id, { notes: 'Cashier attempt' }, cashierNairobi);
        }, (err) => {
            return err.message.includes('Vertical Privilege Escalation Blocked');
        }, 'Cashier must be blocked from reconciling settlements');

        // Driver attempt to reconcile -> Must fail
        await assert.rejects(async () => {
            await codService.reconcileSettlement(roleSettlement.id, { notes: 'Driver attempt' }, driverNairobi);
        }, (err) => {
            return err.message.includes('Vertical Privilege Escalation Blocked');
        }, 'Driver must be blocked from reconciling settlements');

        console.log('  [PASS] Vertical privilege escalation blocked for Cashier and Driver roles');
        passedTests++;

        // -------------------------------------------------------------
        // TEST 9: Horizontal Branch Isolation on COD Reconciliation
        // -------------------------------------------------------------
        console.log('> TEST 9: Horizontal Branch Isolation (Cross-Branch Access Block)...');
        
        // Settlement 1 belongs to Hub 2 (Mombasa)
        // Nairobi Manager (Branch 1) attempts to reconcile Mombasa (Branch 2) settlement -> Must fail
        await assert.rejects(async () => {
            await codService.reconcileSettlement(settlement1.id, { notes: 'Cross-branch reconciliation attempt' }, managerNairobi);
        }, (err) => {
            return err.message.includes('Horizontal Privilege Escalation Blocked') && err.message.includes('Cross-branch access denied');
        }, 'Branch Manager must not be able to reconcile settlements for another hub');

        // Mombasa Manager (Branch 2) reconciling Mombasa settlement -> MUST SUCCEED
        const mombasaReconciled = await codService.reconcileSettlement(settlement1.id, {
            reconciliation_notes: 'Approved by Coast Regional Manager'
        }, managerMombasa);
        assert.strictEqual(mombasaReconciled.status, 'RECONCILED');
        console.log('  [PASS] Nairobi Manager blocked from Mombasa settlement; Mombasa Manager successfully approved');
        passedTests++;

        // -------------------------------------------------------------
        // TEST 10: Aggregated COD Summary Metrics & KPIs
        // -------------------------------------------------------------
        console.log('> TEST 10: Aggregated COD Summary Metrics & KPIs for Control Tower...');
        const allMetrics = await codService.getCODSummaryMetrics(null, superAdmin);
        assert.ok(allMetrics.total_settlements > 0, 'Total settlements count must be > 0');
        assert.ok(allMetrics.total_expected > 0, 'Total expected COD must be > 0');
        assert.ok(allMetrics.total_collected > 0, 'Total collected COD must be > 0');
        assert.ok(allMetrics.reconciled_count >= 2, 'At least 2 settlements should be reconciled');

        const hub1Metrics = await codService.getCODSummaryMetrics(1, managerNairobi);
        assert.ok(hub1Metrics.total_settlements > 0, 'Hub 1 metrics must contain settlements');

        console.log(`  [PASS] Metrics aggregate: Total Settlements: ${allMetrics.total_settlements}, Expected: KES ${allMetrics.total_expected.toLocaleString()}, Collected: KES ${allMetrics.total_collected.toLocaleString()}, Reconciled: ${allMetrics.reconciled_count}`);
        passedTests++;

        // -------------------------------------------------------------
        // TEST 11: End-to-End Last-Mile Delivery POD COD Sync
        // -------------------------------------------------------------
        console.log('> TEST 11: End-to-End Delivery Task POD COD Synchronization...');
        const podShipment = await shipmentService.createShipment({
            origin_hub_id: 1,
            destination_hub_id: 1,
            sender: { name: 'Kilimani Wines', phone: '+254711333999', address: 'Wood Avenue', city: 'Nairobi' },
            recipient: { name: 'Customer Leo', phone: '+254722444888', address: 'Kileleshwa Heights', city: 'Nairobi' },
            cod_amount: 4200.00,
            parcels: [{ weight_kg: 5.0, length_cm: 30, width_cm: 20, height_cm: 20 }]
        }, superAdmin);

        // Transition shipment to READY_FOR_DELIVERY by creating delivery task
        const delTask = await deliveryExecutionService.createDeliveryTask({
            shipment_id: podShipment.id,
            destination_address: 'Kileleshwa Heights Apt 4B',
            destination_city: 'Nairobi'
        }, superAdmin);

        assert.ok(delTask.id, 'Delivery task must be created');
        assert.strictEqual(Number(delTask.cod_amount_expected), 4200.00);

        // Assign driver and vehicle
        await deliveryExecutionService.assignDeliveryTask(delTask.id, {
            driver_id: testDriver.id,
            vehicle_id: testVehicle.id
        }, superAdmin);

        // Start delivery
        await deliveryExecutionService.startDelivery(delTask.id, driverNairobi);

        // Complete delivery with Proof of Delivery and COD collection
        const podResult = await deliveryExecutionService.completeDeliveryWithPOD(delTask.id, {
            recipient_name: 'Customer Leo',
            recipient_phone: '+254722444888',
            signature_data: 'data:image/svg+xml;base64,PHN2Zz5zaWduYXR1cmU8L3N2Zz4=',
            latitude: -1.286389,
            longitude: 36.817223,
            cod_amount_collected: 4200.00,
            collection_method: 'MPESA',
            collection_reference: 'MPESA-LEO-4455'
        }, driverNairobi);

        assert.strictEqual(podResult.delivery.status, 'DELIVERED');
        assert.strictEqual(Number(podResult.delivery.cod_amount_collected), 4200.00);

        // Verify COD settlement was synchronized
        const syncSettlement = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [podShipment.id]);
        assert.ok(syncSettlement, 'COD settlement must exist');
        assert.strictEqual(syncSettlement.delivery_id, delTask.id, 'delivery_id must be linked');
        assert.strictEqual(Number(syncSettlement.collected_amount), 4200.00);
        assert.strictEqual(syncSettlement.status, 'COLLECTED');
        assert.strictEqual(syncSettlement.collection_method, 'MPESA');
        assert.strictEqual(syncSettlement.collection_reference, 'MPESA-LEO-4455');
        assert.strictEqual(Number(syncSettlement.variance_amount), 0.00);
        console.log(`  [PASS] Delivery task POD completed with KES 4,200 collected; Settlement linked and updated to COLLECTED`);
        passedTests++;

        console.log('\n============================================================');
        console.log(`[OK]  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
        console.log('============================================================\n');
        process.exit(0);
    } catch (error) {
        console.error('\n[FAIL]  TEST FAILED WITH EXCEPTION:', error);
        process.exit(1);
    }
}

run();
