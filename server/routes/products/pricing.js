// server/routes/products/pricing.js
// Multi-Tier Pricing Routing: Branch Overrides, Bulk Tiers, Customer Agreements & Dynamic Resolution
const express = require('express');
const router = express.Router({ mergeParams: true });
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../../middleware/auth.js');
const { resolvePrice } = require('../../services/pricingService.js');

// GET /:id/pricing - Get all pricing tiers for a product
router.get('/', authenticateToken, async (req, res) => {
    try {
        const productId = Number(req.params.id);

        const branchPrices = await dbAdapter.all(`
            SELECT bp.*, b.name as branch_name, b.code as branch_code, v.variant_name
            FROM branch_product_prices bp
            JOIN branches b ON bp.branch_id = b.id
            LEFT JOIN product_variants v ON bp.variant_id = v.id
            WHERE bp.product_id = ?
            ORDER BY b.name ASC
        `, [productId]);

        const bulkTiers = await dbAdapter.all(`
            SELECT bp.*, v.variant_name
            FROM product_bulk_pricing bp
            LEFT JOIN product_variants v ON bp.variant_id = v.id
            WHERE bp.product_id = ?
            ORDER BY bp.min_quantity ASC
        `, [productId]);

        const customerPrices = await dbAdapter.all(`
            SELECT cp.*, c.full_name as customer_name, v.variant_name
            FROM customer_product_prices cp
            LEFT JOIN customers c ON cp.customer_id = c.id
            LEFT JOIN product_variants v ON cp.variant_id = v.id
            WHERE cp.product_id = ?
            ORDER BY cp.created_at DESC
        `, [productId]);

        res.json({ branchPrices, bulkTiers, customerPrices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/pricing/branch - Configure branch price override
router.post('/branch', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const { branch_id, variant_id, cost_price, selling_price, wholesale_price } = req.body;

        if (!branch_id || selling_price === undefined) {
            return res.status(400).json({ error: 'Branch ID and Selling Price are required' });
        }

        const vId = variant_id ? Number(variant_id) : null;
        let exist;
        if (vId === null) {
            exist = await dbAdapter.get(`
                SELECT id FROM branch_product_prices
                WHERE branch_id = ? AND product_id = ? AND variant_id IS NULL
            `, [Number(branch_id), productId]);
        } else {
            exist = await dbAdapter.get(`
                SELECT id FROM branch_product_prices
                WHERE branch_id = ? AND product_id = ? AND variant_id = ?
            `, [Number(branch_id), productId, vId]);
        }

        if (exist) {
            await dbAdapter.run(`
                UPDATE branch_product_prices
                SET cost_price = ?, selling_price = ?, wholesale_price = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                cost_price !== undefined ? Number(cost_price) : null,
                Number(selling_price),
                wholesale_price !== undefined ? Number(wholesale_price) : null,
                exist.id
            ]);
            return res.json({ success: true, id: exist.id, message: 'Branch price updated' });
        }

        const result = await dbAdapter.run(`
            INSERT INTO branch_product_prices (branch_id, product_id, variant_id, cost_price, selling_price, wholesale_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            Number(branch_id),
            productId,
            vId,
            cost_price !== undefined ? Number(cost_price) : null,
            Number(selling_price),
            wholesale_price !== undefined ? Number(wholesale_price) : null
        ]);

        res.status(201).json({ success: true, id: result.insertId, message: 'Branch price created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/pricing/branch/:priceId - Remove branch price override
router.delete('/branch/:priceId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        await dbAdapter.run('DELETE FROM branch_product_prices WHERE id = ?', [Number(req.params.priceId)]);
        res.json({ success: true, message: 'Branch price override removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/pricing/bulk - Configure bulk quantity break tier
router.post('/bulk', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const { variant_id, min_quantity, max_quantity, unit_price, discount_percent } = req.body;

        if (!min_quantity || (unit_price === undefined && discount_percent === undefined)) {
            return res.status(400).json({ error: 'Min quantity and either Unit Price or Discount Percent are required' });
        }

        const result = await dbAdapter.run(`
            INSERT INTO product_bulk_pricing (product_id, variant_id, min_quantity, max_quantity, unit_price, discount_percent)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            productId,
            variant_id ? Number(variant_id) : null,
            Number(min_quantity),
            max_quantity ? Number(max_quantity) : null,
            Number(unit_price) || 0,
            discount_percent !== undefined ? Number(discount_percent) : null
        ]);

        res.status(201).json({ success: true, id: result.insertId, message: 'Bulk tier created' });
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique constraint')) {
            return res.status(409).json({ error: 'Bulk tier for this min quantity already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/pricing/bulk/:tierId - Remove bulk pricing tier
router.delete('/bulk/:tierId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        await dbAdapter.run('DELETE FROM product_bulk_pricing WHERE id = ?', [Number(req.params.tierId)]);
        res.json({ success: true, message: 'Bulk pricing tier removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/pricing/customer - Configure customer or tier agreement
router.post('/customer', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const { customer_id, customer_tier, variant_id, special_price, discount_percent, min_quantity, start_date, end_date } = req.body;

        if (!special_price && discount_percent === undefined) {
            return res.status(400).json({ error: 'Special price or discount percent is required' });
        }

        const result = await dbAdapter.run(`
            INSERT INTO customer_product_prices (
                customer_id, customer_tier, product_id, variant_id, special_price,
                discount_percent, min_quantity, start_date, end_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            customer_id ? Number(customer_id) : null,
            customer_tier ? String(customer_tier).toUpperCase() : null,
            productId,
            variant_id ? Number(variant_id) : null,
            Number(special_price) || 0,
            discount_percent !== undefined ? Number(discount_percent) : null,
            Number(min_quantity) || 1,
            start_date || null,
            end_date || null
        ]);

        res.status(201).json({ success: true, id: result.insertId, message: 'Customer agreement saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/pricing/customer/:custPriceId - Remove customer agreement
router.delete('/customer/:custPriceId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        await dbAdapter.run('DELETE FROM customer_product_prices WHERE id = ?', [Number(req.params.custPriceId)]);
        res.json({ success: true, message: 'Customer price agreement removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
