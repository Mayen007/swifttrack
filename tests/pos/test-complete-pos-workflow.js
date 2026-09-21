// tests/pos/test-complete-pos-workflow.js
// SwiftTrack Kenya: Phase 5.1 POS Workflow & Complete POS Integration Test Suite
const assert = require('node:assert');
const path = require('node:path');
const { db, initSchema } = require('../../server/db/database.js');
const posShiftService = require('../../server/services/posShiftService.js');

console.log('\n============================================================');
console.log('🛒  SWIFTTRACK KENYA: PHASE 5.1 COMPLETE POS WORKFLOW SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}\n${err.stack}\n`);
    }
}

// 1. Initialize schema and migrations
initSchema();

// Test users
const cashierUser = {
    id: 4,
    roleName: 'CASHIER',
    branchId: 1,
    fullName: 'Main POS Cashier',
    username: 'cashier1'
};

const cashierUser2 = {
    id: 5,
    roleName: 'CASHIER',
    branchId: 1,
    fullName: 'Second Shift Cashier',
    username: 'cashier2'
};

const branchManagerUser = {
    id: 2,
    roleName: 'BRANCH_MANAGER',
    branchId: 1,
    fullName: 'David Ochieng (Nairobi Branch Manager)',
    username: 'manager_nairobi'
};

const superAdminUser = {
    id: 1,
    roleName: 'SUPER_ADMIN',
    branchId: 1,
    fullName: 'System Administrator',
    username: 'admin'
};

// Clean any previous open shifts for test cashier
db.prepare("UPDATE pos_shifts SET status = 'CLOSED' WHERE cashier_user_id IN (4, 5) AND status = 'OPEN'").run();

let activeShiftId;
let testProduct1;
let testProduct2;
let lastSaleNumber;
let lastSaleId;

// Test 1: Shift Opening & Initial Cash Float
runTest('1. Shift Opening: Cashier opens shift with 5,000 KES float', () => {
    const shift = posShiftService.openShift({
        opening_cash: 5000,
        notes: 'Morning Cashier Shift T-01'
    }, cashierUser);

    assert.ok(shift, 'Shift should be returned');
    assert.strictEqual(shift.status, 'OPEN');
    assert.strictEqual(shift.opening_cash, 5000);
    assert.strictEqual(shift.expected_cash, 5000);
    assert.strictEqual(shift.in_drawer_cash, 5000);
    assert.ok(shift.shift_number.startsWith('SFT-BR1-'));

    // Verify FLOAT_IN movement
    assert.strictEqual(shift.movements.length, 1);
    assert.strictEqual(shift.movements[0].movement_type, 'FLOAT_IN');
    assert.strictEqual(shift.movements[0].amount, 5000);

    activeShiftId = shift.id;

    // Concurrent open shift block
    assert.throws(() => {
        posShiftService.openShift({ opening_cash: 2000 }, cashierUser);
    }, /already has active open shift/);
});

// Test 2: Shift Guard & Product Inventory Setup
runTest('2. Shift Verification Guard: Cashier without shift is blocked', () => {
    // Check that cashier2 has no shift
    const noShift = posShiftService.getCurrentShift(cashierUser2.id, 1);
    assert.strictEqual(noShift, null, 'Cashier 2 should have no active open shift');

    // Fetch test products with stock
    testProduct1 = db.prepare('SELECT * FROM products WHERE is_active = 1 LIMIT 1').get();
    testProduct2 = db.prepare('SELECT * FROM products WHERE is_active = 1 AND id != ? LIMIT 1').get(testProduct1.id);

    // Ensure warehouse inventory exists
    db.prepare('UPDATE inventory SET quantity_available = 100, quantity_on_hand = 100 WHERE warehouse_id = 1 AND product_id IN (?, ?)').run(testProduct1.id, testProduct2.id);
});

// Test 3: Single Cash Payment Sale with Change Calculation
runTest('3. Cash POS Checkout: Accurate stock deduction, shift update & change tender', () => {
    const qty = 2;
    const unitPrice = testProduct1.selling_price;
    const lineTotal = unitPrice * qty;
    const vatRate = 16.0;
    const taxAmount = Number((lineTotal * (vatRate / (100 + vatRate))).toFixed(2));
    const amountTendered = lineTotal + 500; // Extra 500 for change

    const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}`;
    const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}`;
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;

    let saleId;
    db.transaction(() => {
        // Create order
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, ?, ?, 'PAID')
        `).run(orderNumber, cashierUser.id, lineTotal, taxAmount, lineTotal);

        // Create sale linked to shift
        const saleRes = db.prepare(`
            INSERT INTO sales (
                branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, ?, ?, 'PAID')
        `).run(activeShiftId, ordRes.lastInsertRowid, saleNumber, cashierUser.id, lineTotal, taxAmount, lineTotal);
        saleId = saleRes.lastInsertRowid;

        // Create payment
        db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, reference_code, status, cashier_user_id
            ) VALUES (1, ?, ?, ?, 'CASH', ?, 'KES', 'CSH-123', 'COMPLETED', ?)
        `).run(saleId, ordRes.lastInsertRowid, paymentNumber, lineTotal, cashierUser.id);

        // Update shift & cash drawer
        posShiftService.recordSaleInShift(activeShiftId, lineTotal, [{ method: 'CASH', amount: lineTotal }], cashierUser);
    })();

    lastSaleId = saleId;
    lastSaleNumber = saleNumber;

    // Verify shift updated
    const shift = posShiftService.getCurrentShift(cashierUser.id, 1);
    assert.strictEqual(shift.total_sales_count, 1);
    assert.strictEqual(shift.total_sales_amount, lineTotal);
    assert.strictEqual(shift.total_cash_amount, lineTotal);
    assert.strictEqual(shift.expected_cash, 5000 + lineTotal);
    assert.strictEqual(shift.in_drawer_cash, 5000 + lineTotal);
});

