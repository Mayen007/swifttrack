// tests/inventory/test-inventory-states.js
// SwiftTrack Kenya: Phase 3.1 Inventory State Engine Test Suite
const assert = require('node:assert');
const path = require('node:path');
const { db, initSchema } = require('../../server/db/database.js');
const {
  assertInventoryInvariant,
  getOrInitInventory,
  reserveStock,
  releaseReservation,
  dispatchStock,
  receiveInTransit,
  quarantineDamaged,
  markExpired,
  writeOffStock,
  restoreToAvailable,
  getInventoryStateSummary
} = require('../../server/services/inventoryStateService.js');

console.log('\n============================================================');
console.log('📦  SWIFTTRACK INVENTORY ENGINE: 3.1 INVENTORY STATES SUITE');
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
    console.error(`  Error: ${err.message}\n`);
  }
}

// 1. Ensure schema and tables initialized
initSchema();

// Setup dedicated test product and warehouses
const testSku = `TST-ST-${Date.now().toString().slice(-4)}`;
const testBarcode = `600${Date.now().toString().slice(-9)}`;
const prodRes = db.prepare(`
  INSERT INTO products (sku, barcode, name, unit, cost_price, selling_price, category_id)
  VALUES (?, ?, 'State Test Product', 'PIECE', 50.00, 100.00, 1)
`).run(testSku, testBarcode);
const testProductId = prodRes.lastInsertRowid;

const nairobiWarehouse = db.prepare('SELECT id, branch_id FROM warehouses WHERE branch_id = 1 LIMIT 1').get() || { id: 1, branch_id: 1 };
const mombasaWarehouse = db.prepare('SELECT id, branch_id FROM warehouses WHERE branch_id = 2 LIMIT 1').get() || { id: 2, branch_id: 2 };

// Seed initial stock of 100 units in Nairobi
db.prepare(`
  UPDATE inventory
  SET quantity_on_hand = 100, quantity_available = 100, quantity_reserved = 0,
      quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0
  WHERE warehouse_id = ? AND product_id = ?
`).run(nairobiWarehouse.id, testProductId);

let initialInv = getOrInitInventory(nairobiWarehouse.id, testProductId, nairobiWarehouse.branch_id);
if (initialInv.quantity_on_hand !== 100) {
  db.prepare(`
    UPDATE inventory
    SET quantity_on_hand = 100, quantity_available = 100, quantity_reserved = 0,
        quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0
    WHERE id = ?
  `).run(initialInv.id);
  initialInv = getOrInitInventory(nairobiWarehouse.id, testProductId, nairobiWarehouse.branch_id);
}

// TEST 1: Initial Invariant Check
runTest('1.1: Initial stock respects ON_HAND == AVAILABLE + RESERVED + DAMAGED + EXPIRED', () => {
  assert.strictEqual(initialInv.quantity_on_hand, 100);
  assert.strictEqual(initialInv.quantity_available, 100);
  assert.strictEqual(initialInv.quantity_reserved, 0);
  assert.strictEqual(initialInv.quantity_damaged, 0);
  assert.strictEqual(initialInv.quantity_expired, 0);
  assertInventoryInvariant(initialInv, 'Initial state');
});

// TEST 2: Reserve Stock (AVAILABLE -> RESERVED)
runTest('2.1: reserveStock() moves AVAILABLE to RESERVED while ON_HAND remains constant', () => {
  const updated = reserveStock({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 25,
    referenceType: 'ORDER',
    referenceId: 'ORD-TEST-001',
    reason: 'Reserved for delivery dispatch'
  });

  assert.strictEqual(updated.quantity_on_hand, 100);
  assert.strictEqual(updated.quantity_available, 75);
  assert.strictEqual(updated.quantity_reserved, 25);
  assertInventoryInvariant(updated, 'reserveStock 25');
});

runTest('2.2: reserveStock() rejects reservation exceeding AVAILABLE stock', () => {
  assert.throws(() => {
    reserveStock({
      branchId: nairobiWarehouse.branch_id,
      warehouseId: nairobiWarehouse.id,
      productId: testProductId,
      quantity: 90, // Only 75 available!
      referenceType: 'ORDER',
      referenceId: 'ORD-FAIL-001'
    });
  }, /Insufficient available stock/);
});

// TEST 3: Release Reservation (RESERVED -> AVAILABLE)
runTest('3.1: releaseReservation() returns RESERVED stock to AVAILABLE', () => {
  const updated = releaseReservation({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 10,
    referenceType: 'ORDER',
    referenceId: 'ORD-TEST-001',
    reason: 'Customer cancelled partial order'
  });

  assert.strictEqual(updated.quantity_on_hand, 100);
  assert.strictEqual(updated.quantity_available, 85);
  assert.strictEqual(updated.quantity_reserved, 15);
  assertInventoryInvariant(updated, 'releaseReservation 10');
});

// TEST 4: Quarantine Damaged (AVAILABLE -> DAMAGED)
runTest('4.1: quarantineDamaged() moves AVAILABLE to DAMAGED while preserving ON_HAND', () => {
  const updated = quarantineDamaged({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 5,
    referenceId: 'QA-INSPECT-01',
    reason: 'Crushed box packaging on aisle 3'
  });

  assert.strictEqual(updated.quantity_on_hand, 100);
  assert.strictEqual(updated.quantity_available, 80);
  assert.strictEqual(updated.quantity_reserved, 15);
  assert.strictEqual(updated.quantity_damaged, 5);
  assertInventoryInvariant(updated, 'quarantineDamaged 5');
});

