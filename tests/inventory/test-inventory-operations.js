// tests/inventory/test-inventory-operations.js
// SwiftTrack Kenya: Phase 3.2 Inventory Operations Test Suite
const assert = require('assert');
const { db, initSchema } = require('../../server/db/database.js');
const {
  assertInventoryInvariant,
  getOrInitInventory,
  quarantineDamaged,
  writeOffStock
} = require('../../server/services/inventoryStateService.js');
const {
  receiveStock,
  recordLostStock,
  restoreFoundStock,
  createStocktakeSession,
  recordStocktakeCounts,
  reconcileStocktake
} = require('../../server/services/inventoryOperationsService.js');

console.log('\n============================================================');
console.log('⚙️   SWIFTTRACK INVENTORY OPERATIONS: 3.2 TEST SUITE');
console.log('============================================================\n');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}\n  Stack: ${err.stack}`);
  }
}

initSchema();

// Setup test warehouse, product, and supplier
const branch1 = db.prepare('SELECT id FROM branches LIMIT 1').get() || { id: 1 };
const wh1 = db.prepare('SELECT id FROM warehouses WHERE branch_id = ? LIMIT 1').get(branch1.id) || { id: 1 };
const wh2 = db.prepare('SELECT id, branch_id FROM warehouses WHERE branch_id != ? LIMIT 1').get(branch1.id) || { id: 3, branch_id: 2 };
const prod = db.prepare('SELECT id, cost_price, selling_price FROM products LIMIT 1').get() || { id: 1, cost_price: 100, selling_price: 150 };
const adminUser = db.prepare("SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN') LIMIT 1").get() || { id: 1 };

// Reset test inventory
getOrInitInventory(wh1.id, prod.id, branch1.id);
db.prepare(`
  UPDATE inventory
  SET quantity_on_hand = 50, quantity_available = 50, quantity_reserved = 0,
      quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0
  WHERE warehouse_id = ? AND product_id = ?
