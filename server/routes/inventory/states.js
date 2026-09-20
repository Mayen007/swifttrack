// server/routes/inventory/states.js
// SwiftTrack Kenya: Multi-State Inventory Mutation & State Transition Endpoints
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const {
  quarantineDamaged,
  markExpired,
  writeOffStock,
  restoreToAvailable,
  reserveStock,
  releaseReservation,
  getInventoryStateSummary
} = require('../../services/inventoryStateService.js');

/**
 * GET /api/v1/inventory/states/summary
 * Multi-state inventory telemetry breakdown by branch and warehouse
 */
router.get('/states/summary', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  const branchId = req.effectiveBranchId || req.query.branch_id;
  const warehouseId = req.query.warehouse_id;
  const productId = req.query.product_id;

  const data = getInventoryStateSummary({ branchId, warehouseId, productId });
  res.json(data);
});

/**
 * POST /api/v1/inventory/states/quarantine
 * Move sellable stock to DAMAGED quarantine (ON_HAND unchanged)
 */
router.post('/states/quarantine', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, reason, reference_id } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, and Quantity are required.' });
  }

  try {
    const updated = quarantineDamaged({
      branchId: req.effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      referenceId: reference_id || `QA-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Goods quarantined due to damage'
    });

    logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'QUARANTINE_DAMAGED_STOCK',
      resource: 'INVENTORY',
      resourceId: String(product_id),
      branchId: updated.branch_id,
      newValue: { quantity: Number(quantity), warehouse_id, new_damaged: updated.quantity_damaged },
      reason: reason || 'Goods quarantined due to damage'
    });

    res.json({ message: 'Stock successfully quarantined to DAMAGED state.', inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/states/expire
 * Move sellable stock to EXPIRED segregation (ON_HAND unchanged)
 */
router.post('/states/expire', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, reason, reference_id } = req.body;
  if (!warehouse_id || !product_id || !quantity) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, and Quantity are required.' });
  }

  try {
    const updated = markExpired({
      branchId: req.effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      referenceId: reference_id || `EXP-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Product past expiration date'
    });

    logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'SEGREGATE_EXPIRED_STOCK',
      resource: 'INVENTORY',
      resourceId: String(product_id),
      branchId: updated.branch_id,
      newValue: { quantity: Number(quantity), warehouse_id, new_expired: updated.quantity_expired },
      reason: reason || 'Product past expiration date'
    });

    res.json({ message: 'Stock successfully marked as EXPIRED.', inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/states/restore
 * Restore DAMAGED or EXPIRED stock back to AVAILABLE
 */
router.post('/states/restore', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, from_state, reason, reference_id } = req.body;
  if (!warehouse_id || !product_id || !quantity || !from_state) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, Quantity, and from_state are required.' });
  }

  try {
    const updated = restoreToAvailable({
      branchId: req.effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      fromState: from_state,
      referenceId: reference_id || `RESTORE-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Re-inspected and cleared'
    });

    res.json({ message: `Restored ${quantity} units to AVAILABLE.`, inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/states/write-off
 * Permanently scrap/write-off DAMAGED or EXPIRED stock (decrements ON_HAND)
 */
router.post('/states/write-off', authenticateToken, authorize('inventory', 'adjust_request'), (req, res) => {
  const { warehouse_id, product_id, quantity, from_state, reason, reference_id } = req.body;
  if (!warehouse_id || !product_id || !quantity || !from_state) {
    return res.status(400).json({ error: 'Warehouse ID, Product ID, Quantity, and from_state (DAMAGED/EXPIRED) required.' });
  }

  try {
    const updated = writeOffStock({
      branchId: req.effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      quantity: Number(quantity),
      fromState: from_state,
      referenceId: reference_id || `SCRAP-${Date.now().toString().slice(-6)}`,
      userId: req.user.id,
      reason: reason || 'Certified write-off disposal'
    });

    logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'STOCK_WRITE_OFF',
      resource: 'INVENTORY',
      resourceId: String(product_id),
      branchId: updated.branch_id,
      newValue: { quantity: Number(quantity), from_state, new_on_hand: updated.quantity_on_hand },
      reason: reason || 'Certified write-off disposal'
    });

    res.json({ message: 'Stock written off and physically deducted from ON_HAND.', inventory: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