// TEST 5: Mark Expired (AVAILABLE -> EXPIRED)
runTest('5.1: markExpired() moves AVAILABLE to EXPIRED while preserving ON_HAND', () => {
  const updated = markExpired({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 10,
    referenceId: 'EXP-AUDIT-01',
    reason: 'Batch past manufacturer shelf-life date'
  });

  assert.strictEqual(updated.quantity_on_hand, 100);
  assert.strictEqual(updated.quantity_available, 70);
  assert.strictEqual(updated.quantity_reserved, 15);
  assert.strictEqual(updated.quantity_damaged, 5);
  assert.strictEqual(updated.quantity_expired, 10);
  assertInventoryInvariant(updated, 'markExpired 10');
});

// TEST 6: Restore Quarantined Stock (DAMAGED -> AVAILABLE)
runTest('6.1: restoreToAvailable() restores inspected DAMAGED items back to AVAILABLE', () => {
  const updated = restoreToAvailable({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 2,
    fromState: 'DAMAGED',
    referenceId: 'QA-CLEAR-01',
    reason: 'Re-packaged in fresh box'
  });

  assert.strictEqual(updated.quantity_on_hand, 100);
  assert.strictEqual(updated.quantity_available, 72);
  assert.strictEqual(updated.quantity_damaged, 3);
  assertInventoryInvariant(updated, 'restoreToAvailable 2');
});

// TEST 7: Permanent Write-Off (DAMAGED/EXPIRED -> EXTERNAL)
runTest('7.1: writeOffStock() decrements DAMAGED/EXPIRED and physically decrements ON_HAND', () => {
  const updated = writeOffStock({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 3,
    fromState: 'DAMAGED',
    referenceId: 'SCRAP-CERT-01',
    reason: 'Certified scrap disposal'
  });

  assert.strictEqual(updated.quantity_on_hand, 97); // 100 - 3 = 97
  assert.strictEqual(updated.quantity_damaged, 0);  // 3 - 3 = 0
  assert.strictEqual(updated.quantity_available, 72);
  assert.strictEqual(updated.quantity_reserved, 15);
  assert.strictEqual(updated.quantity_expired, 10);
  assertInventoryInvariant(updated, 'writeOffStock 3');
});

// TEST 8: Inter-Branch Transit Lifecycle (RESERVED -> IN_TRANSIT -> AVAILABLE)
runTest('8.1: dispatchStock() moves source RESERVED to IN_TRANSIT and decrements source ON_HAND', () => {
  const updated = dispatchStock({
    branchId: nairobiWarehouse.branch_id,
    warehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 15,
    referenceType: 'TRANSFER',
    referenceId: 'TRF-TEST-88',
    reason: 'Loaded onto Mombasa line-haul truck'
  });

  assert.strictEqual(updated.quantity_on_hand, 82); // 97 - 15 = 82
  assert.strictEqual(updated.quantity_reserved, 0);  // 15 - 15 = 0
  assert.strictEqual(updated.quantity_in_transit, 15);
  assertInventoryInvariant(updated, 'dispatchStock 15');
});

runTest('8.2: receiveInTransit() receives goods at destination into ON_HAND & AVAILABLE', () => {
  const updatedDest = receiveInTransit({
    targetBranchId: mombasaWarehouse.branch_id,
    targetWarehouseId: mombasaWarehouse.id,
    sourceWarehouseId: nairobiWarehouse.id,
    productId: testProductId,
    quantity: 15,
    referenceType: 'TRANSFER',
    referenceId: 'TRF-TEST-88',
    reason: 'Offloaded at Mombasa Port Warehouse'
  });

  assert.strictEqual(updatedDest.quantity_on_hand >= 15, true);
  assert.strictEqual(updatedDest.quantity_available >= 15, true);

  // Source in_transit should now be decremented back to 0
  const srcInv = getOrInitInventory(nairobiWarehouse.id, testProductId);
  assert.strictEqual(srcInv.quantity_in_transit, 0);
});

// TEST 9: Invariant Guard Detects Violation
runTest('9.1: assertInventoryInvariant() correctly detects corrupted inventory balance', () => {
  const corrupted = {
    quantity_on_hand: 100,
    quantity_available: 50,
    quantity_reserved: 20,
    quantity_damaged: 10,
    quantity_expired: 5, // Sum = 85 != 100!
    quantity_in_transit: 0
  };

  assert.throws(() => {
    assertInventoryInvariant(corrupted, 'Corrupted test');
  }, /Invariant Violation/);
});

// TEST 10: Movement Ledger contains from_state and to_state
runTest('10.1: inventory_movements records from_state and to_state audit attributes', () => {
  const movements = db.prepare(`
    SELECT from_state, to_state, movement_type, reference_type
    FROM inventory_movements
    WHERE product_id = ?
    ORDER BY id DESC
    LIMIT 5
  `).all(testProductId);

  assert.strictEqual(movements.length >= 5, true);
  const hasValidStates = movements.every(m => m.from_state && m.to_state);
  assert.strictEqual(hasValidStates, true);
});

console.log('\n============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('============================================================\n');

// Cleanup test product
db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(testProductId);
db.prepare('DELETE FROM inventory WHERE product_id = ?').run(testProductId);
db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);

if (passedTests === totalTests) {
  console.log('🎉 ALL INVENTORY STATE ENGINE TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!\n');
  process.exit(1);
}
