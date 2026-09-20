// server/routes/inventory/adjustments.js
// SwiftTrack Kenya: Stock Recount Adjustments & Approval Workflow
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { assertInventoryInvariant, getOrInitInventory, logMovement } = require('../../services/inventoryStateService.js');

/**
 * GET /api/v1/inventory/adjustments
 */
router.get('/adjustments', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT sa.*, p.name as product_name, p.sku, p.unit,
           w.name as warehouse_name, b.name as branch_name,
           req_u.full_name as requested_by_name, app_u.full_name as approved_by_name
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id
    JOIN warehouses w ON sa.warehouse_id = w.id
    JOIN branches b ON sa.branch_id = b.id
    LEFT JOIN users req_u ON sa.requested_by_user_id = req_u.id
    LEFT JOIN users app_u ON sa.approved_by_user_id = app_u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND sa.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  query += ' ORDER BY sa.id DESC LIMIT 100';
  const adjustments = db.prepare(query).all(...params);
  res.json(adjustments);
});

/**
 * POST /api/v1/inventory/adjust
 */
router.post('/adjust', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, adjustment_type, quantity, reason, notes } = req.body;
  if (!warehouse_id || !product_id || !adjustment_type || !quantity || !reason) {
    return res.status(400).json({ error: 'Warehouse, product, adjustment_type (ADD/DEDUCT/WRITE_OFF), quantity, and reason are required.' });
  }

  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && warehouse.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: You can only adjust inventory within your assigned branch.' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const adjNumber = `ADJ-${Date.now().toString().slice(-6)}`;
  const branchId = warehouse.branch_id;
  const qty = Math.abs(Number(quantity));

  const isInstant = req.user.roleName === 'SUPER_ADMIN' || (req.user.roleName === 'BRANCH_MANAGER' && qty <= 20);
  const status = isInstant ? 'APPROVED' : 'PENDING_APPROVAL';
  const approvedBy = isInstant ? req.user.id : null;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO stock_adjustments (
        adjustment_number, branch_id, warehouse_id, product_id,
        adjustment_type, quantity, reason, status, requested_by_user_id,
        approved_by_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adjNumber, branchId, warehouse_id, product_id, adjustment_type, qty, reason.trim(), status, req.user.id, approvedBy, notes || '');

    if (status === 'APPROVED') {
      const inv = getOrInitInventory(warehouse_id, product_id, branchId);
      let change = adjustment_type === 'ADD' ? qty : -qty;
      const mType = adjustment_type === 'WRITE_OFF' ? 'DAMAGED_WRITE_OFF' : adjustment_type === 'ADD' ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_DEDUCT';

      const prevQty = inv.quantity_on_hand;
      const newOnHand = Math.max(0, prevQty + change);
      const newAvailable = Math.max(0, newOnHand - (inv.quantity_reserved + inv.quantity_damaged + inv.quantity_expired));

      db.prepare(`
        UPDATE inventory
        SET quantity_on_hand = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newOnHand, newAvailable, inv.id);

      assertInventoryInvariant({ ...inv, quantity_on_hand: newOnHand, quantity_available: newAvailable }, 'adjustStock');

      logMovement({
        branchId, warehouseId: warehouse_id, productId: product_id, movementType: mType,
        quantityChange: change, prevQty, newQty: newOnHand,
        fromState: adjustment_type === 'ADD' ? 'EXTERNAL' : 'AVAILABLE',
        toState: adjustment_type === 'ADD' ? 'AVAILABLE' : 'EXTERNAL',
        referenceType: 'ADJUSTMENT', referenceId: adjNumber, reason, userId: req.user.id
      });
    }

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: status === 'APPROVED' ? 'ADJUST_STOCK' : 'REQUEST_STOCK_ADJUSTMENT',
      resource: 'INVENTORY', resourceId: adjNumber, branchId,
      newValue: { adjustment_type, quantity: qty, status, reason },
      reason: `Stock adjustment: ${reason}`
    });
  })();

  res.status(201).json({
    adjustment_number: adjNumber,
    status,
    message: status === 'APPROVED' ? 'Stock adjusted successfully and ledger updated.' : 'Stock adjustment submitted for Super Admin review.'
  });
});

module.exports = router;
