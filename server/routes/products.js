// server/routes/products.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/products - List products with category, stock summaries, and search
router.get('/', authenticateToken, (req, res) => {
    const { category_id, search, barcode, sku, low_stock } = req.query;

    let query = `
        SELECT p.*,
               p.selling_price as price,
               c.name as category,
               c.name as category_name,
               c.code as category_code,
               COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
               COALESCE(SUM(i.quantity_available), 0) as available_stock
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
    `;
    const params = [];
    const whereClauses = ['p.is_active = 1'];

    // If branch filter requested (or non-Super Admin restricted to their branch inventory view)
    if (req.user.roleName !== 'SUPER_ADMIN') {
        query += ' AND (i.branch_id = ? OR i.branch_id IS NULL)';
        params.push(req.user.branchId);
    } else if (req.query.branch_id) {
        query += ' AND (i.branch_id = ? OR i.branch_id IS NULL)';
        params.push(Number(req.query.branch_id));
    }

    if (category_id) {
        whereClauses.push('p.category_id = ?');
        params.push(Number(category_id));
    }

    if (barcode) {
        whereClauses.push('p.barcode = ?');
        params.push(barcode.trim());
    }

    if (sku) {
        whereClauses.push('p.sku = ?');
        params.push(sku.trim());
    }

    if (search) {
        whereClauses.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s);
    }

    if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' GROUP BY p.id';

    if (low_stock === 'true') {
        query += ' HAVING total_stock <= p.min_stock_alert';
    }

    query += ' ORDER BY p.name ASC';

    const products = db.prepare(query).all(...params);
    res.json(products);
});

// GET /api/products/categories - List all categories
router.get('/categories', authenticateToken, (req, res) => {
    const categories = db.prepare(`
        SELECT c.*,
               (SELECT count(*) FROM products WHERE category_id = c.id AND is_active = 1) as product_count
        FROM categories c
        WHERE c.is_active = 1
        ORDER BY c.name ASC
    `).all();
    res.json(categories);
});

// GET /api/products/barcode/:barcode - Direct barcode lookup for POS scanner
router.get('/barcode/:barcode', authenticateToken, (req, res) => {
    const product = db.prepare(`
        SELECT p.*,
               p.selling_price as price,
               c.name as category,
               c.name as category_name
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.barcode = ? AND p.is_active = 1
    `).get(req.params.barcode.trim());

    if (!product) {
        return res.status(404).json({ error: 'Product with this barcode was not found' });
    }

    // Attach current branch stock
    const branchStock = db.prepare(`
        SELECT COALESCE(SUM(quantity_available), 0) as available_qty
        FROM inventory
        WHERE product_id = ? AND branch_id = ?
    `).get(product.id, req.user.branchId || 1);

    res.json({
        ...product,
        available_qty: branchStock ? branchStock.available_qty : 0
    });
});

// POST /api/products - Create product (SUPER_ADMIN or BRANCH_MANAGER)
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const { category_id, sku, barcode, name, description, unit, cost_price, selling_price, min_stock_alert } = req.body;

    if (!category_id || !sku || !barcode || !name || selling_price === undefined) {
        return res.status(400).json({ error: 'Category, SKU, Barcode, Name, and Selling Price are required.' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO products (
                category_id, sku, barcode, name, description, unit,
                cost_price, selling_price, min_stock_alert, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            category_id,
            sku.toUpperCase().trim(),
            barcode.trim(),
            name.trim(),
            description || '',
            unit || 'PCS',
            Number(cost_price) || 0.0,
            Number(selling_price),
            Number(min_stock_alert) || 10
        );

        const newProductId = result.lastInsertRowid;

        // Initialize inventory zero balance across all warehouses
        const warehouses = db.prepare('SELECT id, branch_id FROM warehouses WHERE is_active = 1').all();
        for (const w of warehouses) {
            db.prepare(`
                INSERT OR IGNORE INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available)
                VALUES (?, ?, ?, 0, 0, 0)
            `).run(w.branch_id, w.id, newProductId);
        }

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'PRODUCT',
            resourceId: String(newProductId),
            branchId: req.user.branchId,
            newValue: { sku, barcode, name, selling_price },
            reason: 'Added new product to master catalog'
        });

        const created = db.prepare('SELECT * FROM products WHERE id = ?').get(newProductId);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Product SKU or Barcode already exists in system' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/products/:id - Update product
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const targetProductId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM products WHERE id = ?').get(targetProductId);

    if (!prev) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const { name, description, unit, cost_price, selling_price, min_stock_alert, is_active } = req.body;

    db.prepare(`
        UPDATE products
        SET name = ?, description = ?, unit = ?, cost_price = ?, selling_price = ?,
            min_stock_alert = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name || prev.name,
        description !== undefined ? description : prev.description,
        unit || prev.unit,
        cost_price !== undefined ? Number(cost_price) : prev.cost_price,
        selling_price !== undefined ? Number(selling_price) : prev.selling_price,
        min_stock_alert !== undefined ? Number(min_stock_alert) : prev.min_stock_alert,
        is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
        targetProductId
    );

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'UPDATE',
        resource: 'PRODUCT',
        resourceId: String(targetProductId),
        branchId: req.user.branchId,
        previousValue: prev,
        newValue: req.body,
        reason: 'Updated product catalog information'
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(targetProductId);
    res.json(updated);
});

module.exports = router;
