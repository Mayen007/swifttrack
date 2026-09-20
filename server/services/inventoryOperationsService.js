// server/services/inventoryOperationsService.js
// SwiftTrack Kenya: Comprehensive Inventory Operations Engine
const { db } = require('../db/database.js');
const {
  getOrInitInventory,
  assertInventoryInvariant,
  logMovement,
  writeOffStock
} = require('./inventoryStateService.js');

/**
 * 1. INBOUND STOCK RECEIVING (Goods Received Note / GRN)
 */
function receiveStock({
  branchId, warehouseId, supplierId, supplierInvoiceNo, deliveryNoteNo, items, userId, notes
}) {
  if (!warehouseId || !items?.length) throw new Error('Warehouse and items are required for receiving');

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouseId);
  const effectiveBranchId = branchId || (wh ? wh.branch_id : 1);
  const receiptNo = `GRN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  return db.transaction(() => {
    let totalItems = 0;
    let totalCost = 0;

    const receiptResult = db.prepare(`
      INSERT INTO stock_receipts (
        receipt_number, branch_id, warehouse_id, supplier_id,
        supplier_invoice_no, delivery_note_no, received_by_user_id,
        total_items, total_cost, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'RECEIVED', ?)
    `).run(receiptNo, effectiveBranchId, warehouseId, supplierId || null, supplierInvoiceNo || null, deliveryNoteNo || null, userId, notes || '');

    const receiptId = receiptResult.lastInsertRowid;
    const insertItemStmt = db.prepare(`
      INSERT INTO stock_receipt_items (
        stock_receipt_id, product_id, variant_id, quantity_received,
        unit_cost, batch_number, expiry_date, condition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const productId = Number(it.productId || it.product_id);
      const variantId = it.variantId || it.variant_id ? Number(it.variantId || it.variant_id) : null;
      const qty = Math.abs(Number(it.quantity || it.quantity_received));
      const cost = Number(it.unitCost || it.unit_cost) || 0;
      const batchNumber = it.batchNumber || it.batch_number || null;
      const expiryDate = it.expiryDate || it.expiry_date || null;
      const condition = it.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
      if (!productId || qty <= 0) continue;

      totalItems += qty;
      totalCost += qty * cost;

      insertItemStmt.run(receiptId, productId, variantId, qty, cost, batchNumber, expiryDate, condition);

      const inv = getOrInitInventory(warehouseId, productId, effectiveBranchId);
      const prevOnHand = inv.quantity_on_hand;
      const newOnHand = prevOnHand + qty;
      const newAvailable = condition === 'GOOD' ? inv.quantity_available + qty : inv.quantity_available;
      const newDamaged = condition === 'DAMAGED' ? inv.quantity_damaged + qty : inv.quantity_damaged;

      db.prepare(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newOnHand, newAvailable, newDamaged, inv.id);

      assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, quantity_damaged: newDamaged }, 'receiveStock');

      logMovement({
        branchId: effectiveBranchId, warehouseId, productId,
        movementType: 'PURCHASE_RECEIPT', quantityChange: qty, prevQty: prevOnHand, newQty: newOnHand,
        fromState: 'EXTERNAL', toState: condition === 'GOOD' ? 'AVAILABLE' : 'DAMAGED',
        referenceType: 'GRN', referenceId: receiptNo,
        reason: `Inbound PO/GRN receipt (${condition})`, userId
      });
    }

    db.prepare('UPDATE stock_receipts SET total_items = ?, total_cost = ? WHERE id = ?').run(totalItems, totalCost, receiptId);

    return {
      id: receiptId,
      receipt_number: receiptNo,
      total_items: totalItems,
      total_cost: totalCost,
      status: 'RECEIVED'
    };
  })();
}

/**
 * 2. RECORD LOST STOCK (Theft / Shrinkage - Decrements physical ON_HAND)
 */