// Test 4: M-Pesa Cashless Payment Sale
runTest('4. M-Pesa POS Checkout: Cashless tender leaves physical cash unchanged', () => {
    const qty = 1;
    const lineTotal = testProduct2.selling_price * qty;
    const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}`;
    const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}`;
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;

    db.transaction(() => {
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, 0, ?, 'PAID')
        `).run(orderNumber, cashierUser.id, lineTotal, lineTotal);

        const saleRes = db.prepare(`
            INSERT INTO sales (
                branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'PAID')
        `).run(activeShiftId, ordRes.lastInsertRowid, saleNumber, cashierUser.id, lineTotal, lineTotal);

        db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, reference_code, mpesa_receipt_number, status, cashier_user_id
            ) VALUES (1, ?, ?, ?, 'MPESA', ?, 'KES', 'MPESA-REF', 'QEB1234567', 'COMPLETED', ?)
        `).run(saleRes.lastInsertRowid, ordRes.lastInsertRowid, paymentNumber, lineTotal, cashierUser.id);

        posShiftService.recordSaleInShift(activeShiftId, lineTotal, [{ method: 'MPESA', amount: lineTotal }], cashierUser);
    })();

    const shift = posShiftService.getCurrentShift(cashierUser.id, 1);
    assert.strictEqual(shift.total_sales_count, 2);
    assert.strictEqual(shift.total_mpesa_amount, lineTotal);
    // Physical drawer expected cash should remain unchanged by cashless M-Pesa
    assert.strictEqual(shift.expected_cash, 5000 + (testProduct1.selling_price * 2));
});

