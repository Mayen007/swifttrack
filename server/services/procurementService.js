// server/services/procurementService.js
// SwiftTrack Kenya: Complete Procurement Lifecycle Engine (Phase 8)
const { db } = require('../db/database.js');
const {
  getOrInitInventory,
  assertInventoryInvariant,
  logMovement
} = require('./inventoryStateService.js');

/**
 * Log procurement event to immutable audit trail
 */
function logProcurementAudit({
  entityType,
  entityId,
  entityNumber,
  action,
  fromStatus = null,
  toStatus = null,
  userId = null,
  details = {}
}) {
  try {
    db.prepare(`
      INSERT INTO procurement_audit_trail (
        entity_type, entity_id, entity_number, action, from_status, to_status, user_id, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType,
      entityId,
      entityNumber,
      action,
      fromStatus,
      toStatus,
      userId,
      JSON.stringify(details)
    );
  } catch (err) {
    console.warn('Procurement audit log warning:', err.message);
  }
}

// ============================================================================
// 1. SUPPLIER ANALYTICS, PERFORMANCE & DIRECTORY
// ============================================================================

/**
 * Compute performance telemetry metrics for a given supplier
 */
function getSupplierPerformance(supplierId) {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  // 1. Total POs and Completed POs
  const poStats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN status IN ('FULLY_RECEIVED', 'CLOSED') THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COALESCE(SUM(total_amount), 0.0) as total_po_value
    FROM purchase_orders
    WHERE supplier_id = ?
  `).get(supplierId);

  // 2. Fulfillment rate (% ordered vs received)
  const fulfillmentStats = db.prepare(`
    SELECT
      COALESCE(SUM(poi.ordered_quantity), 0) as total_ordered_qty,
      COALESCE(SUM(poi.received_quantity), 0) as total_received_qty
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    WHERE po.supplier_id = ? AND po.status != 'CANCELLED'
  `).get(supplierId);

  const fulfillmentRate = fulfillmentStats.total_ordered_qty > 0
    ? Math.min(100, Math.round((fulfillmentStats.total_received_qty / fulfillmentStats.total_ordered_qty) * 100))
    : 100;

  // 3. Quality score (% good vs damaged from inbound receipts)
  const qualityStats = db.prepare(`
    SELECT
      COALESCE(SUM(sri.quantity_received), 0) as total_received,
      COALESCE(SUM(CASE WHEN sri.condition = 'GOOD' THEN sri.quantity_received ELSE 0 END), 0) as good_received,
      COALESCE(SUM(CASE WHEN sri.condition = 'DAMAGED' THEN sri.quantity_received ELSE 0 END), 0) as damaged_received
    FROM stock_receipt_items sri
    JOIN stock_receipts sr ON sri.stock_receipt_id = sr.id
    WHERE sr.supplier_id = ?
  `).get(supplierId);

  const qualityPassRate = qualityStats.total_received > 0
    ? Math.round((qualityStats.good_received / qualityStats.total_received) * 100)
    : 100;

  // 4. On-time delivery rate
  const deliveryStats = db.prepare(`
    SELECT
      COUNT(DISTINCT sr.id) as total_receipts,
      COUNT(DISTINCT CASE WHEN po.expected_delivery_date IS NULL OR DATE(sr.created_at) <= DATE(po.expected_delivery_date) THEN sr.id END) as on_time_receipts
    FROM stock_receipts sr
    LEFT JOIN purchase_orders po ON sr.purchase_order_id = po.id
    WHERE sr.supplier_id = ?
  `).get(supplierId);

  const onTimeRate = deliveryStats.total_receipts > 0
    ? Math.round((deliveryStats.on_time_receipts / deliveryStats.total_receipts) * 100)
    : 100;

  // 5. Financial settlement stats
  const invStats = db.prepare(`
    SELECT
      COALESCE(SUM(total_amount), 0.0) as total_invoiced,
      COALESCE(SUM(amount_paid), 0.0) as total_paid,
      COALESCE(SUM(total_amount - amount_paid), 0.0) as outstanding_balance
    FROM supplier_invoices
    WHERE supplier_id = ? AND status != 'CANCELLED'
  `).get(supplierId);

  return {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    supplier_code: supplier.code,
    lead_time_days: supplier.lead_time_days,
    rating: supplier.rating,
    total_orders: poStats.total_orders,
    completed_orders: poStats.completed_orders,
    cancelled_orders: poStats.cancelled_orders,
    total_po_value: poStats.total_po_value,
    fulfillment_rate: fulfillmentRate,
    quality_pass_rate: qualityPassRate,
    on_time_rate: onTimeRate,
    total_invoiced: invStats.total_invoiced,
    total_paid: invStats.total_paid,
    outstanding_balance: invStats.outstanding_balance
  };
}

/**
 * Fetch unified chronological history for a supplier
 */
function getSupplierHistory(supplierId) {
  const events = [];

  // Purchase Orders
  const pos = db.prepare(`
    SELECT id, po_number, status, total_amount, created_at, updated_at
    FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
  pos.forEach(po => {
    events.push({
      type: 'PURCHASE_ORDER',
      id: po.id,
      number: po.po_number,
      title: `Purchase Order ${po.po_number}`,
      status: po.status,
      amount: po.total_amount,
      timestamp: po.created_at
    });
  });

  // Receipts / GRNs
  const grns = db.prepare(`
    SELECT id, receipt_number, total_items, total_cost, created_at
    FROM stock_receipts WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
  grns.forEach(grn => {
    events.push({
      type: 'GRN',
      id: grn.id,
      number: grn.receipt_number,
      title: `Goods Received Note ${grn.receipt_number}`,
      status: 'RECEIVED',
      itemsCount: grn.total_items,
      amount: grn.total_cost,
      timestamp: grn.created_at
    });
  });

  // Invoices
  const invoices = db.prepare(`
    SELECT id, invoice_number, supplier_invoice_no, status, total_amount, amount_paid, created_at
    FROM supplier_invoices WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
  invoices.forEach(inv => {
    events.push({
      type: 'INVOICE',
      id: inv.id,
      number: inv.invoice_number,
      title: `Supplier Invoice ${inv.supplier_invoice_no} (${inv.invoice_number})`,
      status: inv.status,
      amount: inv.total_amount,
      amountPaid: inv.amount_paid,
      timestamp: inv.created_at
    });
  });

  // Payments
  const payments = db.prepare(`
    SELECT id, payment_number, payment_method, reference_number, amount, payment_date, created_at
    FROM supplier_payments WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
  payments.forEach(pay => {
    events.push({
      type: 'PAYMENT',
      id: pay.id,
      number: pay.payment_number,
      title: `Supplier Disbursement ${pay.payment_number} (${pay.payment_method})`,
      status: 'PAID',
      amount: pay.amount,
      reference: pay.reference_number,
      timestamp: pay.created_at
    });
  });

  // Returns
  const returns = db.prepare(`
    SELECT id, return_number, reason, status, total_amount, created_at
    FROM supplier_returns WHERE supplier_id = ? ORDER BY created_at DESC
  `).all(supplierId);
  returns.forEach(ret => {
    events.push({
      type: 'RETURN',
      id: ret.id,
      number: ret.return_number,
      title: `Supplier Return ${ret.return_number} (${ret.reason})`,
      status: ret.status,
      amount: ret.total_amount,
      timestamp: ret.created_at
    });
  });

  // Sort descending by timestamp
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events;
}

// ============================================================================
// 2. PURCHASE REQUISITION (PR) LIFECYCLE
// ============================================================================

/**
 * Create a new Purchase Requisition
 */
function createRequisition({ branchId, userId, urgency = 'MEDIUM', neededByDate = null, items = [], notes = '' }) {
  if (!branchId || !userId) throw new Error('Branch ID and User ID are required');
  if (!items || items.length === 0) throw new Error('Requisition must contain at least one line item');

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const prNumber = `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    let totalEstimatedCost = 0;
    const computedItems = items.map(it => {
      const qty = Math.max(1, Number(it.quantity || it.requested_quantity || 1));
      const cost = Number(it.unit_cost || it.estimated_unit_cost || 0);
      totalEstimatedCost += qty * cost;
      return {
        product_id: Number(it.product_id),
        requested_quantity: qty,
        estimated_unit_cost: cost,
        notes: it.notes || ''
      };
    });

    const res = db.prepare(`
      INSERT INTO purchase_requisitions (
        pr_number, branch_id, requested_by_user_id, urgency, needed_by_date,
        status, notes, total_estimated_cost
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?)
    `).run(prNumber, branchId, userId, urgency, neededByDate, notes, totalEstimatedCost);

    const prId = res.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO purchase_requisition_items (
        requisition_id, product_id, requested_quantity, estimated_unit_cost, notes
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const it of computedItems) {
      itemStmt.run(prId, it.product_id, it.requested_quantity, it.estimated_unit_cost, it.notes);
    }

    logProcurementAudit({
      entityType: 'REQUISITION',
      entityId: prId,
      entityNumber: prNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { itemsCount: items.length, totalEstimatedCost }
    });

    return getRequisitionById(prId);
  })();
}

function getRequisitionById(id) {
  const pr = db.prepare(`
    SELECT pr.*, b.name as branch_name, u.full_name as requested_by_name,
           au.full_name as approved_by_name
    FROM purchase_requisitions pr
    JOIN branches b ON pr.branch_id = b.id
    JOIN users u ON pr.requested_by_user_id = u.id
    LEFT JOIN users au ON pr.approved_by_user_id = au.id
    WHERE pr.id = ?
  `).get(id);

  if (!pr) return null;

  const items = db.prepare(`
    SELECT pri.*, p.name as product_name, p.sku, p.unit
    FROM purchase_requisition_items pri
    JOIN products p ON pri.product_id = p.id
    WHERE pri.requisition_id = ?
  `).all(id);

  return { ...pr, items };
}

/**
 * Submit PR for approval
 */
function submitRequisition(id, userId) {
  const pr = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(id);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'DRAFT') throw new Error(`Cannot submit requisition in status ${pr.status}`);

  db.prepare(`
    UPDATE purchase_requisitions
    SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'SUBMITTED',
    fromStatus: 'DRAFT',
    toStatus: 'SUBMITTED',
    userId
  });

  return getRequisitionById(id);
}

/**
 * Approve PR
 */
function approveRequisition(id, userId) {
  const pr = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(id);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
    throw new Error(`Cannot approve requisition in status ${pr.status}`);
  }

  db.prepare(`
    UPDATE purchase_requisitions
    SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, id);

  logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'APPROVED',
    fromStatus: pr.status,
    toStatus: 'APPROVED',
    userId
  });

  return getRequisitionById(id);
}

/**
 * Reject PR
 */
function rejectRequisition(id, userId, reason = '') {
  const pr = db.prepare('SELECT * FROM purchase_requisitions WHERE id = ?').get(id);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
    throw new Error(`Cannot reject requisition in status ${pr.status}`);
  }

  db.prepare(`
    UPDATE purchase_requisitions
    SET status = 'REJECTED', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason, id);

  logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'REJECTED',
    fromStatus: pr.status,
    toStatus: 'REJECTED',
    userId,
    details: { reason }
  });

  return getRequisitionById(id);
}

