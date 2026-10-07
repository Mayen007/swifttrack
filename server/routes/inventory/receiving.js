// server/routes/inventory/receiving.js
// SwiftTrack Kenya: Inbound Goods Received Notes (GRN) & Receiving
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { receiveStock } = require('../../services/inventoryOperationsService.js');

/**
 * GET /api/v1/inventory/receiving
 * List inbound Goods Received Notes
 */
router.get('/receiving', authenticateToken, authorize('inventory', 'view'), async (req, res) => {
  try {
    let query = `
      SELECT sr.*, w.name as warehouse_name, b.name as branch_name,
             s.name as supplier_name, s.code as supplier_code,
             u.full_name as received_by_name
      FROM stock_receipts sr
      JOIN warehouses w ON sr.warehouse_id = w.id
      JOIN branches b ON sr.branch_id = b.id
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      JOIN users u ON sr.received_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.effectiveBranchId) {
      query += ' AND sr.branch_id = ?';
      params.push(req.effectiveBranchId);
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
      return {
        ...r,
        items
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/inventory/receiving/:id
 */
router.get('/receiving/:id', authenticateToken, authorize('inventory', 'view'), async (req, res) => {
  try {
    const receipt = await dbAdapter.get(`
      SELECT sr.*, w.name as warehouse_name, b.name as branch_name,
             s.name as supplier_name, u.full_name as received_by_name
      FROM stock_receipts sr
      JOIN warehouses w ON sr.warehouse_id = w.id
      JOIN branches b ON sr.branch_id = b.id
      LEFT JOIN suppliers s ON sr.supplier_id = s.id
      JOIN users u ON sr.received_by_user_id = u.id
      WHERE sr.id = ?
    `, [Number(req.params.id)]);

    if (!receipt) return res.status(404).json({ error: 'Stock receipt not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && receipt.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other branch receipt.' });
    }

    const items = await dbAdapter.all(`
      SELECT sri.*, p.name as product_name, p.sku, p.unit
      FROM stock_receipt_items sri
      JOIN products p ON sri.product_id = p.id
      WHERE sri.stock_receipt_id = ?
    `, [receipt.id]);

    res.json({ ...receipt, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/receiving
 * Receive inbound stock and create GRN
 */
router.post('/receiving', authenticateToken, authorize('inventory', 'receive_stock'), async (req, res) => {
  const { warehouse_id, supplier_id, supplier_invoice_no, delivery_note_no, items, notes } = req.body;
  if (!warehouse_id || !items?.length) {
    return res.status(400).json({ error: 'Warehouse and item list are required.' });
  }

  try {
    const wh = await dbAdapter.get('SELECT branch_id FROM warehouses WHERE id = ?', [warehouse_id]);
    if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You can only receive stock for your assigned branch.' });
    }

    const receipt = await receiveStock({
      branchId: wh.branch_id,
      warehouseId: Number(warehouse_id),
      supplierId: supplier_id ? Number(supplier_id) : null,
      supplierInvoiceNo: supplier_invoice_no,
      deliveryNoteNo: delivery_note_no,
      items,
      userId: req.user.id,
      notes
    });

    await logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'RECEIVE_STOCK',
      resource: 'INVENTORY',
      resourceId: receipt.receipt_number,
      branchId: wh.branch_id,
      newValue: receipt,
      reason: `Goods received via ${receipt.receipt_number}`
    });

    res.status(201).json(receipt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