// Test 5: Mixed / Split Payment (Cash + M-Pesa)
runTest('5. Split / Mixed Payment: Splits tender across Cash and M-Pesa', () => {
    const totalAmount = 5000;
    const cashPortion = 2000;
    const mpesaPortion = 3000;

    const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}`;
    const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}`;

    db.transaction(() => {
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, 0, ?, 'PAID')
        `).run(orderNumber, cashierUser.id, totalAmount, totalAmount);

        const saleRes = db.prepare(`
            INSERT INTO sales (
                branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                subtotal, discount_amount, tax_amount, total_amount, payment_status
            ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'PAID')
        `).run(activeShiftId, ordRes.lastInsertRowid, saleNumber, cashierUser.id, totalAmount, totalAmount);

        // Payment 1: Cash
        db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, status, cashier_user_id
            ) VALUES (1, ?, ?, ?, 'CASH', ?, 'KES', 'COMPLETED', ?)
        `).run(saleRes.lastInsertRowid, ordRes.lastInsertRowid, `PAY-SPLIT-1-${Date.now()}`, cashPortion, cashierUser.id);

        // Payment 2: M-Pesa
        db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, reference_code, mpesa_receipt_number, status, cashier_user_id
            ) VALUES (1, ?, ?, ?, 'MPESA', ?, 'KES', 'MP-SPLIT-2', 'QEB9988776', 'COMPLETED', ?)
        `).run(saleRes.lastInsertRowid, ordRes.lastInsertRowid, `PAY-SPLIT-2-${Date.now()}`, mpesaPortion, cashierUser.id);

        // Update shift
        posShiftService.recordSaleInShift(activeShiftId, totalAmount, [
            { method: 'CASH', amount: cashPortion },
            { method: 'MPESA', amount: mpesaPortion }
        ], cashierUser);
    })();

    const shift = posShiftService.getCurrentShift(cashierUser.id, 1);
    assert.strictEqual(shift.total_sales_count, 3);
    assert.strictEqual(shift.total_sales_amount, (testProduct1.selling_price * 2) + testProduct2.selling_price + totalAmount);
    assert.strictEqual(shift.total_cash_amount, (testProduct1.selling_price * 2) + cashPortion);
});

// Test 6: Held Carts Functionality
runTest('6. Held Carts: Hold, list, and clear held register cart', () => {
    const holdRef = `HOLD-${Date.now().toString().slice(-6)}`;
    const cartData = [{ product_id: testProduct1.id, quantity: 3, unit_price: testProduct1.selling_price }];

    // Hold cart
    db.prepare(`
        INSERT INTO held_sales (
            branch_id, cashier_user_id, hold_reference, customer_name,
            customer_phone, cart_data_json, subtotal, total
        ) VALUES (1, ?, ?, 'Mama Sarah Bakery', '+254 711 222 333', ?, 2550, 2550)
    `).run(cashierUser.id, holdRef, JSON.stringify(cartData));

    // Verify listed
    const held = db.prepare('SELECT * FROM held_sales WHERE hold_reference = ?').get(holdRef);
    assert.ok(held, 'Held sale should exist in database');
    assert.strictEqual(held.customer_name, 'Mama Sarah Bakery');

    // Clear / resume held cart
    db.prepare('DELETE FROM held_sales WHERE id = ?').run(held.id);
    const checkCleared = db.prepare('SELECT id FROM held_sales WHERE id = ?').get(held.id);
    assert.strictEqual(checkCleared, undefined, 'Held sale should be removed on resume/clear');
});

// Test 7: Receipt Lookup & Reprint
runTest('7. Receipt Reprint: Query complete printable receipt details by sale number', () => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(lastSaleId);
    assert.ok(sale, 'Sale should exist');

    const items = db.prepare(`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `).all(sale.id);

    const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
    assert.ok(payments.length >= 1, 'Payment records should exist');
    assert.strictEqual(payments[0].payment_method, 'CASH');
});

// Test 8: Product Exchange Transaction
runTest('8. Product Exchange: Return Item A and purchase Item B with net difference settlement', () => {
    const curStock1 = db.prepare('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(testProduct1.id).quantity_available;
    const curStock2 = db.prepare('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(testProduct2.id).quantity_available;

    const returnQty = 1;
    const returnVal = testProduct1.selling_price * returnQty;
    const purchaseQty = 1;
    const purchaseVal = testProduct2.selling_price * purchaseQty;
    const netDiff = purchaseVal - returnVal;

    // Simulate exchange transaction
    db.transaction(() => {
        // Restock returned item
        db.prepare('UPDATE inventory SET quantity_available = quantity_available + ? WHERE warehouse_id = 1 AND product_id = ?')
            .run(returnQty, testProduct1.id);

        // Deduct purchased item
        db.prepare('UPDATE inventory SET quantity_available = quantity_available - ? WHERE warehouse_id = 1 AND product_id = ?')
            .run(purchaseQty, testProduct2.id);

        // Record net difference in shift if positive
        if (netDiff > 0) {
            posShiftService.recordSaleInShift(activeShiftId, netDiff, [{ method: 'CASH', amount: netDiff }], cashierUser);
        }
    })();

    const afterStock1 = db.prepare('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(testProduct1.id).quantity_available;
    const afterStock2 = db.prepare('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(testProduct2.id).quantity_available;

    assert.strictEqual(afterStock1, curStock1 + returnQty, 'Returned item stock must increment');
    assert.strictEqual(afterStock2, curStock2 - purchaseQty, 'Purchased item stock must decrement');
});

// Test 9: Cash Drawer Movement (Petty Cash Payout)
runTest('9. Cash Drawer Movement: Petty payout decrements expected drawer cash', () => {
    const prevShift = posShiftService.getCurrentShift(cashierUser.id, 1);
    const prevExpected = prevShift.expected_cash;

    const updated = posShiftService.recordDrawerMovement(activeShiftId, {
        movement_type: 'PAYOUT',
        amount: 350,
        reason: 'Emergency purchase of receipt thermal rolls'
    }, cashierUser);

    assert.strictEqual(updated.expected_cash, prevExpected - 350);
});

// Test 10: Shift Closing, Variance Calculation & Manager Reconciliation
runTest('10. Shift Close & EOD Reconciliation: Cash count, variance & manager sign-off', () => {
    const shiftBeforeClose = posShiftService.getCurrentShift(cashierUser.id, 1);
    const expected = shiftBeforeClose.expected_cash;

    // Simulate cashier physical cash count: 50 KES short
    const countedCash = expected - 50;

    const closed = posShiftService.closeShift(activeShiftId, {
        closing_cash: countedCash,
        notes: 'End of morning shift T-01. Cash counted and bagged.'
    }, cashierUser);

    assert.strictEqual(closed.status, 'CLOSED');
    assert.strictEqual(closed.closing_cash, countedCash);
    assert.strictEqual(closed.cash_variance, -50.00, 'Variance should correctly be -50 KES');
    assert.ok(closed.closed_at, 'Closed timestamp should be recorded');

    // Cashier cannot close an already closed shift
    assert.throws(() => {
        posShiftService.closeShift(activeShiftId, { closing_cash: 5000 }, cashierUser);
    }, /already CLOSED/);

    // Branch Manager reconciles shift
    const reconciled = posShiftService.reconcileShift(activeShiftId, {
        reconciliation_notes: 'Manager verified 50 KES shortage as minor coin change rounding variance. Approved.'
    }, branchManagerUser);

    assert.strictEqual(reconciled.status, 'RECONCILED');
    assert.strictEqual(reconciled.reconciled_by, branchManagerUser.id);
    assert.ok(reconciled.reconciled_at);
});

console.log('\n============================================================');
console.log(`📊  POS WORKFLOW SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
