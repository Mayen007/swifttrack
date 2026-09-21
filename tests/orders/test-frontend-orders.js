// tests/orders/test-frontend-orders.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('📦  SWIFTTRACK KENYA: PHASE 6 FRONTEND ORDERS ENGINE TEST');
console.log('============================================================\n');

const ordersViewPath = path.join(__dirname, '../../client/src/views/OrdersView.jsx');
assert.ok(fs.existsSync(ordersViewPath), 'OrdersView.jsx must exist');

const ordersViewContent = fs.readFileSync(ordersViewPath, 'utf8');

console.log('▶ TEST 1: State Machine Steps & Alternative States Definition...');
const expectedSteps = ['DRAFT', 'CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED'];
for (const step of expectedSteps) {
  assert.ok(ordersViewContent.includes(step), `OrdersView must define state step: ${step}`);
}
assert.ok(ordersViewContent.includes('STATE_MACHINE_STEPS'), 'OrdersView must define STATE_MACHINE_STEPS constant');
assert.ok(ordersViewContent.includes('CANCELLED'), 'OrdersView must support CANCELLED state');
assert.ok(ordersViewContent.includes('FAILED_DELIVERY'), 'OrdersView must support FAILED_DELIVERY state');
console.log('  ✔ State machine progression and alternative states verified');

console.log('▶ TEST 2: Critical Invariant Guard & Allocation UI Badge...');
assert.ok(ordersViewContent.includes('READY_FOR_DISPATCH'), 'OrdersView includes READY_FOR_DISPATCH check');
assert.ok(ordersViewContent.includes('inventory_allocated'), 'OrdersView checks inventory_allocated flag');
assert.ok(ordersViewContent.includes('ALLOCATED'), 'OrdersView renders ALLOCATED stock badge');
assert.ok(ordersViewContent.includes('UNALLOCATED'), 'OrdersView renders UNALLOCATED stock badge');
console.log('  ✔ Critical inventory allocation guard indicators verified in UI');

console.log('▶ TEST 3: State Transition Handlers & Fulfillment Lock...');
assert.ok(ordersViewContent.includes('handleTransitionStatus'), 'OrdersView must implement handleTransitionStatus');
assert.ok(ordersViewContent.includes('isFulfillmentLocked'), 'OrdersView must implement isFulfillmentLocked logic');
assert.ok(ordersViewContent.includes('handleOpenEdit'), 'OrdersView must implement handleOpenEdit');
assert.ok(ordersViewContent.includes('handleConfirmCancel'), 'OrdersView must implement handleConfirmCancel with reason');
console.log('  ✔ State transition handlers & edit fulfillment locking verified');

console.log('▶ TEST 4: Order Detail Modal & Tabbed Navigation...');
assert.ok(ordersViewContent.includes('detailTab'), 'OrdersView must have detailTab state');
assert.ok(ordersViewContent.includes("'items'"), 'OrdersView must have Items tab');
assert.ok(ordersViewContent.includes("'customer'"), 'OrdersView must have Customer & Delivery Address tab');
assert.ok(ordersViewContent.includes("'timeline'"), 'OrdersView must have Chronological Timeline tab');
assert.ok(ordersViewContent.includes("'notes'"), 'OrdersView must have Internal Staff Notes tab');
assert.ok(ordersViewContent.includes("'delivery'"), 'OrdersView must have Delivery & Fleet tab');
assert.ok(ordersViewContent.includes('handleAddNote'), 'OrdersView must implement handleAddNote');
console.log('  ✔ Interactive detail modal tabs and internal staff notes verified');

console.log('▶ TEST 5: Create / Edit Order Modal & Line Items Picker...');
assert.ok(ordersViewContent.includes('orderFormOpen'), 'OrdersView has orderFormOpen state');
assert.ok(ordersViewContent.includes('formCustomerId'), 'OrdersView has formCustomerId state');
assert.ok(ordersViewContent.includes('formDeliveryAddress'), 'OrdersView has formDeliveryAddress state');
assert.ok(ordersViewContent.includes('formDeliveryFee'), 'OrdersView has formDeliveryFee state');
assert.ok(ordersViewContent.includes('formItems'), 'OrdersView has formItems state');
assert.ok(ordersViewContent.includes('handleSubmitOrder'), 'OrdersView implements handleSubmitOrder');
console.log('  ✔ Order form with customer association and delivery fee verified');

console.log('▶ TEST 6: Commercial Tax Invoice, Thermal Receipt & CSV Export...');
assert.ok(ordersViewContent.includes('invoiceModalOpen'), 'OrdersView has invoiceModalOpen state');
assert.ok(ordersViewContent.includes('handleViewInvoice'), 'OrdersView implements handleViewInvoice');
assert.ok(ordersViewContent.includes('receiptModalOpen'), 'OrdersView has receiptModalOpen state');
assert.ok(ordersViewContent.includes('handleViewReceipt'), 'OrdersView implements handleViewReceipt');
assert.ok(ordersViewContent.includes('handleExportCsv'), 'OrdersView implements handleExportCsv');
assert.ok(ordersViewContent.includes('KRA PIN'), 'OrdersView renders KRA PIN in Tax Invoice');
console.log('  ✔ Commercial Tax Invoice, thermal receipt, and CSV export verified');

console.log('\n============================================================');
console.log('🎉  ALL 6 FRONTEND ORDERS ENGINE ASSERTIONS PASSED!');
console.log('============================================================\n');
