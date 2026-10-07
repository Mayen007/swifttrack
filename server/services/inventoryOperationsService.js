// server/services/inventoryOperationsService.js
// SwiftTrack Kenya: Comprehensive Inventory Operations Engine
const dbAdapter = require('../db/dbAdapter.js');
const {
  getOrInitInventory,
  assertInventoryInvariant,
  logMovement,
  writeOffStock
} = require('./inventoryStateService.js');
const {
  createBatch,
  updateMovingAverageCost,
  registerSerials
} = require('./advancedInventoryService.js');

/**
 * 1. INBOUND STOCK RECEIVING (Goods Received Note / GRN)
 */
async function receiveStock({
  branchId, warehouseId, supplierId, supplierInvoiceNo, deliveryNoteNo, items, userId, notes
}, client = null) {
  if (!warehouseId || !items?.length) throw new Error('Warehouse and items are required for receiving');

  let effectiveBranchId = branchId;
  if (!effectiveBranchId) {
    const wh = await dbAdapter.get('SELECT branch_id FROM warehouses WHERE id = ?', [warehouseId], client);
    effectiveBranchId = wh ? wh.branch_id : 1;
  }
  const receiptNo = `GRN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const runner = async (txnClient) => {
    let totalItems = 0;
    let totalCost = 0;

    const receiptResult = await dbAdapter.run(`
      INSERT INTO stock_receipts (
        receipt_number, branch_id, warehouse_id, supplier_id,
        supplier_invoice_no, delivery_note_no, received_by_user_id,
        total_items, total_cost, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'RECEIVED', ?)
    `, [receiptNo, effectiveBranchId, warehouseId, supplierId || null, supplierInvoiceNo || null, deliveryNoteNo || null, userId, notes || ''], txnClient);

    const receiptId = receiptResult.insertId || receiptResult.id;

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

      const itemRes = await dbAdapter.run(`
        INSERT INTO stock_receipt_items (
          stock_receipt_id, product_id, variant_id, quantity_received,
          unit_cost, batch_number, expiry_date, condition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [receiptId, productId, variantId, qty, cost, batchNumber, expiryDate, condition], txnClient);
      const receiptItemId = itemRes.insertId || itemRes.id;

      const inv = await getOrInitInventory(warehouseId, productId, effectiveBranchId, txnClient);
      const prevOnHand = Number(inv.quantity_on_hand);
      const prevAvail = Number(inv.quantity_available);
      const prevDamaged = Number(inv.quantity_damaged);
      const newOnHand = prevOnHand + qty;
      const newAvailable = condition === 'GOOD' ? prevAvail + qty : prevAvail;
      const newDamaged = condition === 'DAMAGED' ? prevDamaged + qty : prevDamaged;

      await dbAdapter.run(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newOnHand, newAvailable, newDamaged, inv.id], txnClient);

      assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, quantity_damaged: newDamaged }, 'receiveStock');

      await logMovement({
        branchId: effectiveBranchId, warehouseId, productId,
        movementType: 'PURCHASE_RECEIPT', quantityChange: qty, prevQty: prevOnHand, newQty: newOnHand,
        fromState: 'EXTERNAL', toState: condition === 'GOOD' ? 'AVAILABLE' : 'DAMAGED',
        referenceType: 'GRN', referenceId: receiptNo,
        reason: `Inbound PO/GRN receipt (${condition})`, userId
      }, txnClient);

      // Phase 3.3 Advanced Inventory integrations
      if (condition === 'GOOD') {
        // 1. Update moving weighted-average cost
        await updateMovingAverageCost({ warehouseId, productId, receivedQty: qty, unitCost: cost }, txnClient);

        // 2. Track batch/lot if provided
        let createdBatchId = null;
        if (batchNumber || expiryDate) {
          const bNum = batchNumber || `LOT-${Date.now().toString().slice(-6)}`;
          const batch = await createBatch({
            branchId: effectiveBranchId,
            warehouseId,
            productId,
            variantId,
            batchNumber: bNum,
            initialQuantity: qty,
            unitCost: cost,
            expiryDate,
            supplierId: supplierId || null,
            receiptItemId,
            notes: `Auto-recorded from GRN ${receiptNo}`
          }, txnClient);
          createdBatchId = batch ? batch.id : null;
        }

        // 3. Register serial numbers if provided
        const serials = it.serialNumbers || it.serial_numbers || it.serials;
        if (Array.isArray(serials) && serials.length > 0) {
          await registerSerials({
            productId,
            variantId,
            warehouseId,
            branchId: effectiveBranchId,
            batchId: createdBatchId,
            serialNumbers: serials,
            unitCost: cost,
            notes: `Inbound from GRN ${receiptNo}`
          }, txnClient);
        }
      }
    }

    await dbAdapter.run('UPDATE stock_receipts SET total_items = ?, total_cost = ? WHERE id = ?', [totalItems, totalCost, receiptId], txnClient);

    return {
      id: receiptId,
      receipt_number: receiptNo,
      total_items: totalItems,
      total_cost: totalCost,
      status: 'RECEIVED'
    };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

