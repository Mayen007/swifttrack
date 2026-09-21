// server/services/advancedInventoryService.js
// SwiftTrack Kenya: Phase 3.3 Advanced Inventory Engine
// Batch/Lot Tracking, Expiry Management, Serial Numbers, FIFO / Weighted-Average Valuation, COGS & Reorder Alerts
const { db } = require('../db/database.js');
const {
  getOrInitInventory,
  markExpired
} = require('./inventoryStateService.js');

/**
 * 1. BATCH / LOT MANAGEMENT
 */

function createBatch({
  branchId, warehouseId, productId, variantId = null,
  batchNumber, initialQuantity, unitCost = 0,
  expiryDate = null, manufacturingDate = null,
  supplierId = null, receiptItemId = null, notes = null
}) {
  const qty = Math.abs(Number(initialQuantity));
  if (!batchNumber || !productId || !warehouseId || qty <= 0) {
    throw new Error('Valid batchNumber, productId, warehouseId, and positive initialQuantity are required');
  }

  const effectiveBranchId = branchId || (() => {
    const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouseId);
    return wh ? wh.branch_id : 1;
  })();

  const existing = db.prepare(`
    SELECT * FROM inventory_batches
    WHERE warehouse_id = ? AND product_id = ? AND batch_number = ?
  `).get(warehouseId, productId, batchNumber);

  if (existing) {
    const newInitQty = existing.initial_quantity + qty;
    const newAvailQty = existing.quantity_available + qty;
    const newUnitCost = Number(unitCost) > 0 ? Number(unitCost) : existing.unit_cost;
    db.prepare(`
      UPDATE inventory_batches
      SET initial_quantity = ?, quantity_available = ?, unit_cost = ?,
          status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newInitQty, newAvailQty, newUnitCost, existing.id);

    return db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(existing.id);
  }

  const res = db.prepare(`
    INSERT INTO inventory_batches (
      batch_number, product_id, variant_id, warehouse_id, branch_id,
      supplier_id, receipt_item_id, initial_quantity, quantity_available,
      quantity_reserved, unit_cost, manufacturing_date, expiry_date,
      status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'ACTIVE', ?)
  `).run(
    batchNumber, productId, variantId, warehouseId, effectiveBranchId,
    supplierId, receiptItemId, qty, qty,
    Number(unitCost) || 0, manufacturingDate || null, expiryDate || null,
    notes || ''
  );

  return db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(res.lastInsertRowid);
}

function getBatches({ productId, warehouseId, branchId, status, expiringDays = null }) {
  let query = `
    SELECT b.*, p.name AS product_name, p.sku AS product_sku,
           w.name AS warehouse_name, br.name AS branch_name
    FROM inventory_batches b
    JOIN products p ON b.product_id = p.id
    JOIN warehouses w ON b.warehouse_id = w.id
    JOIN branches br ON b.branch_id = br.id
    WHERE 1=1
  `;
  const params = [];

  if (productId) {
    query += ' AND b.product_id = ?';
    params.push(productId);
  }
  if (warehouseId) {
    query += ' AND b.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND b.branch_id = ?';
    params.push(branchId);
  }
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }
  if (expiringDays !== null) {
    query += ` AND b.expiry_date IS NOT NULL AND b.expiry_date <= date('now', '+' || ? || ' days')`;
    params.push(expiringDays);
  }

  query += ` ORDER BY CASE WHEN b.expiry_date IS NOT NULL THEN b.expiry_date ELSE '9999-12-31' END ASC, b.id ASC`;
  return db.prepare(query).all(...params);
}

function getBatchById(id) {
  return db.prepare(`
    SELECT b.*, p.name AS product_name, p.sku AS product_sku,
           w.name AS warehouse_name, br.name AS branch_name
    FROM inventory_batches b
    JOIN products p ON b.product_id = p.id
    JOIN warehouses w ON b.warehouse_id = w.id
    JOIN branches br ON b.branch_id = br.id
    WHERE b.id = ?
  `).get(id);
}

/**
 * Deplete batches using strict FIFO (Oldest expiry first, then oldest creation date)
 */
function depleteBatchFIFO({ warehouseId, productId, quantity }) {
  let remainingNeeded = Math.abs(Number(quantity));
  if (remainingNeeded <= 0) return { allocations: [], totalCogs: 0, totalDepleted: 0 };

  const batches = db.prepare(`
    SELECT * FROM inventory_batches
    WHERE warehouse_id = ? AND product_id = ? AND status = 'ACTIVE' AND quantity_available > 0
    ORDER BY CASE WHEN expiry_date IS NOT NULL THEN expiry_date ELSE '9999-12-31' END ASC,
             created_at ASC, id ASC
  `).all(warehouseId, productId);

  const allocations = [];
  let totalCogs = 0;
  let totalDepleted = 0;

  for (const b of batches) {
    if (remainingNeeded <= 0) break;

    const take = Math.min(b.quantity_available, remainingNeeded);
    const newAvail = b.quantity_available - take;
    const newStatus = newAvail === 0 ? 'DEPLETED' : 'ACTIVE';

    db.prepare(`
      UPDATE inventory_batches
      SET quantity_available = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAvail, newStatus, b.id);

    const cost = take * b.unit_cost;
    allocations.push({
      batchId: b.id,
      batchNumber: b.batch_number,
      quantity: take,
      unitCost: b.unit_cost,
      totalCost: cost,
      expiryDate: b.expiry_date
    });

    totalCogs += cost;
    totalDepleted += take;
    remainingNeeded -= take;
  }

  return {
    allocations,
    totalCogs: Number(totalCogs.toFixed(2)),
    totalDepleted,
    unallocatedQuantity: remainingNeeded
  };
}

