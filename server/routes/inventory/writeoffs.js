// server/routes/inventory/writeoffs.js
// SwiftTrack Kenya: Certified Stock Write-Offs & Loss Tracking
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { writeOffStock } = require('../../services/inventoryStateService.js');
const { recordLostStock, restoreFoundStock } = require('../../services/inventoryOperationsService.js');

/**
 * GET /api/v1/inventory/write-offs
 */
router.get('/write-offs', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT wo.*, p.name as product_name, p.sku, p.unit,
           w.name as warehouse_name, b.name as branch_name,
           req_u.full_name as requested_by_name, app_u.full_name as approved_by_name
    FROM stock_write_offs wo
    JOIN products p ON wo.product_id = p.id
    JOIN warehouses w ON wo.warehouse_id = w.id
    JOIN branches b ON wo.branch_id = b.id
    JOIN users req_u ON wo.requested_by_user_id = req_u.id
    LEFT JOIN users app_u ON wo.approved_by_user_id = app_u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND wo.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  query += ' ORDER BY wo.id DESC LIMIT 100';
  const writeOffs = db.prepare(query).all(...params);
  res.json(writeOffs);
});

/**
 * POST /api/v1/inventory/write-offs
 * Request or execute formal stock write-off
 */
router.post('/write-offs', authenticateToken, authorize('inventory', 'write_off'), (req, res) => {
  const { warehouse_id, product_id, from_state, quantity, reason_category, disposal_method, notes } = req.body;
  if (!warehouse_id || !product_id || !quantity || !reason_category) {
    return res.status(400).json({ error: 'Warehouse, product, quantity, and reason_category are required.' });
  }

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Access denied to other branch.' });
  }

  const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(product_id);
  const cost = prod?.cost_price || 0;
  const qty = Math.abs(Number(quantity));
  const writeOffNo = `WO-${Date.now().toString().slice(-6)}`;
  const sourceState = from_state || 'DAMAGED';

  try {
    let result;
    if (sourceState === 'DAMAGED' || sourceState === 'EXPIRED') {
      result = writeOffStock({
        branchId: wh.branch_id,
        warehouseId: Number(warehouse_id),
        productId: Number(product_id),
        quantity: qty,
        fromState: sourceState,
        referenceId: writeOffNo,
        userId: req.user.id,
        reason: `${reason_category}: ${notes || 'Formal stock write-off'}`
      });
    } else {
      // Direct deduction from available (e.g. loss or contamination)
      result = recordLostStock({
        branchId: wh.branch_id,
        warehouseId: Number(warehouse_id),
        productId: Number(product_id),
        quantity: qty,
        reason: `${reason_category}: ${notes || 'Stock loss / write-off'}`,
        userId: req.user.id
      });
    }

    db.prepare(`
      INSERT INTO stock_write_offs (
        write_off_number, branch_id, warehouse_id, product_id,
        from_state, quantity, unit_cost, total_loss_value,
        reason_category, disposal_method, status, requested_by_user_id, approved_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?)
    `).run(writeOffNo, wh.branch_id, warehouse_id, product_id, sourceState, qty, cost, qty * cost,
      reason_category, disposal_method || 'SCRAPPED', req.user.id, req.user.id, notes || '');

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'STOCK_WRITE_OFF', resource: 'INVENTORY',
      resourceId: writeOffNo, branchId: wh.branch_id,
      newValue: { write_off_number: writeOffNo, quantity: qty, reason_category, loss_value: qty * cost },
      reason: `Stock write-off executed from ${sourceState}`
    });

    res.status(201).json({ write_off_number: writeOffNo, status: 'APPROVED', inventory: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/write-offs/lost
 * Report lost / stolen stock
 */
router.post('/write-offs/lost', authenticateToken, authorize('inventory', 'write_off'), (req, res) => {
  const { warehouse_id, product_id, quantity, reason, notes } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse, product, and quantity are required.' });
  }

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Cannot report loss for another branch.' });
  }

  try {
    const result = recordLostStock({
      branchId: wh.branch_id,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      reason,
      userId: req.user.id,
      notes
    });

    res.status(201).json({ message: 'Lost stock reported and recorded.', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/write-offs/found
 * Restore previously lost stock
 */
router.post('/write-offs/found', authenticateToken, authorize('inventory', 'write_off'), (req, res) => {
  const { warehouse_id, product_id, quantity, reason } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse, product, and quantity are required.' });
  }

  try {
    const result = restoreFoundStock({
      branchId: req.effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      reason,
      userId: req.user.id
    });

    res.json({ message: 'Found stock restored to available.', inventory: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
