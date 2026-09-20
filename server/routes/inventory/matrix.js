// server/routes/inventory/matrix.js
// SwiftTrack Kenya: Multi-State Inventory Matrix & Movement Ledger Queries
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, authorize } = require('../../middleware/auth.js');

/**
 * GET /api/v1/inventory
 * Stock matrix supporting multi-state breakdown and branch isolation
 */
router.get('/', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT i.*, p.sku, p.barcode, p.name as product_name, p.unit, p.unit_of_measure,
           p.selling_price, p.cost_price, p.wholesale_price, p.tax_category,
           p.min_stock_alert, p.reorder_threshold, c.name as category_name,
           w.name as warehouse_name, w.code as warehouse_code,
           b.name as branch_name, b.code as branch_code
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN branches b ON i.branch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND i.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  if (req.query.warehouse_id) {
    query += ' AND i.warehouse_id = ?';
    params.push(Number(req.query.warehouse_id));
  }

  if (req.query.low_stock === 'true') {
    query += ' AND i.quantity_available <= p.reorder_threshold';
  }

  if (req.query.state === 'DAMAGED') {
    query += ' AND i.quantity_damaged > 0';
  } else if (req.query.state === 'EXPIRED') {
    query += ' AND i.quantity_expired > 0';
  } else if (req.query.state === 'RESERVED') {
    query += ' AND i.quantity_reserved > 0';
  } else if (req.query.state === 'IN_TRANSIT') {
    query += ' AND i.quantity_in_transit > 0';
  }

  query += ' ORDER BY b.name ASC, w.name ASC, p.name ASC';

  const stock = db.prepare(query).all(...params);
  res.json(stock);
});

/**
 * GET /api/v1/inventory/movements
 * Append-only stock movement ledger with state transitions
 */
router.get('/movements', authenticateToken, authorize('inventory', 'view'), (req, res) => {
  let query = `
    SELECT im.*, p.sku, p.name as product_name, p.unit,
           w.name as warehouse_name, b.name as branch_name,
           u.full_name as user_full_name, u.username
    FROM inventory_movements im
    JOIN products p ON im.product_id = p.id
    JOIN warehouses w ON im.warehouse_id = w.id
    JOIN branches b ON im.branch_id = b.id
    LEFT JOIN users u ON im.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.effectiveBranchId) {
    query += ' AND im.branch_id = ?';
    params.push(req.effectiveBranchId);
  }

  if (req.query.product_id) {
    query += ' AND im.product_id = ?';
    params.push(Number(req.query.product_id));
  }

  if (req.query.movement_type) {
    query += ' AND im.movement_type = ?';
    params.push(req.query.movement_type);
  }

  if (req.query.reference_type) {
    query += ' AND im.reference_type = ?';
    params.push(req.query.reference_type);
  }

  if (req.query.from_state) {
    query += ' AND im.from_state = ?';
    params.push(req.query.from_state);
  }

  if (req.query.to_state) {
    query += ' AND im.to_state = ?';
    params.push(req.query.to_state);
  } else if (req.query.state) {
    query += ' AND (im.from_state = ? OR im.to_state = ?)';
    params.push(req.query.state, req.query.state);
  }

  if (req.query.search) {
    const q = `%${req.query.search.trim()}%`;
    query += ' AND (p.sku LIKE ? OR p.name LIKE ? OR im.reference_id LIKE ? OR im.reason LIKE ?)';
    params.push(q, q, q, q);
  }

  if (req.query.date_from) {
    query += ' AND im.created_at >= ?';
    params.push(req.query.date_from);
  }

  if (req.query.date_to) {
    query += ' AND im.created_at <= ?';
    params.push(req.query.date_to + ' 23:59:59');
  }

  const limit = Math.min(Number(req.query.limit) || 150, 500);
  query += ` ORDER BY im.id DESC LIMIT ${limit}`;

  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

module.exports = router;