/**
 * 2. EXPIRY DATES INTELLIGENCE & AUTOMATED SEGREGATION
 */

function evaluateBatchExpiries({ warehouseId = null, branchId = null, currentDate = null, userId = 1 }) {
  const targetDate = currentDate || new Date().toISOString().slice(0, 10);

  let query = `
    SELECT b.* FROM inventory_batches b
    WHERE b.status = 'ACTIVE'
      AND b.quantity_available > 0
      AND b.expiry_date IS NOT NULL
      AND b.expiry_date <= ?
  `;
  const params = [targetDate];

  if (warehouseId) {
    query += ' AND b.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND b.branch_id = ?';
    params.push(branchId);
  }

  const expiredBatches = db.prepare(query).all(...params);
  const segregated = [];
  let totalUnitsExpired = 0;

  for (const b of expiredBatches) {
    const qty = b.quantity_available;
    if (qty <= 0) continue;

    // Segregate stock in multi-state inventory from AVAILABLE to EXPIRED
    markExpired({
      branchId: b.branch_id,
      warehouseId: b.warehouse_id,
      productId: b.product_id,
      quantity: qty,
      referenceId: b.batch_number,
      userId,
      reason: `Auto-segregation: Batch ${b.batch_number} expired on ${b.expiry_date}`
    });

    // Mark batch as EXPIRED and zero available
    db.prepare(`
      UPDATE inventory_batches
      SET quantity_available = 0, status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(b.id);

    segregated.push({
      batchId: b.id,
      batchNumber: b.batch_number,
      productId: b.product_id,
      warehouseId: b.warehouse_id,
      quantity: qty,
      unitCost: b.unit_cost,
      lossValue: Number((qty * b.unit_cost).toFixed(2)),
      expiryDate: b.expiry_date
    });

    totalUnitsExpired += qty;
  }

  return {
    evaluatedAt: targetDate,
    expiredBatchesCount: segregated.length,
    totalUnitsExpired,
    segregatedBatches: segregated
  };
}

function getExpiringBatches({ daysThreshold = 30, branchId = null, warehouseId = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const thresholdDate = new Date(Date.now() + daysThreshold * 86400000).toISOString().slice(0, 10);

  let query = `
    SELECT b.*, p.name AS product_name, p.sku AS product_sku,
           w.name AS warehouse_name, br.name AS branch_name
    FROM inventory_batches b
    JOIN products p ON b.product_id = p.id
    JOIN warehouses w ON b.warehouse_id = w.id
    JOIN branches br ON b.branch_id = br.id
    WHERE b.quantity_available > 0 AND b.expiry_date IS NOT NULL
  `;
  const params = [];

  if (warehouseId) {
    query += ' AND b.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND b.branch_id = ?';
    params.push(branchId);
  }

  query += ` ORDER BY b.expiry_date ASC`;
  const rows = db.prepare(query).all(...params);

  const criticalExpired = [];
  const warningExpiringSoon = [];
  const healthy = [];

  for (const r of rows) {
    const diffDays = Math.ceil((new Date(r.expiry_date) - new Date(today)) / 86400000);
    const enriched = { ...r, daysUntilExpiry: diffDays };

    if (diffDays <= 0) {
      criticalExpired.push(enriched);
    } else if (diffDays <= daysThreshold) {
      warningExpiringSoon.push(enriched);
    } else {
      healthy.push(enriched);
    }
  }

  return {
    summary: {
      criticalCount: criticalExpired.length,
      warningCount: warningExpiringSoon.length,
      healthyCount: healthy.length,
      daysThreshold
    },
    criticalExpired,
    warningExpiringSoon,
    healthy
  };
}

/**
 * 3. SERIAL NUMBERS MANAGEMENT
 */

function registerSerials({
  productId, variantId = null, warehouseId, branchId = null,
  batchId = null, serialNumbers = [], unitCost = 0, notes = null
}) {
  if (!productId || !warehouseId || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
    throw new Error('Valid productId, warehouseId, and serialNumbers array are required');
  }

  const effectiveBranchId = branchId || (() => {
    const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouseId);
    return wh ? wh.branch_id : 1;
  })();

  const cleanSerials = [...new Set(serialNumbers.map(s => String(s).trim()).filter(Boolean))];
  if (cleanSerials.length === 0) throw new Error('No valid serial numbers provided');

  return db.transaction(() => {
    // Check for duplicates in DB
    const checkStmt = db.prepare('SELECT serial_number FROM inventory_serials WHERE serial_number = ?');
    for (const sn of cleanSerials) {
      const dup = checkStmt.get(sn);
      if (dup) {
        throw new Error(`Serial number '${sn}' is already registered in the system.`);
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO inventory_serials (
        serial_number, product_id, variant_id, warehouse_id, branch_id,
        batch_id, status, unit_cost, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
    `);

    const insertedIds = [];
    for (const sn of cleanSerials) {
      const r = insertStmt.run(sn, productId, variantId, warehouseId, effectiveBranchId, batchId, Number(unitCost) || 0, notes || '');
      insertedIds.push(r.lastInsertRowid);
    }

    // Mark product as serialized if not already set
    db.prepare('UPDATE products SET is_serialized = 1 WHERE id = ?').run(productId);

    return {
      registeredCount: insertedIds.length,
      serialNumbers: cleanSerials
    };
  })();
}

