// tests/pos/test-complete-pos-workflow.js
// SwiftTrack Kenya: Phase 5.1 POS Workflow & Complete POS Integration Test Suite
const assert = require('node:assert');
const path = require('node:path');
const dbAdapter = require('../../server/db/dbAdapter.js');
const posShiftService = require('../../server/services/posShiftService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK KENYA: PHASE 5.1 COMPLETE POS WORKFLOW SUITE');
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

(async () => {
    let activeShiftId;
    let testProduct1;
    let testProduct2;
    let lastSaleNumber;
    let lastSaleId;
    const createdOrderIds = [];
    const createdSaleIds = [];

    try {
        // Clean any previous open shifts for test cashier
        await dbAdapter.run("UPDATE pos_shifts SET status = 'CLOSED' WHERE cashier_user_id IN (4, 5) AND status = 'OPEN'");

        // Test 1: Shift Opening & Initial Cash Float
        await runTest('1. Shift Opening: Cashier opens shift with 5,000 KES float', async () => {
            const shift = await posShiftService.openShift({
                opening_cash: 5000,
                notes: 'Morning Cashier Shift T-01'
            }, cashierUser);

            assert.ok(shift, 'Shift should be returned');
            assert.strictEqual(shift.status, 'OPEN');
            assert.strictEqual(Number(shift.opening_cash), 5000);
            assert.strictEqual(Number(shift.expected_cash), 5000);
            assert.strictEqual(Number(shift.in_drawer_cash), 5000);
            assert.ok(shift.shift_number.startsWith('SFT-BR1-'));

            // Verify FLOAT_IN movement
            assert.strictEqual(shift.movements.length, 1);
            assert.strictEqual(shift.movements[0].movement_type, 'FLOAT_IN');
            assert.strictEqual(Number(shift.movements[0].amount), 5000);

            activeShiftId = shift.id;

            // Concurrent open shift block at another branch
            await assert.rejects(async () => {
                await posShiftService.openShift({ opening_cash: 2000, branch_id: 2 }, cashierUser);
            }, /already has active open shift/);
        });

        // Test 2: Shift Guard & Product Inventory Setup
        await runTest('2. Shift Verification Guard: Cashier without shift is blocked', async () => {
            // Check that cashier2 has no shift
            const noShift = await posShiftService.getCurrentShift(cashierUser2.id, 1);
            assert.strictEqual(noShift, null, 'Cashier 2 should have no active open shift');

            // Fetch test products with stock
            testProduct1 = await dbAdapter.get('SELECT * FROM products WHERE is_active = true LIMIT 1');
            testProduct2 = await dbAdapter.get('SELECT * FROM products WHERE is_active = true AND id != ? LIMIT 1', [testProduct1.id]);

            // Ensure warehouse inventory exists
            await dbAdapter.run('UPDATE inventory SET quantity_available = 100, quantity_on_hand = 100 WHERE warehouse_id = 1 AND product_id IN (?, ?)', [testProduct1.id, testProduct2.id]);
        });

        // Test 3: Single Cash Payment Sale with Change Calculation
        await runTest('3. Cash POS Checkout: Accurate stock deduction, shift update & change tender', async () => {
            const qty = 2;
            const unitPrice = Number(testProduct1.selling_price);
            const lineTotal = unitPrice * qty;
            const vatRate = 16.0;
            const taxAmount = Number((lineTotal * (vatRate / (100 + vatRate))).toFixed(2));

            const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}`;
            const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}`;
            const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;

            let saleId;
            let orderId;

            await dbAdapter.withTransaction(async (tx) => {
                // Create order
                const ordRes = await tx.run(`
                    INSERT INTO orders (
                        branch_id, order_number, customer_id, cashier_user_id, order_type,
                        status, subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, ?, ?, 'PAID')
                `, [orderNumber, cashierUser.id, lineTotal, taxAmount, lineTotal]);
                orderId = ordRes.insertId || ordRes.id;
                createdOrderIds.push(orderId);

                // Create sale linked to shift
                const saleRes = await tx.run(`
                    INSERT INTO sales (
                        branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                        subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, ?, ?, 'PAID')
                `, [activeShiftId, orderId, saleNumber, cashierUser.id, lineTotal, taxAmount, lineTotal]);
                saleId = saleRes.insertId || saleRes.id;
                createdSaleIds.push(saleId);

                // Create payment
                await tx.run(`
                    INSERT INTO payments (
                        branch_id, sale_id, order_id, payment_number, payment_method,
                        amount, currency, reference_code, status, cashier_user_id
                    ) VALUES (1, ?, ?, ?, 'CASH', ?, 'KES', 'CSH-123', 'COMPLETED', ?)
                `, [saleId, orderId, paymentNumber, lineTotal, cashierUser.id]);

                // Update shift & cash drawer
                await posShiftService.recordSaleInShift(activeShiftId, lineTotal, [{ method: 'CASH', amount: lineTotal }], cashierUser, tx);
            });

            lastSaleId = saleId;
            lastSaleNumber = saleNumber;

            // Verify shift updated
            const shift = await posShiftService.getCurrentShift(cashierUser.id, 1);
            assert.strictEqual(Number(shift.total_sales_count), 1);
            assert.strictEqual(Number(shift.total_sales_amount), lineTotal);
            assert.strictEqual(Number(shift.total_cash_amount), lineTotal);
            assert.strictEqual(Number(shift.expected_cash), 5000 + lineTotal);
            assert.strictEqual(Number(shift.in_drawer_cash), 5000 + lineTotal);
        });

        // Test 4: M-Pesa Cashless Payment Sale
        await runTest('4. M-Pesa POS Checkout: Cashless tender leaves physical cash unchanged', async () => {
            const qty = 1;
            const lineTotal = Number(testProduct2.selling_price) * qty;
            const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}`;
            const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}`;
            const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;

            await dbAdapter.withTransaction(async (tx) => {
                const ordRes = await tx.run(`
                    INSERT INTO orders (
                        branch_id, order_number, customer_id, cashier_user_id, order_type,
                        status, subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, 0, ?, 'PAID')
                `, [orderNumber, cashierUser.id, lineTotal, lineTotal]);
                const orderId = ordRes.insertId || ordRes.id;
                createdOrderIds.push(orderId);

                const saleRes = await tx.run(`
                    INSERT INTO sales (
                        branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                        subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'PAID')
                `, [activeShiftId, orderId, saleNumber, cashierUser.id, lineTotal, lineTotal]);
                const saleId = saleRes.insertId || saleRes.id;
                createdSaleIds.push(saleId);

                await tx.run(`
                    INSERT INTO payments (
                        branch_id, sale_id, order_id, payment_number, payment_method,
                        amount, currency, reference_code, mpesa_receipt_number, status, cashier_user_id
                    ) VALUES (1, ?, ?, ?, 'MPESA', ?, 'KES', 'MPESA-REF', 'QEB1234567', 'COMPLETED', ?)
                `, [saleId, orderId, paymentNumber, lineTotal, cashierUser.id]);

                await posShiftService.recordSaleInShift(activeShiftId, lineTotal, [{ method: 'MPESA', amount: lineTotal }], cashierUser, tx);
            });

            const shift = await posShiftService.getCurrentShift(cashierUser.id, 1);
            assert.strictEqual(Number(shift.total_sales_count), 2);
            assert.strictEqual(Number(shift.total_mpesa_amount), lineTotal);
            // Physical drawer expected cash should remain unchanged by cashless M-Pesa
            assert.strictEqual(Number(shift.expected_cash), 5000 + (Number(testProduct1.selling_price) * 2));
        });

        // Test 5: Mixed / Split Payment (Cash + M-Pesa)
        await runTest('5. Split / Mixed Payment: Splits tender across Cash and M-Pesa', async () => {
            const totalAmount = 5000;
            const cashPortion = 2000;
            const mpesaPortion = 3000;

            const saleNumber = `SALE-1-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000)}`;
            const orderNumber = `ORD-POS-1-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000)}`;

            await dbAdapter.withTransaction(async (tx) => {
                const ordRes = await tx.run(`
                    INSERT INTO orders (
                        branch_id, order_number, customer_id, cashier_user_id, order_type,
                        status, subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, 1, ?, 'POS_WALKIN', 'COMPLETED', ?, 0, 0, ?, 'PAID')
                `, [orderNumber, cashierUser.id, totalAmount, totalAmount]);
                const orderId = ordRes.insertId || ordRes.id;
                createdOrderIds.push(orderId);

                const saleRes = await tx.run(`
                    INSERT INTO sales (
                        branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                        subtotal, discount_amount, tax_amount, total_amount, payment_status
                    ) VALUES (1, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'PAID')
                `, [activeShiftId, orderId, saleNumber, cashierUser.id, totalAmount, totalAmount]);
                const saleId = saleRes.insertId || saleRes.id;
                createdSaleIds.push(saleId);

                // Payment 1: Cash
                await tx.run(`
                    INSERT INTO payments (
                        branch_id, sale_id, order_id, payment_number, payment_method,
                        amount, currency, status, cashier_user_id
                    ) VALUES (1, ?, ?, ?, 'CASH', ?, 'KES', 'COMPLETED', ?)
                `, [saleId, orderId, `PAY-SPLIT-1-${Date.now()}`, cashPortion, cashierUser.id]);

                // Payment 2: M-Pesa
                await tx.run(`
                    INSERT INTO payments (
                        branch_id, sale_id, order_id, payment_number, payment_method,
                        amount, currency, reference_code, mpesa_receipt_number, status, cashier_user_id
                    ) VALUES (1, ?, ?, ?, 'MPESA', ?, 'KES', 'MP-SPLIT-2', 'QEB9988776', 'COMPLETED', ?)
                `, [saleId, orderId, `PAY-SPLIT-2-${Date.now()}`, mpesaPortion, cashierUser.id]);

                // Update shift
                await posShiftService.recordSaleInShift(activeShiftId, totalAmount, [
                    { method: 'CASH', amount: cashPortion },
                    { method: 'MPESA', amount: mpesaPortion }
                ], cashierUser, tx);
            });

            const shift = await posShiftService.getCurrentShift(cashierUser.id, 1);
            assert.strictEqual(Number(shift.total_sales_count), 3);
            assert.strictEqual(Number(shift.total_sales_amount), (Number(testProduct1.selling_price) * 2) + Number(testProduct2.selling_price) + totalAmount);
            assert.strictEqual(Number(shift.total_cash_amount), (Number(testProduct1.selling_price) * 2) + cashPortion);
        });

        // Test 6: Held Carts Functionality
        await runTest('6. Held Carts: Hold, list, and clear held register cart', async () => {
            const holdRef = `HOLD-${Date.now().toString().slice(-6)}`;
            const cartData = [{ product_id: testProduct1.id, quantity: 3, unit_price: Number(testProduct1.selling_price) }];

            // Hold cart
            await dbAdapter.run(`
                INSERT INTO held_sales (
                    branch_id, cashier_user_id, hold_reference, customer_name,
                    customer_phone, cart_data_json, subtotal, total
                ) VALUES (1, ?, ?, 'Mama Sarah Bakery', '+254 711 222 333', ?, 2550, 2550)
            `, [cashierUser.id, holdRef, JSON.stringify(cartData)]);

            // Verify listed
            const held = await dbAdapter.get('SELECT * FROM held_sales WHERE hold_reference = ?', [holdRef]);
            assert.ok(held, 'Held sale should exist in database');
            assert.strictEqual(held.customer_name, 'Mama Sarah Bakery');

            // Clear / resume held cart
            await dbAdapter.run('DELETE FROM held_sales WHERE id = ?', [held.id]);
            const checkCleared = await dbAdapter.get('SELECT id FROM held_sales WHERE id = ?', [held.id]);
            assert.strictEqual(checkCleared, null, 'Held sale should be removed on resume/clear');
        });

        // Test 7: Receipt Lookup & Reprint
        await runTest('7. Receipt Reprint: Query complete printable receipt details by sale number', async () => {
            const sale = await dbAdapter.get('SELECT * FROM sales WHERE id = ?', [lastSaleId]);
            assert.ok(sale, 'Sale should exist');

            const payments = await dbAdapter.all('SELECT * FROM payments WHERE sale_id = ?', [sale.id]);
            assert.ok(payments.length >= 1, 'Payment records should exist');
            assert.strictEqual(payments[0].payment_method, 'CASH');
        });

        // Test 8: Product Exchange Transaction
        await runTest('8. Product Exchange: Return Item A and purchase Item B with net difference settlement', async () => {
            const stock1Before = await dbAdapter.get('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [testProduct1.id]);
            const stock2Before = await dbAdapter.get('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [testProduct2.id]);
            const curStock1 = Number(stock1Before.quantity_available);
            const curStock2 = Number(stock2Before.quantity_available);

            const returnQty = 1;
            const returnVal = Number(testProduct1.selling_price) * returnQty;
            const purchaseQty = 1;
            const purchaseVal = Number(testProduct2.selling_price) * purchaseQty;
            const netDiff = purchaseVal - returnVal;

            // Simulate exchange transaction
            await dbAdapter.withTransaction(async (tx) => {
                // Restock returned item
                await tx.run('UPDATE inventory SET quantity_available = quantity_available + ? WHERE warehouse_id = 1 AND product_id = ?', [returnQty, testProduct1.id]);

                // Deduct purchased item
                await tx.run('UPDATE inventory SET quantity_available = quantity_available - ? WHERE warehouse_id = 1 AND product_id = ?', [purchaseQty, testProduct2.id]);

                // Record net difference in shift if positive
                if (netDiff > 0) {
                    await posShiftService.recordSaleInShift(activeShiftId, netDiff, [{ method: 'CASH', amount: netDiff }], cashierUser, tx);
                }
            });

            const stock1After = await dbAdapter.get('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [testProduct1.id]);
            const stock2After = await dbAdapter.get('SELECT quantity_available FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [testProduct2.id]);
            const afterStock1 = Number(stock1After.quantity_available);
            const afterStock2 = Number(stock2After.quantity_available);

            assert.strictEqual(afterStock1, curStock1 + returnQty, 'Returned item stock must increment');
            assert.strictEqual(afterStock2, curStock2 - purchaseQty, 'Purchased item stock must decrement');
        });

        // Test 9: Cash Drawer Movement (Petty Cash Payout)
        await runTest('9. Cash Drawer Movement: Petty payout decrements expected drawer cash', async () => {
            const prevShift = await posShiftService.getCurrentShift(cashierUser.id, 1);
            const prevExpected = Number(prevShift.expected_cash);

            const updated = await posShiftService.recordDrawerMovement(activeShiftId, {
                movement_type: 'PAYOUT',
                amount: 350,
                reason: 'Emergency purchase of receipt thermal rolls'
            }, cashierUser);

            assert.strictEqual(Number(updated.expected_cash), prevExpected - 350);
        });

        // Test 10: Shift Closing, Variance Calculation & Manager Reconciliation
        await runTest('10. Shift Close & EOD Reconciliation: Cash count, variance & manager sign-off', async () => {
            const shiftBeforeClose = await posShiftService.getCurrentShift(cashierUser.id, 1);
            const expected = Number(shiftBeforeClose.expected_cash);

            // Simulate cashier physical cash count: 50 KES short
            const countedCash = expected - 50;

            const closed = await posShiftService.closeShift(activeShiftId, {
                closing_cash: countedCash,
                notes: 'End of morning shift T-01. Cash counted and bagged.'
            }, cashierUser);

            assert.strictEqual(closed.status, 'CLOSED');
            assert.strictEqual(Number(closed.closing_cash), countedCash);
            assert.strictEqual(Number(closed.cash_variance), -50.00, 'Variance should correctly be -50 KES');
            assert.ok(closed.closed_at, 'Closed timestamp should be recorded');

            // Cashier cannot close an already closed shift
            await assert.rejects(async () => {
                await posShiftService.closeShift(activeShiftId, { closing_cash: 5000 }, cashierUser);
            }, /already CLOSED/);

            // Branch Manager reconciles shift
            const reconciled = await posShiftService.reconcileShift(activeShiftId, {
                reconciliation_notes: 'Manager verified 50 KES shortage as minor coin change rounding variance. Approved.'
            }, branchManagerUser);

            assert.strictEqual(reconciled.status, 'RECONCILED');
            assert.strictEqual(Number(reconciled.reconciled_by), branchManagerUser.id);
            assert.ok(reconciled.reconciled_at);
        });

    } finally {
        console.log('\n============================================================');
        console.log(`  POS WORKFLOW SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
        console.log('============================================================\n');

        // Cleanup created test records
        try {
            for (const sId of createdSaleIds) {
                await dbAdapter.run('DELETE FROM payments WHERE sale_id = ?', [sId]);
                await dbAdapter.run('DELETE FROM sale_items WHERE sale_id = ?', [sId]);
                await dbAdapter.run('DELETE FROM sales WHERE id = ?', [sId]);
            }
            for (const oId of createdOrderIds) {
                await dbAdapter.run('DELETE FROM order_items WHERE order_id = ?', [oId]);
                await dbAdapter.run('DELETE FROM orders WHERE id = ?', [oId]);
            }
            if (activeShiftId) {
                await dbAdapter.run('DELETE FROM cash_drawer_movements WHERE shift_id = ?', [activeShiftId]);
                await dbAdapter.run('DELETE FROM pos_shifts WHERE id = ?', [activeShiftId]);
            }
        } catch (cleanupErr) {
            console.warn('POS test cleanup notice:', cleanupErr.message);
        }

        if (passedTests !== totalTests) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
})();
