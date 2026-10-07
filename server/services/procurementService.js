// server/services/procurementService.js
// SwiftTrack Kenya: Complete Procurement Lifecycle Engine (Phase 8)
const dbAdapter = require('../db/dbAdapter.js');
const {
  getOrInitInventory,
  assertInventoryInvariant,
  logMovement
} = require('./inventoryStateService.js');

/**
 * Log procurement event to immutable audit trail
 */
async function logProcurementAudit({
  entityType,
  entityId,
  entityNumber,
  action,
  fromStatus = null,
  toStatus = null,
  userId = null,
  details = {}
}, client = null) {
  try {
    await dbAdapter.run(`
      INSERT INTO procurement_audit_trail (
        entity_type, entity_id, entity_number, action, from_status, to_status, user_id, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entityType,
      entityId,
      entityNumber,
      action,
      fromStatus,
      toStatus,
      userId,
      JSON.stringify(details)
    ], client);
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
async function getSupplierPerformance(supplierId, client = null) {
  const supplier = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [supplierId], client);
  if (!supplier) throw new Error('Supplier not found');

  // 1. Total POs and Completed POs
  const poStats = await dbAdapter.get(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN status IN ('FULLY_RECEIVED', 'CLOSED') THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COALESCE(SUM(total_amount), 0.0) as total_po_value
    FROM purchase_orders
    WHERE supplier_id = ?
  `, [supplierId], client);

  // 2. Fulfillment rate (% ordered vs received)
  const fulfillmentStats = await dbAdapter.get(`
    SELECT
      COALESCE(SUM(poi.ordered_quantity), 0) as total_ordered_qty,
      COALESCE(SUM(poi.received_quantity), 0) as total_received_qty
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    WHERE po.supplier_id = ? AND po.status != 'CANCELLED'
  `, [supplierId], client);

  const totalOrdered = Number(fulfillmentStats?.total_ordered_qty || 0);
  const totalReceived = Number(fulfillmentStats?.total_received_qty || 0);
  const fulfillmentRate = totalOrdered > 0
    ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
    : 100;

  // 3. Quality score (% good vs damaged from inbound receipts)
  const qualityStats = await dbAdapter.get(`
    SELECT
      COALESCE(SUM(sri.quantity_received), 0) as total_received,
      COALESCE(SUM(CASE WHEN sri.condition = 'GOOD' THEN sri.quantity_received ELSE 0 END), 0) as good_received,
      COALESCE(SUM(CASE WHEN sri.condition = 'DAMAGED' THEN sri.quantity_received ELSE 0 END), 0) as damaged_received
    FROM stock_receipt_items sri
    JOIN stock_receipts sr ON sri.stock_receipt_id = sr.id
    WHERE sr.supplier_id = ?
  `, [supplierId], client);

  const totalRec = Number(qualityStats?.total_received || 0);
  const goodRec = Number(qualityStats?.good_received || 0);
  const qualityPassRate = totalRec > 0
    ? Math.round((goodRec / totalRec) * 100)
    : 100;

  // 4. On-time delivery rate
  const deliveryStats = await dbAdapter.get(`
    SELECT
      COUNT(DISTINCT sr.id) as total_receipts,
      COUNT(DISTINCT CASE WHEN po.expected_delivery_date IS NULL OR DATE(sr.created_at) <= DATE(po.expected_delivery_date) THEN sr.id END) as on_time_receipts
    FROM stock_receipts sr
    LEFT JOIN purchase_orders po ON sr.purchase_order_id = po.id
    WHERE sr.supplier_id = ?
  `, [supplierId], client);

  const totalReceipts = Number(deliveryStats?.total_receipts || 0);
  const onTimeReceipts = Number(deliveryStats?.on_time_receipts || 0);
  const onTimeRate = totalReceipts > 0
    ? Math.round((onTimeReceipts / totalReceipts) * 100)
    : 100;

  // 5. Financial settlement stats
  const invStats = await dbAdapter.get(`
    SELECT
      COALESCE(SUM(total_amount), 0.0) as total_invoiced,
      COALESCE(SUM(amount_paid), 0.0) as total_paid,
      COALESCE(SUM(total_amount - amount_paid), 0.0) as outstanding_balance
    FROM supplier_invoices
    WHERE supplier_id = ? AND status != 'CANCELLED'
  `, [supplierId], client);

  return {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    supplier_code: supplier.code,
    lead_time_days: supplier.lead_time_days,
    rating: supplier.rating,
    total_orders: Number(poStats?.total_orders || 0),
    completed_orders: Number(poStats?.completed_orders || 0),
    cancelled_orders: Number(poStats?.cancelled_orders || 0),
    total_po_value: Number(poStats?.total_po_value || 0),
    fulfillment_rate: fulfillmentRate,
    quality_pass_rate: qualityPassRate,
    on_time_rate: onTimeRate,
    total_invoiced: Number(invStats?.total_invoiced || 0),
    total_paid: Number(invStats?.total_paid || 0),
    outstanding_balance: Number(invStats?.outstanding_balance || 0)
  };
}

/**
 * Fetch unified chronological history for a supplier
 */
async function getSupplierHistory(supplierId, client = null) {
  const events = [];

  // Purchase Orders
  const pos = await dbAdapter.all(`
    SELECT id, po_number, status, total_amount, created_at, updated_at
    FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC
  `, [supplierId], client);
  pos.forEach(po => {
    events.push({
      type: 'PURCHASE_ORDER',
      id: po.id,
      number: po.po_number,
      title: `Purchase Order ${po.po_number}`,
      status: po.status,
      amount: Number(po.total_amount),
      timestamp: po.created_at
    });
  });

  // Receipts / GRNs
  const grns = await dbAdapter.all(`
    SELECT id, receipt_number, total_items, total_cost, created_at
    FROM stock_receipts WHERE supplier_id = ? ORDER BY created_at DESC
  `, [supplierId], client);
  grns.forEach(grn => {
    events.push({
      type: 'GRN',
      id: grn.id,
      number: grn.receipt_number,
      title: `Goods Received Note ${grn.receipt_number}`,
      status: 'RECEIVED',
      itemsCount: Number(grn.total_items),
      amount: Number(grn.total_cost),
      timestamp: grn.created_at
    });
  });

  // Invoices
  const invoices = await dbAdapter.all(`
    SELECT id, invoice_number, supplier_invoice_no, status, total_amount, amount_paid, created_at
    FROM supplier_invoices WHERE supplier_id = ? ORDER BY created_at DESC
  `, [supplierId], client);
  invoices.forEach(inv => {
    events.push({
      type: 'INVOICE',
      id: inv.id,
      number: inv.invoice_number,
      title: `Supplier Invoice ${inv.supplier_invoice_no} (${inv.invoice_number})`,
      status: inv.status,
      amount: Number(inv.total_amount),
      amountPaid: Number(inv.amount_paid),
      timestamp: inv.created_at
    });
  });

  // Payments
  const payments = await dbAdapter.all(`
    SELECT id, payment_number, payment_method, reference_number, amount, payment_date, created_at
    FROM supplier_payments WHERE supplier_id = ? ORDER BY created_at DESC
  `, [supplierId], client);
  payments.forEach(pay => {
    events.push({
      type: 'PAYMENT',
      id: pay.id,
      number: pay.payment_number,
      title: `Supplier Disbursement ${pay.payment_number} (${pay.payment_method})`,
      status: 'PAID',
      amount: Number(pay.amount),
      reference: pay.reference_number,
      timestamp: pay.created_at
    });
  });

  // Returns
  const returns = await dbAdapter.all(`
    SELECT id, return_number, reason, status, total_amount, created_at
    FROM supplier_returns WHERE supplier_id = ? ORDER BY created_at DESC
  `, [supplierId], client);
  returns.forEach(ret => {
    events.push({
      type: 'RETURN',
      id: ret.id,
      number: ret.return_number,
      title: `Supplier Return ${ret.return_number} (${ret.reason})`,
      status: ret.status,
      amount: Number(ret.total_amount),
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
async function createRequisition({ branchId, userId, urgency = 'MEDIUM', neededByDate = null, items = [], notes = '' }, client = null) {
  if (!branchId || !userId) throw new Error('Branch ID and User ID are required');
  if (!items || items.length === 0) throw new Error('Requisition must contain at least one line item');

  const runner = async (txnClient) => {
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

    const res = await dbAdapter.run(`
      INSERT INTO purchase_requisitions (
        pr_number, branch_id, requested_by_user_id, urgency, needed_by_date,
        status, notes, total_estimated_cost
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?)
    `, [prNumber, branchId, userId, urgency, neededByDate, notes, totalEstimatedCost], txnClient);

    const prId = res.insertId || res.id;

    for (const it of computedItems) {
      await dbAdapter.run(`
        INSERT INTO purchase_requisition_items (
          requisition_id, product_id, requested_quantity, estimated_unit_cost, notes
        ) VALUES (?, ?, ?, ?, ?)
      `, [prId, it.product_id, it.requested_quantity, it.estimated_unit_cost, it.notes], txnClient);
    }

    await logProcurementAudit({
      entityType: 'REQUISITION',
      entityId: prId,
      entityNumber: prNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { itemsCount: items.length, totalEstimatedCost }
    }, txnClient);

    return getRequisitionById(prId, txnClient);
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

async function getRequisitionById(id, client = null) {
  const pr = await dbAdapter.get(`
    SELECT pr.*, b.name as branch_name, u.full_name as requested_by_name,
           au.full_name as approved_by_name
    FROM purchase_requisitions pr
    JOIN branches b ON pr.branch_id = b.id
    JOIN users u ON pr.requested_by_user_id = u.id
    LEFT JOIN users au ON pr.approved_by_user_id = au.id
    WHERE pr.id = ?
  `, [id], client);

  if (!pr) return null;

  const items = await dbAdapter.all(`
    SELECT pri.*, p.name as product_name, p.sku, p.unit
    FROM purchase_requisition_items pri
    JOIN products p ON pri.product_id = p.id
    WHERE pri.requisition_id = ?
  `, [id], client);

  return { ...pr, items };
}

/**
 * Submit PR for approval
 */
async function submitRequisition(id, userId, client = null) {
  const pr = await dbAdapter.get('SELECT * FROM purchase_requisitions WHERE id = ?', [id], client);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'DRAFT') throw new Error(`Cannot submit requisition in status ${pr.status}`);

  await dbAdapter.run(`
    UPDATE purchase_requisitions
    SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id], client);

  await logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'SUBMITTED',
    fromStatus: 'DRAFT',
    toStatus: 'SUBMITTED',
    userId
  }, client);

  return getRequisitionById(id, client);
}

/**
 * Approve PR
 */
async function approveRequisition(id, userId, client = null) {
  const pr = await dbAdapter.get('SELECT * FROM purchase_requisitions WHERE id = ?', [id], client);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
    throw new Error(`Cannot approve requisition in status ${pr.status}`);
  }

  await dbAdapter.run(`
    UPDATE purchase_requisitions
    SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [userId, id], client);

  await logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'APPROVED',
    fromStatus: pr.status,
    toStatus: 'APPROVED',
    userId
  }, client);

  return getRequisitionById(id, client);
}

/**
 * Reject PR
 */
async function rejectRequisition(id, userId, reason = '', client = null) {
  const pr = await dbAdapter.get('SELECT * FROM purchase_requisitions WHERE id = ?', [id], client);
  if (!pr) throw new Error('Requisition not found');
  if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
    throw new Error(`Cannot reject requisition in status ${pr.status}`);
  }

  await dbAdapter.run(`
    UPDATE purchase_requisitions
    SET status = 'REJECTED', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [reason, id], client);

  await logProcurementAudit({
    entityType: 'REQUISITION',
    entityId: id,
    entityNumber: pr.pr_number,
    action: 'REJECTED',
    fromStatus: pr.status,
    toStatus: 'REJECTED',
    userId,
    details: { reason }
  }, client);

  return getRequisitionById(id, client);
}

// ============================================================================
// 3. PURCHASE ORDER (PO) ENGINE
// ============================================================================

/**
 * Create a new Purchase Order
 */
async function createPurchaseOrder({
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
}, client = null) {
  if (!supplierId || !branchId || !warehouseId || !userId) {
    throw new Error('Supplier, Branch, Warehouse, and User are required to generate PO');
  }
  if (!items || items.length === 0) {
    throw new Error('Purchase order must contain at least one line item');
  }

  const supplier = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [supplierId], client);
  if (!supplier) throw new Error('Supplier not found');

  const runner = async (txnClient) => {
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

    const res = await dbAdapter.run(`
      INSERT INTO purchase_orders (
        po_number, purchase_requisition_id, supplier_id, branch_id, warehouse_id,
        created_by_user_id, status, payment_terms, currency, subtotal, tax_amount,
        shipping_fee, total_amount, expected_delivery_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ], txnClient);

    const poId = res.insertId || res.id;

    for (const it of computedItems) {
      await dbAdapter.run(`
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, variant_id, ordered_quantity, received_quantity,
          unit_cost, tax_rate, tax_amount, total_cost
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)
      `, [poId, it.product_id, it.variant_id, it.ordered_quantity, it.unit_cost, it.tax_rate, it.tax_amount, it.total_cost], txnClient);
    }

    if (purchaseRequisitionId) {
      await dbAdapter.run(`
        UPDATE purchase_requisitions
        SET status = 'CONVERTED_TO_PO', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [purchaseRequisitionId], txnClient);
    }

    await logProcurementAudit({
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      entityNumber: poNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { supplierId, grandTotal, itemsCount: items.length }
    }, txnClient);

    return getPurchaseOrderById(poId, txnClient);
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

async function getPurchaseOrderById(id, client = null) {
  const po = await dbAdapter.get(`
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
  `, [id], client);

  if (!po) return null;

  const items = await dbAdapter.all(`
    SELECT poi.*, p.name as product_name, p.sku, p.barcode, p.unit
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = ?
  `, [id], client);

  // GRN receipts linked to this PO
  const receipts = await dbAdapter.all(`
    SELECT sr.id, sr.receipt_number, sr.status, sr.total_items, sr.total_cost, sr.created_at,
           u.full_name as received_by_name
    FROM stock_receipts sr
    JOIN users u ON sr.received_by_user_id = u.id
    WHERE sr.purchase_order_id = ?
    ORDER BY sr.id DESC
  `, [id], client);

  return { ...po, items, receipts };
}

/**
 * Approve Purchase Order
 */
async function approvePurchaseOrder(id, userId, client = null) {
  const po = await dbAdapter.get('SELECT * FROM purchase_orders WHERE id = ?', [id], client);
  if (!po) throw new Error('Purchase Order not found');
  if (po.status !== 'DRAFT' && po.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve Purchase Order in status ${po.status}`);
  }

  await dbAdapter.run(`
    UPDATE purchase_orders
    SET status = 'APPROVED', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [userId, id], client);

  await logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'APPROVED',
    fromStatus: po.status,
    toStatus: 'APPROVED',
    userId
  }, client);

  return getPurchaseOrderById(id, client);
}

/**
 * Send PO to supplier
 */
async function sendPurchaseOrder(id, userId, client = null) {
  const po = await dbAdapter.get('SELECT * FROM purchase_orders WHERE id = ?', [id], client);
  if (!po) throw new Error('Purchase Order not found');
  if (po.status !== 'APPROVED') {
    throw new Error(`Only APPROVED Purchase Orders can be sent to supplier (current: ${po.status})`);
  }

  await dbAdapter.run(`
    UPDATE purchase_orders
    SET status = 'SENT_TO_SUPPLIER', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id], client);

  await logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'SENT_TO_SUPPLIER',
    fromStatus: 'APPROVED',
    toStatus: 'SENT_TO_SUPPLIER',
    userId
  }, client);

  return getPurchaseOrderById(id, client);
}

/**
 * Cancel PO
 */
async function cancelPurchaseOrder(id, userId, reason = '', client = null) {
  const po = await dbAdapter.get('SELECT * FROM purchase_orders WHERE id = ?', [id], client);
  if (!po) throw new Error('Purchase Order not found');
  if (['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(po.status)) {
    throw new Error(`Cannot cancel Purchase Order that has received goods (current: ${po.status})`);
  }

  await dbAdapter.run(`
    UPDATE purchase_orders
    SET status = 'CANCELLED', notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [`Cancelled: ${reason}`, `Cancelled: ${reason}`, id], client);

  await logProcurementAudit({
    entityType: 'PURCHASE_ORDER',
    entityId: id,
    entityNumber: po.po_number,
    action: 'CANCELLED',
    fromStatus: po.status,
    toStatus: 'CANCELLED',
    userId,
    details: { reason }
  }, client);

  return getPurchaseOrderById(id, client);
}

// ============================================================================
// 4. GOODS RECEIVING (GRN) & INVENTORY ALLOCATION
// ============================================================================

/**
 * Receive goods against a Purchase Order (Partial or Full receiving)
 */
async function receivePurchaseOrderItems({
  poId,
  warehouseId,
  supplierInvoiceNo = '',
  deliveryNoteNo = '',
  items = [],
  userId,
  notes = ''
}, client = null) {
  if (!poId || !items || items.length === 0) {
    throw new Error('Purchase Order ID and items list are required for receiving');
  }

  const po = await dbAdapter.get('SELECT * FROM purchase_orders WHERE id = ?', [poId], client);
  if (!po) throw new Error('Purchase Order not found');
  if (!['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new Error(`Cannot receive goods for PO in status ${po.status}`);
  }

  const targetWarehouseId = warehouseId ? Number(warehouseId) : po.warehouse_id;
  const wh = await dbAdapter.get('SELECT * FROM warehouses WHERE id = ?', [targetWarehouseId], client);
  if (!wh) throw new Error('Target warehouse not found');

  const runner = async (txnClient) => {
    const timestamp = Date.now().toString().slice(-6);
    const receiptNumber = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    let totalItemsReceived = 0;
    let totalCostReceived = 0;

    // 1. Create stock_receipts record
    const receiptRes = await dbAdapter.run(`
      INSERT INTO stock_receipts (
        receipt_number, branch_id, warehouse_id, supplier_id, purchase_order_id,
        supplier_invoice_no, delivery_note_no, received_by_user_id,
        total_items, total_cost, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'RECEIVED', ?)
    `, [
      receiptNumber,
      po.branch_id,
      targetWarehouseId,
      po.supplier_id,
      po.id,
      supplierInvoiceNo || null,
      deliveryNoteNo || null,
      userId,
      notes || ''
    ], txnClient);

    const receiptId = receiptRes.insertId || receiptRes.id;

    for (const it of items) {
      const poItemId = Number(it.po_item_id || it.purchase_order_item_id || it.id);
      const qty = Math.max(1, Number(it.quantity || it.quantity_received || 1));
      const condition = it.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
      const batchNumber = it.batch_number || null;
      const expiryDate = it.expiry_date || null;

      const poItem = await dbAdapter.get('SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?', [poItemId, po.id], txnClient);
      if (!poItem) throw new Error(`PO Item #${poItemId} does not belong to Purchase Order #${po.po_number}`);

      const remainingQty = Number(poItem.ordered_quantity) - Number(poItem.received_quantity);
      if (qty > remainingQty && !it.allow_over_receiving) {
        throw new Error(`Received quantity (${qty}) exceeds pending ordered quantity (${remainingQty}) for product #${poItem.product_id}`);
      }

      const itemCost = Number(poItem.unit_cost);
      totalItemsReceived += qty;
      totalCostReceived += qty * itemCost;

      // Insert receipt item
      await dbAdapter.run(`
        INSERT INTO stock_receipt_items (
          stock_receipt_id, product_id, variant_id, purchase_order_item_id,
          quantity_received, unit_cost, batch_number, expiry_date, condition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        receiptId,
        poItem.product_id,
        poItem.variant_id,
        poItem.id,
        qty,
        itemCost,
        batchNumber,
        expiryDate,
        condition
      ], txnClient);

      // Increment PO item received quantity
      await dbAdapter.run(`
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + ?
        WHERE id = ?
      `, [qty, poItem.id], txnClient);

      // Credit warehouse inventory
      const inv = await getOrInitInventory(targetWarehouseId, poItem.product_id, po.branch_id, txnClient);
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

      assertInventoryInvariant(
        { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable, quantity_damaged: newDamaged },
        'receivePurchaseOrderItems'
      );

      await logMovement({
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
      }, txnClient);
    }

    // Update receipt totals
    await dbAdapter.run(`
      UPDATE stock_receipts
      SET total_items = ?, total_cost = ?
      WHERE id = ?
    `, [totalItemsReceived, totalCostReceived, receiptId], txnClient);

    // Evaluate PO completion status
    const allItems = await dbAdapter.all('SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?', [po.id], txnClient);
    const isAllFulfilled = allItems.every(i => Number(i.received_quantity) >= Number(i.ordered_quantity));
    const newPoStatus = isAllFulfilled ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';

    await dbAdapter.run(`
      UPDATE purchase_orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newPoStatus, po.id], txnClient);

    await logProcurementAudit({
      entityType: 'GRN',
      entityId: receiptId,
      entityNumber: receiptNumber,
      action: 'RECEIVED',
      fromStatus: po.status,
      toStatus: newPoStatus,
      userId,
      details: { poNumber: po.po_number, totalItemsReceived, totalCostReceived }
    }, txnClient);

    await logProcurementAudit({
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      entityNumber: po.po_number,
      action: newPoStatus,
      fromStatus: po.status,
      toStatus: newPoStatus,
      userId,
      details: { grnNumber: receiptNumber }
    }, txnClient);

    const receipt = await dbAdapter.get('SELECT * FROM stock_receipts WHERE id = ?', [receiptId], txnClient);
    const updatedPo = await getPurchaseOrderById(po.id, txnClient);

    return {
      receipt,
      purchase_order: updatedPo
    };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

// ============================================================================
// 5. SUPPLIER INVOICES (BILLS) & 3-WAY MATCHING
// ============================================================================

/**
 * Record incoming supplier invoice
 */
async function createSupplierInvoice({
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
}, client = null) {
  if (!supplierId || !supplierInvoiceNo || !invoiceDate || !dueDate || totalAmount === undefined) {
    throw new Error('Supplier, Invoice No, Dates, and Total Amount are required');
  }

  const supplier = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [supplierId], client);
  if (!supplier) throw new Error('Supplier not found');

  const runner = async (txnClient) => {
    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `SINV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;

    const effectiveBranchId = branchId || 1;
    const computedSubtotal = subtotal !== undefined ? Number(subtotal) : Number(totalAmount) - Number(taxAmount || 0);

    const res = await dbAdapter.run(`
      INSERT INTO supplier_invoices (
        invoice_number, supplier_invoice_no, supplier_id, purchase_order_id,
        stock_receipt_id, branch_id, invoice_date, due_date, subtotal,
        tax_amount, total_amount, amount_paid, status, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 'PENDING', ?, ?)
    `, [
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
    ], txnClient);

    const invId = res.insertId || res.id;

    await logProcurementAudit({
      entityType: 'INVOICE',
      entityId: invId,
      entityNumber: invoiceNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      userId,
      details: { supplierInvoiceNo, totalAmount }
    }, txnClient);

    return getSupplierInvoiceById(invId, txnClient);
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

async function getSupplierInvoiceById(id, client = null) {
  return dbAdapter.get(`
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
  `, [id], client);
}

// ============================================================================
// 6. SUPPLIER PAYMENTS (OUTBOUND DISBURSEMENTS)
// ============================================================================

/**
 * Record disbursement payment against supplier invoice
 */
async function recordSupplierPayment({
  supplierInvoiceId,
  amount,
  paymentMethod = 'BANK',
  referenceNumber,
  paymentDate = new Date().toISOString().slice(0, 10),
  notes = '',
  userId
}, client = null) {
  if (!supplierInvoiceId || !amount || Number(amount) <= 0 || !referenceNumber) {
    throw new Error('Invoice ID, positive amount, and reference number are required for payment');
  }

  const invoice = await dbAdapter.get('SELECT * FROM supplier_invoices WHERE id = ?', [supplierInvoiceId], client);
  if (!invoice) throw new Error('Supplier invoice not found');
  if (['PAID', 'CANCELLED'].includes(invoice.status)) {
    throw new Error(`Cannot disburse payment for invoice in status ${invoice.status}`);
  }

  const payAmount = Number(amount);
  const totalAmt = Number(invoice.total_amount);
  const amtPaid = Number(invoice.amount_paid);
  const remainingDue = totalAmt - amtPaid;
  if (payAmount > remainingDue + 0.01) {
    throw new Error(`Payment amount (${payAmount}) exceeds outstanding invoice balance (${remainingDue.toFixed(2)})`);
  }

  const runner = async (txnClient) => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const paymentNumber = `SPAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}${rand}`;

    const res = await dbAdapter.run(`
      INSERT INTO supplier_payments (
        payment_number, supplier_invoice_id, supplier_id, amount,
        payment_method, reference_number, payment_date, notes, processed_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentNumber,
      invoice.id,
      invoice.supplier_id,
      payAmount,
      paymentMethod,
      referenceNumber.trim(),
      paymentDate,
      notes,
      userId
    ], txnClient);

    const paymentId = res.insertId || res.id;
    const newAmountPaid = amtPaid + payAmount;
    const newStatus = newAmountPaid >= totalAmt - 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    await dbAdapter.run(`
      UPDATE supplier_invoices
      SET amount_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newAmountPaid, newStatus, invoice.id], txnClient);

    await logProcurementAudit({
      entityType: 'PAYMENT',
      entityId: paymentId,
      entityNumber: paymentNumber,
      action: 'PAID',
      fromStatus: invoice.status,
      toStatus: newStatus,
      userId,
      details: { invoiceNumber: invoice.invoice_number, amount: payAmount, referenceNumber }
    }, txnClient);

    const payment = await dbAdapter.get('SELECT * FROM supplier_payments WHERE id = ?', [paymentId], txnClient);
    const updatedInvoice = await getSupplierInvoiceById(invoice.id, txnClient);

    return {
      payment,
      invoice: updatedInvoice
    };
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

// ============================================================================
// 7. SUPPLIER RETURNS (DEBIT NOTES)
// ============================================================================

/**
 * Create a supplier return (Debit Note)
 */
async function createSupplierReturn({
  supplierId,
  purchaseOrderId = null,
  stockReceiptId = null,
  branchId,
  warehouseId,
  reason = 'DAMAGED_ON_ARRIVAL',
  items = [],
  notes = '',
  userId
}, client = null) {
  if (!supplierId || !warehouseId || !items || items.length === 0) {
    throw new Error('Supplier, Warehouse, and returned items list are required');
  }

  const supplier = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [supplierId], client);
  if (!supplier) throw new Error('Supplier not found');

  const wh = await dbAdapter.get('SELECT * FROM warehouses WHERE id = ?', [warehouseId], client);
  if (!wh) throw new Error('Warehouse not found');

  const runner = async (txnClient) => {
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

    const res = await dbAdapter.run(`
      INSERT INTO supplier_returns (
        return_number, supplier_id, purchase_order_id, stock_receipt_id,
        branch_id, warehouse_id, reason, status, total_amount, notes, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)
    `, [
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
    ], txnClient);

    const returnId = res.insertId || res.id;

    for (const it of computedItems) {
      await dbAdapter.run(`
        INSERT INTO supplier_return_items (
          supplier_return_id, product_id, quantity, unit_cost, total_cost,
          from_inventory_state, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [returnId, it.product_id, it.quantity, it.unit_cost, it.total_cost, it.from_inventory_state, it.reason], txnClient);
    }

    await logProcurementAudit({
      entityType: 'RETURN',
      entityId: returnId,
      entityNumber: returnNumber,
      action: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      userId,
      details: { supplierId, totalReturnAmount }
    }, txnClient);

    return getSupplierReturnById(returnId, txnClient);
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

async function getSupplierReturnById(id, client = null) {
  const ret = await dbAdapter.get(`
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
  `, [id], client);

  if (!ret) return null;

  const items = await dbAdapter.all(`
    SELECT sri.*, p.name as product_name, p.sku, p.unit
    FROM supplier_return_items sri
    JOIN products p ON sri.product_id = p.id
    WHERE sri.supplier_return_id = ?
  `, [id], client);

  return { ...ret, items };
}

/**
 * Approve Supplier Return and deduct warehouse inventory
 */
async function approveSupplierReturn(id, userId, client = null) {
  const ret = await dbAdapter.get('SELECT * FROM supplier_returns WHERE id = ?', [id], client);
  if (!ret) throw new Error('Supplier Return not found');
  if (ret.status !== 'DRAFT') {
    throw new Error(`Cannot approve return in status ${ret.status}`);
  }

  const items = await dbAdapter.all('SELECT * FROM supplier_return_items WHERE supplier_return_id = ?', [id], client);

  const runner = async (txnClient) => {
    for (const it of items) {
      const inv = await getOrInitInventory(ret.warehouse_id, it.product_id, ret.branch_id, txnClient);
      const prevOnHand = Number(inv.quantity_on_hand);
      const deductQty = Number(it.quantity);

      if (it.from_inventory_state === 'DAMAGED') {
        const damagedQty = Number(inv.quantity_damaged);
        if (damagedQty < deductQty) {
          throw new Error(`Insufficient damaged stock for product #${it.product_id} (Available damaged: ${damagedQty}, Needed: ${deductQty})`);
        }
        const newOnHand = prevOnHand - deductQty;
        const newDamaged = damagedQty - deductQty;

        await dbAdapter.run(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_damaged = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newOnHand, newDamaged, inv.id], txnClient);

        assertInventoryInvariant(
          { ...inv, quantity_on_hand: newOnHand, quantity_damaged: newDamaged },
          'approveSupplierReturn DAMAGED'
        );
      } else {
        const availQty = Number(inv.quantity_available);
        if (availQty < deductQty) {
          throw new Error(`Insufficient available stock for product #${it.product_id} (Available: ${availQty}, Needed: ${deductQty})`);
        }
        const newOnHand = prevOnHand - deductQty;
        const newAvailable = availQty - deductQty;

        await dbAdapter.run(`
          UPDATE inventory
          SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newOnHand, newAvailable, inv.id], txnClient);

        assertInventoryInvariant(
          { ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable },
          'approveSupplierReturn AVAILABLE'
        );
      }

      await logMovement({
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
      }, txnClient);
    }

    await dbAdapter.run(`
      UPDATE supplier_returns
      SET status = 'APPROVED', approved_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId, id], txnClient);

    await logProcurementAudit({
      entityType: 'RETURN',
      entityId: id,
      entityNumber: ret.return_number,
      action: 'APPROVED',
      fromStatus: 'DRAFT',
      toStatus: 'APPROVED',
      userId
    }, txnClient);

    return getSupplierReturnById(id, txnClient);
  };

  return client ? runner(client) : dbAdapter.withTransaction(runner);
}

// ============================================================================
// 8. PROCUREMENT TELEMETRY & CONSOLIDATED KPIS
// ============================================================================

/**
 * Executive telemetry dashboard metrics for procurement
 */
async function getProcurementTelemetry({ branchId = null } = {}, client = null) {
  let branchFilter = '';
  const params = [];
  if (branchId) {
    branchFilter = 'WHERE branch_id = ?';
    params.push(branchId);
  }

  const poKPIs = await dbAdapter.get(`
    SELECT
      COUNT(*) as total_pos,
      SUM(CASE WHEN status IN ('APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED') THEN 1 ELSE 0 END) as active_pos,
      SUM(CASE WHEN status IN ('DRAFT', 'PENDING_APPROVAL') THEN 1 ELSE 0 END) as pending_approval_pos,
      COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0.0) as total_po_spend
    FROM purchase_orders
    ${branchFilter}
  `, params, client);

  const prKPIs = await dbAdapter.get(`
    SELECT
      COUNT(*) as total_prs,
      SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as pending_prs
    FROM purchase_requisitions
    ${branchFilter}
  `, params, client);

  const invKPIs = await dbAdapter.get(`
    SELECT
      COUNT(*) as total_invoices,
      COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PARTIALLY_PAID') THEN total_amount - amount_paid ELSE 0 END), 0.0) as open_payable_amount
    FROM supplier_invoices
    ${branchFilter}
  `, params, client);

  const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
  const activeCondition = isPostgres ? 'is_active = true' : 'is_active = 1';
  const supplierCountRow = await dbAdapter.get(`SELECT COUNT(*) as count FROM suppliers WHERE ${activeCondition}`, [], client);

  return {
    active_pos: Number(poKPIs?.active_pos || 0),
    pending_approval_pos: Number(poKPIs?.pending_approval_pos || 0),
    pending_prs: Number(prKPIs?.pending_prs || 0),
    total_po_spend: Number(poKPIs?.total_po_spend || 0),
    open_payable_amount: Number(invKPIs?.open_payable_amount || 0),
    active_suppliers: Number(supplierCountRow?.count || 0)
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
