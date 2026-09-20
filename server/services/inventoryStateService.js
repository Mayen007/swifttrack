// server/services/inventoryStateService.js
// SwiftTrack Kenya: Multi-State Inventory Engine & Mathematical Invariant Guard
const { db } = require('../db/database.js');

/**
 * Validates the core mathematical invariant:
 * ON_HAND == AVAILABLE + RESERVED + DAMAGED + EXPIRED
 * AVAILABLE >= 0 and all state buckets >= 0
 */
function assertInventoryInvariant(inv, context = 'State Transition') {
  const onHand = Number(inv.quantity_on_hand) || 0;
  const available = Number(inv.quantity_available) || 0;
  const reserved = Number(inv.quantity_reserved) || 0;
  const damaged = Number(inv.quantity_damaged) || 0;
  const expired = Number(inv.quantity_expired) || 0;
  const inTransit = Number(inv.quantity_in_transit) || 0;

  if (onHand < 0 || available < 0 || reserved < 0 || damaged < 0 || expired < 0 || inTransit < 0) {
    throw new Error(`[${context}] Invariant Violation: Negative inventory bucket detected.`);
  }

  const calculatedOnHand = available + reserved + damaged + expired;
  if (onHand !== calculatedOnHand) {
    throw new Error(
      `[${context}] Invariant Violation: ON_HAND (${onHand}) != AVAILABLE (${available}) + RESERVED (${reserved}) + DAMAGED (${damaged}) + EXPIRED (${expired}) [Sum: ${calculatedOnHand}]`
    );
  }
}

/**
 * Helper to retrieve or initialize an inventory record
 */
function getOrInitInventory(warehouseId, productId, branchId) {
  let inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
  if (!inv) {
    if (!branchId) {
      const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouseId);
      branchId = wh ? wh.branch_id : 1;
    }
    db.prepare(`
      INSERT INTO inventory (
        branch_id, warehouse_id, product_id,
        quantity_on_hand, quantity_available, quantity_reserved,
        quantity_in_transit, quantity_damaged, quantity_expired
      ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
    `).run(branchId, warehouseId, productId);

    inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
  }
  return inv;
}

/**
 * Record immutable movement ledger entry with state transition details
 */
