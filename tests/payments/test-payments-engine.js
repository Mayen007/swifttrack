// tests/payments/test-payments-engine.js
// SwiftTrack Kenya: Phase 7 Payments Engine & State Machine Integration Suite
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const paymentService = require('../../server/services/paymentService.js');
const darajaService = require('../../server/services/darajaService.js');
const orderService = require('../../server/services/orderService.js');

console.log('\n============================================================');
console.log('💳  SWIFTTRACK KENYA: PHASE 7 PAYMENTS ENGINE SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Setup users
const adminUser = db.prepare(`
    SELECT u.*, r.name as roleName, r.name as role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'SUPER_ADMIN'
    LIMIT 1
`).get() || { id: 1, role: 'SUPER_ADMIN', roleName: 'SUPER_ADMIN', branchId: 1 };
adminUser.roleName = 'SUPER_ADMIN';
adminUser.branchId = adminUser.branch_id || 1;

const cashierUser = db.prepare(`
    SELECT u.*, r.name as roleName, r.name as role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'CASHIER'
    LIMIT 1
`).get() || adminUser;
cashierUser.roleName = 'CASHIER';
cashierUser.branchId = cashierUser.branch_id || 1;

const testProduct = db.prepare('SELECT * FROM products WHERE is_active = 1 LIMIT 1').get();
const testCustomer = db.prepare("SELECT * FROM customers WHERE status = 'ACTIVE' LIMIT 1").get() || { id: 1, full_name: 'Test Customer', phone: '0712345678' };

let testOrder;
let createdIntentMpesa;
let createdIntentCard;
let createdIntentCash;
let createdIntentBank;

async function runSuite() {
    // Setup a real test order for payment linkages
    const orderRes = orderService.createOrder({
        branch_id: 1,
        customer_id: testCustomer.id,
        initial_status: 'CONFIRMED',
        delivery_address: 'Moi Avenue, Nairobi CBD',
        delivery_city: 'Nairobi',
        recipient_name: 'Amina Kimani',
        recipient_phone: '0712345678',
        delivery_fee: 250,
        items: [{ product_id: testProduct.id, quantity: 2, unit_price: testProduct.selling_price }]
    }, adminUser);
    testOrder = orderService.getOrderById(orderRes.id, adminUser);

    // TEST 1: Payment Intent Creation for All 4 Methods in PENDING state
    await runTest('1. Payment Intent Creation: Create PENDING intents across M-Pesa, Card, Cash, and Bank', async () => {
        createdIntentMpesa = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            customer_id: testCustomer.id,
            payment_method: 'MPESA',
            amount: 1500,
            phone_number: '0712345678',
            metadata: { note: 'Deposit payment' }
        }, cashierUser);

        assert.strictEqual(createdIntentMpesa.status, 'PENDING');
        assert.strictEqual(createdIntentMpesa.payment_method, 'MPESA');
        assert.strictEqual(createdIntentMpesa.amount, 1500);
        assert.ok(createdIntentMpesa.intent_number.startsWith('PI-'));

        createdIntentCard = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            customer_id: testCustomer.id,
            payment_method: 'CARD',
            amount: 2500
        }, cashierUser);
        assert.strictEqual(createdIntentCard.status, 'PENDING');
        assert.strictEqual(createdIntentCard.payment_method, 'CARD');

        createdIntentCash = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            customer_id: testCustomer.id,
            payment_method: 'CASH',
            amount: 500
        }, cashierUser);
        assert.strictEqual(createdIntentCash.status, 'PENDING');
        assert.strictEqual(createdIntentCash.payment_method, 'CASH');

        createdIntentBank = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            customer_id: testCustomer.id,
            payment_method: 'BANK',
            amount: 8000
        }, cashierUser);
        assert.strictEqual(createdIntentBank.status, 'PENDING');
        assert.strictEqual(createdIntentBank.payment_method, 'BANK');
    });

    // TEST 2: Strict Idempotency Enforcement
    await runTest('2. Idempotency Guard: Duplicate request with identical idempotency_key returns existing intent', async () => {
        const uniqueKey = `idemp-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const intent1 = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            payment_method: 'MPESA',
            amount: 3200,
            idempotency_key: uniqueKey,
            phone_number: '0712345678'
        }, cashierUser);

        const intent2 = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            payment_method: 'MPESA',
            amount: 3200,
            idempotency_key: uniqueKey,
            phone_number: '0712345678'
        }, cashierUser);

        assert.strictEqual(intent1.id, intent2.id, 'Both calls must return the same intent ID');
        assert.strictEqual(intent1.intent_number, intent2.intent_number, 'Intent numbers must match');
        assert.strictEqual(intent2.is_idempotent_replay, true, 'Second call must flag idempotent replay');
    });

    // TEST 3: M-Pesa STK Push Initiation via Daraja (PENDING -> PROCESSING)
    await runTest('3. STK Push Initiation: Advances intent to PROCESSING with CheckoutRequestID & timeout TTL', async () => {
        const processed = await paymentService.processIntent(createdIntentMpesa.id, {
            phone_number: '0722000000'
        }, cashierUser);

        assert.strictEqual(processed.status, 'PROCESSING');
        assert.ok(processed.provider_reference.startsWith('ws_CO_'), 'Must store CheckoutRequestID as provider_reference');
        assert.ok(processed.timeout_at !== null, 'Must define timeout_at timestamp');

        // Verify audit trail logged transition
        const details = paymentService.getPaymentIntentById(createdIntentMpesa.id, cashierUser);
        const processingAudit = details.audit_trail.find(a => a.to_status === 'PROCESSING');
        assert.ok(processingAudit, 'Must record audit trail for PROCESSING transition');
    });

    // TEST 4: Daraja Callback Webhook Handling (PROCESSING -> SUCCESS) & Order Sync
    await runTest('4. Callback Processing: Valid Daraja callback marks SUCCESS and syncs payments ledger', async () => {
        const fullIntent = paymentService.getPaymentIntentById(createdIntentMpesa.id, cashierUser);
        const checkoutReqId = fullIntent.provider_reference;

        const simulatedCallback = darajaService.createSimulatedCallback(checkoutReqId, {
            resultCode: 0,
            amount: fullIntent.amount,
            phone: '254722000000',
            receiptNumber: 'QEB78129KM'
        });

        const callbackRes = paymentService.handleMpesaCallback(simulatedCallback);
        assert.strictEqual(callbackRes.success, true);
        assert.strictEqual(callbackRes.status, 'SUCCESS');
        assert.strictEqual(callbackRes.receipt, 'QEB78129KM');

        // Check intent updated
        const updatedIntent = paymentService.getPaymentIntentById(createdIntentMpesa.id, cashierUser);
        assert.strictEqual(updatedIntent.status, 'SUCCESS');
        assert.strictEqual(updatedIntent.external_reference, 'QEB78129KM');
        assert.ok(updatedIntent.completed_at !== null);

        // Check payments table has completed record
        assert.strictEqual(updatedIntent.payments.length, 1);
        assert.strictEqual(updatedIntent.payments[0].status, 'COMPLETED');
        assert.strictEqual(updatedIntent.payments[0].mpesa_receipt_number, 'QEB78129KM');
    });

    // TEST 5: Duplicate Callback Protection
    await runTest('5. Duplicate Callback Protection: Re-submitting identical callback is safely acknowledged without duplicate state transition', async () => {
        const fullIntent = paymentService.getPaymentIntentById(createdIntentMpesa.id, cashierUser);
        const checkoutReqId = fullIntent.provider_reference;

        const duplicateCallback = darajaService.createSimulatedCallback(checkoutReqId, {
            resultCode: 0,
            amount: fullIntent.amount,
            phone: '254722000000',
            receiptNumber: 'QEB78129KM'
        });

        const secondCallRes = paymentService.handleMpesaCallback(duplicateCallback);
        assert.strictEqual(secondCallRes.success, true);
        assert.strictEqual(secondCallRes.is_duplicate, true);

        // Verify payments count is still exactly 1
        const verifiedIntent = paymentService.getPaymentIntentById(createdIntentMpesa.id, cashierUser);
        assert.strictEqual(verifiedIntent.payments.length, 1, 'Duplicate callback must not create duplicate payment record');
    });

    // TEST 6: User-Cancelled & Failed Callback (ResultCode 1032 -> FAILED)
    await runTest('6. Failed Callback Handling: User cancellation (ResultCode 1032) marks intent as FAILED', async () => {
        const failedIntent = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            payment_method: 'MPESA',
            amount: 750,
            phone_number: '0711223344'
        }, cashierUser);

        const processed = await paymentService.processIntent(failedIntent.id, {}, cashierUser);
        const checkoutReqId = processed.provider_reference;

        const cancelCallback = darajaService.createSimulatedCallback(checkoutReqId, {
            resultCode: 1032,
            resultDesc: 'Request cancelled by user.'
        });

        const cbRes = paymentService.handleMpesaCallback(cancelCallback);
        assert.strictEqual(cbRes.success, true);
        assert.strictEqual(cbRes.status, 'FAILED');

        const updated = paymentService.getPaymentIntentById(failedIntent.id, cashierUser);
        assert.strictEqual(updated.status, 'FAILED');
        assert.strictEqual(updated.failure_reason, 'Request cancelled by user.');
    });

    // TEST 7: Synchronous Processing for Card, Cash, and Bank Tenders
    await runTest('7. Synchronous Channels: Direct execution for Card, Cash, and Bank completes immediately to SUCCESS', async () => {
        const cardProcessed = await paymentService.processIntent(createdIntentCard.id, {
            card_reference: 'AUTH-VISA-9941',
            last4: '4242'
        }, cashierUser);
        assert.strictEqual(cardProcessed.status, 'SUCCESS');
        assert.strictEqual(cardProcessed.external_reference, 'CARD-****-4242');

        const cashProcessed = await paymentService.processIntent(createdIntentCash.id, {}, cashierUser);
        assert.strictEqual(cashProcessed.status, 'SUCCESS');

        const bankProcessed = await paymentService.processIntent(createdIntentBank.id, {
            bank_name: 'KCB Bank',
            bank_reference: 'EFT-KCB-99124'
        }, cashierUser);
        assert.strictEqual(bankProcessed.status, 'SUCCESS');
    });

    // TEST 8: Timeout Recovery & Status Query
    await runTest('8. Timeout Recovery: Status inquiry from provider reconciles pending intent', async () => {
        const timeoutIntent = paymentService.createPaymentIntent({
            branch_id: 1,
            order_id: testOrder.id,
            payment_method: 'MPESA',
            amount: 990,
            phone_number: '0799887766'
        }, cashierUser);

        await paymentService.processIntent(timeoutIntent.id, {}, cashierUser);

        // Query status from provider
        const recovered = await paymentService.queryPaymentStatus(timeoutIntent.id, cashierUser);
        assert.strictEqual(recovered.status, 'SUCCESS', 'Query status should reconcile and complete intent');
    });

    // TEST 9: Payment Refunds (Partial and Full)
    await runTest('9. Payment Refunds: Full and partial refunds against completed payments update status to REFUNDED', async () => {
        const details = paymentService.getPaymentIntentById(createdIntentCard.id, cashierUser);
        const paymentRecord = details.payments[0];
        assert.ok(paymentRecord, 'Must have linked payment record');

        const refundRes = paymentService.refundPayment(paymentRecord.id, {
            amount: 2500,
            reason: 'Customer cancelled transaction'
        }, adminUser);

        assert.strictEqual(refundRes.amount, 2500);
        assert.ok(refundRes.refund_number.startsWith('REF-PAY-'));

        // Verify payment is REFUNDED
        const checkPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentRecord.id);
        assert.strictEqual(checkPayment.status, 'REFUNDED');

        const checkIntent = paymentService.getPaymentIntentById(createdIntentCard.id, cashierUser);
        assert.strictEqual(checkIntent.status, 'REFUNDED');
    });

    // TEST 10: Automated Payment Reconciliation Engine
    await runTest('10. Payment Reconciliation: Evaluates payments, matches provider references, and reports discrepancies', async () => {
        const recon = paymentService.reconcilePayments({ branch_id: 1 }, adminUser);

        assert.ok(recon.total_evaluated > 0, 'Must evaluate payments');
        assert.ok(recon.matched_count > 0, 'Must have matched payments');
        assert.ok(recon.reconciled_volume > 0, 'Must compute reconciled volume in KES');
        assert.ok(Array.isArray(recon.discrepancies), 'Must return discrepancies array');
    });

    console.log('\n============================================================');
    console.log(`📊  PAYMENTS ENGINE SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('============================================================\n');
}

runSuite().catch(err => {
    console.error('Fatal suite failure:', err);
    process.exit(1);
});
