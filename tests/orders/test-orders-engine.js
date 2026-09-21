// tests/orders/test-orders-engine.js
// SwiftTrack Kenya: Phase 6 Orders Engine & State Machine Integration Suite
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const orderService = require('../../server/services/orderService.js');
const inventoryStateService = require('../../server/services/inventoryStateService.js');

console.log('\n============================================================');
console.log('📦  SWIFTTRACK KENYA: PHASE 6 ORDERS ENGINE SUITE');
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
        console.error(`  Error: ${err.message}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Ensure test users and products exist
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
    WHERE r.name = 'CASHIER' AND u.branch_id = 1
    LIMIT 1
`).get() || { id: 4, role: 'CASHIER', roleName: 'CASHIER', branchId: 1 };
cashierUser.roleName = 'CASHIER';
cashierUser.branchId = cashierUser.branch_id || 1;

// Ensure test customer
let testCustomer = db.prepare("SELECT * FROM customers WHERE status = 'ACTIVE' LIMIT 1").get();
if (!testCustomer) {
    const res = db.prepare(`
        INSERT INTO customers (branch_id, customer_number, full_name, phone, email, status)
        VALUES (1, 'CUST-ORD-001', 'Orders Engine Test Customer', '+254711999888', 'ordtest@example.com', 'ACTIVE')
    `).run();
    testCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.lastInsertRowid);
}

// Fetch two test products with known inventory in Warehouse 1
const prodA = db.prepare('SELECT * FROM products WHERE is_active = 1 LIMIT 1').get();
const prodB = db.prepare('SELECT * FROM products WHERE is_active = 1 AND id != ? LIMIT 1').get(prodA.id);