// ============================================================================
// 3. PURCHASE ORDER (PO) ENGINE
// ============================================================================

/**
 * Create a new Purchase Order
 */
function createPurchaseOrder({
  purchaseRequisitionId = null,
  supplierId,
  branchId,
  warehouseId,
  userId,
  paymentTerms = 'NET30',
  currency = 'KES',
  expectedDeliveryDate = null,
  items = [],
  shippingFee = 0.0,
  notes = ''
}) {
  if (!supplierId || !branchId || !warehouseId || !userId) {
    throw new Error('Supplier, Branch, Warehouse, and User are required to generate PO');
  }
  if (!items || items.length === 0) {
    throw new Error('Purchase order must contain at least one line item');
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    let subtotal = 0;
    let totalTax = 0;

    const computedItems = items.map(it => {
      const qty = Math.max(1, Number(it.ordered_quantity || it.quantity || 1));
      const cost = Number(it.unit_cost || 0);
      const taxRate = Number(it.tax_rate !== undefined ? it.tax_rate : 16.0);
      const lineCost = qty * cost;
      const lineTax = (lineCost * taxRate) / 100;
      subtotal += lineCost;
      totalTax += lineTax;

      return {
        product_id: Number(it.product_id),
        variant_id: it.variant_id ? Number(it.variant_id) : null,
        ordered_quantity: qty,
        unit_cost: cost,
        tax_rate: taxRate,
        tax_amount: lineTax,
        total_cost: lineCost + lineTax
      };
    });

    const parsedShipping = Number(shippingFee) || 0.0;
    const grandTotal = subtotal + totalTax + parsedShipping;

    const res = db.prepare(`
      INSERT INTO purchase_orders (
        po_number, purchase_requisition_id, supplier_id, branch_id, warehouse_id,
        created_by_user_id, status, payment_terms, currency, subtotal, tax_amount,
        shipping_fee, total_amount, expected_delivery_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poNumber,
      purchaseRequisitionId ? Number(purchaseRequisitionId) : null,
      supplierId,
      branchId,
      warehouseId,
      userId,
      paymentTerms || supplier.payment_terms || 'NET30',
      currency,
      subtotal,
      totalTax,
      parsedShipping,
      grandTotal,
      expectedDeliveryDate,
      notes
    );

    const poId = res.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO purchase_order_items (
        purchase_order_id, product_id, variant_id, ordered_quantity, received_quantity,
        unit_cost, tax_rate, tax_amount, total_cost
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
    `);

    for (const it of computedItems) {
      itemStmt.run(poId, it.product_id, it.variant_id, it.ordered_quantity, it.unit_cost, it.tax_rate, it.tax_amount, it.total_cost);
    }

    if (purchaseRequisitionId) {
      db.prepare(`
        UPDATE purchase_requisitions
        SET status = 'CONVERTED_TO_PO', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(purchaseRequisitionId);
    }

    logProcurementAudit({
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      entityNumber: poNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { supplierId, grandTotal, itemsCount: items.length }
    });

    return getPurchaseOrderById(poId);
  })();
}

function getPurchaseOrderById(id) {
  const po = db.prepare(`
    SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.tax_pin as supplier_tax_pin,
           s.phone as supplier_phone, s.email as supplier_email,
           b.name as branch_name, b.code as branch_code,
           w.name as warehouse_name, w.code as warehouse_code,
           u.full_name as created_by_name, au.full_name as approved_by_name
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    JOIN branches b ON po.branch_id = b.id
    JOIN warehouses w ON po.warehouse_id = w.id
    JOIN users u ON po.created_by_user_id = u.id
    LEFT JOIN users au ON po.approved_by_user_id = au.id
    WHERE po.id = ?
  `).get(id);

  if (!po) return null;

  const items = db.prepare(`
    SELECT poi.*, p.name as product_name, p.sku, p.barcode, p.unit
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = ?
  `).all(id);

  // GRN receipts linked to this PO
  const receipts = db.prepare(`
    SELECT sr.id, sr.receipt_number, sr.status, sr.total_items, sr.total_cost, sr.created_at,
           u.full_name as received_by_name
    FROM stock_receipts sr
    JOIN users u ON sr.received_by_user_id = u.id
    WHERE sr.purchase_order_id = ?
    ORDER BY sr.id DESC
  `).all(id);

  return { ...po, items, receipts };
}

/**
 * Approve Purchase Order
 */
function approvePurchaseOrder(id, userId) {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po) throw new Error('Purchase Order not found');
  if (po.status !== 'DRAFT' && po.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve Purchase Order in status ${po.status}`);
  }

  db.prepare(`
    UPDATE purchase_orders
    SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, id);

  logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'APPROVED',
    fromStatus: po.status,
    toStatus: 'APPROVED',
    userId
  });

  return getPurchaseOrderById(id);
}

/**
 * Send PO to supplier
 */
function sendPurchaseOrder(id, userId) {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po) throw new Error('Purchase Order not found');
  if (po.status !== 'APPROVED') {
    throw new Error(`Only APPROVED Purchase Orders can be sent to supplier (current: ${po.status})`);
  }

  db.prepare(`
    UPDATE purchase_orders
    SET status = 'SENT_TO_SUPPLIER', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'SENT_TO_SUPPLIER',
    fromStatus: 'APPROVED',
    toStatus: 'SENT_TO_SUPPLIER',
    userId
  });

  return getPurchaseOrderById(id);
}

