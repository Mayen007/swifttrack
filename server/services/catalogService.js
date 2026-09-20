// server/services/catalogService.js
// Catalog Business Operations: SKU Generation, Variant Warehouse Allocations & Lifecycle
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');

/**
 * Generates a clean, normalized variant SKU
 * e.g. LOG-BX-01 + Size: '40x30' -> LOG-BX-01-40X30
 */
function generateVariantSku(parentSku, attributes = {}) {
    const parts = [parentSku.toUpperCase().trim()];
    if (attributes.size) parts.push(String(attributes.size).replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
    if (attributes.color) parts.push(String(attributes.color).slice(0, 3).toUpperCase());
    if (attributes.model) parts.push(String(attributes.model).slice(0, 3).toUpperCase());
    return parts.join('-');
}

/**
 * Initializes variant inventory rows across all active warehouses
 */
function initVariantInventory(productId, variantId) {
    const warehouses = db.prepare('SELECT id, branch_id FROM warehouses WHERE is_active = 1').all();
    for (const w of warehouses) {
        db.prepare(`
            INSERT OR IGNORE INTO variant_inventory (
                branch_id, warehouse_id, product_id, variant_id,
                quantity_on_hand, quantity_reserved, quantity_available
            ) VALUES (?, ?, ?, ?, 0, 0, 0)
        `).run(w.branch_id, w.id, Number(productId), Number(variantId));
    }
}

/**
 * Archives a product (soft-delete)
 */
function archiveProduct(productId, user) {
    const targetId = Number(productId);
    const prev = db.prepare('SELECT * FROM products WHERE id = ?').get(targetId);
    if (!prev) throw new Error('Product not found');

    db.prepare(`
        UPDATE products
        SET is_archived = 1, is_active = 0, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(targetId);

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'ARCHIVE',
        resource: 'PRODUCT',
        resourceId: String(targetId),
        branchId: user.branchId,
        previousValue: { is_archived: 0 },
        newValue: { is_archived: 1 },
        reason: 'Archived product from active catalog'
    });

    return db.prepare('SELECT * FROM products WHERE id = ?').get(targetId);
}

/**
 * Restores an archived product
 */
function restoreProduct(productId, user) {
    const targetId = Number(productId);
    const prev = db.prepare('SELECT * FROM products WHERE id = ?').get(targetId);
    if (!prev) throw new Error('Product not found');

    db.prepare(`
        UPDATE products
        SET is_archived = 0, is_active = 1, archived_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(targetId);

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'RESTORE',
        resource: 'PRODUCT',
        resourceId: String(targetId),
        branchId: user.branchId,
        previousValue: { is_archived: 1 },
        newValue: { is_archived: 0 },
        reason: 'Restored archived product to active catalog'
    });

    return db.prepare('SELECT * FROM products WHERE id = ?').get(targetId);
}

module.exports = {
    generateVariantSku,
    initVariantInventory,
    archiveProduct,
    restoreProduct
};
