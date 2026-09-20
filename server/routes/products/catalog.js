// server/routes/products/catalog.js
// Product Catalog Master CRUD & Search Route
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken, requireRole } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { archiveProduct, restoreProduct } = require('../../services/catalogService.js');

// GET / - List products with rich filtering, pagination & stock levels
router.get('/', authenticateToken, (req, res) => {
    const {
        category_id, brand_id, supplier_id, tax_category,
        search, barcode, sku, low_stock, is_archived, branch_id
    } = req.query;

    let query = `
        SELECT p.*,
               p.selling_price as price,
               c.name as category,
               c.name as category_name,
               c.code as category_code,
               b.name as brand_name,
               s.name as supplier_name,
               (SELECT count(*) FROM product_variants WHERE product_id = p.id AND is_active = 1) as variant_count,
               COALESCE(SUM(i.quantity_on_hand), 0) as total_stock,
               COALESCE(SUM(i.quantity_available), 0) as available_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN inventory i ON p.id = i.product_id
    `;
    const params = [];
    const whereClauses = [];

    // Filter active vs archived
    if (is_archived === 'true' || is_archived === '1') {
        whereClauses.push('p.is_archived = 1');
    } else {
        whereClauses.push('p.is_archived = 0');
    }

    // Branch isolation for non-Super Admin or branch query
    const targetBranchId = req.user.roleName !== 'SUPER_ADMIN' ? req.user.branchId : (branch_id ? Number(branch_id) : null);
    if (targetBranchId) {
        query += ' AND (i.branch_id = ? OR i.branch_id IS NULL)';
        params.push(targetBranchId);
    }

    if (category_id) {
        whereClauses.push('p.category_id = ?');
        params.push(Number(category_id));
    }
    if (brand_id) {
        whereClauses.push('p.brand_id = ?');
        params.push(Number(brand_id));
    }
    if (supplier_id) {
        whereClauses.push('p.supplier_id = ?');
        params.push(Number(supplier_id));
    }
    if (tax_category) {
        whereClauses.push('p.tax_category = ?');
        params.push(tax_category);
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
        whereClauses.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR b.name LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
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

    // Parse image arrays safely
    const formatted = products.map(p => ({
        ...p,
        images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || [])
    }));

    res.json(formatted);
});

// GET /:id - Get product details with category, brand & variants summary
router.get('/:id', authenticateToken, (req, res) => {
    const product = db.prepare(`
        SELECT p.*,
               c.name as category_name,
               b.name as brand_name,
               s.name as supplier_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
    `).get(Number(req.params.id));

    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(product.id);
    const images = typeof product.images === 'string' ? JSON.parse(product.images || '[]') : (product.images || []);

    res.json({ ...product, images, variants });
});

// POST / - Create product
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const {
        category_id, brand_id, supplier_id, sku, barcode, name, description,
        unit, cost_price, selling_price, wholesale_price, tax_category,
        min_stock_alert, reorder_quantity, images
    } = req.body;

    if (!category_id || !sku || !barcode || !name || selling_price === undefined) {
        return res.status(400).json({ error: 'Category, SKU, Barcode, Name, and Selling Price are required.' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO products (
                category_id, brand_id, supplier_id, sku, barcode, name, description,
                unit, cost_price, selling_price, wholesale_price, tax_category,
                min_stock_alert, reorder_threshold, reorder_quantity, images, is_active, is_archived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
        `).run(
            Number(category_id),
            brand_id ? Number(brand_id) : null,
            supplier_id ? Number(supplier_id) : null,
            sku.toUpperCase().trim(),
            barcode.trim(),
            name.trim(),
            description || '',
            unit || 'PCS',
            Number(cost_price) || 0.0,
            Number(selling_price),
            wholesale_price !== undefined ? Number(wholesale_price) : Number(selling_price) * 0.85,
            tax_category || 'STANDARD_16',
            Number(min_stock_alert) || 10,
            Number(min_stock_alert) || 10,
            Number(reorder_quantity) || 50,
            JSON.stringify(Array.isArray(images) ? images : [])
        );

        const newProductId = result.lastInsertRowid;

        // Initialize zero inventory balance across all warehouses
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

// PUT /:id - Update product
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const targetProductId = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM products WHERE id = ?').get(targetProductId);
    if (!prev) return res.status(404).json({ error: 'Product not found' });

    const {
        name, description, category_id, brand_id, supplier_id, unit,
        cost_price, selling_price, wholesale_price, tax_category,
        min_stock_alert, reorder_quantity, images, is_active
    } = req.body;

    db.prepare(`
        UPDATE products
        SET name = ?, description = ?, category_id = ?, brand_id = ?, supplier_id = ?, unit = ?,
            cost_price = ?, selling_price = ?, wholesale_price = ?, tax_category = ?,
            min_stock_alert = ?, reorder_threshold = ?, reorder_quantity = ?,
            images = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name || prev.name,
        description !== undefined ? description : prev.description,
        category_id ? Number(category_id) : prev.category_id,
        brand_id !== undefined ? (brand_id ? Number(brand_id) : null) : prev.brand_id,
        supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : prev.supplier_id,
        unit || prev.unit,
        cost_price !== undefined ? Number(cost_price) : prev.cost_price,
        selling_price !== undefined ? Number(selling_price) : prev.selling_price,
        wholesale_price !== undefined ? Number(wholesale_price) : prev.wholesale_price,
        tax_category || prev.tax_category,
        min_stock_alert !== undefined ? Number(min_stock_alert) : prev.min_stock_alert,
        min_stock_alert !== undefined ? Number(min_stock_alert) : prev.reorder_threshold,
        reorder_quantity !== undefined ? Number(reorder_quantity) : prev.reorder_quantity,
        images !== undefined ? JSON.stringify(images) : prev.images,
        is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
        targetProductId
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(targetProductId);
    res.json(updated);
});

// POST /:id/archive - Archive product
router.post('/:id/archive', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    try {
        const archived = archiveProduct(req.params.id, req.user);
        res.json(archived);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /:id/restore - Restore product
router.post('/:id/restore', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    try {
        const restored = restoreProduct(req.params.id, req.user);
        res.json(restored);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
