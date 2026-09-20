// server/routes/products/variants.js
// Product Variants Management & Variant Inventory Routing
const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../../db/database.js');
const { authenticateToken, requireRole } = require('../../middleware/auth.js');
const { generateVariantSku, initVariantInventory } = require('../../services/catalogService.js');

// GET /:id/variants - List all variants for a product
router.get('/', authenticateToken, (req, res) => {
    const productId = Number(req.params.id);
    const variants = db.prepare(`
        SELECT v.*,
               COALESCE(SUM(vi.quantity_on_hand), 0) as total_variant_stock,
               COALESCE(SUM(vi.quantity_available), 0) as available_variant_stock
        FROM product_variants v
        LEFT JOIN variant_inventory vi ON v.id = vi.variant_id
        WHERE v.product_id = ? AND v.is_active = 1
        GROUP BY v.id
        ORDER BY v.id ASC
    `).all(productId);

    res.json(variants);
});

// POST /:id/variants - Create variant for product
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const productId = Number(req.params.id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Parent product not found' });

    const {
        variant_sku, variant_barcode, variant_name, size, color, model,
        attributes_json, cost_price_override, selling_price_override, wholesale_price_override
    } = req.body;

    const sku = variant_sku
        ? variant_sku.toUpperCase().trim()
        : generateVariantSku(product.sku, { size, color, model });

    const name = variant_name || `${product.name} - ${[size, color, model].filter(Boolean).join(' / ')}`;

    try {
        const result = db.prepare(`
            INSERT INTO product_variants (
                product_id, variant_sku, variant_barcode, variant_name, size, color, model,
                attributes_json, cost_price_override, selling_price_override, wholesale_price_override, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
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
            wholesale_price_override !== undefined ? Number(wholesale_price_override) : null
        );

        const newVariantId = result.lastInsertRowid;
        initVariantInventory(productId, newVariantId);

        const created = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(newVariantId);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Variant SKU or Barcode already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id/variants/:variantId - Update variant
router.put('/:variantId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const variantId = Number(req.params.variantId);
    const prev = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
    if (!prev) return res.status(404).json({ error: 'Variant not found' });

    const {
        variant_sku, variant_barcode, variant_name, size, color, model,
        attributes_json, cost_price_override, selling_price_override, wholesale_price_override, is_active
    } = req.body;

    try {
        db.prepare(`
            UPDATE product_variants
            SET variant_sku = ?, variant_barcode = ?, variant_name = ?, size = ?, color = ?, model = ?,
                attributes_json = ?, cost_price_override = ?, selling_price_override = ?,
                wholesale_price_override = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
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
            is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
            variantId
        );

        const updated = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
        res.json(updated);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Variant SKU or Barcode already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/variants/:variantId - Deactivate variant
router.delete('/:variantId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const variantId = Number(req.params.variantId);
    db.prepare('UPDATE product_variants SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(variantId);
    res.json({ success: true, message: 'Variant deactivated successfully' });
});

module.exports = router;
