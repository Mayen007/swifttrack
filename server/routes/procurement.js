// server/routes/procurement.js
// SwiftTrack Kenya: Complete Procurement Lifecycle REST API (Phase 8)
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const procurementService = require('../services/procurementService.js');

// ============================================================================
// 1. TELEMETRY & KPIS
// ============================================================================
router.get('/telemetry', authenticateToken, async (req, res) => {
  try {
    const branchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    const telemetry = await procurementService.getProcurementTelemetry({ branchId });
    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. PURCHASE REQUISITIONS (PR)
// ============================================================================

// GET /requisitions - List PRs
router.get('/requisitions', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT pr.*, b.name as branch_name, b.code as branch_code,
             u.full_name as requested_by_name,
             (SELECT count(*) FROM purchase_requisition_items WHERE requisition_id = pr.id) as items_count
      FROM purchase_requisitions pr
      JOIN branches b ON pr.branch_id = b.id
      JOIN users u ON pr.requested_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const effectiveBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    if (effectiveBranchId) {
      query += ' AND pr.branch_id = ?';
      params.push(effectiveBranchId);
    }

    if (req.query.status) {
      query += ' AND pr.status = ?';
      params.push(req.query.status);
    }

    if (req.query.urgency) {
      query += ' AND pr.urgency = ?';
      params.push(req.query.urgency);
    }

    query += ' ORDER BY pr.id DESC LIMIT 100';
    const list = await dbAdapter.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /requisitions/:id - Get PR details
router.get('/requisitions/:id', authenticateToken, async (req, res) => {
  try {
    const pr = await procurementService.getRequisitionById(Number(req.params.id));
    if (!pr) return res.status(404).json({ error: 'Requisition not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && pr.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'Forbidden: Access to other branch requisition is restricted' });
    }

    res.json(pr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /requisitions - Create PR
router.post('/requisitions', authenticateToken, async (req, res) => {
  try {
    const branchId = req.user.roleName !== 'SUPER_ADMIN'
      ? (req.user.branchId || 1)
      : (req.body.branch_id ? Number(req.body.branch_id) : (req.user.branchId || 1));
    const pr = await procurementService.createRequisition({
      branchId,
      userId: req.user.id,
      urgency: req.body.urgency,
      neededByDate: req.body.needed_by_date,
      items: req.body.items,
      notes: req.body.notes
    });
    res.status(201).json(pr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /requisitions/:id/submit - Submit PR
router.post('/requisitions/:id/submit', authenticateToken, async (req, res) => {
  try {
    const updated = await procurementService.submitRequisition(Number(req.params.id), req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /requisitions/:id/approve - Approve PR
router.post('/requisitions/:id/approve', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.approveRequisition(Number(req.params.id), req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /requisitions/:id/reject - Reject PR
router.post('/requisitions/:id/reject', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.rejectRequisition(Number(req.params.id), req.user.id, req.body.reason || '');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /requisitions/:id/convert-to-po - Convert approved PR to Purchase Order
router.post('/requisitions/:id/convert-to-po', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const pr = await procurementService.getRequisitionById(Number(req.params.id));
    if (!pr) return res.status(404).json({ error: 'Requisition not found' });
    if (pr.status !== 'APPROVED') {
      return res.status(400).json({ error: `Only APPROVED requisitions can be converted to Purchase Orders (current: ${pr.status})` });
    }

    const { supplier_id, warehouse_id, payment_terms, expected_delivery_date, shipping_fee, notes } = req.body;
    if (!supplier_id || !warehouse_id) {
      return res.status(400).json({ error: 'Supplier ID and Warehouse ID are required' });
    }

    const poItems = pr.items.map(it => ({
      product_id: it.product_id,
      ordered_quantity: it.requested_quantity,
      unit_cost: it.estimated_unit_cost,
      tax_rate: 16.0
    }));

    const po = await procurementService.createPurchaseOrder({
      purchaseRequisitionId: pr.id,
      supplierId: Number(supplier_id),
      branchId: pr.branch_id,
      warehouseId: Number(warehouse_id),
      userId: req.user.id,
      paymentTerms: payment_terms || 'NET30',
      expectedDeliveryDate: expected_delivery_date || pr.needed_by_date,
      items: poItems,
      shippingFee: Number(shipping_fee) || 0.0,
      notes: notes || pr.notes || ''
    });

    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 3. PURCHASE ORDERS (PO)
// ============================================================================

// GET /orders - List Purchase Orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT po.*, s.name as supplier_name, s.code as supplier_code,
             b.name as branch_name, b.code as branch_code,
             w.name as warehouse_name, u.full_name as created_by_name,
             (SELECT count(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as items_count,
             (SELECT COALESCE(sum(ordered_quantity), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_ordered_qty,
             (SELECT COALESCE(sum(received_quantity), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_received_qty
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN branches b ON po.branch_id = b.id
      JOIN warehouses w ON po.warehouse_id = w.id
      JOIN users u ON po.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const effectiveBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    if (effectiveBranchId) {
      query += ' AND po.branch_id = ?';
      params.push(effectiveBranchId);
    }

    if (req.query.supplier_id) {
      query += ' AND po.supplier_id = ?';
      params.push(Number(req.query.supplier_id));
    }

    if (req.query.status) {
      query += ' AND po.status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY po.id DESC LIMIT 100';
    const list = await dbAdapter.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /orders/:id - Get PO details
router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const po = await procurementService.getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && po.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'Forbidden: Access to other branch order is restricted' });
    }

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /orders - Create PO directly
router.post('/orders', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const branchId = req.user.roleName !== 'SUPER_ADMIN'
      ? (req.user.branchId || 1)
      : (req.body.branch_id ? Number(req.body.branch_id) : (req.user.branchId || 1));
    const po = await procurementService.createPurchaseOrder({
      purchaseRequisitionId: req.body.purchase_requisition_id,
      supplierId: Number(req.body.supplier_id),
      branchId,
      warehouseId: Number(req.body.warehouse_id),
      userId: req.user.id,
      paymentTerms: req.body.payment_terms,
      currency: req.body.currency,
      expectedDeliveryDate: req.body.expected_delivery_date,
      items: req.body.items,
      shippingFee: req.body.shipping_fee,
      notes: req.body.notes
    });
    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /orders/:id/approve - Approve PO
router.post('/orders/:id/approve', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.approvePurchaseOrder(Number(req.params.id), req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /orders/:id/send - Mark PO as sent to supplier
router.post('/orders/:id/send', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.sendPurchaseOrder(Number(req.params.id), req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /orders/:id/cancel - Cancel PO
router.post('/orders/:id/cancel', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.cancelPurchaseOrder(Number(req.params.id), req.user.id, req.body.reason || '');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /orders/:id/receive - Receive goods against PO (GRN)
router.post('/orders/:id/receive', authenticateToken, authorize('inventory', 'receive_stock'), async (req, res) => {
  try {
    const result = await procurementService.receivePurchaseOrderItems({
      poId: Number(req.params.id),
      warehouseId: req.body.warehouse_id,
      supplierInvoiceNo: req.body.supplier_invoice_no,
      deliveryNoteNo: req.body.delivery_note_no,
      items: req.body.items,
      userId: req.user.id,
      notes: req.body.notes
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 4. GOODS RECEIVED NOTES (GRN)
// ============================================================================

// GET /grns - List GRNs
router.get('/grns', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT sr.*, s.name as supplier_name, s.code as supplier_code,
             b.name as branch_name, w.name as warehouse_name,
             u.full_name as received_by_name, po.po_number
      FROM stock_receipts sr
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      JOIN branches b ON sr.branch_id = b.id
      JOIN warehouses w ON sr.warehouse_id = w.id
      JOIN users u ON sr.received_by_user_id = u.id
      LEFT JOIN purchase_orders po ON sr.purchase_order_id = po.id
      WHERE 1=1
    `;
    const params = [];

    const effectiveBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    if (effectiveBranchId) {
      query += ' AND sr.branch_id = ?';
      params.push(effectiveBranchId);
    }

    if (req.query.supplier_id) {
      query += ' AND sr.supplier_id = ?';
      params.push(Number(req.query.supplier_id));
    }

    query += ' ORDER BY sr.id DESC LIMIT 100';
    const receipts = await dbAdapter.all(query, params);

    const result = await Promise.all(receipts.map(async (r) => {
      const items = await dbAdapter.all(`
        SELECT sri.*, p.name as product_name, p.sku, p.unit
        FROM stock_receipt_items sri
        JOIN products p ON sri.product_id = p.id
        WHERE sri.stock_receipt_id = ?
      `, [r.id]);
      return { ...r, items };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /grns/:id - GRN details
router.get('/grns/:id', authenticateToken, async (req, res) => {
  try {
    const grn = await dbAdapter.get(`
      SELECT sr.*, s.name as supplier_name, s.code as supplier_code,
             b.name as branch_name, w.name as warehouse_name,
             u.full_name as received_by_name, po.po_number
      FROM stock_receipts sr
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      JOIN branches b ON sr.branch_id = b.id
      JOIN warehouses w ON sr.warehouse_id = w.id
      JOIN users u ON sr.received_by_user_id = u.id
      LEFT JOIN purchase_orders po ON sr.purchase_order_id = po.id
      WHERE sr.id = ?
    `, [Number(req.params.id)]);

    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    const items = await dbAdapter.all(`
      SELECT sri.*, p.name as product_name, p.sku, p.unit
      FROM stock_receipt_items sri
      JOIN products p ON sri.product_id = p.id
      WHERE sri.stock_receipt_id = ?
    `, [grn.id]);

    res.json({ ...grn, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 5. SUPPLIER INVOICES & PAYMENTS
// ============================================================================

// GET /invoices - List supplier invoices
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT si.*, s.name as supplier_name, s.code as supplier_code,
             po.po_number, b.name as branch_name, u.full_name as created_by_name
      FROM supplier_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      LEFT JOIN purchase_orders po ON si.purchase_order_id = po.id
      JOIN branches b ON si.branch_id = b.id
      JOIN users u ON si.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const effectiveBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    if (effectiveBranchId) {
      query += ' AND si.branch_id = ?';
      params.push(effectiveBranchId);
    }

    if (req.query.supplier_id) {
      query += ' AND si.supplier_id = ?';
      params.push(Number(req.query.supplier_id));
    }

    if (req.query.status) {
      query += ' AND si.status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY si.id DESC LIMIT 100';
    const list = await dbAdapter.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /invoices/:id - Invoice details
router.get('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const inv = await procurementService.getSupplierInvoiceById(Number(req.params.id));
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const payments = await dbAdapter.all(`
      SELECT sp.*, u.full_name as processed_by_name
      FROM supplier_payments sp
      JOIN users u ON sp.processed_by_user_id = u.id
      WHERE sp.supplier_invoice_id = ?
      ORDER BY sp.id DESC
    `, [inv.id]);

    res.json({ ...inv, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /invoices - Log supplier invoice
router.post('/invoices', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const branchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.body.branch_id ? Number(req.body.branch_id) : req.user.branchId);
    const inv = await procurementService.createSupplierInvoice({
      supplierId: Number(req.body.supplier_id),
      purchaseOrderId: req.body.purchase_order_id,
      stockReceiptId: req.body.stock_receipt_id,
      supplierInvoiceNo: req.body.supplier_invoice_no,
      branchId,
      invoiceDate: req.body.invoice_date,
      dueDate: req.body.due_date,
      subtotal: req.body.subtotal,
      taxAmount: req.body.tax_amount,
      totalAmount: req.body.total_amount,
      notes: req.body.notes,
      userId: req.user.id
    });
    res.status(201).json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /invoices/:id/pay - Disburse payment for invoice
router.post('/invoices/:id/pay', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const result = await procurementService.recordSupplierPayment({
      supplierInvoiceId: Number(req.params.id),
      amount: req.body.amount,
      paymentMethod: req.body.payment_method,
      referenceNumber: req.body.reference_number,
      paymentDate: req.body.payment_date,
      notes: req.body.notes,
      userId: req.user.id
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 6. SUPPLIER RETURNS (DEBIT NOTES)
// ============================================================================

// GET /returns - List returns
router.get('/returns', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT sr.*, s.name as supplier_name, s.code as supplier_code,
             w.name as warehouse_name, b.name as branch_name,
             u.full_name as created_by_name
      FROM supplier_returns sr
      JOIN suppliers s ON sr.supplier_id = s.id
      JOIN warehouses w ON sr.warehouse_id = w.id
      JOIN branches b ON sr.branch_id = b.id
      JOIN users u ON sr.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const effectiveBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.query.branch_id ? Number(req.query.branch_id) : null);
    if (effectiveBranchId) {
      query += ' AND sr.branch_id = ?';
      params.push(effectiveBranchId);
    }

    if (req.query.supplier_id) {
      query += ' AND sr.supplier_id = ?';
      params.push(Number(req.query.supplier_id));
    }

    query += ' ORDER BY sr.id DESC LIMIT 100';
    const list = await dbAdapter.all(query, params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /returns/:id - Return details
router.get('/returns/:id', authenticateToken, async (req, res) => {
  try {
    const ret = await procurementService.getSupplierReturnById(Number(req.params.id));
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    res.json(ret);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /returns - Create return
router.post('/returns', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const branchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (req.body.branch_id ? Number(req.body.branch_id) : req.user.branchId);
    const ret = await procurementService.createSupplierReturn({
      supplierId: Number(req.body.supplier_id),
      purchaseOrderId: req.body.purchase_order_id,
      stockReceiptId: req.body.stock_receipt_id,
      branchId,
      warehouseId: Number(req.body.warehouse_id),
      reason: req.body.reason,
      items: req.body.items,
      notes: req.body.notes,
      userId: req.user.id
    });
    res.status(201).json(ret);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /returns/:id/approve - Approve return and decrement stock
router.post('/returns/:id/approve', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
  try {
    const updated = await procurementService.approveSupplierReturn(Number(req.params.id), req.user.id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// 7. PROCUREMENT HISTORY & AUDIT LOG
// ============================================================================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const list = await dbAdapter.all(`
      SELECT pat.*, u.full_name as user_full_name, u.username
      FROM procurement_audit_trail pat
      LEFT JOIN users u ON pat.user_id = u.id
      ORDER BY pat.id DESC LIMIT 100
    `);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
