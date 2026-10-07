// server/routes/products/index.js
// Master Product Router aggregating Catalog, Variants, Multi-Tier Pricing & Barcode Lookups
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken } = require('../../middleware/auth.js');
const { resolvePrice } = require('../../services/pricingService.js');

const catalogRouter = require('./catalog.js');
const variantsRouter = require('./variants.js');
const pricingRouter = require('./pricing.js');

// 1. Categories listing
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const isPg = dbAdapter.isPostgres;
        const activeCond = isPg ? 'is_active = true' : 'is_active = 1';
        const unarchivedCond = isPg ? 'is_archived = false' : 'is_archived = 0';
        const categories = await dbAdapter.all(`
            SELECT c.*,
                   (SELECT count(*) FROM products WHERE category_id = c.id AND ${activeCond} AND ${unarchivedCond}) as product_count
            FROM categories c
            WHERE c.${activeCond}
            ORDER BY c.name ASC
        `);
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Barcode scanner lookup (Product)
router.get('/barcode/:barcode', authenticateToken, async (req, res) => {
    try {
        const barcode = req.params.barcode.trim();
        const isPg = dbAdapter.isPostgres;
        const activeCond = isPg ? 'p.is_active = true' : 'p.is_active = 1';
        const unarchivedCond = isPg ? 'p.is_archived = false' : 'p.is_archived = 0';
        const product = await dbAdapter.get(`
            SELECT p.*,
                   p.selling_price as price,
                   c.name as category,
                   c.name as category_name,
                   b.name as brand_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.barcode = ? AND ${activeCond} AND ${unarchivedCond}
        `, [barcode]);

        if (!product) {
            return res.status(404).json({ error: 'Product with this barcode was not found' });
        }

        const branchStock = await dbAdapter.get(`
            SELECT COALESCE(SUM(quantity_available), 0) as available_qty
            FROM inventory
            WHERE product_id = ? AND branch_id = ?
        `, [product.id, req.user.branchId || 1]);

        const variantActiveCond = isPg ? 'is_active = true' : 'is_active = 1';
        const variants = await dbAdapter.all(
            `SELECT * FROM product_variants WHERE product_id = ? AND ${variantActiveCond}`,
            [product.id]
        );

        res.json({
            ...product,
            available_qty: branchStock ? Number(branchStock.available_qty) : 0,
            variants
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Barcode scanner lookup (Variant)
router.get('/variant-barcode/:barcode', authenticateToken, async (req, res) => {
    try {
        const barcode = req.params.barcode.trim();
        const isPg = dbAdapter.isPostgres;
        const vActiveCond = isPg ? 'v.is_active = true' : 'v.is_active = 1';
        const pActiveCond = isPg ? 'p.is_active = true' : 'p.is_active = 1';
        const pUnarchivedCond = isPg ? 'p.is_archived = false' : 'p.is_archived = 0';
        const variant = await dbAdapter.get(`
            SELECT v.*,
                   p.name as parent_name,
                   p.category_id,
                   p.unit,
                   p.selling_price as parent_selling_price,
                   p.cost_price as parent_cost_price,
                   p.wholesale_price as parent_wholesale_price,
                   p.tax_category
            FROM product_variants v
            JOIN products p ON v.product_id = p.id
            WHERE v.variant_barcode = ? AND ${vActiveCond} AND ${pActiveCond} AND ${pUnarchivedCond}
        `, [barcode]);

        if (!variant) {
            return res.status(404).json({ error: 'Product variant with this barcode was not found' });
        }

        const branchStock = await dbAdapter.get(`
            SELECT COALESCE(SUM(quantity_available), 0) as available_qty
            FROM variant_inventory
            WHERE variant_id = ? AND branch_id = ?
        `, [variant.id, req.user.branchId || 1]);

        res.json({
            ...variant,
            available_qty: branchStock ? Number(branchStock.available_qty) : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Dynamic Price Resolver Endpoint (Used by POS, Orders & Cart)
router.post('/resolve-price', authenticateToken, async (req, res) => {
    try {
        const {
            productId, variantId, branchId, customerId,
            customerTier, quantity, promoCode, isWholesale
        } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'productId is required for price resolution' });
        }

        const pricing = await resolvePrice({
            productId,
            variantId,
            branchId: branchId || req.user.branchId,
            customerId,
            customerTier,
            quantity: quantity || 1,
            promoCode,
            isWholesale: Boolean(isWholesale)
        });

        res.json(pricing);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 5. Mount Sub-routers
router.use('/:id/variants', variantsRouter);
router.use('/:id/pricing', pricingRouter);
router.use('/', catalogRouter);

module.exports = router;