function recordLostStock({ branchId, warehouseId, productId, quantity, reason, userId, notes }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_available < qty) {
      throw new Error(`Insufficient available stock to report as lost. Available: ${inv.quantity_available}, Lost: ${qty}`);
    }

    const newOnHand = inv.quantity_on_hand - qty;
    const newAvailable = inv.quantity_available - qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOnHand, newAvailable, inv.id);

    assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'recordLostStock');

    const lostRef = `LOST-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    logMovement({
      branchId: inv.branch_id, warehouseId, productId,
      movementType: 'SHRINKAGE_LOST', quantityChange: -qty, prevQty: inv.quantity_on_hand, newQty: newOnHand,
      fromState: 'AVAILABLE', toState: 'EXTERNAL',
      referenceType: 'LOST', referenceId: lostRef,
      reason: reason || 'Inventory shrinkage / lost stock', userId
    });

    // Also track in write-offs
    const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(productId);
    const cost = prod?.cost_price || 0;
    db.prepare(`
      INSERT INTO stock_write_offs (
        write_off_number, branch_id, warehouse_id, product_id,
        from_state, quantity, unit_cost, total_loss_value,
        reason_category, disposal_method, status, requested_by_user_id, approved_by_user_id, notes
      ) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, 'THEFT_LOST', 'SCRAPPED', 'APPROVED', ?, ?, ?)
    `).run(lostRef, inv.branch_id, warehouseId, productId, qty, cost, qty * cost, userId, userId, notes || reason || 'Unaccounted shrinkage');

    return { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, lost_reference: lostRef };
  })();
}

/**
 * 3. RESTORE FOUND STOCK (Reverses previously lost inventory)
 */
function restoreFoundStock({ branchId, warehouseId, productId, quantity, reason, userId }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    const newOnHand = inv.quantity_on_hand + qty;
    const newAvailable = inv.quantity_available + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOnHand, newAvailable, inv.id);

    assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'restoreFoundStock');

    const foundRef = `FND-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    logMovement({
      branchId: inv.branch_id, warehouseId, productId,
      movementType: 'FOUND_STOCK', quantityChange: qty, prevQty: inv.quantity_on_hand, newQty: newOnHand,
      fromState: 'EXTERNAL', toState: 'AVAILABLE',
      referenceType: 'ADJUSTMENT', referenceId: foundRef,
      reason: reason || 'Previously lost stock recovered / found', userId
    });

    return { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable };
  })();
}

/**
 * 4. CREATE STOCKTAKE SESSION (Freezes system inventory snapshot)
 */
