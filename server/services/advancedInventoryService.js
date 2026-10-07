// server/services/advancedInventoryService.js
// SwiftTrack Kenya: Phase 3.3 Advanced Inventory Engine
// Batch/Lot Tracking, Expiry Management, Serial Numbers, FIFO / Weighted-Average Valuation, COGS & Reorder Alerts
const dbAdapter = require('../db/dbAdapter.js');
const {
  getOrInitInventory,
  markExpired
} = require('./inventoryStateService.js');

/**
 * 1. BATCH / LOT MANAGEMENT
 */

async function createBatch({
  branchId, warehouseId, productId, variantId = null,
  batchNumber, initialQuantity, unitCost = 0,
  expiryDate = null, manufacturingDate = null,
  supplierId = null, receiptItemId = null, notes = null
}, client = null) {
  const qty = Math.abs(Number(initialQuantity));
  if (!batchNumber || !productId || !warehouseId || qty <= 0) {
    throw new Error('Valid batchNumber, productId, warehouseId, and positive initialQuantity are required');
  }

  let effectiveBranchId = branchId;
  if (!effectiveBranchId) {
    const wh = await dbAdapter.get('SELECT branch_id FROM warehouses WHERE id = ?', [warehouseId], client);
    effectiveBranchId = wh ? wh.branch_id : 1;
  }

  const existing = await dbAdapter.get(`
    SELECT * FROM inventory_batches
    WHERE warehouse_id = ? AND product_id = ? AND batch_number = ?
  `, [warehouseId, productId, batchNumber], client);

  if (existing) {
    const newInitQty = Number(existing.initial_quantity) + qty;
    const newAvailQty = Number(existing.quantity_available) + qty;
    const newUnitCost = Number(unitCost) > 0 ? Number(unitCost) : Number(existing.unit_cost);
    await dbAdapter.run(`
      UPDATE inventory_batches
      SET initial_quantity = ?, quantity_available = ?, unit_cost = ?,
          status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newInitQty, newAvailQty, newUnitCost, existing.id], client);

    return dbAdapter.get('SELECT * FROM inventory_batches WHERE id = ?', [existing.id], client);
  }

  const res = await dbAdapter.run(`
    INSERT INTO inventory_batches (
      batch_number, product_id, variant_id, warehouse_id, branch_id,
      supplier_id, receipt_item_id, initial_quantity, quantity_available,
      quantity_reserved, unit_cost, manufacturing_date, expiry_date,
      status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'ACTIVE', ?)
  `, [
    batchNumber, productId, variantId, warehouseId, effectiveBranchId,
    supplierId, receiptItemId, qty, qty,
    Number(unitCost) || 0, manufacturingDate || null, expiryDate || null,
    notes || ''
  ], client);

  const batchId = res.insertId || res.id;
  if (batchId) {
    return dbAdapter.get('SELECT * FROM inventory_batches WHERE id = ?', [batchId], client);
  }
  return dbAdapter.get(`
    SELECT * FROM inventory_batches
    WHERE warehouse_id = ? AND product_id = ? AND batch_number = ?
    ORDER BY id DESC LIMIT 1
  `, [warehouseId, productId, batchNumber], client);
}

async function getBatches({ productId, warehouseId, branchId, status, expiringDays = null }, client = null) {
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
    const targetDate = new Date(Date.now() + Number(expiringDays) * 86400000).toISOString().slice(0, 10);
    query += ` AND b.expiry_date IS NOT NULL AND b.expiry_date <= ?`;
    params.push(targetDate);
  }

  query += ` ORDER BY CASE WHEN b.expiry_date IS NOT NULL THEN b.expiry_date ELSE '9999-12-31' END ASC, b.id ASC`;
  return dbAdapter.all(query, params, client);
}

async function getBatchById(id, client = null) {
  return dbAdapter.get(`
    SELECT b.*, p.name AS product_name, p.sku AS product_sku,
           w.name AS warehouse_name, br.name AS branch_name
    FROM inventory_batches b
    JOIN products p ON b.product_id = p.id
    JOIN warehouses w ON b.warehouse_id = w.id
    JOIN branches br ON b.branch_id = br.id
    WHERE b.id = ?
  `, [id], client);
}

/**
 * Deplete batches using strict FIFO (Oldest expiry first, then oldest creation date)
 */
async function depleteBatchFIFO({ warehouseId, productId, quantity }, client = null) {
  let remainingNeeded = Math.abs(Number(quantity));
  if (remainingNeeded <= 0) return { allocations: [], totalCogs: 0, totalDepleted: 0 };

  const batches = await dbAdapter.all(`
    SELECT * FROM inventory_batches
    WHERE warehouse_id = ? AND product_id = ? AND status = 'ACTIVE' AND quantity_available > 0
    ORDER BY CASE WHEN expiry_date IS NOT NULL THEN expiry_date ELSE '9999-12-31' END ASC,
             created_at ASC, id ASC
  `, [warehouseId, productId], client);

  const allocations = [];
  let totalCogs = 0;
  let totalDepleted = 0;

  for (const b of batches) {
    if (remainingNeeded <= 0) break;

    const available = Number(b.quantity_available);
    const unitCost = Number(b.unit_cost);
    const take = Math.min(available, remainingNeeded);
    const newAvail = available - take;
    const newStatus = newAvail === 0 ? 'DEPLETED' : 'ACTIVE';

    await dbAdapter.run(`
      UPDATE inventory_batches
      SET quantity_available = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newAvail, newStatus, b.id], client);

    const cost = take * unitCost;
    allocations.push({
      batchId: b.id,
      batchNumber: b.batch_number,
      quantity: take,
      unitCost: unitCost,
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

async function evaluateBatchExpiries({ warehouseId = null, branchId = null, currentDate = null, userId = 1 }, client = null) {
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

  const expiredBatches = await dbAdapter.all(query, params, client);
  const segregated = [];
  let totalUnitsExpired = 0;

  for (const b of expiredBatches) {
    const qty = Number(b.quantity_available);
    if (qty <= 0) continue;

    // Segregate stock in multi-state inventory from AVAILABLE to EXPIRED
    await markExpired({
      branchId: b.branch_id,
      warehouseId: b.warehouse_id,
      productId: b.product_id,
      quantity: qty,
      referenceId: b.batch_number,
      userId,
      reason: `Auto-segregation: Batch ${b.batch_number} expired on ${b.expiry_date}`
    }, client);

    // Mark batch as EXPIRED and zero available
    await dbAdapter.run(`
      UPDATE inventory_batches
      SET quantity_available = 0, status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [b.id], client);

    const unitCost = Number(b.unit_cost);
    segregated.push({
      batchId: b.id,
      batchNumber: b.batch_number,
      productId: b.product_id,
      warehouseId: b.warehouse_id,
      quantity: qty,
      unitCost: unitCost,
      lossValue: Number((qty * unitCost).toFixed(2)),
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

async function getExpiringBatches({ daysThreshold = 30, branchId = null, warehouseId = null }, client = null) {
  const today = new Date().toISOString().slice(0, 10);

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
  const rows = await dbAdapter.all(query, params, client);

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

async function registerSerials({
  productId, variantId = null, warehouseId, branchId = null,
  batchId = null, serialNumbers = [], unitCost = 0, notes = null
}, client = null) {
  if (!productId || !warehouseId || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
    throw new Error('Valid productId, warehouseId, and serialNumbers array are required');
  }

  let effectiveBranchId = branchId;
  if (!effectiveBranchId) {
    const wh = await dbAdapter.get('SELECT branch_id FROM warehouses WHERE id = ?', [warehouseId], client);
    effectiveBranchId = wh ? wh.branch_id : 1;
  }

  const cleanSerials = [...new Set(serialNumbers.map(s => String(s).trim()).filter(Boolean))];
  if (cleanSerials.length === 0) throw new Error('No valid serial numbers provided');

  const runner = async (txnClient) => {
    for (const sn of cleanSerials) {
      const dup = await dbAdapter.get('SELECT serial_number FROM inventory_serials WHERE serial_number = ?', [sn], txnClient);
      if (dup) {
        throw new Error(`Serial number '${sn}' is already registered in the system.`);
      }
    }

    const insertedIds = [];
    for (const sn of cleanSerials) {
      const r = await dbAdapter.run(`
        INSERT INTO inventory_serials (
          serial_number, product_id, variant_id, warehouse_id, branch_id,
          batch_id, status, unit_cost, notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)
      `, [sn, productId, variantId, warehouseId, effectiveBranchId, batchId, Number(unitCost) || 0, notes || ''], txnClient);
      insertedIds.push(r.insertId || r.id);
    }

    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    await dbAdapter.run(
      isPostgres ? 'UPDATE products SET is_serialized = true WHERE id = ?' : 'UPDATE products SET is_serialized = 1 WHERE id = ?',
      [productId],
      txnClient
    );

    return {
      registeredCount: insertedIds.length,
      serialNumbers: cleanSerials
    };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

async function allocateSerial({ serialNumber, orderId = null, saleId = null }, client = null) {
  const serial = await dbAdapter.get('SELECT * FROM inventory_serials WHERE serial_number = ?', [serialNumber], client);
  if (!serial) throw new Error(`Serial number '${serialNumber}' not found`);
  if (serial.status !== 'AVAILABLE') {
    throw new Error(`Serial number '${serialNumber}' is not available (Status: ${serial.status})`);
  }

  await dbAdapter.run(`
    UPDATE inventory_serials
    SET status = 'RESERVED', allocated_order_id = ?, allocated_sale_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [orderId, saleId, serial.id], client);

  return dbAdapter.get('SELECT * FROM inventory_serials WHERE id = ?', [serial.id], client);
}

async function markSerialSold({ serialNumber, saleId }, client = null) {
  const serial = await dbAdapter.get('SELECT * FROM inventory_serials WHERE serial_number = ?', [serialNumber], client);
  if (!serial) throw new Error(`Serial number '${serialNumber}' not found`);

  await dbAdapter.run(`
    UPDATE inventory_serials
    SET status = 'SOLD', allocated_sale_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [saleId, serial.id], client);

  return dbAdapter.get('SELECT * FROM inventory_serials WHERE id = ?', [serial.id], client);
}

async function getSerials({ productId, warehouseId, branchId, status, serialNumber }, client = null) {
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
  return dbAdapter.all(query, params, client);
}

/**
 * 4. VALUATION & COGS STRATEGY (FIFO vs WEIGHTED_AVERAGE)
 */

async function updateMovingAverageCost({ warehouseId, productId, receivedQty, unitCost }, client = null) {
  const qty = Number(receivedQty) || 0;
  const newCost = Number(unitCost) || 0;
  if (qty <= 0) return 0;

  const inv = await dbAdapter.get('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?', [warehouseId, productId], client);
  const product = await dbAdapter.get('SELECT cost_price FROM products WHERE id = ?', [productId], client);

  const curAvailable = inv ? Math.max(0, Number(inv.quantity_available)) : 0;
  const invAvgCost = inv ? Number(inv.average_cost) : 0;
  const prodCost = product ? Number(product.cost_price) : 0;
  const curAvgCost = invAvgCost > 0 ? invAvgCost : prodCost;

  const totalCurrentValue = curAvailable * curAvgCost;
  const totalReceivedValue = qty * newCost;
  const totalQuantity = curAvailable + qty;

  const updatedAverageCost = totalQuantity > 0
    ? Number(((totalCurrentValue + totalReceivedValue) / totalQuantity).toFixed(2))
    : newCost;

  if (inv) {
    await dbAdapter.run(`
      UPDATE inventory
      SET average_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [updatedAverageCost, inv.id], client);
  }

  return updatedAverageCost;
}

async function calculateCOGS({ warehouseId, productId, quantity, costingMethod = null }, client = null) {
  const product = await dbAdapter.get('SELECT cost_price, costing_method FROM products WHERE id = ?', [productId], client);
  if (!product) throw new Error(`Product ${productId} not found`);

  const effectiveMethod = costingMethod || product.costing_method || 'FIFO';
  const qty = Math.max(1, Number(quantity) || 1);
  const prodCost = Number(product.cost_price) || 0;

  if (effectiveMethod === 'WEIGHTED_AVERAGE') {
    const inv = await dbAdapter.get('SELECT average_cost FROM inventory WHERE warehouse_id = ? AND product_id = ?', [warehouseId, productId], client);
    const invAvgCost = inv ? Number(inv.average_cost) : 0;
    const unitCost = invAvgCost > 0 ? invAvgCost : prodCost;
    const totalCogs = Number((qty * unitCost).toFixed(2));

    return {
      costingMethod: 'WEIGHTED_AVERAGE',
      unitCost,
      totalCogs,
      allocations: [{ quantity: qty, unitCost, totalCost: totalCogs }]
    };
  }

  // FIFO Strategy: Deplete from oldest batch
  const fifoResult = await depleteBatchFIFO({ warehouseId, productId, quantity: qty }, client);
  let totalCogs = fifoResult.totalCogs;

  if (fifoResult.unallocatedQuantity > 0) {
    const fallbackCost = Number((fifoResult.unallocatedQuantity * prodCost).toFixed(2));
    totalCogs = Number((totalCogs + fallbackCost).toFixed(2));
    fifoResult.allocations.push({
      batchId: null,
      batchNumber: 'STANDARD_STOCK',
      quantity: fifoResult.unallocatedQuantity,
      unitCost: prodCost,
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

async function getInventoryValuation({ branchId = null, warehouseId = null }, client = null) {
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

  const rows = await dbAdapter.all(query, params, client);

  let totalOnHandValue = 0;
  let totalAvailableValue = 0;
  let totalReservedValue = 0;
  let totalInTransitValue = 0;
  let totalDamagedValue = 0;
  let totalExpiredValue = 0;
  let totalRetailValue = 0;

  const itemDetails = rows.map(r => {
    const avgCost = Number(r.average_cost) || 0;
    const costPrice = Number(r.cost_price) || 0;
    const unitCost = avgCost > 0 ? avgCost : costPrice;
    const onHand = Number(r.quantity_on_hand) || 0;
    const available = Number(r.quantity_available) || 0;
    const reserved = Number(r.quantity_reserved) || 0;
    const inTransit = Number(r.quantity_in_transit) || 0;
    const damaged = Number(r.quantity_damaged) || 0;
    const expired = Number(r.quantity_expired) || 0;
    const sellingPrice = Number(r.selling_price) || 0;

    const onHandVal = Number((onHand * unitCost).toFixed(2));
    const availVal = Number((available * unitCost).toFixed(2));
    const resVal = Number((reserved * unitCost).toFixed(2));
    const transVal = Number((inTransit * unitCost).toFixed(2));
    const damVal = Number((damaged * unitCost).toFixed(2));
    const expVal = Number((expired * unitCost).toFixed(2));
    const retVal = Number((available * sellingPrice).toFixed(2));

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
      sellingPrice,
      quantities: {
        onHand,
        available,
        reserved,
        inTransit,
        damaged,
        expired
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

async function getReorderAlerts({ branchId = null, warehouseId = null }, client = null) {
  const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
  const activeCondition = isPostgres ? 'p.is_active = true' : 'p.is_active = 1';
  const archivedCondition = isPostgres ? 'p.is_archived = false' : 'p.is_archived = 0';

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
      AND ${activeCondition}
      AND ${archivedCondition}
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
  const rows = await dbAdapter.all(query, params, client);

  const alerts = rows.map(r => {
    const available = Number(r.quantity_available) || 0;
    const threshold = Number(r.reorder_threshold) || 0;
    const reorderQty = Number(r.reorder_quantity) || 0;
    const costPrice = Number(r.cost_price) || 0;

    const deficit = Math.max(0, threshold - available);
    const suggestedReorderQty = Math.max(reorderQty, deficit + reorderQty);
    const estimatedCost = Number((suggestedReorderQty * costPrice).toFixed(2));
    const urgency = available === 0 ? 'CRITICAL_OUT_OF_STOCK' : 'LOW_STOCK';

    return {
      productId: r.product_id,
      productName: r.product_name,
      sku: r.product_sku,
      categoryName: r.category_name,
      warehouseName: r.warehouse_name,
      branchName: r.branch_name,
      quantityAvailable: available,
      quantityOnHand: Number(r.quantity_on_hand) || 0,
      reorderThreshold: threshold,
      reorderQuantity: reorderQty,
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
