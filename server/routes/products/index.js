// server/routes/products/index.js
// Master Product Router aggregating Catalog, Variants, Multi-Tier Pricing & Barcode Lookups
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken } = require('../../middleware/auth.js');
const { resolvePrice } = require('../../services/pricingService.js');

const catalogRouter = require('./catalog.js');
const variantsRouter = require('./variants.js');
const pricingRouter = require('./pricing.js');

// 1. Categories listing
router.get('/categories', authenticateToken, (req, res) => {
    const categories = db.prepare(`
        SELECT c.*,
               (SELECT count(*) FROM products WHERE category_id = c.id AND is_active = 1 AND is_archived = 0) as product_count
        FROM categories c
        WHERE c.is_active = 1
        ORDER BY c.name ASC
    `).all();
    res.json(categories);
});

// 2. Barcode scanner lookup (Product)
router.get('/barcode/:barcode', authenticateToken, (req, res) => {
    const barcode = req.params.barcode.trim();
    const product = db.prepare(`
        SELECT p.*,
               p.selling_price as price,
               c.name as category,
               c.name as category_name,
               b.name as brand_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.barcode = ? AND p.is_active = 1 AND p.is_archived = 0
    `).get(barcode);

    if (!product) {
        return res.status(404).json({ error: 'Product with this barcode was not found' });
    }

    const branchStock = db.prepare(`
        SELECT COALESCE(SUM(quantity_available), 0) as available_qty
        FROM inventory
        WHERE product_id = ? AND branch_id = ?
    `).get(product.id, req.user.branchId || 1);

    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(product.id);

    res.json({
        ...product,
        available_qty: branchStock ? branchStock.available_qty : 0,
        variants
    });
});

// 3. Barcode scanner lookup (Variant)
router.get('/variant-barcode/:barcode', authenticateToken, (req, res) => {
    const barcode = req.params.barcode.trim();
    const variant = db.prepare(`
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
        WHERE v.variant_barcode = ? AND v.is_active = 1 AND p.is_active = 1 AND p.is_archived = 0
    `).get(barcode);

    if (!variant) {
        return res.status(404).json({ error: 'Product variant with this barcode was not found' });
    }

    const branchStock = db.prepare(`
        SELECT COALESCE(SUM(quantity_available), 0) as available_qty
        FROM variant_inventory
        WHERE variant_id = ? AND branch_id = ?
    `).get(variant.id, req.user.branchId || 1);

    res.json({
        ...variant,
        available_qty: branchStock ? branchStock.available_qty : 0
    });
});

// 4. Dynamic Price Resolver Endpoint (Used by POS, Orders & Cart)
router.post('/resolve-price', authenticateToken, (req, res) => {
    try {
        const {
            productId, variantId, branchId, customerId,
            customerTier, quantity, promoCode, isWholesale
        } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'productId is required for price resolution' });
        }

        const pricing = resolvePrice({
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