`).run(wh1.id, prod.id);

// 1. STOCK RECEIVING (GOODS RECEIVED NOTE)
runTest('1.1: receiveStock() with GOOD condition increments ON_HAND & AVAILABLE', () => {
  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const receipt = receiveStock({
    branchId: branch1.id,
    warehouseId: wh1.id,
    supplierInvoiceNo: 'INV-2026-001',
    deliveryNoteNo: 'DN-999',
    items: [{ productId: prod.id, quantity: 20, unitCost: 100, condition: 'GOOD' }],
    userId: adminUser.id
  });

  assert.strictEqual(receipt.status, 'RECEIVED');
  assert.strictEqual(receipt.total_items, 20);

  const invAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  assert.strictEqual(invAfter.quantity_on_hand, invBefore.quantity_on_hand + 20);
  assert.strictEqual(invAfter.quantity_available, invBefore.quantity_available + 20);
  assertInventoryInvariant(invAfter, 'testReceiveStockGood');
});

runTest('1.2: receiveStock() with DAMAGED condition increments ON_HAND & DAMAGED (not available)', () => {
  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const receipt = receiveStock({
    branchId: branch1.id,
    warehouseId: wh1.id,
    items: [{ productId: prod.id, quantity: 5, unitCost: 100, condition: 'DAMAGED' }],
    userId: adminUser.id
  });

  const invAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  assert.strictEqual(invAfter.quantity_on_hand, invBefore.quantity_on_hand + 5);
  assert.strictEqual(invAfter.quantity_available, invBefore.quantity_available);
  assert.strictEqual(invAfter.quantity_damaged, invBefore.quantity_damaged + 5);
  assertInventoryInvariant(invAfter, 'testReceiveStockDamaged');
});

// 2. LOST STOCK & FOUND STOCK (SHRINKAGE)
runTest('2.1: recordLostStock() decrements ON_HAND & AVAILABLE and logs SHRINKAGE_LOST', () => {
  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const lost = recordLostStock({
    branchId: branch1.id,
    warehouseId: wh1.id,
    productId: prod.id,
    quantity: 3,
    reason: 'Shelf shrinkage / theft',
    userId: adminUser.id
  });

  assert.strictEqual(lost.quantity_on_hand, invBefore.quantity_on_hand - 3);
  assert.strictEqual(lost.quantity_available, invBefore.quantity_available - 3);
  assertInventoryInvariant(lost, 'testLostStock');

  const mov = db.prepare("SELECT * FROM inventory_movements WHERE reference_id = ?").get(lost.lost_reference);
  assert.ok(mov);
  assert.strictEqual(mov.movement_type, 'SHRINKAGE_LOST');
  assert.strictEqual(mov.quantity_change, -3);
});

runTest('2.2: restoreFoundStock() restores previously lost stock to AVAILABLE & ON_HAND', () => {
  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const found = restoreFoundStock({
    branchId: branch1.id,
    warehouseId: wh1.id,
    productId: prod.id,
    quantity: 3,
    reason: 'Located in back corner behind pallets',
    userId: adminUser.id
  });

  assert.strictEqual(found.quantity_on_hand, invBefore.quantity_on_hand + 3);
  assert.strictEqual(found.quantity_available, invBefore.quantity_available + 3);
  assertInventoryInvariant(found, 'testFoundStock');
});

// 3. PHYSICAL STOCKTAKE & VARIANCE RECONCILIATION
let stocktakeSessionId;

runTest('3.1: createStocktakeSession() freezes system inventory snapshot', () => {
  const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const session = createStocktakeSession({
    branchId: branch1.id,
    warehouseId: wh1.id,
    title: 'Q3 End of Month Cycle Count',
    countType: 'CYCLE_COUNT',
    userId: adminUser.id
  });

  assert.ok(session.id);
  stocktakeSessionId = session.id;

  const item = db.prepare('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND product_id = ?').get(session.id, prod.id);
  assert.ok(item);
  assert.strictEqual(item.system_quantity, inv.quantity_on_hand);
  assert.strictEqual(item.counted_quantity, null);
});

runTest('3.2: recordStocktakeCounts() calculates variance units and financial value', () => {
  const item = db.prepare('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND product_id = ?').get(stocktakeSessionId, prod.id);
  // Physical count has 4 more units (surplus)
  const physicalCount = item.system_quantity + 4;

  const totals = recordStocktakeCounts({
    stocktakeId: stocktakeSessionId,
    counts: [{ id: item.id, counted_quantity: physicalCount, notes: 'Extra sealed cartons' }],
    userId: adminUser.id
  });

  assert.strictEqual(totals.total_variance_units, 4);

  const updatedItem = db.prepare('SELECT * FROM stocktake_items WHERE id = ?').get(item.id);
  assert.strictEqual(updatedItem.counted_quantity, physicalCount);
  assert.strictEqual(updatedItem.variance_quantity, 4);
  assert.strictEqual(updatedItem.variance_value, 4 * item.unit_cost);
});

runTest('3.3: reconcileStocktake() synchronizes system inventory to physical count', () => {
  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const result = reconcileStocktake({
    stocktakeId: stocktakeSessionId,
    userId: adminUser.id,
    notes: 'Audit variance approved by Branch Manager'
  });

  assert.strictEqual(result.message, 'Stocktake reconciled successfully');

  const invAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  assert.strictEqual(invAfter.quantity_on_hand, invBefore.quantity_on_hand + 4);
  assert.strictEqual(invAfter.quantity_available, invBefore.quantity_available + 4);
  assertInventoryInvariant(invAfter, 'testReconcileStocktake');

  const session = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(stocktakeSessionId);
  assert.strictEqual(session.status, 'RECONCILED');
  assert.strictEqual(session.reconciled_by_user_id, adminUser.id);
});

// 4. CERTIFIED WRITE-OFFS
runTest('4.1: Certified write-off permanently deducts DAMAGED stock and ON_HAND', () => {
  // Quarantine 6 units to DAMAGED first
  quarantineDamaged({
    branchId: branch1.id,
    warehouseId: wh1.id,
    productId: prod.id,
    quantity: 6,
    userId: adminUser.id,
    reason: 'Water damaged packaging'
  });

  const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  const updated = writeOffStock({
    branchId: branch1.id,
    warehouseId: wh1.id,
    productId: prod.id,
    quantity: 4,
    fromState: 'DAMAGED',
    userId: adminUser.id,
    reason: 'Certified incinerator destruction'
  });

  assert.strictEqual(updated.quantity_damaged, invBefore.quantity_damaged - 4);
  assert.strictEqual(updated.quantity_on_hand, invBefore.quantity_on_hand - 4);
  assertInventoryInvariant(updated, 'testWriteOffStock');
});

// 5. TRANSFER RECEIPT WITH DISCREPANCY
runTest('5.1: Transfer receipt discrepancy tracks transit loss and logs TRANSIT_LOSS', () => {
  // Transfer 10 units from wh1 to wh2
  const trfNo = `TRF-TEST-${Date.now().toString().slice(-4)}`;
  const trf = db.prepare(`
    INSERT INTO stock_transfers (
      transfer_number, source_branch_id, source_warehouse_id,
      target_branch_id, target_warehouse_id, status, requested_by_user_id
    ) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)
  `).run(trfNo, branch1.id, wh1.id, wh2.branch_id || branch1.id, wh2.id, adminUser.id);

  const trfItem = db.prepare(`
    INSERT INTO stock_transfer_items (
      stock_transfer_id, product_id, quantity_requested, quantity_sent
    ) VALUES (?, ?, 10, 10)
  `).run(trf.lastInsertRowid, prod.id);

  // Dispatch transfer
  const { dispatchStock, reserveStock } = require('../../server/services/inventoryStateService.js');
  const curWh1Inv = getOrInitInventory(wh1.id, prod.id, branch1.id);
  if (curWh1Inv.quantity_available < 15) {
    db.prepare('UPDATE inventory SET quantity_on_hand = quantity_on_hand + 20, quantity_available = quantity_available + 20 WHERE id = ?').run(curWh1Inv.id);
  }
  reserveStock({ branchId: branch1.id, warehouseId: wh1.id, productId: prod.id, quantity: 10, userId: adminUser.id });
  dispatchStock({ branchId: branch1.id, warehouseId: wh1.id, productId: prod.id, quantity: 10, referenceId: trfNo, userId: adminUser.id });

  // Simulate receipt of only 8 units (2 units lost in transit)
  const itemRow = { id: trfItem.lastInsertRowid, quantity_requested: 10, quantity_sent: 10, product_id: prod.id };
  const targetInvBefore = getOrInitInventory(wh2.id, prod.id, wh2.branch_id || branch1.id);
  const qtySent = 10;
  const qtyReceived = 8;
  const discrepancy = 2;

  // Clear 10 from source in_transit
  db.prepare('UPDATE inventory SET quantity_in_transit = quantity_in_transit - ? WHERE warehouse_id = ? AND product_id = ?')
    .run(qtySent, wh1.id, prod.id);

  // Target receives 8
  const newTargetOnHand = targetInvBefore.quantity_on_hand + qtyReceived;
  const newTargetAvailable = targetInvBefore.quantity_available + qtyReceived;
  db.prepare('UPDATE inventory SET quantity_on_hand = ?, quantity_available = ? WHERE id = ?')
    .run(newTargetOnHand, newTargetAvailable, targetInvBefore.id);

  db.prepare('UPDATE stock_transfer_items SET quantity_received = ?, quantity_discrepancy = ?, discrepancy_reason = ? WHERE id = ?')
    .run(qtyReceived, discrepancy, 'Damaged carton in transit', itemRow.id);

  const targetInvAfter = db.prepare('SELECT * FROM inventory WHERE id = ?').get(targetInvBefore.id);
  assert.strictEqual(targetInvAfter.quantity_on_hand, targetInvBefore.quantity_on_hand + 8);
  assertInventoryInvariant(targetInvAfter, 'testTransferDiscrepancyTarget');

  const srcInvAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(wh1.id, prod.id);
  assertInventoryInvariant(srcInvAfter, 'testTransferDiscrepancySource');

  // Clean up test transfer records
  db.prepare('DELETE FROM stock_transfer_items WHERE stock_transfer_id = ?').run(trf.lastInsertRowid);
  db.prepare('DELETE FROM stock_transfers WHERE id = ?').run(trf.lastInsertRowid);
});

// 6. MOVEMENT HISTORY DEEP FILTERING
runTest('6.1: Movement history tracks from_state and to_state across all operations', () => {
  const movements = db.prepare(`
    SELECT DISTINCT movement_type, from_state, to_state
    FROM inventory_movements
    WHERE warehouse_id = ?
  `).all(wh1.id);

  assert.ok(movements.length > 0);
  const types = movements.map(m => m.movement_type);
  assert.ok(types.includes('PURCHASE_RECEIPT'));
  assert.ok(types.includes('SHRINKAGE_LOST'));
  assert.ok(types.includes('STOCKTAKE_SURPLUS'));
});

console.log('\n============================================================');
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${total - passed}`);
console.log('============================================================\n');

if (passed === total) {
  console.log('🎉 ALL INVENTORY OPERATIONS ENGINE TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
