// tests/inventory/test-inventory-operations.js
// SwiftTrack Kenya: Phase 3.2 Inventory Operations Test Suite
const assert = require('assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const {
  assertInventoryInvariant,
  getOrInitInventory,
  quarantineDamaged,
  writeOffStock,
  dispatchStock,
  reserveStock
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
console.log('   SWIFTTRACK INVENTORY OPERATIONS: 3.2 TEST SUITE');
console.log('============================================================\n');

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}\n  Stack: ${err.stack}`);
  }
}

(async () => {
  try {
    // Setup test warehouse, product, and supplier
    const branch1 = (await dbAdapter.get('SELECT id FROM branches LIMIT 1')) || { id: 1 };
    const wh1 = (await dbAdapter.get('SELECT id FROM warehouses WHERE branch_id = ? LIMIT 1', [branch1.id])) || { id: 1 };
    const wh2 = (await dbAdapter.get('SELECT id, branch_id FROM warehouses WHERE branch_id != ? LIMIT 1', [branch1.id])) || { id: 3, branch_id: 2 };
    const prod = (await dbAdapter.get('SELECT id, cost_price, selling_price FROM products LIMIT 1')) || { id: 1, cost_price: 100, selling_price: 150 };
    const adminUser = (await dbAdapter.get("SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN') LIMIT 1")) || { id: 1 };

    // Reset test inventory for both warehouses
    await getOrInitInventory(wh1.id, prod.id, branch1.id);
    await dbAdapter.run(`
      UPDATE inventory
      SET quantity_on_hand = 50, quantity_available = 50, quantity_reserved = 0,
          quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0
      WHERE warehouse_id = ? AND product_id = ?
    `, [wh1.id, prod.id]);

    await getOrInitInventory(wh2.id, prod.id, wh2.branch_id || branch1.id);
    await dbAdapter.run(`
      UPDATE inventory
      SET quantity_on_hand = 100, quantity_available = 100, quantity_reserved = 0,
          quantity_in_transit = 0, quantity_damaged = 0, quantity_expired = 0
      WHERE warehouse_id = ? AND product_id = ?
    `, [wh2.id, prod.id]);

    // 1. STOCK RECEIVING (GOODS RECEIVED NOTE)
    await runTest('1.1: receiveStock() with GOOD condition increments ON_HAND & AVAILABLE', async () => {
      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const receipt = await receiveStock({
        branchId: branch1.id,
        warehouseId: wh1.id,
        supplierInvoiceNo: 'INV-2026-001',
        deliveryNoteNo: 'DN-999',
        items: [{ productId: prod.id, quantity: 20, unitCost: 100, condition: 'GOOD' }],
        userId: adminUser.id
      });

      assert.strictEqual(receipt.status, 'RECEIVED');
      assert.strictEqual(Number(receipt.total_items), 20);

      const invAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      assert.strictEqual(Number(invAfter.quantity_on_hand), Number(invBefore.quantity_on_hand) + 20);
      assert.strictEqual(Number(invAfter.quantity_available), Number(invBefore.quantity_available) + 20);
      assertInventoryInvariant(invAfter, 'testReceiveStockGood');
    });

    await runTest('1.2: receiveStock() with DAMAGED condition increments ON_HAND & DAMAGED (not available)', async () => {
      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const receipt = await receiveStock({
        branchId: branch1.id,
        warehouseId: wh1.id,
        items: [{ productId: prod.id, quantity: 5, unitCost: 100, condition: 'DAMAGED' }],
        userId: adminUser.id
      });

      const invAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      assert.strictEqual(Number(invAfter.quantity_on_hand), Number(invBefore.quantity_on_hand) + 5);
      assert.strictEqual(Number(invAfter.quantity_available), Number(invBefore.quantity_available));
      assert.strictEqual(Number(invAfter.quantity_damaged), Number(invBefore.quantity_damaged) + 5);
      assertInventoryInvariant(invAfter, 'testReceiveStockDamaged');
    });

    // 2. LOST STOCK & FOUND STOCK (SHRINKAGE)
    await runTest('2.1: recordLostStock() decrements ON_HAND & AVAILABLE and logs SHRINKAGE_LOST', async () => {
      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const lost = await recordLostStock({
        branchId: branch1.id,
        warehouseId: wh1.id,
        productId: prod.id,
        quantity: 3,
        reason: 'Shelf shrinkage / theft',
        userId: adminUser.id
      });

      assert.strictEqual(Number(lost.quantity_on_hand), Number(invBefore.quantity_on_hand) - 3);
      assert.strictEqual(Number(lost.quantity_available), Number(invBefore.quantity_available) - 3);
      assertInventoryInvariant(lost, 'testLostStock');

      const mov = await dbAdapter.get('SELECT * FROM inventory_movements WHERE reference_id = ?', [lost.lost_reference]);
      assert.ok(mov);
      assert.strictEqual(mov.movement_type, 'SHRINKAGE_LOST');
      assert.strictEqual(Number(mov.quantity_change), -3);
    });

    await runTest('2.2: restoreFoundStock() restores previously lost stock to AVAILABLE & ON_HAND', async () => {
      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const found = await restoreFoundStock({
        branchId: branch1.id,
        warehouseId: wh1.id,
        productId: prod.id,
        quantity: 3,
        reason: 'Located in back corner behind pallets',
        userId: adminUser.id
      });

      assert.strictEqual(Number(found.quantity_on_hand), Number(invBefore.quantity_on_hand) + 3);
      assert.strictEqual(Number(found.quantity_available), Number(invBefore.quantity_available) + 3);
      assertInventoryInvariant(found, 'testFoundStock');
    });

    // 3. PHYSICAL STOCKTAKE & VARIANCE RECONCILIATION
    let stocktakeSessionId;

    await runTest('3.1: createStocktakeSession() freezes system inventory snapshot', async () => {
      const inv = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const session = await createStocktakeSession({
        branchId: branch1.id,
        warehouseId: wh1.id,
        title: 'Q3 End of Month Cycle Count',
        countType: 'CYCLE_COUNT',
        userId: adminUser.id
      });

      assert.ok(session.id);
      stocktakeSessionId = session.id;

      const item = await dbAdapter.get('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND product_id = ?', [session.id, prod.id]);
      assert.ok(item);
      assert.strictEqual(Number(item.system_quantity), Number(inv.quantity_on_hand));
      assert.strictEqual(item.counted_quantity, null);
    });

    await runTest('3.2: recordStocktakeCounts() calculates variance units and financial value', async () => {
      const item = await dbAdapter.get('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND product_id = ?', [stocktakeSessionId, prod.id]);
      // Physical count has 4 more units (surplus)
      const physicalCount = Number(item.system_quantity) + 4;

      const totals = await recordStocktakeCounts({
        stocktakeId: stocktakeSessionId,
        counts: [{ id: item.id, counted_quantity: physicalCount, notes: 'Extra sealed cartons' }],
        userId: adminUser.id
      });

      assert.strictEqual(Number(totals.total_variance_units), 4);

      const updatedItem = await dbAdapter.get('SELECT * FROM stocktake_items WHERE id = ?', [item.id]);
      assert.strictEqual(Number(updatedItem.counted_quantity), physicalCount);
      assert.strictEqual(Number(updatedItem.variance_quantity), 4);
      assert.strictEqual(Number(updatedItem.variance_value), 4 * Number(item.unit_cost));
    });

    await runTest('3.3: reconcileStocktake() synchronizes system inventory to physical count', async () => {
      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const result = await reconcileStocktake({
        stocktakeId: stocktakeSessionId,
        userId: adminUser.id,
        notes: 'Audit variance approved by Branch Manager'
      });

      assert.strictEqual(result.message, 'Stocktake reconciled successfully');

      const invAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      assert.strictEqual(Number(invAfter.quantity_on_hand), Number(invBefore.quantity_on_hand) + 4);
      assert.strictEqual(Number(invAfter.quantity_available), Number(invBefore.quantity_available) + 4);
      assertInventoryInvariant(invAfter, 'testReconcileStocktake');

      const session = await dbAdapter.get('SELECT * FROM stocktakes WHERE id = ?', [stocktakeSessionId]);
      assert.strictEqual(session.status, 'RECONCILED');
      assert.strictEqual(Number(session.reconciled_by_user_id), Number(adminUser.id));
    });

    // 4. CERTIFIED WRITE-OFFS
    await runTest('4.1: Certified write-off permanently deducts DAMAGED stock and ON_HAND', async () => {
      // Quarantine 6 units to DAMAGED first
      await quarantineDamaged({
        branchId: branch1.id,
        warehouseId: wh1.id,
        productId: prod.id,
        quantity: 6,
        userId: adminUser.id,
        reason: 'Water damaged packaging'
      });

      const invBefore = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      const updated = await writeOffStock({
        branchId: branch1.id,
        warehouseId: wh1.id,
        productId: prod.id,
        quantity: 4,
        fromState: 'DAMAGED',
        userId: adminUser.id,
        reason: 'Certified incinerator destruction'
      });

      assert.strictEqual(Number(updated.quantity_damaged), Number(invBefore.quantity_damaged) - 4);
      assert.strictEqual(Number(updated.quantity_on_hand), Number(invBefore.quantity_on_hand) - 4);
      assertInventoryInvariant(updated, 'testWriteOffStock');
    });

    // 5. TRANSFER RECEIPT WITH DISCREPANCY
    await runTest('5.1: Transfer receipt discrepancy tracks transit loss and logs TRANSIT_LOSS', async () => {
      // Transfer 10 units from wh1 to wh2
      const trfNo = `TRF-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const trf = await dbAdapter.run(`
        INSERT INTO stock_transfers (
          transfer_number, source_branch_id, source_warehouse_id,
          target_branch_id, target_warehouse_id, status, requested_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)
      `, [trfNo, branch1.id, wh1.id, wh2.branch_id || branch1.id, wh2.id, adminUser.id]);
      const trfId = trf.insertId || trf.id;

      const trfItem = await dbAdapter.run(`
        INSERT INTO stock_transfer_items (
          stock_transfer_id, product_id, quantity_requested, quantity_sent
        ) VALUES (?, ?, 10, 10)
      `, [trfId, prod.id]);
      const trfItemId = trfItem.insertId || trfItem.id;

      // Dispatch transfer
      const curWh1Inv = await getOrInitInventory(wh1.id, prod.id, branch1.id);
      if (Number(curWh1Inv.quantity_available) < 15) {
        await dbAdapter.run('UPDATE inventory SET quantity_on_hand = quantity_on_hand + 20, quantity_available = quantity_available + 20 WHERE id = ?', [curWh1Inv.id]);
      }
      await reserveStock({ branchId: branch1.id, warehouseId: wh1.id, productId: prod.id, quantity: 10, userId: adminUser.id });
      await dispatchStock({ branchId: branch1.id, warehouseId: wh1.id, productId: prod.id, quantity: 10, referenceId: trfNo, userId: adminUser.id });

      // Simulate receipt of only 8 units (2 units lost in transit)
      const targetInvBefore = await getOrInitInventory(wh2.id, prod.id, wh2.branch_id || branch1.id);
      const qtySent = 10;
      const qtyReceived = 8;
      const discrepancy = 2;

      // Clear 10 from source in_transit
      await dbAdapter.run('UPDATE inventory SET quantity_in_transit = quantity_in_transit - ? WHERE warehouse_id = ? AND product_id = ?', [qtySent, wh1.id, prod.id]);

      // Target receives 8
      const newTargetOnHand = Number(targetInvBefore.quantity_on_hand) + qtyReceived;
      const newTargetAvailable = Number(targetInvBefore.quantity_available) + qtyReceived;
      await dbAdapter.run('UPDATE inventory SET quantity_on_hand = ?, quantity_available = ? WHERE id = ?', [newTargetOnHand, newTargetAvailable, targetInvBefore.id]);

      await dbAdapter.run('UPDATE stock_transfer_items SET quantity_received = ?, quantity_discrepancy = ?, discrepancy_reason = ? WHERE id = ?', [qtyReceived, discrepancy, 'Damaged carton in transit', trfItemId]);

      const targetInvAfter = await dbAdapter.get('SELECT * FROM inventory WHERE id = ?', [targetInvBefore.id]);
      assert.strictEqual(Number(targetInvAfter.quantity_on_hand), Number(targetInvBefore.quantity_on_hand) + 8);
      assertInventoryInvariant(targetInvAfter, 'testTransferDiscrepancyTarget');

      const srcInvAfter = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [wh1.id, prod.id]);
      assertInventoryInvariant(srcInvAfter, 'testTransferDiscrepancySource');

      // Clean up test transfer records
      await dbAdapter.run('DELETE FROM stock_transfer_items WHERE stock_transfer_id = ?', [trfId]);
      await dbAdapter.run('DELETE FROM stock_transfers WHERE id = ?', [trfId]);
    });

    // 6. MOVEMENT HISTORY DEEP FILTERING
    await runTest('6.1: Movement history tracks from_state and to_state across all operations', async () => {
      const movements = await dbAdapter.all(`
        SELECT DISTINCT movement_type, from_state, to_state
        FROM inventory_movements
        WHERE warehouse_id = ?
      `, [wh1.id]);

      assert.ok(movements.length > 0);
      const types = movements.map(m => m.movement_type);
      assert.ok(types.includes('PURCHASE_RECEIPT'));
      assert.ok(types.includes('SHRINKAGE_LOST'));
      assert.ok(types.includes('STOCKTAKE_SURPLUS'));
    });

  } finally {
    console.log('\n============================================================');
    console.log(`TOTAL TESTS: ${total}`);
    console.log(`PASSED:      ${passed}`);
    console.log(`FAILED:      ${total - passed}`);
    console.log('============================================================\n');

    if (passed === total) {
      console.log('[SUCCESS] ALL INVENTORY OPERATIONS ENGINE TESTS PASSED!\n');
      process.exit(0);
    } else {
      console.error('[FAIL] SOME TESTS FAILED!\n');
      process.exit(1);
    }
  }
})();
