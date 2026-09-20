// server/routes/inventory/reservations.js
// SwiftTrack Kenya: Stock Reservation & Release Endpoints
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { reserveStock, releaseReservation } = require('../../services/inventoryStateService.js');

/**
 * GET /api/v1/inventory/reservations
 * View currently reserved stock by branch/warehouse
 */
router.get('/reservations', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT i.id, i.branch_id, i.warehouse_id, i.product_id,
           i.quantity_on_hand, i.quantity_available, i.quantity_reserved,
           p.name as product_name, p.sku, p.unit,
           w.name as warehouse_name, b.name as branch_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN branches b ON i.branch_id = b.id
    WHERE i.quantity_reserved > 0
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND i.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  query += ' ORDER BY b.name ASC, p.name ASC';
  const reserved = db.prepare(query).all(...params);
  res.json(reserved);
});

/**
 * POST /api/v1/inventory/reservations/reserve
 * Reserve available stock for an order or hold
 */
router.post('/reservations/reserve', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, reference_type, reference_id, reason } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, and Quantity are required.' });
  }

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Access denied to other branch.' });
  }

  try {
    const updated = reserveStock({
      branchId: wh.branch_id,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      referenceType: reference_type || 'MANUAL_HOLD',
      referenceId: reference_id || `HLD-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Stock reservation hold'
    });

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'RESERVE_STOCK', resource: 'INVENTORY',
      resourceId: String(product_id), branchId: wh.branch_id,
      newValue: { quantity: Number(quantity), new_reserved: updated.quantity_reserved },
      reason: reason || 'Stock reserved'
    });

    res.json({ message: 'Stock reserved successfully.', inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/reservations/release
 * Release reserved stock back to available
 */
router.post('/reservations/release', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, reference_type, reference_id, reason } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, and Quantity are required.' });
  }

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Access denied to other branch.' });
  }

  try {
    const updated = releaseReservation({
      branchId: wh.branch_id,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      referenceType: reference_type || 'MANUAL_RELEASE',
      referenceId: reference_id || `REL-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Stock reservation released'
    });

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'RELEASE_STOCK_RESERVATION', resource: 'INVENTORY',
      resourceId: String(product_id), branchId: wh.branch_id,
      newValue: { quantity: Number(quantity), new_available: updated.quantity_available },
      reason: reason || 'Stock reservation released'
    });

    res.json({ message: 'Reservation released back to available.', inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
