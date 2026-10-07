// server/routes/products/catalog.js
// Product Catalog Master CRUD & Search Route
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { archiveProduct, restoreProduct } = require('../../services/catalogService.js');

// GET / - List products with rich filtering, pagination & stock levels
router.get('/', authenticateToken, async (req, res) => {
    try {
        const {
            category_id, brand_id, supplier_id, tax_category,
            search, barcode, sku, low_stock, is_archived, branch_id
        } = req.query;

        const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
        const activeVariantCondition = isPostgres ? 'is_active = true' : 'is_active = 1';

        let query = `
            SELECT p.*,
                   p.selling_price as price,
                   c.name as category,
                   c.name as category_name,
                   c.code as category_code,
                   b.name as brand_name,
                   s.name as supplier_name,
                   (SELECT count(*) FROM product_variants WHERE product_id = p.id AND ${activeVariantCondition}) as variant_count,
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
            whereClauses.push(isPostgres ? 'p.is_archived = true' : 'p.is_archived = 1');
        } else {
            whereClauses.push(isPostgres ? 'p.is_archived = false' : 'p.is_archived = 0');
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

        query += ' GROUP BY p.id, c.name, c.code, b.name, s.name';

        if (low_stock === 'true') {
            query += ' HAVING COALESCE(SUM(i.quantity_on_hand), 0) <= p.min_stock_alert';
        }

        query += ' ORDER BY p.name ASC';

        const products = await dbAdapter.all(query, params);

        // Parse image arrays safely
        const formatted = products.map(p => ({
            ...p,
            images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || [])
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id - Get product details with category, brand & variants summary
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const product = await dbAdapter.get(`
            SELECT p.*,
                   c.name as category_name,
                   b.name as brand_name,
                   s.name as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
        `, [Number(req.params.id)]);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
        const activeCondition = isPostgres ? 'is_active = true' : 'is_active = 1';
        const variants = await dbAdapter.all(`SELECT * FROM product_variants WHERE product_id = ? AND ${activeCondition}`, [product.id]);
        const images = typeof product.images === 'string' ? JSON.parse(product.images || '[]') : (product.images || []);

        res.json({ ...product, images, variants });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST / - Create product
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    const {
        category_id, brand_id, supplier_id, sku, barcode, name, description,
        unit, cost_price, selling_price, wholesale_price, tax_category,
        min_stock_alert, reorder_quantity, images
    } = req.body;

    if (!category_id || !sku || !barcode || !name || selling_price === undefined) {
        return res.status(400).json({ error: 'Category, SKU, Barcode, Name, and Selling Price are required.' });
    }

    try {
        const uom = (req.body.unit || req.body.unit_of_measure || 'PCS').trim();
        const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');

        const result = await dbAdapter.run(`
            INSERT INTO products (
                category_id, brand_id, supplier_id, sku, barcode, name, description,
                unit, cost_price, selling_price, wholesale_price, tax_category,
                min_stock_alert, reorder_threshold, reorder_quantity, images, is_active, is_archived
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            Number(category_id),
            brand_id ? Number(brand_id) : null,
            supplier_id ? Number(supplier_id) : null,
            sku.toUpperCase().trim(),
            barcode.trim(),
            name.trim(),
            description || '',
            uom,
            Number(cost_price) || 0.0,
            Number(selling_price),
            wholesale_price !== undefined ? Number(wholesale_price) : Number(selling_price) * 0.85,
            tax_category || 'STANDARD_16',
            Number(min_stock_alert) || 10,
            Number(min_stock_alert) || 10,
            Number(reorder_quantity) || 50,
            JSON.stringify(Array.isArray(images) ? images : []),
            isPostgres ? true : 1,
            isPostgres ? false : 0
        ]);

        const newProductId = result.insertId || result.id;

        // Initialize zero inventory balance across all warehouses
        const activeCondition = isPostgres ? 'is_active = true' : 'is_active = 1';
        const warehouses = await dbAdapter.all(`SELECT id, branch_id FROM warehouses WHERE ${activeCondition}`);
        for (const w of warehouses) {
            if (isPostgres) {
                await dbAdapter.run(`
                    INSERT INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available)
                    VALUES (?, ?, ?, 0, 0, 0)
                    ON CONFLICT (warehouse_id, product_id) DO NOTHING
                `, [w.branch_id, w.id, newProductId]);
            } else {
                await dbAdapter.run(`
                    INSERT OR IGNORE INTO inventory (branch_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, quantity_available)
                    VALUES (?, ?, ?, 0, 0, 0)
                `, [w.branch_id, w.id, newProductId]);
            }
        }

        await logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'PRODUCT',
            resourceId: String(newProductId),
            branchId: req.user.branchId,
            newValue: { sku, barcode, name, selling_price },
            reason: 'Added new product to master catalog'
        });

        const created = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [newProductId]);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Product SKU or Barcode already exists in system' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update product
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const targetProductId = Number(req.params.id);
        const prev = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetProductId]);
        if (!prev) return res.status(404).json({ error: 'Product not found' });

        const {
            name, description, category_id, brand_id, supplier_id, unit, unit_of_measure,
            cost_price, selling_price, wholesale_price, tax_category,
            min_stock_alert, reorder_quantity, images, is_active
        } = req.body;

        const uom = unit || unit_of_measure || prev.unit || 'PCS';
        const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');

        let activeVal = prev.is_active;
        if (is_active !== undefined) {
            activeVal = isPostgres ? Boolean(is_active) : (is_active ? 1 : 0);
        }

        await dbAdapter.run(`
            UPDATE products
            SET name = ?, description = ?, category_id = ?, brand_id = ?, supplier_id = ?,
                unit = ?, cost_price = ?, selling_price = ?, wholesale_price = ?, tax_category = ?,
                min_stock_alert = ?, reorder_threshold = ?, reorder_quantity = ?,
                images = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name || prev.name,
            description !== undefined ? description : prev.description,
            category_id ? Number(category_id) : prev.category_id,
            brand_id !== undefined ? (brand_id ? Number(brand_id) : null) : prev.brand_id,
            supplier_id !== undefined ? (supplier_id ? Number(supplier_id) : null) : prev.supplier_id,
            uom,
            cost_price !== undefined ? Number(cost_price) : prev.cost_price,
            selling_price !== undefined ? Number(selling_price) : prev.selling_price,
            wholesale_price !== undefined ? Number(wholesale_price) : prev.wholesale_price,
            tax_category || prev.tax_category,
            min_stock_alert !== undefined ? Number(min_stock_alert) : prev.min_stock_alert,
            min_stock_alert !== undefined ? Number(min_stock_alert) : prev.reorder_threshold,
            reorder_quantity !== undefined ? Number(reorder_quantity) : prev.reorder_quantity,
            images !== undefined ? JSON.stringify(images) : prev.images,
            activeVal,
            targetProductId
        ]);

        const updated = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetProductId]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/archive - Archive product
router.post('/:id/archive', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const archived = await archiveProduct(req.params.id, req.user);
        res.json(archived);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /:id/restore - Restore product
router.post('/:id/restore', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const restored = await restoreProduct(req.params.id, req.user);
        res.json(restored);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