function createStocktakeSession({ branchId, warehouseId, title, countType = 'CYCLE_COUNT', categoryId, userId, notes }) {
  if (!warehouseId || !title) throw new Error('Warehouse and session title are required');

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouseId);
  const effectiveBranchId = branchId || (wh ? wh.branch_id : 1);
  const stocktakeNo = `STK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  return db.transaction(() => {
    const sessionRes = db.prepare(`
      INSERT INTO stocktakes (
        stocktake_number, branch_id, warehouse_id, title, count_type,
        category_id, status, created_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)
    `).run(stocktakeNo, effectiveBranchId, warehouseId, title.trim(), countType, categoryId || null, userId, notes || '');

    const stocktakeId = sessionRes.lastInsertRowid;

    // Snapshot current inventory
    let selectQuery = `
      SELECT i.product_id, i.quantity_on_hand, p.cost_price
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.warehouse_id = ?
    `;
    const params = [warehouseId];
    if (categoryId) {
      selectQuery += ' AND p.category_id = ?';
      params.push(Number(categoryId));
    }

    const items = db.prepare(selectQuery).all(...params);
    const insertItem = db.prepare(`
      INSERT INTO stocktake_items (
        stocktake_id, product_id, system_quantity, counted_quantity,
        variance_quantity, unit_cost, variance_value, status
      ) VALUES (?, ?, ?, NULL, 0, ?, 0, 'PENDING')
    `);

    for (const item of items) {
      insertItem.run(stocktakeId, item.product_id, item.quantity_on_hand, item.cost_price || 0);
    }

    return { id: stocktakeId, stocktake_number: stocktakeNo, items_count: items.length };
  })();
}

/**
 * 5. RECORD PHYSICAL STOCKTAKE COUNTS
 */
function recordStocktakeCounts({ stocktakeId, counts, userId }) {
  return db.transaction(() => {
    const session = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(stocktakeId);
    if (!session) throw new Error('Stocktake session not found');
    if (session.status === 'RECONCILED' || session.status === 'CANCELLED') {
      throw new Error(`Cannot record counts for ${session.status} session`);
    }

    const updateItem = db.prepare(`
      UPDATE stocktake_items
      SET counted_quantity = ?, variance_quantity = ? - system_quantity,
          variance_value = (? - system_quantity) * unit_cost,
          counted_by_user_id = ?, status = 'COUNTED', counted_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes)
      WHERE id = ? AND stocktake_id = ?
    `);

    for (const c of counts) {
      const counted = Number(c.counted_quantity);
      updateItem.run(counted, counted, counted, userId, c.notes || null, c.id, stocktakeId);
    }

    // Refresh totals
    const totals = db.prepare(`
      SELECT COUNT(CASE WHEN counted_quantity IS NOT NULL THEN 1 END) as counted_items,
             SUM(variance_quantity) as total_variance_units,
             SUM(variance_value) as total_variance_value
      FROM stocktake_items
      WHERE stocktake_id = ?
    `).get(stocktakeId);

    db.prepare(`
      UPDATE stocktakes
      SET total_products_counted = ?, total_variance_units = ?, total_variance_value = ?,
          status = 'PENDING_APPROVAL', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totals.counted_items || 0, totals.total_variance_units || 0, totals.total_variance_value || 0, stocktakeId);

    return totals;
  })();
}

/**
 * 6. RECONCILE STOCKTAKE (Applies Variances & Updates Inventory)
 */
function reconcileStocktake({ stocktakeId, userId, notes }) {
  return db.transaction(() => {
    const session = db.prepare('SELECT * FROM stocktakes WHERE id = ?').get(stocktakeId);
    if (!session) throw new Error('Stocktake session not found');
    if (session.status === 'RECONCILED') throw new Error('Stocktake already reconciled');

    const items = db.prepare('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND counted_quantity IS NOT NULL').all(stocktakeId);

    for (const item of items) {
      const variance = item.variance_quantity;
      if (variance === 0) continue;

      const inv = getOrInitInventory(session.warehouse_id, item.product_id, session.branch_id);
      const prevOnHand = inv.quantity_on_hand;
      const newOnHand = Math.max(0, prevOnHand + variance);
      const newAvailable = Math.max(0, newOnHand - (inv.quantity_reserved + inv.quantity_damaged + inv.quantity_expired));

      db.prepare(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newOnHand, newAvailable, inv.id);

      assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'reconcileStocktake');

      const mType = variance > 0 ? 'STOCKTAKE_SURPLUS' : 'STOCKTAKE_DEFICIT';
      logMovement({
        branchId: session.branch_id, warehouseId: session.warehouse_id, productId: item.product_id,
        movementType: mType, quantityChange: variance, prevQty: prevOnHand, newQty: newOnHand,
        fromState: variance > 0 ? 'EXTERNAL' : 'AVAILABLE', toState: variance > 0 ? 'AVAILABLE' : 'EXTERNAL',
        referenceType: 'STOCKTAKE', referenceId: session.stocktake_number,
        reason: `Stocktake variance reconciliation (${variance > 0 ? '+' : ''}${variance} units)`, userId
      });
    }

    db.prepare(`
      UPDATE stocktakes
      SET status = 'RECONCILED', reconciled_by_user_id = ?, reconciled_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, notes || session.notes, stocktakeId);

    return { message: 'Stocktake reconciled successfully', session_id: stocktakeId };
  })();
}

module.exports = {
  receiveStock,
  recordLostStock,
  restoreFoundStock,
  createStocktakeSession,
  recordStocktakeCounts,
  reconcileStocktake
};
