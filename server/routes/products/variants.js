// server/routes/products/variants.js
// Product Variants Management & Variant Inventory Routing
const express = require('express');
const router = express.Router({ mergeParams: true });
const dbAdapter = require('../../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../../middleware/auth.js');
const { generateVariantSku, initVariantInventory } = require('../../services/catalogService.js');

// GET /:id/variants - List all variants for a product
router.get('/', authenticateToken, async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const activeCond = dbAdapter.isPostgres ? 'v.is_active = true' : 'v.is_active = 1';
        const variants = await dbAdapter.all(`
            SELECT v.*,
                   COALESCE(SUM(vi.quantity_on_hand), 0) as total_variant_stock,
                   COALESCE(SUM(vi.quantity_available), 0) as available_variant_stock
            FROM product_variants v
            LEFT JOIN variant_inventory vi ON v.id = vi.variant_id
            WHERE v.product_id = ? AND ${activeCond}
            GROUP BY v.id
            ORDER BY v.id ASC
        `, [productId]);

        res.json(variants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/variants - Create variant for product
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const product = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) return res.status(404).json({ error: 'Parent product not found' });

        const {
            variant_sku, variant_barcode, variant_name, size, color, model,
            attributes_json, cost_price_override, selling_price_override, wholesale_price_override
        } = req.body;

        const sku = variant_sku
            ? variant_sku.toUpperCase().trim()
            : generateVariantSku(product.sku, { size, color, model });

        const name = variant_name || `${product.name} - ${[size, color, model].filter(Boolean).join(' / ')}`;
        const activeVal = dbAdapter.isPostgres ? true : 1;

        const result = await dbAdapter.run(`
            INSERT INTO product_variants (
                product_id, variant_sku, variant_barcode, variant_name, size, color, model,
                attributes_json, cost_price_override, selling_price_override, wholesale_price_override, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            sku,
            variant_barcode ? String(variant_barcode).trim() : null,
            name,
            size || null,
            color || null,
            model || null,
            typeof attributes_json === 'object' ? JSON.stringify(attributes_json) : (attributes_json || '{}'),
            cost_price_override !== undefined ? Number(cost_price_override) : null,
            selling_price_override !== undefined ? Number(selling_price_override) : null,
            wholesale_price_override !== undefined ? Number(wholesale_price_override) : null,
            activeVal
        ]);

        const newVariantId = result.insertId;
        await initVariantInventory(productId, newVariantId);

        const created = await dbAdapter.get('SELECT * FROM product_variants WHERE id = ?', [newVariantId]);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique constraint')) {
            return res.status(409).json({ error: 'Variant SKU or Barcode already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/variants/:variantId - Update variant
router.put('/:variantId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const variantId = Number(req.params.variantId);
        const prev = await dbAdapter.get('SELECT * FROM product_variants WHERE id = ?', [variantId]);
        if (!prev) return res.status(404).json({ error: 'Variant not found' });

        const {
            variant_sku, variant_barcode, variant_name, size, color, model,
            attributes_json, cost_price_override, selling_price_override, wholesale_price_override, is_active
        } = req.body;

        const activeValue = is_active !== undefined
            ? (dbAdapter.isPostgres ? Boolean(is_active) : (is_active ? 1 : 0))
            : prev.is_active;

        await dbAdapter.run(`
            UPDATE product_variants
            SET variant_sku = ?, variant_barcode = ?, variant_name = ?, size = ?, color = ?, model = ?,
                attributes_json = ?, cost_price_override = ?, selling_price_override = ?,
                wholesale_price_override = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            variant_sku ? variant_sku.toUpperCase().trim() : prev.variant_sku,
            variant_barcode !== undefined ? (variant_barcode ? String(variant_barcode).trim() : null) : prev.variant_barcode,
            variant_name || prev.variant_name,
            size !== undefined ? size : prev.size,
            color !== undefined ? color : prev.color,
            model !== undefined ? model : prev.model,
            attributes_json !== undefined ? (typeof attributes_json === 'object' ? JSON.stringify(attributes_json) : attributes_json) : prev.attributes_json,
            cost_price_override !== undefined ? Number(cost_price_override) : prev.cost_price_override,
            selling_price_override !== undefined ? Number(selling_price_override) : prev.selling_price_override,
            wholesale_price_override !== undefined ? Number(wholesale_price_override) : prev.wholesale_price_override,
            activeValue,
            variantId
        ]);

        const updated = await dbAdapter.get('SELECT * FROM product_variants WHERE id = ?', [variantId]);
        res.json(updated);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique constraint')) {
            return res.status(409).json({ error: 'Variant SKU or Barcode already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/variants/:variantId - Deactivate variant
router.delete('/:variantId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const variantId = Number(req.params.variantId);
        const inactiveVal = dbAdapter.isPostgres ? false : 0;
        await dbAdapter.run('UPDATE product_variants SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [inactiveVal, variantId]);
        res.json({ success: true, message: 'Variant deactivated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
