// tests/orders/test-orders-engine.js
// SwiftTrack Kenya: Phase 6 Orders Engine & State Machine Integration Suite
const assert = require('assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const orderService = require('../../server/services/orderService.js');
const inventoryStateService = require('../../server/services/inventoryStateService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK KENYA: PHASE 6 ORDERS ENGINE SUITE');
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

async function resetInventory(prodId, qtyOnHand) {
    let inv = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodId]);
    if (!inv) {
        await dbAdapter.run(`
            INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_available, quantity_reserved, quantity_in_transit, quantity_damaged, quantity_expired)
            VALUES (1, 1, ?, ?, ?, 0, 0, 0, 0)
        `, [prodId, qtyOnHand, qtyOnHand]);
    } else {
        await dbAdapter.run(`
            UPDATE inventory
            SET quantity_on_hand = ?, quantity_available = ?, quantity_reserved = 0, quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [qtyOnHand, qtyOnHand, inv.id]);
    }
}

(async () => {
    let draftOrderId = null;
    let draftOrderNumber = null;
    const createdOrderIds = [];

    try {
        // Ensure test users exist
        const adminUser = (await dbAdapter.get(`
            SELECT u.*, r.name as roleName, r.name as role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'SUPER_ADMIN'
            LIMIT 1
        `)) || { id: 1, role: 'SUPER_ADMIN', roleName: 'SUPER_ADMIN', branchId: 1 };
        adminUser.roleName = 'SUPER_ADMIN';
        adminUser.branchId = adminUser.branch_id || 1;

        const cashierUser = (await dbAdapter.get(`
            SELECT u.*, r.name as roleName, r.name as role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'CASHIER' AND u.branch_id = 1
            LIMIT 1
        `)) || { id: 4, role: 'CASHIER', roleName: 'CASHIER', branchId: 1 };
        cashierUser.roleName = 'CASHIER';
        cashierUser.branchId = cashierUser.branch_id || 1;

        // Ensure test customer
        let testCustomer = await dbAdapter.get("SELECT * FROM customers WHERE status = 'ACTIVE' LIMIT 1");
        if (!testCustomer) {
            const res = await dbAdapter.run(`
                INSERT INTO customers (branch_id, customer_number, full_name, phone, email, status)
                VALUES (1, 'CUST-ORD-001', 'Orders Engine Test Customer', '+254711999888', 'ordtest@example.com', 'ACTIVE')
            `);
            testCustomer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [res.insertId || res.id]);
        }

        // Fetch two test products with known inventory in Warehouse 1
        const prodA = await dbAdapter.get('SELECT * FROM products WHERE is_active = true LIMIT 1');
        const prodB = await dbAdapter.get('SELECT * FROM products WHERE is_active = true AND id != ? LIMIT 1', [prodA.id]);

        await resetInventory(prodA.id, 50);
        await resetInventory(prodB.id, 30);

        // Test 1: Draft Order Creation
        await runTest('1. Order Creation: Create DRAFT order without reserving inventory', async () => {
            const invABefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);

            const orderRes = await orderService.createOrder({
                branch_id: 1,
                customer_id: testCustomer.id,
                initial_status: 'DRAFT',
                delivery_address: 'Enterprise Road, Gate 4',
                delivery_city: 'Nairobi',
                delivery_fee: 350,
                items: [{ product_id: prodA.id, quantity: 5, unit_price: Number(prodA.selling_price) }]
            }, cashierUser);

            assert.ok(orderRes.id, 'Order should have an ID');
            createdOrderIds.push(orderRes.id);
            assert.strictEqual(orderRes.status, 'DRAFT', 'Order status must be DRAFT');
            assert.strictEqual(Number(orderRes.delivery_fee), 350, 'Delivery fee must be 350');
            assert.strictEqual(Number(orderRes.subtotal), 5 * Number(prodA.selling_price), 'Subtotal must match');
            assert.strictEqual(Number(orderRes.total_amount), (5 * Number(prodA.selling_price)) + 350, 'Total must include delivery fee');

            draftOrderId = orderRes.id;
            draftOrderNumber = orderRes.order_number;

            // Verify inventory was NOT reserved
            const invAAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            assert.strictEqual(Number(invAAfter.quantity_available), Number(invABefore.quantity_available), 'Available inventory should remain unreserved');
            assert.strictEqual(Number(invAAfter.quantity_reserved), Number(invABefore.quantity_reserved), 'Reserved inventory should remain 0');

            // Verify order flag
            const ordDb = await dbAdapter.get('SELECT * FROM orders WHERE id = ?', [draftOrderId]);
            assert.strictEqual(Number(ordDb.inventory_allocated || 0), 0, 'Inventory allocated flag must be 0 for DRAFT');
        });

        // Test 2: Order Editing Before Fulfillment
        await runTest('2. Order Editing: Modify line items and delivery fee before fulfillment', async () => {
            const edited = await orderService.editOrder(draftOrderId, {
                delivery_fee: 450,
                delivery_address: 'Enterprise Road, Gate 8 Logistics Yard',
                items: [
                    { product_id: prodA.id, quantity: 3, unit_price: Number(prodA.selling_price) },
                    { product_id: prodB.id, quantity: 4, unit_price: Number(prodB.selling_price) }
                ]
            }, cashierUser);

            assert.strictEqual(Number(edited.delivery_fee), 450);
            assert.strictEqual(edited.items.length, 2);
            assert.strictEqual(edited.delivery_address, 'Enterprise Road, Gate 8 Logistics Yard');

            const expectedSubtotal = (3 * Number(prodA.selling_price)) + (4 * Number(prodB.selling_price));
            assert.strictEqual(Number(edited.subtotal), expectedSubtotal);
            assert.strictEqual(Number(edited.total_amount), expectedSubtotal + 450);
        });

        // Test 3: Transition DRAFT -> CONFIRMED allocates inventory reservation
        await runTest('3. Confirmation & Allocation: Transition to CONFIRMED reserves inventory', async () => {
            const invABefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            const invBBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodB.id]);

            const confirmed = await orderService.transitionOrderStatus(draftOrderId, 'CONFIRMED', {
                notes: 'Customer confirmed via WhatsApp'
            }, cashierUser);

            assert.strictEqual(confirmed.status, 'CONFIRMED');
            assert.strictEqual(Number(confirmed.inventory_allocated), 1, 'Inventory allocated flag should be 1');

            // Verify inventory reservation
            const invAAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            const invBAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodB.id]);

            assert.strictEqual(Number(invAAfter.quantity_reserved), Number(invABefore.quantity_reserved) + 3, 'Prod A: 3 units reserved');
            assert.strictEqual(Number(invAAfter.quantity_available), Number(invABefore.quantity_available) - 3, 'Prod A: Available decremented by 3');

            assert.strictEqual(Number(invBAfter.quantity_reserved), Number(invBBefore.quantity_reserved) + 4, 'Prod B: 4 units reserved');
            assert.strictEqual(Number(invBAfter.quantity_available), Number(invBBefore.quantity_available) - 4, 'Prod B: Available decremented by 4');
        });

        // Test 4: Progression CONFIRMED -> PAID -> PROCESSING -> PACKED
        await runTest('4. Order Progression: Progress through PAID, PROCESSING, and PACKED', async () => {
            const paid = await orderService.transitionOrderStatus(draftOrderId, 'PAID', { notes: 'M-Pesa payment confirmed' }, cashierUser);
            assert.strictEqual(paid.status, 'PAID');

            const processing = await orderService.transitionOrderStatus(draftOrderId, 'PROCESSING', { notes: 'Warehouse pick list printed' }, cashierUser);
            assert.strictEqual(processing.status, 'PROCESSING');

            const packed = await orderService.transitionOrderStatus(draftOrderId, 'PACKED', { notes: 'Carton sealed and labeled' }, cashierUser);
            assert.strictEqual(packed.status, 'PACKED');
        });

        // Test 5: Edit Rejection after Fulfillment
        await runTest('5. Fulfillment Lock: Editing rejected once order is in PACKED or beyond', async () => {
            await assert.rejects(async () => {
                await orderService.editOrder(draftOrderId, { delivery_fee: 100 }, cashierUser);
            }, (err) => {
                return err.code === 'ORDER_LOCKED_FOR_EDITING';
            }, 'Editing order after fulfillment must throw ORDER_LOCKED_FOR_EDITING');
        });

        // Test 6: CRITICAL INVARIANT GUARD: READY_FOR_DISPATCH requires allocated inventory
        await runTest('6. Critical Invariant Guard: READY_FOR_DISPATCH rejected if unallocated inventory', async () => {
            // Create an unallocated order with demand (99,999) exceeding available stock
            const shortOrder = await orderService.createOrder({
                branch_id: 1,
                customer_id: testCustomer.id,
                initial_status: 'DRAFT',
                items: [{ product_id: prodB.id, quantity: 99999 }]
            }, cashierUser);
            createdOrderIds.push(shortOrder.id);

            // Bypass to PACKED via direct update
            await dbAdapter.run("UPDATE orders SET status = 'PACKED', inventory_allocated = 0 WHERE id = ?", [shortOrder.id]);

            // Attempt transition to READY_FOR_DISPATCH
            await assert.rejects(async () => {
                await orderService.transitionOrderStatus(shortOrder.id, 'READY_FOR_DISPATCH', {}, adminUser);
            }, (err) => {
                return err.code === 'INVENTORY_NOT_ALLOCATED';
            }, 'Must reject transition to READY_FOR_DISPATCH when inventory cannot be allocated');

            // Verify our legitimate order progresses to READY_FOR_DISPATCH
            const ready = await orderService.transitionOrderStatus(draftOrderId, 'READY_FOR_DISPATCH', {
                notes: 'Staged at dispatch loading bay 2'
            }, cashierUser);

            assert.strictEqual(ready.status, 'READY_FOR_DISPATCH');
        });

        // Test 7: Dispatch & Physical Stock Deduction
        await runTest('7. Dispatch Execution: DISPATCHED decrements ON_HAND and shifts to IN_TRANSIT', async () => {
            const invABefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);

            const dispatched = await orderService.transitionOrderStatus(draftOrderId, 'DISPATCHED', {
                notes: 'Driver Joseph Kiprop scanned package out'
            }, cashierUser);

            assert.strictEqual(dispatched.status, 'DISPATCHED');

            // Verify physical ON_HAND was decremented by 3 and RESERVED decremented by 3
            const invAAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            assert.strictEqual(Number(invAAfter.quantity_on_hand), Number(invABefore.quantity_on_hand) - 3, 'ON_HAND must decrement upon dispatch');
            assert.strictEqual(Number(invAAfter.quantity_reserved), Number(invABefore.quantity_reserved) - 3, 'RESERVED must decrement upon dispatch');
        });

        // Test 8: In Transit & Delivered Lifecycle
        await runTest('8. Delivery Completion: IN_TRANSIT to DELIVERED with POD timestamp', async () => {
            const inTransit = await orderService.transitionOrderStatus(draftOrderId, 'IN_TRANSIT', { notes: 'Van in transit to Westlands' }, cashierUser);
            assert.strictEqual(inTransit.status, 'IN_TRANSIT');

            const delivered = await orderService.transitionOrderStatus(draftOrderId, 'DELIVERED', { notes: 'Recipient signed POD' }, cashierUser);
            assert.strictEqual(delivered.status, 'DELIVERED');
            assert.ok(delivered.delivered_at, 'delivered_at timestamp must be recorded');
        });

        // Test 9: Cancellation & Automatic Inventory Release
        await runTest('9. Order Cancellation: Cancelling CONFIRMED order automatically releases reserved stock', async () => {
            await resetInventory(prodA.id, 40);
            const invABefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);

            const cancelTarget = await orderService.createOrder({
                branch_id: 1,
                customer_id: testCustomer.id,
                initial_status: 'CONFIRMED',
                items: [{ product_id: prodA.id, quantity: 10 }]
            }, cashierUser);
            createdOrderIds.push(cancelTarget.id);

            const invAMid = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            assert.strictEqual(Number(invAMid.quantity_reserved), Number(invABefore.quantity_reserved) + 10, '10 units reserved on CONFIRMED');
            assert.strictEqual(Number(invAMid.quantity_available), Number(invABefore.quantity_available) - 10);

            // Cancel order
            const cancelled = await orderService.transitionOrderStatus(cancelTarget.id, 'CANCELLED', {
                reason: 'Customer requested cancellation prior to packing'
            }, cashierUser);

            assert.strictEqual(cancelled.status, 'CANCELLED');
            assert.strictEqual(Number(cancelled.inventory_allocated || 0), 0, 'inventory_allocated reset to 0');
            assert.ok(cancelled.cancelled_at, 'cancelled_at recorded');

            // Verify reserved inventory was released back to AVAILABLE
            const invAFinal = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?', [prodA.id]);
            assert.strictEqual(Number(invAFinal.quantity_reserved), Number(invABefore.quantity_reserved), 'Reserved restored');
            assert.strictEqual(Number(invAFinal.quantity_available), Number(invABefore.quantity_available), 'Available restored');
        });

        // Test 10: Status History, Timeline, Internal Notes, Invoice & CSV Export
        await runTest('10. Audit, Invoice & Export: Timeline integrity, staff notes, tax invoice & CSV', async () => {
            // Add internal note
            await orderService.addInternalNote(draftOrderId, 'Customer requested morning delivery before 11am', cashierUser);

            const order = await orderService.getOrderById(draftOrderId, cashierUser);
            assert.ok(order.timeline.length >= 6, 'Timeline must track every transition');
            assert.strictEqual(order.internal_notes_list.length, 1, 'Internal note recorded');
            assert.strictEqual(order.internal_notes_list[0].note, 'Customer requested morning delivery before 11am');

            // Generate Invoice Data
            const invoice = await orderService.generateInvoiceData(draftOrderId, cashierUser);
            assert.strictEqual(invoice.invoice_number, `INV-${order.order_number}`);
            assert.strictEqual(Number(invoice.delivery_fee), 450);
            assert.ok(Number(invoice.tax_amount) > 0, 'KRA VAT must be calculated');
            assert.ok(invoice.etr_compliance.fiscal_code, 'ETR fiscal code generated');

            // CSV Export
            const csv = await orderService.exportOrdersToCsv({ limit: 10 }, cashierUser);
            assert.ok(csv.includes('Order Number,Date,Branch'), 'CSV header present');
            assert.ok(csv.includes(order.order_number), 'Export contains order number');
        });

    } finally {
        console.log('\n============================================================');
        console.log(`  ORDERS ENGINE SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
        console.log('============================================================\n');

        // Cleanup
        try {
            for (const ordId of createdOrderIds) {
                await dbAdapter.run('DELETE FROM order_internal_notes WHERE order_id = ?', [ordId]);
                await dbAdapter.run('DELETE FROM order_status_history WHERE order_id = ?', [ordId]);
                await dbAdapter.run('DELETE FROM deliveries WHERE order_id = ?', [ordId]);
                await dbAdapter.run('DELETE FROM order_items WHERE order_id = ?', [ordId]);
                await dbAdapter.run('DELETE FROM orders WHERE id = ?', [ordId]);
            }
        } catch (cleanupErr) {
            console.warn('Orders test cleanup notice:', cleanupErr.message);
        }

        if (passedTests !== totalTests) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
})();