// Reset inventory for test products
function resetInventory(prodId, qtyOnHand) {
    let inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodId);
    if (!inv) {
        db.prepare(`
            INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_available, quantity_reserved, quantity_in_transit, quantity_damaged, quantity_expired)
            VALUES (1, 1, ?, ?, ?, 0, 0, 0, 0)
        `).run(prodId, qtyOnHand, qtyOnHand);
    } else {
        db.prepare(`
            UPDATE inventory
            SET quantity_on_hand = ?, quantity_available = ?, quantity_reserved = 0, quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(qtyOnHand, qtyOnHand, inv.id);
    }
}

resetInventory(prodA.id, 50);
resetInventory(prodB.id, 30);

let draftOrderId = null;
let draftOrderNumber = null;

// Test 1: Draft Order Creation
runTest('1. Order Creation: Create DRAFT order without reserving inventory', () => {
    const invABefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);

    const orderRes = orderService.createOrder({
        branch_id: 1,
        customer_id: testCustomer.id,
        initial_status: 'DRAFT',
        delivery_address: 'Enterprise Road, Gate 4',
        delivery_city: 'Nairobi',
        delivery_fee: 350,
        items: [{ product_id: prodA.id, quantity: 5, unit_price: prodA.selling_price }]
    }, cashierUser);

    assert.ok(orderRes.id, 'Order should have an ID');
    assert.strictEqual(orderRes.status, 'DRAFT', 'Order status must be DRAFT');
    assert.strictEqual(orderRes.delivery_fee, 350, 'Delivery fee must be 350');
    assert.strictEqual(orderRes.subtotal, 5 * prodA.selling_price, 'Subtotal must match');
    assert.strictEqual(orderRes.total_amount, (5 * prodA.selling_price) + 350, 'Total must include delivery fee');

    draftOrderId = orderRes.id;
    draftOrderNumber = orderRes.order_number;

    // Verify inventory was NOT reserved
    const invAAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    assert.strictEqual(invAAfter.quantity_available, invABefore.quantity_available, 'Available inventory should remain unreserved');
    assert.strictEqual(invAAfter.quantity_reserved, invABefore.quantity_reserved, 'Reserved inventory should remain 0');

    // Verify order flag
    const ordDb = db.prepare('SELECT * FROM orders WHERE id = ?').get(draftOrderId);
    assert.strictEqual(ordDb.inventory_allocated, 0, 'Inventory allocated flag must be 0 for DRAFT');
});

// Test 2: Order Editing Before Fulfillment
runTest('2. Order Editing: Modify line items and delivery fee before fulfillment', () => {
    const edited = orderService.editOrder(draftOrderId, {
        delivery_fee: 450,
        delivery_address: 'Enterprise Road, Gate 8 Logistics Yard',
        items: [
            { product_id: prodA.id, quantity: 3, unit_price: prodA.selling_price },
            { product_id: prodB.id, quantity: 4, unit_price: prodB.selling_price }
        ]
    }, cashierUser);

    assert.strictEqual(edited.delivery_fee, 450);
    assert.strictEqual(edited.items.length, 2);
    assert.strictEqual(edited.delivery_address, 'Enterprise Road, Gate 8 Logistics Yard');

    const expectedSubtotal = (3 * prodA.selling_price) + (4 * prodB.selling_price);
    assert.strictEqual(edited.subtotal, expectedSubtotal);
    assert.strictEqual(edited.total_amount, expectedSubtotal + 450);
});

// Test 3: Transition DRAFT -> CONFIRMED allocates inventory reservation
runTest('3. Confirmation & Allocation: Transition to CONFIRMED reserves inventory', () => {
    const invABefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    const invBBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodB.id);

    const confirmed = orderService.transitionOrderStatus(draftOrderId, 'CONFIRMED', {
        notes: 'Customer confirmed via WhatsApp'
    }, cashierUser);

    assert.strictEqual(confirmed.status, 'CONFIRMED');
    assert.strictEqual(confirmed.inventory_allocated, 1, 'Inventory allocated flag should be 1');

    // Verify inventory reservation
    const invAAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    const invBAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodB.id);

    assert.strictEqual(invAAfter.quantity_reserved, invABefore.quantity_reserved + 3, 'Prod A: 3 units reserved');
    assert.strictEqual(invAAfter.quantity_available, invABefore.quantity_available - 3, 'Prod A: Available decremented by 3');

    assert.strictEqual(invBAfter.quantity_reserved, invBBefore.quantity_reserved + 4, 'Prod B: 4 units reserved');
    assert.strictEqual(invBAfter.quantity_available, invBBefore.quantity_available - 4, 'Prod B: Available decremented by 4');
});

// Test 4: Progression CONFIRMED -> PAID -> PROCESSING -> PACKED
runTest('4. Order Progression: Progress through PAID, PROCESSING, and PACKED', () => {
    const paid = orderService.transitionOrderStatus(draftOrderId, 'PAID', { notes: 'M-Pesa payment confirmed' }, cashierUser);
    assert.strictEqual(paid.status, 'PAID');

    const processing = orderService.transitionOrderStatus(draftOrderId, 'PROCESSING', { notes: 'Warehouse pick list printed' }, cashierUser);
    assert.strictEqual(processing.status, 'PROCESSING');

    const packed = orderService.transitionOrderStatus(draftOrderId, 'PACKED', { notes: 'Carton sealed and labeled' }, cashierUser);
    assert.strictEqual(packed.status, 'PACKED');
});

// Test 5: Edit Rejection after Fulfillment
runTest('5. Fulfillment Lock: Editing rejected once order is in PACKED or beyond', () => {
    assert.throws(() => {
        orderService.editOrder(draftOrderId, { delivery_fee: 100 }, cashierUser);
    }, (err) => {
        return err.code === 'ORDER_LOCKED_FOR_EDITING';
    }, 'Editing order after fulfillment must throw ORDER_LOCKED_FOR_EDITING');
});

// Test 6: CRITICAL INVARIANT GUARD: READY_FOR_DISPATCH requires allocated inventory
runTest('6. Critical Invariant Guard: READY_FOR_DISPATCH rejected if unallocated inventory', () => {
    // Create an unallocated order with demand (99,999) exceeding available stock
    const shortOrder = orderService.createOrder({
        branch_id: 1,
        customer_id: testCustomer.id,
        initial_status: 'DRAFT',
        items: [{ product_id: prodB.id, quantity: 99999 }]
    }, cashierUser);

    // Bypass to PACKED via super admin
    db.prepare("UPDATE orders SET status = 'PACKED', inventory_allocated = 0 WHERE id = ?").run(shortOrder.id);

    // Attempt transition to READY_FOR_DISPATCH
    assert.throws(() => {
        orderService.transitionOrderStatus(shortOrder.id, 'READY_FOR_DISPATCH', {}, adminUser);
    }, (err) => {
        return err.code === 'INVENTORY_NOT_ALLOCATED';
    }, 'Must reject transition to READY_FOR_DISPATCH when inventory cannot be allocated');

    // Verify our legitimate order progresses to READY_FOR_DISPATCH
    const ready = orderService.transitionOrderStatus(draftOrderId, 'READY_FOR_DISPATCH', {
        notes: 'Staged at dispatch loading bay 2'
    }, cashierUser);

    assert.strictEqual(ready.status, 'READY_FOR_DISPATCH');
});

// Test 7: Dispatch & Physical Stock Deduction
runTest('7. Dispatch Execution: DISPATCHED decrements ON_HAND and shifts to IN_TRANSIT', () => {
    const invABefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);

    const dispatched = orderService.transitionOrderStatus(draftOrderId, 'DISPATCHED', {
        notes: 'Driver Joseph Kiprop scanned package out'
    }, cashierUser);

    assert.strictEqual(dispatched.status, 'DISPATCHED');

    // Verify physical ON_HAND was decremented by 3 and RESERVED decremented by 3
    const invAAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    assert.strictEqual(invAAfter.quantity_on_hand, invABefore.quantity_on_hand - 3, 'ON_HAND must decrement upon dispatch');
    assert.strictEqual(invAAfter.quantity_reserved, invABefore.quantity_reserved - 3, 'RESERVED must decrement upon dispatch');
});

// Test 8: In Transit & Delivered Lifecycle
runTest('8. Delivery Completion: IN_TRANSIT to DELIVERED with POD timestamp', () => {
    const inTransit = orderService.transitionOrderStatus(draftOrderId, 'IN_TRANSIT', { notes: 'Van in transit to Westlands' }, cashierUser);
    assert.strictEqual(inTransit.status, 'IN_TRANSIT');

    const delivered = orderService.transitionOrderStatus(draftOrderId, 'DELIVERED', { notes: 'Recipient signed POD' }, cashierUser);
    assert.strictEqual(delivered.status, 'DELIVERED');
    assert.ok(delivered.delivered_at, 'delivered_at timestamp must be recorded');
});

// Test 9: Cancellation & Automatic Inventory Release
runTest('9. Order Cancellation: Cancelling CONFIRMED order automatically releases reserved stock', () => {
    resetInventory(prodA.id, 40);
    const invABefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);

    const cancelTarget = orderService.createOrder({
        branch_id: 1,
        customer_id: testCustomer.id,
        initial_status: 'CONFIRMED',
        items: [{ product_id: prodA.id, quantity: 10 }]
    }, cashierUser);

    const invAMid = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    assert.strictEqual(invAMid.quantity_reserved, invABefore.quantity_reserved + 10, '10 units reserved on CONFIRMED');
    assert.strictEqual(invAMid.quantity_available, invABefore.quantity_available - 10);

    // Cancel order
    const cancelled = orderService.transitionOrderStatus(cancelTarget.id, 'CANCELLED', {
        reason: 'Customer requested cancellation prior to packing'
    }, cashierUser);

    assert.strictEqual(cancelled.status, 'CANCELLED');
    assert.strictEqual(cancelled.inventory_allocated, 0, 'inventory_allocated reset to 0');
    assert.ok(cancelled.cancelled_at, 'cancelled_at recorded');

    // Verify reserved inventory was released back to AVAILABLE
    const invAFinal = db.prepare('SELECT * FROM inventory WHERE warehouse_id = 1 AND product_id = ?').get(prodA.id);
    assert.strictEqual(invAFinal.quantity_reserved, invABefore.quantity_reserved, 'Reserved restored');
    assert.strictEqual(invAFinal.quantity_available, invABefore.quantity_available, 'Available restored');
});

// Test 10: Status History, Timeline, Internal Notes, Invoice & CSV Export
runTest('10. Audit, Invoice & Export: Timeline integrity, staff notes, tax invoice & CSV', () => {
    // Add internal note
    orderService.addInternalNote(draftOrderId, 'Customer requested morning delivery before 11am', cashierUser);

    const order = orderService.getOrderById(draftOrderId, cashierUser);
    assert.ok(order.timeline.length >= 6, 'Timeline must track every transition');
    assert.strictEqual(order.internal_notes_list.length, 1, 'Internal note recorded');
    assert.strictEqual(order.internal_notes_list[0].note, 'Customer requested morning delivery before 11am');

    // Generate Invoice Data
    const invoice = orderService.generateInvoiceData(draftOrderId, cashierUser);
    assert.strictEqual(invoice.invoice_number, `INV-${order.order_number}`);
    assert.strictEqual(invoice.delivery_fee, 450);
    assert.ok(invoice.tax_amount > 0, 'KRA VAT must be calculated');
    assert.ok(invoice.etr_compliance.fiscal_code, 'ETR fiscal code generated');

    // CSV Export
    const csv = orderService.exportOrdersToCsv({ limit: 10 }, cashierUser);
    assert.ok(csv.includes('Order Number,Date,Branch'), 'CSV header present');
    assert.ok(csv.includes(order.order_number), 'Export contains order number');
});

console.log('\n============================================================');
console.log(`📊  ORDERS ENGINE SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