function allocateSerial({ serialNumber, orderId = null, saleId = null }) {
  const serial = db.prepare('SELECT * FROM inventory_serials WHERE serial_number = ?').get(serialNumber);
  if (!serial) throw new Error(`Serial number '${serialNumber}' not found`);
  if (serial.status !== 'AVAILABLE') {
    throw new Error(`Serial number '${serialNumber}' is not available (Status: ${serial.status})`);
  }

  db.prepare(`
    UPDATE inventory_serials
    SET status = 'RESERVED', allocated_order_id = ?, allocated_sale_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(orderId, saleId, serial.id);

  return db.prepare('SELECT * FROM inventory_serials WHERE id = ?').get(serial.id);
}

function markSerialSold({ serialNumber, saleId }) {
  const serial = db.prepare('SELECT * FROM inventory_serials WHERE serial_number = ?').get(serialNumber);
  if (!serial) throw new Error(`Serial number '${serialNumber}' not found`);

  db.prepare(`
    UPDATE inventory_serials
    SET status = 'SOLD', allocated_sale_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(saleId, serial.id);

  return db.prepare('SELECT * FROM inventory_serials WHERE id = ?').get(serial.id);
}

function getSerials({ productId, warehouseId, branchId, status, serialNumber }) {
  let query = `
    SELECT s.*, p.name AS product_name, p.sku AS product_sku,
           w.name AS warehouse_name, br.name AS branch_name,
           b.batch_number
    FROM inventory_serials s
    JOIN products p ON s.product_id = p.id
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN branches br ON s.branch_id = br.id
    LEFT JOIN inventory_batches b ON s.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (productId) {
    query += ' AND s.product_id = ?';
    params.push(productId);
  }
  if (warehouseId) {
    query += ' AND s.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND s.branch_id = ?';
    params.push(branchId);
  }
  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }
  if (serialNumber) {
    query += ' AND s.serial_number LIKE ?';
    params.push(`%${serialNumber}%`);
  }

  query += ' ORDER BY s.id DESC';
  return db.prepare(query).all(...params);
}

/**
 * 4. VALUATION & COGS STRATEGY (FIFO vs WEIGHTED_AVERAGE)
 */

function updateMovingAverageCost({ warehouseId, productId, receivedQty, unitCost }) {
  const qty = Number(receivedQty) || 0;
  const newCost = Number(unitCost) || 0;
  if (qty <= 0) return 0;

  const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
  const product = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(productId);

  const curAvailable = inv ? Math.max(0, inv.quantity_available) : 0;
  const curAvgCost = (inv && inv.average_cost > 0) ? inv.average_cost : (product ? product.cost_price : 0);

  const totalCurrentValue = curAvailable * curAvgCost;
  const totalReceivedValue = qty * newCost;
  const totalQuantity = curAvailable + qty;

  const updatedAverageCost = totalQuantity > 0
    ? Number(((totalCurrentValue + totalReceivedValue) / totalQuantity).toFixed(2))
    : newCost;

  if (inv) {
    db.prepare(`
      UPDATE inventory
      SET average_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedAverageCost, inv.id);
  }

  return updatedAverageCost;
}