/**
 * Cancel PO
 */
function cancelPurchaseOrder(id, userId, reason = '') {
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po) throw new Error('Purchase Order not found');
  if (['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(po.status)) {
    throw new Error(`Cannot cancel Purchase Order that has received goods (current: ${po.status})`);
  }

  db.prepare(`
    UPDATE purchase_orders
    SET status = 'CANCELLED', notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(`Cancelled: ${reason}`, `Cancelled: ${reason}`, id);

  logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'CANCELLED',
    fromStatus: po.status,
    toStatus: 'CANCELLED',
    userId,
    details: { reason }
  });

  return getPurchaseOrderById(id);
}

// ============================================================================
// 4. GOODS RECEIVING (GRN) & INVENTORY ALLOCATION
// ============================================================================

/**
 * Receive goods against a Purchase Order (Partial or Full receiving)
 */
function receivePurchaseOrderItems({
  poId,
  warehouseId,
  supplierInvoiceNo = '',
  deliveryNoteNo = '',
  items = [],
  userId,
  notes = ''
}) {
  if (!poId || !items || items.length === 0) {
    throw new Error('Purchase Order ID and items list are required for receiving');
  }

  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId);
  if (!po) throw new Error('Purchase Order not found');
  if (!['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new Error(`Cannot receive goods for PO in status ${po.status}`);
  }

  const targetWarehouseId = warehouseId ? Number(warehouseId) : po.warehouse_id;
  const wh = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(targetWarehouseId);
  if (!wh) throw new Error('Target warehouse not found');

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const receiptNumber = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    let totalItemsReceived = 0;
    let totalCostReceived = 0;

    // 1. Create stock_receipts record
    const receiptRes = db.prepare(`
      INSERT INTO stock_receipts (
        receipt_number, branch_id, warehouse_id, supplier_id, purchase_order_id,
        supplier_invoice_no, delivery_note_no, received_by_user_id,
        total_items, total_cost, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'RECEIVED', ?)
    `).run(
      receiptNumber,
      po.branch_id,
      targetWarehouseId,
      po.supplier_id,
      po.id,
      supplierInvoiceNo || null,
      deliveryNoteNo || null,
      userId,
      notes || ''
    );

    const receiptId = receiptRes.lastInsertRowid;

    const insertReceiptItemStmt = db.prepare(`
      INSERT INTO stock_receipt_items (
        stock_receipt_id, product_id, variant_id, purchase_order_item_id,
        quantity_received, unit_cost, batch_number, expiry_date, condition
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updatePoItemStmt = db.prepare(`
      UPDATE purchase_order_items
      SET received_quantity = received_quantity + ?
      WHERE id = ?
    `);

    for (const it of items) {
      const poItemId = Number(it.po_item_id || it.purchase_order_item_id || it.id);
      const qty = Math.max(1, Number(it.quantity || it.quantity_received || 1));
      const condition = it.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
      const batchNumber = it.batch_number || null;
      const expiryDate = it.expiry_date || null;

      const poItem = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?').get(poItemId, po.id);
      if (!poItem) throw new Error(`PO Item #${poItemId} does not belong to Purchase Order #${po.po_number}`);

      const remainingQty = poItem.ordered_quantity - poItem.received_quantity;
      if (qty > remainingQty && !it.allow_over_receiving) {
        throw new Error(`Received quantity (${qty}) exceeds pending ordered quantity (${remainingQty}) for product #${poItem.product_id}`);
      }

      totalItemsReceived += qty;
      totalCostReceived += qty * poItem.unit_cost;

      // Insert receipt item
      insertReceiptItemStmt.run(
        receiptId,
        poItem.product_id,
        poItem.variant_id,
        poItem.id,
        qty,
        poItem.unit_cost,
        batchNumber,
        expiryDate,
        condition
      );

      // Increment PO item received quantity
      updatePoItemStmt.run(qty, poItem.id);

      // Credit warehouse inventory
      const inv = getOrInitInventory(targetWarehouseId, poItem.product_id, po.branch_id);
      const prevOnHand = inv.quantity_on_hand;
      const newOnHand = prevOnHand + qty;
      const newAvailable = condition === 'GOOD' ? inv.quantity_available + qty : inv.quantity_available;
      const newDamaged = condition === 'DAMAGED' ? inv.quantity_damaged + qty : inv.quantity_damaged;

      db.prepare(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newOnHand, newAvailable, newDamaged, inv.id);

      assertInventoryInvariant(
        { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, quantity_damaged: newDamaged },
        'receivePurchaseOrderItems'
      );

      logMovement({
        branchId: po.branch_id,
        warehouseId: targetWarehouseId,
        productId: poItem.product_id,
        movementType: 'PURCHASE_RECEIPT',
        quantityChange: qty,
        prevQty: prevOnHand,
        newQty: newOnHand,
        fromState: 'EXTERNAL',
        toState: condition === 'GOOD' ? 'AVAILABLE' : 'DAMAGED',
        referenceType: 'GRN',
        referenceId: receiptNumber,
        reason: `PO Inbound Receipt #${po.po_number} (${condition})`,
        userId
      });
    }

    // Update receipt totals
    db.prepare(`
      UPDATE stock_receipts
      SET total_items = ?, total_cost = ?
      WHERE id = ?
    `).run(totalItemsReceived, totalCostReceived, receiptId);

    // Evaluate PO completion status
    const allItems = db.prepare('SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?').all(po.id);
    const isAllFulfilled = allItems.every(i => i.received_quantity >= i.ordered_quantity);
    const newPoStatus = isAllFulfilled ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';

    db.prepare(`
      UPDATE purchase_orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPoStatus, po.id);

    logProcurementAudit({
      entityType: 'GRN',
      entityId: receiptId,
      entityNumber: receiptNumber,
      action: 'RECEIVED',
      fromStatus: po.status,
      toStatus: newPoStatus,
      userId,
      details: { poNumber: po.po_number, totalItemsReceived, totalCostReceived }
    });

    logProcurementAudit({
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      entityNumber: po.po_number,
      action: newPoStatus,
      fromStatus: po.status,
      toStatus: newPoStatus,
      userId,
      details: { grnNumber: receiptNumber }
    });

    return {
      receipt: db.prepare('SELECT * FROM stock_receipts WHERE id = ?').get(receiptId),
      purchase_order: getPurchaseOrderById(po.id)
    };
  })();
}

// ============================================================================
// 5. SUPPLIER INVOICES (BILLS) & 3-WAY MATCHING
// ============================================================================

/**
 * Record incoming supplier invoice
 */
function createSupplierInvoice({
  supplierId,
  purchaseOrderId = null,
  stockReceiptId = null,
  supplierInvoiceNo,
  branchId,
  invoiceDate,
  dueDate,
  subtotal,
  taxAmount = 0.0,
  totalAmount,
  notes = '',
  userId
}) {
  if (!supplierId || !supplierInvoiceNo || !invoiceDate || !dueDate || totalAmount === undefined) {
    throw new Error('Supplier, Invoice No, Dates, and Total Amount are required');
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `SINV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    const effectiveBranchId = branchId || 1;
    const computedSubtotal = subtotal !== undefined ? Number(subtotal) : Number(totalAmount) - Number(taxAmount || 0);

    const res = db.prepare(`
      INSERT INTO supplier_invoices (
        invoice_number, supplier_invoice_no, supplier_id, purchase_order_id,
        stock_receipt_id, branch_id, invoice_date, due_date, subtotal,
        tax_amount, total_amount, amount_paid, status, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 'PENDING', ?, ?)
    `).run(
      invoiceNumber,
      supplierInvoiceNo.trim(),
      supplierId,
      purchaseOrderId ? Number(purchaseOrderId) : null,
      stockReceiptId ? Number(stockReceiptId) : null,
      effectiveBranchId,
      invoiceDate,
      dueDate,
      computedSubtotal,
      Number(taxAmount) || 0.0,
      Number(totalAmount),
      notes,
      userId
    );

    const invId = res.lastInsertRowid;

    logProcurementAudit({
      entityType: 'INVOICE',
      entityId: invId,
      entityNumber: invoiceNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      userId,
      details: { supplierInvoiceNo, totalAmount }
    });

    return getSupplierInvoiceById(invId);
  })();
}

function getSupplierInvoiceById(id) {
  return db.prepare(`
    SELECT si.*, s.name as supplier_name, s.code as supplier_code, s.tax_pin as supplier_tax_pin,
           po.po_number, sr.receipt_number as grn_number, b.name as branch_name,
           u.full_name as created_by_name
    FROM supplier_invoices si
    JOIN suppliers s ON si.supplier_id = s.id
    LEFT JOIN purchase_orders po ON si.purchase_order_id = po.id
    LEFT JOIN stock_receipts sr ON si.stock_receipt_id = sr.id
    JOIN branches b ON si.branch_id = b.id
    JOIN users u ON si.created_by_user_id = u.id
    WHERE si.id = ?
  `).get(id);
}

// ============================================================================
// 6. SUPPLIER PAYMENTS (OUTBOUND DISBURSEMENTS)
// ============================================================================

/**
 * Record disbursement payment against supplier invoice
 */
function recordSupplierPayment({
  supplierInvoiceId,
  amount,
  paymentMethod = 'BANK',
  referenceNumber,
  paymentDate = new Date().toISOString().slice(0, 10),
  notes = '',
  userId
}) {
  if (!supplierInvoiceId || !amount || Number(amount) <= 0 || !referenceNumber) {
    throw new Error('Invoice ID, positive amount, and reference number are required for payment');
  }

  const invoice = db.prepare('SELECT * FROM supplier_invoices WHERE id = ?').get(supplierInvoiceId);
  if (!invoice) throw new Error('Supplier invoice not found');
  if (['PAID', 'CANCELLED'].includes(invoice.status)) {
    throw new Error(`Cannot disburse payment for invoice in status ${invoice.status}`);
  }

  const payAmount = Number(amount);
  const remainingDue = invoice.total_amount - invoice.amount_paid;
  if (payAmount > remainingDue + 0.01) {
    throw new Error(`Payment amount (${payAmount}) exceeds outstanding invoice balance (${remainingDue.toFixed(2)})`);
  }

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const paymentNumber = `SPAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    const res = db.prepare(`
      INSERT INTO supplier_payments (
        payment_number, supplier_invoice_id, supplier_id, amount,
        payment_method, reference_number, payment_date, notes, processed_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentNumber,
      invoice.id,
      invoice.supplier_id,
      payAmount,
      paymentMethod,
      referenceNumber.trim(),
      paymentDate,
      notes,
      userId
    );

    const paymentId = res.lastInsertRowid;
    const newAmountPaid = invoice.amount_paid + payAmount;
    const newStatus = newAmountPaid >= invoice.total_amount - 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    db.prepare(`
      UPDATE supplier_invoices
      SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAmountPaid, newStatus, invoice.id);

    logProcurementAudit({
      entityType: 'PAYMENT',
      entityId: paymentId,
      entityNumber: paymentNumber,
      action: 'PAID',
      fromStatus: invoice.status,
      toStatus: newStatus,
      userId,
      details: { invoiceNumber: invoice.invoice_number, amount: payAmount, referenceNumber }
    });

    return {
      payment: db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(paymentId),
      invoice: getSupplierInvoiceById(invoice.id)
    };
  })();
}

// ============================================================================
// 7. SUPPLIER RETURNS (DEBIT NOTES)
// ============================================================================

/**
 * Create a supplier return (Debit Note)
 */
function createSupplierReturn({
  supplierId,
  purchaseOrderId = null,
  stockReceiptId = null,
  branchId,
  warehouseId,
  reason = 'DAMAGED_ON_ARRIVAL',
  items = [],
  notes = '',
  userId
}) {
  if (!supplierId || !warehouseId || !items || items.length === 0) {
    throw new Error('Supplier, Warehouse, and returned items list are required');
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const wh = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouseId);
  if (!wh) throw new Error('Warehouse not found');

  return db.transaction(() => {
    const timestamp = Date.now().toString().slice(-6);
    const returnNumber = `PRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    let totalReturnAmount = 0;
    const computedItems = items.map(it => {
      const qty = Math.max(1, Number(it.quantity || 1));
      const cost = Number(it.unit_cost || 0);
      const lineCost = qty * cost;
      totalReturnAmount += lineCost;

      return {
        product_id: Number(it.product_id),
        quantity: qty,
        unit_cost: cost,
        total_cost: lineCost,
        from_inventory_state: it.from_inventory_state === 'AVAILABLE' ? 'AVAILABLE' : 'DAMAGED',
        reason: it.reason || reason
      };
    });

    const res = db.prepare(`
      INSERT INTO supplier_returns (
        return_number, supplier_id, purchase_order_id, stock_receipt_id,
        branch_id, warehouse_id, reason, status, total_amount, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)
    `).run(
      returnNumber,
      supplierId,
      purchaseOrderId ? Number(purchaseOrderId) : null,
      stockReceiptId ? Number(stockReceiptId) : null,
      branchId || wh.branch_id,
      warehouseId,
      reason,
      totalReturnAmount,
      notes,
      userId
    );

    const returnId = res.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO supplier_return_items (
        supplier_return_id, product_id, quantity, unit_cost, total_cost,
        from_inventory_state, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of computedItems) {
      itemStmt.run(returnId, it.product_id, it.quantity, it.unit_cost, it.total_cost, it.from_inventory_state, it.reason);
    }

    logProcurementAudit({
      entityType: 'RETURN',
      entityId: returnId,
      entityNumber: returnNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { supplierId, totalReturnAmount }
    });

    return getSupplierReturnById(returnId);
  })();
}