/**
 * 2. RECORD LOST STOCK (Theft / Shrinkage - Decrements physical ON_HAND)
 */
async function recordLostStock({ branchId, warehouseId, productId, quantity, reason, userId, notes }, client = null) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  const runner = async (txnClient) => {
    const inv = await getOrInitInventory(warehouseId, productId, branchId, txnClient);
    if (Number(inv.quantity_available) < qty) {
      throw new Error(`Insufficient available stock to report as lost. Available: ${inv.quantity_available}, Lost: ${qty}`);
    }

    const prevOnHand = Number(inv.quantity_on_hand);
    const prevAvail = Number(inv.quantity_available);
    const newOnHand = prevOnHand - qty;
    const newAvailable = prevAvail - qty;

    await dbAdapter.run(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newOnHand, newAvailable, inv.id], txnClient);

    assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'recordLostStock');

    const lostRef = `LOST-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    await logMovement({
      branchId: inv.branch_id, warehouseId, productId,
      movementType: 'SHRINKAGE_LOST', quantityChange: -qty, prevQty: prevOnHand, newQty: newOnHand,
      fromState: 'AVAILABLE', toState: 'EXTERNAL',
      referenceType: 'LOST', referenceId: lostRef,
      reason: reason || 'Inventory shrinkage / lost stock', userId
    }, txnClient);

    // Also track in write-offs
    const prod = await dbAdapter.get('SELECT cost_price FROM products WHERE id = ?', [productId], txnClient);
    const cost = prod ? Number(prod.cost_price) : 0;
    await dbAdapter.run(`
      INSERT INTO stock_write_offs (
        write_off_number, branch_id, warehouse_id, product_id,
        from_state, quantity, unit_cost, total_loss_value,
        reason_category, disposal_method, status, requested_by_user_id, approved_by_user_id, notes
      ) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, 'THEFT_LOST', 'SCRAPPED', 'APPROVED', ?, ?, ?)
    `, [lostRef, inv.branch_id, warehouseId, productId, qty, cost, qty * cost, userId, userId, notes || reason || 'Unaccounted shrinkage'], txnClient);

    return { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, lost_reference: lostRef };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

/**
 * 3. RESTORE FOUND STOCK (Reverses previously lost inventory)
 */
async function restoreFoundStock({ branchId, warehouseId, productId, quantity, reason, userId }, client = null) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  const runner = async (txnClient) => {
    const inv = await getOrInitInventory(warehouseId, productId, branchId, txnClient);
    const prevOnHand = Number(inv.quantity_on_hand);
    const prevAvail = Number(inv.quantity_available);
    const newOnHand = prevOnHand + qty;
    const newAvailable = prevAvail + qty;

    await dbAdapter.run(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newOnHand, newAvailable, inv.id], txnClient);

    assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'restoreFoundStock');

    const foundRef = `FND-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    await logMovement({
      branchId: inv.branch_id, warehouseId, productId,
      movementType: 'FOUND_STOCK', quantityChange: qty, prevQty: prevOnHand, newQty: newOnHand,
      fromState: 'EXTERNAL', toState: 'AVAILABLE',
      referenceType: 'ADJUSTMENT', referenceId: foundRef,
      reason: reason || 'Previously lost stock recovered / found', userId
    }, txnClient);

    return { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

/**
 * 4. CREATE STOCKTAKE SESSION (Freezes system inventory snapshot)
 */
async function createStocktakeSession({ branchId, warehouseId, title, countType = 'CYCLE_COUNT', categoryId, userId, notes }, client = null) {
  if (!warehouseId || !title) throw new Error('Warehouse and session title are required');

  let effectiveBranchId = branchId;
  if (!effectiveBranchId) {
    const wh = await dbAdapter.get('SELECT branch_id FROM warehouses WHERE id = ?', [warehouseId], client);
    effectiveBranchId = wh ? wh.branch_id : 1;
  }
  const stocktakeNo = `STK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const runner = async (txnClient) => {
    const sessionRes = await dbAdapter.run(`
      INSERT INTO stocktakes (
        stocktake_number, branch_id, warehouse_id, title, count_type,
        category_id, status, created_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?)
    `, [stocktakeNo, effectiveBranchId, warehouseId, title.trim(), countType, categoryId || null, userId, notes || ''], txnClient);

    const stocktakeId = sessionRes.insertId || sessionRes.id;

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

    const items = await dbAdapter.all(selectQuery, params, txnClient);
    for (const item of items) {
      await dbAdapter.run(`
        INSERT INTO stocktake_items (
          stocktake_id, product_id, system_quantity, counted_quantity,
          variance_quantity, unit_cost, variance_value, status
        ) VALUES (?, ?, ?, NULL, 0, ?, 0, 'PENDING')
      `, [stocktakeId, item.product_id, item.quantity_on_hand, item.cost_price || 0], txnClient);
    }

    return { id: stocktakeId, stocktake_number: stocktakeNo, items_count: items.length };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

/**
 * 5. RECORD PHYSICAL STOCKTAKE COUNTS
 */
async function recordStocktakeCounts({ stocktakeId, counts, userId }, client = null) {
  const runner = async (txnClient) => {
    const session = await dbAdapter.get('SELECT * FROM stocktakes WHERE id = ?', [stocktakeId], txnClient);
    if (!session) throw new Error('Stocktake session not found');
    if (session.status === 'RECONCILED' || session.status === 'CANCELLED') {
      throw new Error(`Cannot record counts for ${session.status} session`);
    }

    for (const c of counts) {
      const counted = Number(c.counted_quantity);
      await dbAdapter.run(`
        UPDATE stocktake_items
        SET counted_quantity = ?, variance_quantity = ? - system_quantity,
            variance_value = (? - system_quantity) * unit_cost,
            counted_by_user_id = ?, status = 'COUNTED', counted_at = CURRENT_TIMESTAMP,
            notes = COALESCE(?, notes)
        WHERE id = ? AND stocktake_id = ?
      `, [counted, counted, counted, userId, c.notes || null, c.id, stocktakeId], txnClient);
    }

    // Refresh totals
    const totals = await dbAdapter.get(`
      SELECT COUNT(CASE WHEN counted_quantity IS NOT NULL THEN 1 END) as counted_items,
             COALESCE(SUM(variance_quantity), 0) as total_variance_units,
             COALESCE(SUM(variance_value), 0) as total_variance_value
      FROM stocktake_items
      WHERE stocktake_id = ?
    `, [stocktakeId], txnClient);

    await dbAdapter.run(`
      UPDATE stocktakes
      SET total_products_counted = ?, total_variance_units = ?, total_variance_value = ?,
          status = 'PENDING_APPROVAL', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [totals.counted_items || 0, totals.total_variance_units || 0, totals.total_variance_value || 0, stocktakeId], txnClient);

    return totals;
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

/**
 * 6. RECONCILE STOCKTAKE (Applies Variances & Updates Inventory)
 */
async function reconcileStocktake({ stocktakeId, userId, notes }, client = null) {
  const runner = async (txnClient) => {
    const session = await dbAdapter.get('SELECT * FROM stocktakes WHERE id = ?', [stocktakeId], txnClient);
    if (!session) throw new Error('Stocktake session not found');
    if (session.status === 'RECONCILED') throw new Error('Stocktake already reconciled');

    const items = await dbAdapter.all('SELECT * FROM stocktake_items WHERE stocktake_id = ? AND counted_quantity IS NOT NULL', [stocktakeId], txnClient);

    for (const item of items) {
      const variance = Number(item.variance_quantity);
      if (variance === 0) continue;

      const inv = await getOrInitInventory(session.warehouse_id, item.product_id, session.branch_id, txnClient);
      const prevOnHand = Number(inv.quantity_on_hand);
      const newOnHand = Math.max(0, prevOnHand + variance);
      const reserved = Number(inv.quantity_reserved) || 0;
      const damaged = Number(inv.quantity_damaged) || 0;
      const expired = Number(inv.quantity_expired) || 0;
      const newAvailable = Math.max(0, newOnHand - (reserved + damaged + expired));

      await dbAdapter.run(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newOnHand, newAvailable, inv.id], txnClient);

      assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'reconcileStocktake');

      const mType = variance > 0 ? 'STOCKTAKE_SURPLUS' : 'STOCKTAKE_DEFICIT';
      await logMovement({
        branchId: session.branch_id, warehouseId: session.warehouse_id, productId: item.product_id,
        movementType: mType, quantityChange: variance, prevQty: prevOnHand, newQty: newOnHand,
        fromState: variance > 0 ? 'EXTERNAL' : 'AVAILABLE', toState: variance > 0 ? 'AVAILABLE' : 'EXTERNAL',
        referenceType: 'STOCKTAKE', referenceId: session.stocktake_number,
        reason: `Stocktake variance reconciliation (${variance > 0 ? '+' : ''}${variance} units)`, userId
      }, txnClient);
    }

    await dbAdapter.run(`
      UPDATE stocktakes
      SET status = 'RECONCILED', reconciled_by_user_id = ?, reconciled_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId, notes || session.notes, stocktakeId], txnClient);

    return { message: 'Stocktake reconciled successfully', session_id: stocktakeId };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

module.exports = {
  receiveStock,
  recordLostStock,
  restoreFoundStock,
  createStocktakeSession,
  recordStocktakeCounts,
  reconcileStocktake
};