function calculateCOGS({ warehouseId, productId, quantity, costingMethod = null }) {
  const product = db.prepare('SELECT cost_price, costing_method FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error(`Product ${productId} not found`);

  const effectiveMethod = costingMethod || product.costing_method || 'FIFO';
  const qty = Math.max(1, Number(quantity) || 1);

  if (effectiveMethod === 'WEIGHTED_AVERAGE') {
    const inv = db.prepare('SELECT average_cost FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
    const unitCost = (inv && inv.average_cost > 0) ? inv.average_cost : product.cost_price;
    const totalCogs = Number((qty * unitCost).toFixed(2));

    return {
      costingMethod: 'WEIGHTED_AVERAGE',
      unitCost,
      totalCogs,
      allocations: [{ quantity: qty, unitCost, totalCost: totalCogs }]
    };
  }

  // FIFO Strategy: Deplete from oldest batch
  const fifoResult = depleteBatchFIFO({ warehouseId, productId, quantity: qty });
  let totalCogs = fifoResult.totalCogs;

  // Fallback: If not enough batch-tracked inventory exists, fill remainder with product.cost_price
  if (fifoResult.unallocatedQuantity > 0) {
    const fallbackCost = Number((fifoResult.unallocatedQuantity * product.cost_price).toFixed(2));
    totalCogs = Number((totalCogs + fallbackCost).toFixed(2));
    fifoResult.allocations.push({
      batchId: null,
      batchNumber: 'STANDARD_STOCK',
      quantity: fifoResult.unallocatedQuantity,
      unitCost: product.cost_price,
      totalCost: fallbackCost
    });
  }

  const effectiveUnitCost = Number((totalCogs / qty).toFixed(2));
  return {
    costingMethod: 'FIFO',
    unitCost: effectiveUnitCost,
    totalCogs,
    allocations: fifoResult.allocations
  };
}

function getInventoryValuation({ branchId = null, warehouseId = null }) {
  let query = `
    SELECT 
      i.warehouse_id, i.product_id,
      i.quantity_on_hand, i.quantity_available, i.quantity_reserved,
      i.quantity_in_transit, i.quantity_damaged, i.quantity_expired,
      i.average_cost,
      p.name AS product_name, p.sku AS product_sku, p.cost_price, p.selling_price,
      p.costing_method,
      c.name AS category_name,
      w.name AS warehouse_name,
      br.name AS branch_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN branches br ON i.branch_id = br.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (warehouseId) {
    query += ' AND i.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND i.branch_id = ?';
    params.push(branchId);
  }

  const rows = db.prepare(query).all(...params);

  let totalOnHandValue = 0;
  let totalAvailableValue = 0;
  let totalReservedValue = 0;
  let totalInTransitValue = 0;
  let totalDamagedValue = 0;
  let totalExpiredValue = 0;
  let totalRetailValue = 0;

  const itemDetails = rows.map(r => {
    const unitCost = r.average_cost > 0 ? r.average_cost : r.cost_price;
    const onHandVal = Number((r.quantity_on_hand * unitCost).toFixed(2));
    const availVal = Number((r.quantity_available * unitCost).toFixed(2));
    const resVal = Number((r.quantity_reserved * unitCost).toFixed(2));
    const transVal = Number((r.quantity_in_transit * unitCost).toFixed(2));
    const damVal = Number((r.quantity_damaged * unitCost).toFixed(2));
    const expVal = Number((r.quantity_expired * unitCost).toFixed(2));
    const retVal = Number((r.quantity_available * r.selling_price).toFixed(2));

    totalOnHandValue += onHandVal;
    totalAvailableValue += availVal;
    totalReservedValue += resVal;
    totalInTransitValue += transVal;
    totalDamagedValue += damVal;
    totalExpiredValue += expVal;
    totalRetailValue += retVal;

    return {
      productId: r.product_id,
      productName: r.product_name,
      sku: r.product_sku,
      categoryName: r.category_name,
      warehouseName: r.warehouse_name,
      branchName: r.branch_name,
      costingMethod: r.costing_method,
      unitCost,
      sellingPrice: r.selling_price,
      quantities: {
        onHand: r.quantity_on_hand,
        available: r.quantity_available,
        reserved: r.quantity_reserved,
        inTransit: r.quantity_in_transit,
        damaged: r.quantity_damaged,
        expired: r.quantity_expired
      },
      valuations: {
        onHand: onHandVal,
        available: availVal,
        reserved: resVal,
        inTransit: transVal,
        damagedLoss: damVal,
        expiredLoss: expVal,
        potentialRetail: retVal,
        potentialGrossProfit: Number((retVal - availVal).toFixed(2))
      }
    };
  });

  return {
    summary: {
      totalProductsTracked: rows.length,
      totalOnHandValue: Number(totalOnHandValue.toFixed(2)),
      totalAvailableValue: Number(totalAvailableValue.toFixed(2)),
      totalReservedValue: Number(totalReservedValue.toFixed(2)),
      totalInTransitValue: Number(totalInTransitValue.toFixed(2)),
      totalDamagedLossValue: Number(totalDamagedValue.toFixed(2)),
      totalExpiredLossValue: Number(totalExpiredValue.toFixed(2)),
      totalPotentialRetailValue: Number(totalRetailValue.toFixed(2)),
      totalPotentialGrossProfit: Number((totalRetailValue - totalAvailableValue).toFixed(2))
    },
    items: itemDetails
  };
}

/**
 * 5. REORDER ALERTS ENGINE
 */

function getReorderAlerts({ branchId = null, warehouseId = null }) {
  let query = `
    SELECT 
      i.warehouse_id, i.product_id, i.quantity_available, i.quantity_on_hand,
      p.name AS product_name, p.sku AS product_sku, p.cost_price,
      p.reorder_threshold, p.reorder_quantity,
      c.name AS category_name,
      w.name AS warehouse_name,
      br.name AS branch_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN branches br ON i.branch_id = br.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE i.quantity_available <= p.reorder_threshold
      AND p.is_active = 1
      AND p.is_archived = 0
  `;
  const params = [];

  if (warehouseId) {
    query += ' AND i.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (branchId) {
    query += ' AND i.branch_id = ?';
    params.push(branchId);
  }

  query += ' ORDER BY (p.reorder_threshold - i.quantity_available) DESC';
  const rows = db.prepare(query).all(...params);

  const alerts = rows.map(r => {
    const deficit = Math.max(0, r.reorder_threshold - r.quantity_available);
    const suggestedReorderQty = Math.max(r.reorder_quantity, deficit + r.reorder_quantity);
    const estimatedCost = Number((suggestedReorderQty * r.cost_price).toFixed(2));
    const urgency = r.quantity_available === 0 ? 'CRITICAL_OUT_OF_STOCK' : 'LOW_STOCK';

    return {
      productId: r.product_id,
      productName: r.product_name,
      sku: r.product_sku,
      categoryName: r.category_name,
      warehouseName: r.warehouse_name,
      branchName: r.branch_name,
      quantityAvailable: r.quantity_available,
      quantityOnHand: r.quantity_on_hand,
      reorderThreshold: r.reorder_threshold,
      reorderQuantity: r.reorder_quantity,
      deficit,
      suggestedReorderQty,
      estimatedCost,
      urgency
    };
  });

  return {
    totalAlerts: alerts.length,
    criticalCount: alerts.filter(a => a.urgency === 'CRITICAL_OUT_OF_STOCK').length,
    lowStockCount: alerts.filter(a => a.urgency === 'LOW_STOCK').length,
    totalEstimatedReorderCost: Number(alerts.reduce((acc, a) => acc + a.estimatedCost, 0).toFixed(2)),
    alerts
  };
}

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  depleteBatchFIFO,
  evaluateBatchExpiries,
  getExpiringBatches,
  registerSerials,
  allocateSerial,
  markSerialSold,
  getSerials,
  updateMovingAverageCost,
  calculateCOGS,
  getInventoryValuation,
  getReorderAlerts
};