function getSupplierReturnById(id) {
  const ret = db.prepare(`
    SELECT sr.*, s.name as supplier_name, s.code as supplier_code,
           w.name as warehouse_name, b.name as branch_name,
           u.full_name as created_by_name, au.full_name as approved_by_name
    FROM supplier_returns sr
    JOIN suppliers s ON sr.supplier_id = s.id
    JOIN warehouses w ON sr.warehouse_id = w.id
    JOIN branches b ON sr.branch_id = b.id
    JOIN users u ON sr.created_by_user_id = u.id
    LEFT JOIN users au ON sr.approved_by_user_id = au.id
    WHERE sr.id = ?
  `).get(id);

  if (!ret) return null;

  const items = db.prepare(`
    SELECT sri.*, p.name as product_name, p.sku, p.unit
    FROM supplier_return_items sri
    JOIN products p ON sri.product_id = p.id
    WHERE sri.supplier_return_id = ?
  `).all(id);

  return { ...ret, items };
}

/**
 * Approve Supplier Return and deduct warehouse inventory
 */
function approveSupplierReturn(id, userId) {
  const ret = db.prepare('SELECT * FROM supplier_returns WHERE id = ?').get(id);
  if (!ret) throw new Error('Supplier Return not found');
  if (ret.status !== 'DRAFT') {
    throw new Error(`Cannot approve return in status ${ret.status}`);
  }

  const items = db.prepare('SELECT * FROM supplier_return_items WHERE supplier_return_id = ?').all(id);

  return db.transaction(() => {
    for (const it of items) {
      const inv = getOrInitInventory(ret.warehouse_id, it.product_id, ret.branch_id);
      const prevOnHand = inv.quantity_on_hand;
      const deductQty = it.quantity;

      if (it.from_inventory_state === 'DAMAGED') {
        if (inv.quantity_damaged < deductQty) {
          throw new Error(`Insufficient damaged stock for product #${it.product_id} (Available damaged: ${inv.quantity_damaged}, Needed: ${deductQty})`);
        }
        const newOnHand = prevOnHand - deductQty;
        const newDamaged = inv.quantity_damaged - deductQty;

        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newOnHand, newDamaged, inv.id);

        assertInventoryInvariant(
          { ...inv, quantity_on_hand: newOnHand, quantity_damaged: newDamaged },
          'approveSupplierReturn DAMAGED'
        );
      } else {
        if (inv.quantity_available < deductQty) {
          throw new Error(`Insufficient available stock for product #${it.product_id} (Available: ${inv.quantity_available}, Needed: ${deductQty})`);
        }
        const newOnHand = prevOnHand - deductQty;
        const newAvailable = inv.quantity_available - deductQty;

        db.prepare(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newOnHand, newAvailable, inv.id);

        assertInventoryInvariant(
          { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable },
          'approveSupplierReturn AVAILABLE'
        );
      }

      logMovement({
        branchId: ret.branch_id,
        warehouseId: ret.warehouse_id,
        productId: it.product_id,
        movementType: 'PURCHASE_RETURN',
        quantityChange: -deductQty,
        prevQty: prevOnHand,
        newQty: prevOnHand - deductQty,
        fromState: it.from_inventory_state,
        toState: 'EXTERNAL',
        referenceType: 'RETURN_TO_VENDOR',
        referenceId: ret.return_number,
        reason: `Debit Note Return #${ret.return_number} (${it.reason})`,
        userId
      });
    }

    db.prepare(`
      UPDATE supplier_returns
      SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, id);

    logProcurementAudit({
      entityType: 'RETURN',
      entityId: id,
      entityNumber: ret.return_number,
      action: 'APPROVED',
      fromStatus: 'DRAFT',
      toStatus: 'APPROVED',
      userId
    });

    return getSupplierReturnById(id);
  })();
}

// ============================================================================
// 8. PROCUREMENT TELEMETRY & CONSOLIDATED KPIS
// ============================================================================

/**
 * Executive telemetry dashboard metrics for procurement
 */
function getProcurementTelemetry({ branchId = null } = {}) {
  let branchFilter = '';
  const params = [];
  if (branchId) {
    branchFilter = 'WHERE branch_id = ?';
    params.push(branchId);
  }

  const poKPIs = db.prepare(`
    SELECT
      COUNT(*) as total_pos,
      SUM(CASE WHEN status IN ('APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED') THEN 1 ELSE 0 END) as active_pos,
      SUM(CASE WHEN status IN ('DRAFT', 'PENDING_APPROVAL') THEN 1 ELSE 0 END) as pending_approval_pos,
      COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0.0) as total_po_spend
    FROM purchase_orders
    ${branchFilter}
  `).get(...params);

  const prKPIs = db.prepare(`
    SELECT
      COUNT(*) as total_prs,
      SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as pending_prs
    FROM purchase_requisitions
    ${branchFilter}
  `).get(...params);

  const invKPIs = db.prepare(`
    SELECT
      COUNT(*) as total_invoices,
      COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PARTIALLY_PAID') THEN total_amount - amount_paid ELSE 0 END), 0.0) as open_payable_amount
    FROM supplier_invoices
    ${branchFilter}
  `).get(...params);

  const supplierCount = db.prepare('SELECT COUNT(*) as count FROM suppliers WHERE is_active = 1').get().count;

  return {
    active_pos: poKPIs.active_pos || 0,
    pending_approval_pos: poKPIs.pending_approval_pos || 0,
    pending_prs: prKPIs.pending_prs || 0,
    total_po_spend: poKPIs.total_po_spend || 0,
    open_payable_amount: invKPIs.open_payable_amount || 0,
    active_suppliers: supplierCount || 0
  };
}

module.exports = {
  getSupplierPerformance,
  getSupplierHistory,
  createRequisition,
  getRequisitionById,
  submitRequisition,
  approveRequisition,
  rejectRequisition,
  createPurchaseOrder,
  getPurchaseOrderById,
  approvePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrderItems,
  createSupplierInvoice,
  getSupplierInvoiceById,
  recordSupplierPayment,
  createSupplierReturn,
  getSupplierReturnById,
  approveSupplierReturn,
  getProcurementTelemetry,
  logProcurementAudit
};
