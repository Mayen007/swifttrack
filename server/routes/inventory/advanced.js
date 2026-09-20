// server/routes/inventory/advanced.js
// SwiftTrack Kenya: Phase 3.3 Advanced Inventory Routes
// Batches, Expiries, Serial Numbers, Financial Valuation, & Reorder Replenishment Alerts
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const {
  createBatch,
  getBatches,
  getBatchById,
  evaluateBatchExpiries,
  getExpiringBatches,
  registerSerials,
  getSerials,
  getInventoryValuation,
  getReorderAlerts
} = require('../../services/advancedInventoryService.js');

/**
 * GET /api/v1/inventory/batches
 * Retrieve batch/lot records with filtering
 */
router.get('/batches', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  try {
    const { product_id, warehouse_id, branch_id, status, expiring_days } = req.query;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const batches = getBatches({
      productId: product_id ? Number(product_id) : null,
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId,
      status: status || null,
      expiringDays: expiring_days ? Number(expiring_days) : null
    });

    res.json(batches);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/inventory/batches/expiring
 * Get categorized expiring batches (critical expired, warning soon, healthy)
 */
router.get('/batches/expiring', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  try {
    const { days_threshold = 30, warehouse_id, branch_id } = req.query;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const data = getExpiringBatches({
      daysThreshold: Number(days_threshold) || 30,
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId
    });

    res.json(data);
  } catch (err) {
    console.error('Error fetching expiring batches:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/batches/evaluate-expiries
 * Automated segregation of expired batches from AVAILABLE to EXPIRED
 */
router.post('/batches/evaluate-expiries', authenticateToken, authorize('inventory', 'adjust'), (req, res) => {
  try {
    const { warehouse_id, branch_id, current_date } = req.body;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const result = evaluateBatchExpiries({
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId,
      currentDate: current_date || null,
      userId: req.user.id
    });

    if (result.expiredBatchesCount > 0) {
      logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'EVALUATE_BATCH_EXPIRIES',
        resource: 'INVENTORY_BATCHES',
        branchId: effectiveBranchId || 1,
        newValue: { expiredBatchesCount: result.expiredBatchesCount, totalUnitsExpired: result.totalUnitsExpired },
        reason: 'Automated batch expiration evaluation & segregation'
      });
    }

    res.json({
      success: true,
      message: `Processed ${result.expiredBatchesCount} expired batches (${result.totalUnitsExpired} units segregated).`,
      result
    });
  } catch (err) {
    console.error('Error evaluating batch expiries:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/batches
 * Manually register a batch lot
 */
router.post('/batches', authenticateToken, authorize('inventory', 'create'), (req, res) => {
  try {
    const {
      branch_id, warehouse_id, product_id, variant_id,
      batch_number, initial_quantity, unit_cost,
      expiry_date, manufacturing_date, notes
    } = req.body;

    if (!batch_number || !product_id || !warehouse_id || !initial_quantity) {
      return res.status(400).json({ error: 'batch_number, product_id, warehouse_id, and initial_quantity are required' });
    }

    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : 1);

    const batch = createBatch({
      branchId: effectiveBranchId,
      warehouseId: Number(warehouse_id),
      productId: Number(product_id),
      variantId: variant_id ? Number(variant_id) : null,
      batchNumber: String(batch_number).trim(),
      initialQuantity: Number(initial_quantity),
      unitCost: Number(unit_cost) || 0,
      expiryDate: expiry_date || null,
      manufacturingDate: manufacturing_date || null,
      notes: notes || ''
    });

    logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'CREATE_BATCH',
      resource: 'INVENTORY_BATCH',
      resourceId: batch.batch_number,
      branchId: effectiveBranchId,
      newValue: { batchId: batch.id, batchNumber: batch.batch_number, quantity: batch.initial_quantity },
      reason: 'Manual batch creation'
    });

    res.status(201).json({ success: true, batch });
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/inventory/serials
 * Retrieve serial numbers with status & location filters
 */
router.get('/serials', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  try {
    const { product_id, warehouse_id, branch_id, status, serial_number } = req.query;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const serials = getSerials({
      productId: product_id ? Number(product_id) : null,
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId,
      status: status || null,
      serialNumber: serial_number || null
    });

    res.json(serials);
  } catch (err) {
    console.error('Error fetching serials:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/serials
 * Bulk register serial numbers
 */
router.post('/serials', authenticateToken, authorize('inventory', 'create'), (req, res) => {
  try {
    const {
      product_id, variant_id, warehouse_id, branch_id,
      batch_id, serial_numbers, unit_cost, notes
    } = req.body;

    if (!product_id || !warehouse_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and serial_numbers array are required' });
    }

    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : 1);

    const result = registerSerials({
      productId: Number(product_id),
      variantId: variant_id ? Number(variant_id) : null,
      warehouseId: Number(warehouse_id),
      branchId: effectiveBranchId,
      batchId: batch_id ? Number(batch_id) : null,
      serialNumbers: serial_numbers,
      unitCost: Number(unit_cost) || 0,
      notes: notes || ''
    });

    logAuditEvent({
      userId: req.user.id,
      role: req.user.roleName,
      action: 'REGISTER_SERIALS',
      resource: 'INVENTORY_SERIALS',
      branchId: effectiveBranchId,
      newValue: { count: result.registeredCount, serialNumbers: result.serialNumbers },
      reason: 'Bulk serial number registration'
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Error registering serials:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/inventory/valuation
 * Financial inventory valuation across all state buckets
 */
router.get('/valuation', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  try {
    const { warehouse_id, branch_id } = req.query;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const valuation = getInventoryValuation({
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId
    });

    res.json(valuation);
  } catch (err) {
    console.error('Error calculating inventory valuation:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/inventory/reorder-alerts
 * Replenishment and low-stock alerts
 */
router.get('/reorder-alerts', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  try {
    const { warehouse_id, branch_id } = req.query;
    const effectiveBranchId = req.effectiveBranchId || (branch_id ? Number(branch_id) : null);

    const alerts = getReorderAlerts({
      warehouseId: warehouse_id ? Number(warehouse_id) : null,
      branchId: effectiveBranchId
    });

    res.json(alerts);
  } catch (err) {
    console.error('Error fetching reorder alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