function logMovement({
  branchId, warehouseId, productId, movementType,
  quantityChange, prevQty, newQty, fromState, toState,
  referenceType, referenceId, reason, userId
}) {
  db.prepare(`
    INSERT INTO inventory_movements (
      branch_id, warehouse_id, product_id, movement_type,
      quantity_change, previous_quantity, new_quantity,
      from_state, to_state, reference_type, reference_id,
      reason, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    branchId, warehouseId, productId, movementType,
    quantityChange, prevQty, newQty,
    fromState || 'AVAILABLE', toState || 'AVAILABLE',
    referenceType || 'MANUAL', referenceId || null,
    reason || 'Inventory State Update', userId || null
  );
}

/**
 * 1. RESERVE STOCK: AVAILABLE -> RESERVED
 */
function reserveStock({ branchId, warehouseId, productId, quantity, referenceType, referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_available < qty) {
      throw new Error(`Insufficient available stock to reserve. Requested: ${qty}, Available: ${inv.quantity_available}`);
    }

    const newAvailable = inv.quantity_available - qty;
    const newReserved = inv.quantity_reserved + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_available = ?, quantity_reserved = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvailable, newReserved, inv.id);

    const updated = { ...inv, quantity_available: newAvailable, quantity_reserved: newReserved };
    assertInventoryInvariant(updated, 'reserveStock');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'STOCK_RESERVED',
      quantityChange: qty, prevQty: inv.quantity_available, newQty: newAvailable,
      fromState: 'AVAILABLE', toState: 'RESERVED', referenceType, referenceId, reason, userId
    });

    return updated;
  })();
}

/**
 * 2. RELEASE RESERVATION: RESERVED -> AVAILABLE
 */
function releaseReservation({ branchId, warehouseId, productId, quantity, referenceType, referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_reserved < qty) {
      throw new Error(`Cannot release ${qty} units; only ${inv.quantity_reserved} currently reserved.`);
    }

    const newReserved = inv.quantity_reserved - qty;
    const newAvailable = inv.quantity_available + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_available = ?, quantity_reserved = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvailable, newReserved, inv.id);

    const updated = { ...inv, quantity_available: newAvailable, quantity_reserved: newReserved };
    assertInventoryInvariant(updated, 'releaseReservation');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'RESERVATION_RELEASED',
      quantityChange: qty, prevQty: inv.quantity_reserved, newQty: newReserved,
      fromState: 'RESERVED', toState: 'AVAILABLE', referenceType, referenceId, reason, userId
    });

    return updated;
  })();
}

/**
 * 3. DISPATCH OUTBOUND: RESERVED -> IN_TRANSIT (Decrements source ON_HAND)
 */
function dispatchStock({ branchId, warehouseId, productId, quantity, referenceType, referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_reserved < qty) {
      throw new Error(`Cannot dispatch ${qty} units; only ${inv.quantity_reserved} reserved.`);
    }

    const newReserved = inv.quantity_reserved - qty;
    const newOnHand = inv.quantity_on_hand - qty;
    const newInTransit = inv.quantity_in_transit + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_reserved = ?, quantity_in_transit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOnHand, newReserved, newInTransit, inv.id);

    const updated = { ...inv, quantity_on_hand: newOnHand, quantity_reserved: newReserved, quantity_in_transit: newInTransit };
    assertInventoryInvariant(updated, 'dispatchStock');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'TRANSFER_OUT',
      quantityChange: -qty, prevQty: inv.quantity_on_hand, newQty: newOnHand,
      fromState: 'RESERVED', toState: 'IN_TRANSIT', referenceType, referenceId, reason, userId
    });

    return updated;
  })();
}

/**
 * 4. RECEIVE INBOUND: IN_TRANSIT -> AVAILABLE (Increments target ON_HAND and AVAILABLE)
 */
function receiveInTransit({
  targetWarehouseId, sourceWarehouseId, targetBranchId, productId, quantity,
  referenceType, referenceId, userId, reason
}) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    // Clear in-transit on source if provided
    if (sourceWarehouseId) {
      const srcInv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(sourceWarehouseId, productId);
      if (srcInv && srcInv.quantity_in_transit >= qty) {
        db.prepare('UPDATE inventory SET quantity_in_transit = quantity_in_transit - ? WHERE id = ?').run(qty, srcInv.id);
      }
    }

    const targetInv = getOrInitInventory(targetWarehouseId, productId, targetBranchId);
    const newOnHand = targetInv.quantity_on_hand + qty;
    const newAvailable = targetInv.quantity_available + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOnHand, newAvailable, targetInv.id);

    const updated = { ...targetInv, quantity_on_hand: newOnHand, quantity_available: newAvailable };
    assertInventoryInvariant(updated, 'receiveInTransit');

    logMovement({
      branchId: targetInv.branch_id, warehouseId: targetWarehouseId, productId, movementType: 'TRANSFER_IN',
      quantityChange: qty, prevQty: targetInv.quantity_on_hand, newQty: newOnHand,
      fromState: 'IN_TRANSIT', toState: 'AVAILABLE', referenceType, referenceId, reason, userId
    });

    return updated;
  })();
}

/**
 * 5. QUARANTINE DAMAGED: AVAILABLE -> DAMAGED (ON_HAND unchanged)
 */
function quarantineDamaged({ branchId, warehouseId, productId, quantity, referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_available < qty) {
      throw new Error(`Insufficient available stock to quarantine. Available: ${inv.quantity_available}, Requested: ${qty}`);
    }

    const newAvailable = inv.quantity_available - qty;
    const newDamaged = inv.quantity_damaged + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_available = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvailable, newDamaged, inv.id);

    const updated = { ...inv, quantity_available: newAvailable, quantity_damaged: newDamaged };
    assertInventoryInvariant(updated, 'quarantineDamaged');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'DAMAGED_WRITE_OFF',
      quantityChange: qty, prevQty: inv.quantity_available, newQty: newAvailable,
      fromState: 'AVAILABLE', toState: 'DAMAGED', referenceType: 'QUARANTINE',
      referenceId, reason: reason || 'Goods damaged / quarantined', userId
    });

    return updated;
  })();
}

/**
 * 6. MARK EXPIRED: AVAILABLE -> EXPIRED (ON_HAND unchanged)
 */
function markExpired({ branchId, warehouseId, productId, quantity, referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    if (inv.quantity_available < qty) {
      throw new Error(`Insufficient available stock to mark expired. Available: ${inv.quantity_available}, Requested: ${qty}`);
    }

    const newAvailable = inv.quantity_available - qty;
    const newExpired = inv.quantity_expired + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_available = ?, quantity_expired = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvailable, newExpired, inv.id);

    const updated = { ...inv, quantity_available: newAvailable, quantity_expired: newExpired };
    assertInventoryInvariant(updated, 'markExpired');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'EXPIRED_SEGREGATION',
      quantityChange: qty, prevQty: inv.quantity_available, newQty: newAvailable,
      fromState: 'AVAILABLE', toState: 'EXPIRED', referenceType: 'EXPIRY',
      referenceId, reason: reason || 'Product past expiration date', userId
    });

    return updated;
  })();
}

/**
 * 7. WRITE OFF STOCK: DAMAGED or EXPIRED -> WRITTEN_OFF (Decrements ON_HAND)
 */
function writeOffStock({ branchId, warehouseId, productId, quantity, fromState = 'DAMAGED', referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');
  if (fromState !== 'DAMAGED' && fromState !== 'EXPIRED') {
    throw new Error('Write-off can only be executed from DAMAGED or EXPIRED state');
  }

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    const pool = fromState === 'DAMAGED' ? inv.quantity_damaged : inv.quantity_expired;

    if (pool < qty) {
      throw new Error(`Cannot write off ${qty} units; only ${pool} currently in ${fromState} state.`);
    }

    const newDamaged = fromState === 'DAMAGED' ? inv.quantity_damaged - qty : inv.quantity_damaged;
    const newExpired = fromState === 'EXPIRED' ? inv.quantity_expired - qty : inv.quantity_expired;
    const newOnHand = inv.quantity_on_hand - qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_on_hand = ?, quantity_damaged = ?, quantity_expired = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOnHand, newDamaged, newExpired, inv.id);

    const updated = { ...inv, quantity_on_hand: newOnHand, quantity_damaged: newDamaged, quantity_expired: newExpired };
    assertInventoryInvariant(updated, 'writeOffStock');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'DAMAGED_WRITE_OFF',
      quantityChange: -qty, prevQty: inv.quantity_on_hand, newQty: newOnHand,
      fromState, toState: 'EXTERNAL', referenceType: 'WRITE_OFF',
      referenceId, reason: reason || `Certified write-off from ${fromState}`, userId
    });

    return updated;
  })();
}

/**
 * 8. RESTORE TO AVAILABLE: DAMAGED or EXPIRED -> AVAILABLE (ON_HAND unchanged)
 */
function restoreToAvailable({ branchId, warehouseId, productId, quantity, fromState = 'DAMAGED', referenceId, userId, reason }) {
  const qty = Math.abs(Number(quantity));
  if (qty <= 0) throw new Error('Quantity must be greater than 0');

  return db.transaction(() => {
    const inv = getOrInitInventory(warehouseId, productId, branchId);
    const pool = fromState === 'DAMAGED' ? inv.quantity_damaged : inv.quantity_expired;
    if (pool < qty) {
      throw new Error(`Cannot restore ${qty} units; only ${pool} currently in ${fromState}.`);
    }

    const newDamaged = fromState === 'DAMAGED' ? inv.quantity_damaged - qty : inv.quantity_damaged;
    const newExpired = fromState === 'EXPIRED' ? inv.quantity_expired - qty : inv.quantity_expired;
    const newAvailable = inv.quantity_available + qty;

    db.prepare(`
      UPDATE inventory
      SET quantity_available = ?, quantity_damaged = ?, quantity_expired = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvailable, newDamaged, newExpired, inv.id);

    const updated = { ...inv, quantity_available: newAvailable, quantity_damaged: newDamaged, quantity_expired: newExpired };
    assertInventoryInvariant(updated, 'restoreToAvailable');

    logMovement({
      branchId: inv.branch_id, warehouseId, productId, movementType: 'RESTORE_AVAILABLE',
      quantityChange: qty, prevQty: pool, newQty: pool - qty,
      fromState, toState: 'AVAILABLE', referenceType: 'ADJUSTMENT',
      referenceId, reason: reason || `Re-inspected and restored from ${fromState}`, userId
    });

    return updated;
  })();
}

/**
 * 9. GET INVENTORY STATE SUMMARY FOR BRANCH / WAREHOUSE
 */
function getInventoryStateSummary({ branchId, warehouseId, productId } = {}) {
  let query = `
    SELECT i.*, p.sku, p.name as product_name, p.barcode, p.category, p.unit_of_measure,
           p.reorder_threshold, b.name as branch_name, b.code as branch_code,
           w.name as warehouse_name, w.code as warehouse_code
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN branches b ON i.branch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (branchId) {
    query += ' AND i.branch_id = ?';
    params.push(Number(branchId));
  }
  if (warehouseId) {
    query += ' AND i.warehouse_id = ?';
    params.push(Number(warehouseId));
  }
  if (productId) {
    query += ' AND i.product_id = ?';
    params.push(Number(productId));
  }

  query += ' ORDER BY b.name ASC, w.name ASC, p.name ASC';
  return db.prepare(query).all(...params);
}

module.exports = {
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
  getInventoryStateSummary,
  logMovement
};
