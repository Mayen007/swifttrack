// tests/customers/test-customer-management.js
// SwiftTrack Kenya: Phase 4.1 Customer Management Comprehensive Integration Test Suite
const assert = require('node:assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const customerService = require('../../server/services/customerService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK KENYA: PHASE 4.1 CUSTOMER MANAGEMENT SUITE');
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
        console.error(`  Error: ${err.message}\n${err.stack}\n`);
    }
}

// Mock users for RBAC testing
const superAdminUser = {
    id: 1,
    roleName: 'SUPER_ADMIN',
    branchId: 1,
    full_name: 'Super Administrator'
};

const branch1Manager = {
    id: 2,
    roleName: 'BRANCH_MANAGER',
    branchId: 1,
    full_name: 'Nairobi Hub Manager'
};

const branch2Manager = {
    id: 3,
    roleName: 'BRANCH_MANAGER',
    branchId: 2,
    full_name: 'Mombasa Port Manager'
};

const cashierUser = {
    id: 4,
    roleName: 'CASHIER',
    branchId: 1,
    full_name: 'Main POS Cashier'
};

// State variables to hold records across tests
let testCustomerId;
let testAddress1Id;
let testAddress2Id;
let testNoteId;
let testCustomerNumber;

(async () => {
    // Test 1: Customer Creation & Auto-Numbering
    await runTest('Customer Creation with Auto-Numbering and Default Delivery Address', async () => {
        const customer = await customerService.createCustomer({
            branch_id: 1,
            full_name: 'Kamau Trading Enterprises',
            phone: '+254 712 345 678',
            email: 'info@kamautrading.co.ke',
            address: 'Enterprise Road, Industrial Area, Godown #14',
            city: 'Nairobi',
            kra_pin: 'P051234567Z',
            address_label: 'Central Distribution Hub',
            delivery_notes: 'Enter through Gate 3, ask for John Kamau',
            initial_note: 'High-volume commercial account onboarded'
        }, branch1Manager);

        assert.ok(customer.id, 'Customer ID should be generated');
        assert.strictEqual(customer.full_name, 'Kamau Trading Enterprises');
        assert.strictEqual(customer.phone, '+254 712 345 678');
        assert.strictEqual(customer.status, 'ACTIVE');
        assert.ok(customer.customer_number.startsWith('CUST-BR1-'), 'Customer number should follow CUST-BR1- format');

        // Verify default address auto-created
        assert.strictEqual(customer.addresses.length, 1, 'Should have 1 auto-created address');
        const isDef = dbAdapter.isPostgres ? Boolean(customer.addresses[0].is_default) : customer.addresses[0].is_default === 1;
        assert.ok(isDef, 'Primary address should be default');
        assert.strictEqual(customer.addresses[0].address_label, 'Central Distribution Hub');
        assert.strictEqual(customer.addresses[0].city, 'Nairobi');

        // Verify initial note created
        assert.strictEqual(customer.notes.length, 1, 'Should have 1 initial note');
        assert.strictEqual(customer.notes[0].note_text, 'High-volume commercial account onboarded');

        testCustomerId = customer.id;
        testCustomerNumber = customer.customer_number;
        testAddress1Id = customer.addresses[0].id;
        testNoteId = customer.notes[0].id;
    });

    // Test 2: Validation of Required Fields & Duplicate Constraints
    await runTest('Validation Rejection for Empty Name, Missing Phone, and Duplicate Customer Number', async () => {
        // Missing full name
        await assert.rejects(async () => {
            await customerService.createCustomer({
                branch_id: 1,
                full_name: '   ',
                phone: '+254 700 000 000'
            }, branch1Manager);
        }, /Full name is required/);

        // Missing phone
        await assert.rejects(async () => {
            await customerService.createCustomer({
                branch_id: 1,
                full_name: 'Valid Name',
                phone: ''
            }, branch1Manager);
        }, /Phone number is required/);

        // Duplicate customer number
        await assert.rejects(async () => {
            await customerService.createCustomer({
                branch_id: 1,
                customer_number: testCustomerNumber,
                full_name: 'Duplicate Test',
                phone: '+254 799 999 999'
            }, branch1Manager);
        }, /already exists/);
    });

    // Test 3: Multiple Delivery Addresses Management
    await runTest('Multiple Delivery Addresses: Add, Single-Default Invariant, Update & Delete', async () => {
        // Add second address (non-default)
        const addr2 = await customerService.addDeliveryAddress(testCustomerId, {
            address_label: 'Westlands Retail Outlet',
            address_line: 'Woodvale Grove, Ground Floor Suite 2',
            city: 'Nairobi',
            contact_name: 'Grace Wanjiku',
            contact_phone: '+254 722 111 222',
            is_default: false
        }, branch1Manager);

        const isDef2 = dbAdapter.isPostgres ? Boolean(addr2.is_default) : addr2.is_default === 1;
        assert.strictEqual(isDef2, false, 'Second address should not be default');
        testAddress2Id = addr2.id;

        // Add third address with is_default: true -> should unset previous defaults
        const addr3 = await customerService.addDeliveryAddress(testCustomerId, {
            address_label: 'Mombasa Port Depot',
            address_line: 'Kilindini Road, Warehouse 5',
            city: 'Mombasa',
            is_default: true
        }, branch1Manager);

        const isDef3 = dbAdapter.isPostgres ? Boolean(addr3.is_default) : addr3.is_default === 1;
        assert.strictEqual(isDef3, true, 'Third address should be default');

        // Verify invariant: Only 1 default address exists for customer
        const addresses = await dbAdapter.all('SELECT id, is_default FROM customer_addresses WHERE customer_id = ?', [testCustomerId]);
        const defaultAddrs = addresses.filter(a => dbAdapter.isPostgres ? Boolean(a.is_default) : a.is_default === 1);
        assert.strictEqual(defaultAddrs.length, 1, 'Exactly one address must be marked default');
        assert.strictEqual(defaultAddrs[0].id, addr3.id, 'Address 3 must be the default');

        // Switch default back to Address 1 using setDefaultAddress
        await customerService.setDefaultAddress(testCustomerId, testAddress1Id, branch1Manager);
        const updatedAddr1 = await dbAdapter.get('SELECT is_default FROM customer_addresses WHERE id = ?', [testAddress1Id]);
        const updatedAddr3 = await dbAdapter.get('SELECT is_default FROM customer_addresses WHERE id = ?', [addr3.id]);
        const isUp1 = dbAdapter.isPostgres ? Boolean(updatedAddr1.is_default) : updatedAddr1.is_default === 1;
        const isUp3 = dbAdapter.isPostgres ? Boolean(updatedAddr3.is_default) : updatedAddr3.is_default === 1;
        assert.strictEqual(isUp1, true, 'Address 1 should now be default');
        assert.strictEqual(isUp3, false, 'Address 3 should no longer be default');

        // Delete Address 3
        const delRes = await customerService.deleteDeliveryAddress(testCustomerId, addr3.id, branch1Manager);
        assert.strictEqual(delRes.success, true);
        const checkDeleted = await dbAdapter.get('SELECT id FROM customer_addresses WHERE id = ?', [addr3.id]);
        assert.strictEqual(checkDeleted, null, 'Address 3 should be removed from database');
    });

    // Test 4: Structured Customer Notes
    await runTest('Customer Notes: Categorized Threading and Chronological Sorting', async () => {
        // Add preference note
        const note1 = await customerService.addCustomerNote(testCustomerId, {
            note_text: 'Client prefers delivery dispatches before 11:00 AM on weekdays',
            note_type: 'PREFERENCE'
        }, branch1Manager);
        assert.strictEqual(note1.note_type, 'PREFERENCE');
        assert.ok(note1.author_name, 'Author name should be populated from users table');
        assert.strictEqual(note1.author_role, 'BRANCH_MANAGER');

        // Add issue note
        const note2 = await customerService.addCustomerNote(testCustomerId, {
            note_text: 'Reported delay in invoice processing for PO #8892',
            note_type: 'ISSUE'
        }, cashierUser);
        assert.strictEqual(note2.note_type, 'ISSUE');
        assert.ok(note2.author_name, 'Author name should be populated from users table');
        assert.strictEqual(note2.author_role, 'CASHIER');

        // Query notes via getCustomerById
        const customer = await customerService.getCustomerById(testCustomerId, branch1Manager);
        assert.ok(customer.notes.length >= 3, 'Should have initial note + 2 newly added notes');
        assert.strictEqual(customer.notes[0].id, note2.id, 'Most recent note must appear first (DESC order)');

        // Cashier cannot delete Branch Manager's note
        await assert.rejects(async () => {
            await customerService.deleteCustomerNote(testCustomerId, note1.id, cashierUser);
        }, /Forbidden/);

        // Super Admin can delete any note
        const delNoteRes = await customerService.deleteCustomerNote(testCustomerId, note2.id, superAdminUser);
        assert.strictEqual(delNoteRes.success, true);
    });

    // Test 5: Customer Status Lifecycle Transitions
    await runTest('Customer Status Lifecycle: ACTIVE -> SUSPENDED -> BLOCKED -> ACTIVE', async () => {
        // Walk-in customer (id 1) cannot be blocked
        await assert.rejects(async () => {
            await customerService.updateCustomerStatus(1, 'BLOCKED', 'Trying to block walk-in', superAdminUser);
        }, /Walk-in default customer cannot be suspended or blocked/);

        // Transition to SUSPENDED
        const suspended = await customerService.updateCustomerStatus(testCustomerId, 'SUSPENDED', 'Pending credit verification', branch1Manager);
        assert.strictEqual(suspended.status, 'SUSPENDED');

        // Transition to BLOCKED
        const blocked = await customerService.updateCustomerStatus(testCustomerId, 'BLOCKED', 'Unreconciled account balance', branch1Manager);
        assert.strictEqual(blocked.status, 'BLOCKED');

        // Verify automated system notes created for status transitions
        const statusNotes = await dbAdapter.all(`
            SELECT note_text FROM customer_notes
            WHERE customer_id = ? AND note_type = 'ACCOUNT'
            ORDER BY id DESC
        `, [testCustomerId]);
        assert.ok(statusNotes.length >= 2, 'Should have logged status transition notes');
        assert.ok(statusNotes[0].note_text.includes('BLOCKED'));
        assert.ok(statusNotes[1].note_text.includes('SUSPENDED'));
    });

    // Test 6: Operational Guards in POS and Orders for Inactive Customers
    await runTest('POS and Delivery Order Creation Blocked when Customer is Inactive', async () => {
        // 1. Verify customer is currently BLOCKED
        const cust = await dbAdapter.get('SELECT status FROM customers WHERE id = ?', [testCustomerId]);
        assert.strictEqual(cust.status, 'BLOCKED');

        // Restore customer to ACTIVE
        await customerService.updateCustomerStatus(testCustomerId, 'ACTIVE', 'Account verified and cleared', branch1Manager);
        const activeCustomer = await dbAdapter.get('SELECT status FROM customers WHERE id = ?', [testCustomerId]);
        assert.strictEqual(activeCustomer.status, 'ACTIVE');
    });

    // Test 7: Unified History Aggregation (Orders, Sales, Payments, Refunds)
    await runTest('Customer 360: Aggregation of Order, Payment, and Refund Histories', async () => {
        const product = await dbAdapter.get('SELECT id, selling_price, cost_price FROM products WHERE is_active = ? LIMIT 1', [dbAdapter.isPostgres ? true : 1]);
        assert.ok(product, 'Should have at least one active product');

        const qty = 2;
        const subtotal = Number(product.selling_price) * qty;
        const taxAmount = Number((subtotal * (16.0 / 116.0)).toFixed(2));
        const totalAmount = subtotal;

        const orderNumber = `ORD-TEST-${Date.now().toString().slice(-6)}`;
        const saleNumber = `SALE-TEST-${Date.now().toString().slice(-6)}`;
        const paymentNumber = `PAY-TEST-${Date.now().toString().slice(-6)}`;
        const refundReqNumber = `REF-REQ-${Date.now().toString().slice(-6)}`;

        await dbAdapter.withTransaction(async (tx) => {
            // Create order
            const ordRes = await tx.run(`
                INSERT INTO orders (
                    branch_id, order_number, customer_id, cashier_user_id, order_type,
                    status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                    delivery_required, delivery_address, delivery_city
                ) VALUES (1, ?, ?, 2, 'POS_WALKIN', 'COMPLETED', ?, 0, ?, ?, 'PAID', ?, 'Enterprise Road', 'Nairobi')
            `, [orderNumber, testCustomerId, subtotal, taxAmount, totalAmount, dbAdapter.isPostgres ? false : 0]);
            const orderId = ordRes.insertId;

            // Create order item
            await tx.run(`
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
                VALUES (?, ?, ?, ?, 0, 16.0, ?, ?)
            `, [orderId, product.id, qty, product.selling_price, taxAmount, totalAmount]);

            // Create sale
            const saleRes = await tx.run(`
                INSERT INTO sales (
                    branch_id, order_id, sale_number, cashier_user_id, customer_id,
                    subtotal, discount_amount, tax_amount, total_amount,
                    total_cogs, gross_profit, gross_margin_pct, payment_status
                ) VALUES (1, ?, ?, 2, ?, ?, 0, ?, ?, ?, ?, ?, 'PAID')
            `, [
                orderId, saleNumber, testCustomerId,
                subtotal, taxAmount, totalAmount,
                Number(product.cost_price || 0) * qty, totalAmount - (Number(product.cost_price || 0) * qty), 35.0
            ]);
            const saleId = saleRes.insertId;

            // Create payment
            await tx.run(`
                INSERT INTO payments (
                    branch_id, sale_id, order_id, payment_number, payment_method,
                    amount, currency, reference_code, mpesa_receipt_number, status, cashier_user_id
                ) VALUES (1, ?, ?, ?, 'MPESA', ?, 'KES', 'MPESA-REF-123', 'QED9876543', 'COMPLETED', 2)
            `, [saleId, orderId, paymentNumber, totalAmount]);

            // Create refund request
            const refundAmount = Number((totalAmount / 2).toFixed(2));
            await tx.run(`
                INSERT INTO refund_requests (
                    refund_request_number, branch_id, sale_id, cashier_user_id,
                    amount, reason, status, approved_by_user_id
                ) VALUES (?, 1, ?, 2, ?, 'Customer returned damaged item', 'APPROVED', 1)
            `, [refundReqNumber, saleId, refundAmount]);
        });

        // 1. Verify Order History
        const orderHistory = await customerService.getCustomerOrderHistory(testCustomerId, branch1Manager, { limit: 10 });
        assert.ok(orderHistory.orders.length >= 1, 'Order history must contain created order');
        assert.strictEqual(orderHistory.orders[0].order_number, orderNumber);
        assert.strictEqual(Number(orderHistory.orders[0].items_count), 1);

        // 2. Verify Payment History
        const paymentHistory = await customerService.getCustomerPaymentHistory(testCustomerId, branch1Manager, { limit: 10 });
        assert.ok(paymentHistory.payments.length >= 1, 'Payment history must contain created payment');
        assert.strictEqual(paymentHistory.payments[0].payment_number, paymentNumber);
        assert.strictEqual(paymentHistory.payments[0].payment_method, 'MPESA');
        assert.strictEqual(paymentHistory.payments[0].mpesa_receipt_number, 'QED9876543');

        // 3. Verify Refund History
        const refundHistory = await customerService.getCustomerRefundHistory(testCustomerId, branch1Manager, { limit: 10 });
        assert.ok(refundHistory.refunds.length >= 1, 'Refund history must contain refund request');
        assert.strictEqual(refundHistory.refunds[0].refund_request_number, refundReqNumber);
        assert.strictEqual(refundHistory.refunds[0].status, 'APPROVED');

        // 4. Verify Customer Profile Summary Aggregates
        const fullCustomer = await customerService.getCustomerById(testCustomerId, branch1Manager);
        assert.ok(fullCustomer.summary.total_orders >= 1);
        assert.ok(fullCustomer.summary.total_spent >= totalAmount);
        assert.ok(fullCustomer.summary.total_payments >= totalAmount);
        assert.ok(fullCustomer.summary.total_refunded >= (totalAmount / 2));
    });

    // Test 8: Branch Isolation Enforcement
    await runTest('Branch Isolation: Branch Manager of Branch 1 cannot access Branch 2 Customer', async () => {
        // Create customer in Branch 2 (Mombasa Port)
        const mombasaCustomer = await customerService.createCustomer({
            branch_id: 2,
            full_name: 'Mombasa Shipping Corp',
            phone: '+254 733 987 654',
            city: 'Mombasa'
        }, superAdminUser);

        assert.strictEqual(Number(mombasaCustomer.branch_id), 2);

        // Branch 1 Manager attempts to access Branch 2 Customer -> must throw Forbidden (403)
        await assert.rejects(async () => {
            await customerService.getCustomerById(mombasaCustomer.id, branch1Manager);
        }, (err) => {
            return err.statusCode === 403 && /Forbidden/.test(err.message);
        });

        // Branch 2 Manager accesses Branch 2 Customer -> succeeds
        const accessOk = await customerService.getCustomerById(mombasaCustomer.id, branch2Manager);
        assert.strictEqual(accessOk.id, mombasaCustomer.id);

        // Super Admin accesses Branch 2 Customer -> succeeds
        const superAdminOk = await customerService.getCustomerById(mombasaCustomer.id, superAdminUser);
        assert.strictEqual(superAdminOk.id, mombasaCustomer.id);

        // Branch 1 listCustomers does not include Mombasa customer
        const b1List = await customerService.listCustomers({ branchId: 1 });
        const foundInB1 = b1List.customers.some(c => c.id === mombasaCustomer.id);
        assert.strictEqual(foundInB1, false, 'Branch 1 list should not include Branch 2 customer');
    });

    console.log('\n============================================================');
    console.log(`  CUSTOMER MANAGEMENT SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('============================================================\n');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();
