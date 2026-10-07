// server/services/catalogService.js
// Catalog Business Operations: SKU Generation, Variant Warehouse Allocations & Lifecycle
const dbAdapter = require('../db/dbAdapter.js');
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
async function initVariantInventory(productId, variantId, client = null) {
    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    const activeCondition = isPostgres ? 'is_active = true' : 'is_active = 1';
    const warehouses = await dbAdapter.all(`SELECT id, branch_id FROM warehouses WHERE ${activeCondition}`, [], client);
    for (const w of warehouses) {
        if (isPostgres) {
            await dbAdapter.run(`
                INSERT INTO variant_inventory (
                    branch_id, warehouse_id, product_id, variant_id,
                    quantity_on_hand, quantity_reserved, quantity_available
                ) VALUES (?, ?, ?, ?, 0, 0, 0)
                ON CONFLICT (warehouse_id, variant_id) DO NOTHING
            `, [w.branch_id, w.id, Number(productId), Number(variantId)], client);
        } else {
            await dbAdapter.run(`
                INSERT OR IGNORE INTO variant_inventory (
                    branch_id, warehouse_id, product_id, variant_id,
                    quantity_on_hand, quantity_reserved, quantity_available
                ) VALUES (?, ?, ?, ?, 0, 0, 0)
            `, [w.branch_id, w.id, Number(productId), Number(variantId)], client);
        }
    }
}

/**
 * Archives a product (soft-delete)
 */
async function archiveProduct(productId, user, client = null) {
    const targetId = Number(productId);
    const prev = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetId], client);
    if (!prev) throw new Error('Product not found');

    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    const updateSql = isPostgres
        ? `UPDATE products SET is_archived = true, is_active = false, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        : `UPDATE products SET is_archived = 1, is_active = 0, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    await dbAdapter.run(updateSql, [targetId], client);

    await logAuditEvent({
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

    return dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetId], client);
}

/**
 * Restores an archived product
 */
async function restoreProduct(productId, user, client = null) {
    const targetId = Number(productId);
    const prev = await dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetId], client);
    if (!prev) throw new Error('Product not found');

    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    const updateSql = isPostgres
        ? `UPDATE products SET is_archived = false, is_active = true, archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        : `UPDATE products SET is_archived = 0, is_active = 1, archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    await dbAdapter.run(updateSql, [targetId], client);

    await logAuditEvent({
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

    return dbAdapter.get('SELECT * FROM products WHERE id = ?', [targetId], client);
}

module.exports = {
    generateVariantSku,
    initVariantInventory,
    archiveProduct,
    restoreProduct
};
