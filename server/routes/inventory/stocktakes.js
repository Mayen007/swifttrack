// server/routes/inventory/stocktakes.js
// SwiftTrack Kenya: Physical Stocktakes, Cycle Counts & Variance Auditing
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const {
  createStocktakeSession,
  recordStocktakeCounts,
  reconcileStocktake
} = require('../../services/inventoryOperationsService.js');

/**
 * GET /api/v1/inventory/stocktakes
 */
router.get('/stocktakes', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT st.*, w.name as warehouse_name, b.name as branch_name,
           u.full_name as created_by_name, rec_u.full_name as reconciled_by_name
    FROM stocktakes st
    JOIN warehouses w ON st.warehouse_id = w.id
    JOIN branches b ON st.branch_id = b.id
    JOIN users u ON st.created_by_user_id = u.id
    LEFT JOIN users rec_u ON st.reconciled_by_user_id = rec_u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND st.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  query += ' ORDER BY st.id DESC LIMIT 100';
  const stocktakes = db.prepare(query).all(...params);
  res.json(stocktakes);
});

/**
 * GET /api/v1/inventory/stocktakes/:id
 */
router.get('/stocktakes/:id', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  const stocktake = db.prepare(`
    SELECT st.*, w.name as warehouse_name, b.name as branch_name,
           u.full_name as created_by_name, rec_u.full_name as reconciled_by_name
    FROM stocktakes st
    JOIN warehouses w ON st.warehouse_id = w.id
    JOIN branches b ON st.branch_id = b.id
    JOIN users u ON st.created_by_user_id = u.id
    LEFT JOIN users rec_u ON st.reconciled_by_user_id = rec_u.id
    WHERE st.id = ?
  `).get(Number(req.params.id));

  if (!stocktake) return res.status(404).json({ error: 'Stocktake session not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && stocktake.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Access denied to other branch stocktake.' });
  }

  const items = db.prepare(`
    SELECT sti.*, p.name as product_name, p.sku, p.barcode, p.unit,
           cu.full_name as counted_by_name
    FROM stocktake_items sti
    JOIN products p ON sti.product_id = p.id
    LEFT JOIN users cu ON sti.counted_by_user_id = cu.id
    WHERE sti.stocktake_id = ?
    ORDER BY p.name ASC
  `).all(stocktake.id);

  res.json({ ...stocktake, items });
});

/**
 * POST /api/v1/inventory/stocktakes
 * Create new count session (freezes current snapshot)
 */
router.post('/stocktakes', authenticateToken, authorize('inventory', 'stocktake'), (req, res) => {
  const { warehouse_id, title, count_type, category_id, notes } = req.body;
  if (!warehouse_id || !title) {
    return res.status(400).json({ error: 'Warehouse ID and Session Title are required.' });
  }

  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ?').get(warehouse_id);
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });

  if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Forbidden: Cannot create stocktake for another branch.' });
  }

  try {
    const session = createStocktakeSession({
      branchId: wh.branch_id,
      warehouseId: Number(warehouse_id),
      title,
      countType: count_type || 'CYCLE_COUNT',
      categoryId: category_id ? Number(category_id) : null,
      userId: req.user.id,
      notes
    });

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'START_STOCKTAKE', resource: 'STOCKTAKE',
      resourceId: session.stocktake_number, branchId: wh.branch_id,
      newValue: session, reason: `Stocktake session started: ${title}`
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/stocktakes/:id/counts
 * Submit / update physical counts
 */
router.post('/stocktakes/:id/counts', authenticateToken, authorize('inventory', 'stocktake'), (req, res) => {
  const stocktakeId = Number(req.params.id);
  const { counts } = req.body;
  if (!counts || !Array.isArray(counts)) {
    return res.status(400).json({ error: 'Counts array is required.' });
  }

  try {
    const totals = recordStocktakeCounts({ stocktakeId, counts, userId: req.user.id });
    res.json({ message: 'Counts recorded successfully.', totals });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/stocktakes/:id/reconcile
 * Approve & reconcile stocktake variances into actual inventory
 */
router.post('/stocktakes/:id/reconcile', authenticateToken, authorize('inventory', 'stocktake'), (req, res) => {
  const stocktakeId = Number(req.params.id);
  const { notes } = req.body;

  try {
    const result = reconcileStocktake({ stocktakeId, userId: req.user.id, notes });

    logAuditEvent({
      userId: req.user.id, role: req.user.roleName,
      action: 'RECONCILE_STOCKTAKE', resource: 'STOCKTAKE',
      resourceId: String(stocktakeId), branchId: req.user.branchId,
      reason: 'Approved and reconciled physical stocktake'
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/inventory/stocktakes/:id/cancel
 */
router.post('/stocktakes/:id/cancel', authenticateToken, authorize('inventory', 'stocktake'), (req, res) => {
  const stocktakeId = Number(req.params.id);
  db.prepare("UPDATE stocktakes SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(stocktakeId);
  res.json({ message: 'Stocktake cancelled.' });
});

module.exports = router;
