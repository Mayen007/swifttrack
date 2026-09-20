// server/db/database.js
// High-performance SQLite database connection using Node 24 native node:sqlite
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.resolve(__dirname, '../../data/logistics_platform.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable Foreign Key constraints and WAL mode for high concurrency & integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Helper method for executing transactions
db.transaction = (fn) => {
    return (...args) => {
        db.exec('BEGIN IMMEDIATE;');
        try {
            const result = fn(...args);
            db.exec('COMMIT;');
            return result;
        } catch (error) {
            try {
                db.exec('ROLLBACK;');
            } catch (rbError) {
                // Ignore rollback failure if already rolled back
            }
            throw error;
        }
    };
};

// Safely add missing columns to existing tables during schema evolution
function migrateAuthSchema() {
    try {
        const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);

        const newCols = [
            { name: 'password_changed_at', def: 'DATETIME' },
            { name: 'must_change_password', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'failed_login_attempts', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'locked_until', def: 'DATETIME' },
            { name: 'token_version', def: 'INTEGER NOT NULL DEFAULT 1' },
            { name: 'two_factor_enabled', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'two_factor_secret', def: 'TEXT' },
            { name: 'two_factor_recovery_codes', def: 'TEXT' }
        ];

        for (const col of newCols) {
            if (!userCols.includes(col.name)) {
                db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.def};`);
            }
        }
    } catch (err) {
        console.warn('Auth schema migration notice:', err.message);
    }
}

function migrateCommerceSchema() {
    try {
        const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);

        const newProductCols = [
            { name: 'brand_id', def: 'INTEGER REFERENCES brands(id) ON DELETE SET NULL' },
            { name: 'supplier_id', def: 'INTEGER REFERENCES suppliers(id) ON DELETE SET NULL' },
            { name: 'wholesale_price', def: 'REAL NOT NULL DEFAULT 0.0' },
            { name: 'tax_category', def: "TEXT NOT NULL DEFAULT 'STANDARD_16'" },
            { name: 'reorder_threshold', def: 'INTEGER NOT NULL DEFAULT 10' },
            { name: 'reorder_quantity', def: 'INTEGER NOT NULL DEFAULT 50' },
            { name: 'images', def: "TEXT NOT NULL DEFAULT '[]'" },
            { name: 'is_archived', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'archived_at', def: 'DATETIME' }
        ];

        for (const col of newProductCols) {
            if (!productCols.includes(col.name)) {
                db.exec(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def};`);
            }
        }
    } catch (err) {
        console.warn('Commerce schema migration notice:', err.message);
    }
}

/**
 * Non-destructive runtime migration for Phase 3: 3.1 Inventory States
 * Adds quantity_in_transit, quantity_damaged, quantity_expired to inventory & variant_inventory,
 * and from_state / to_state to inventory_movements.
 */
function migrateInventoryStatesSchema() {
    try {
        // 1. inventory table columns
        const invInfo = db.prepare('PRAGMA table_info(inventory)').all();
        const invCols = invInfo.map(c => c.name);
        const newInvCols = [
            { name: 'quantity_in_transit', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'quantity_damaged', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'quantity_expired', def: 'INTEGER NOT NULL DEFAULT 0' }
        ];
        for (const col of newInvCols) {
            if (!invCols.includes(col.name)) {
                db.exec(`ALTER TABLE inventory ADD COLUMN ${col.name} ${col.def};`);
            }
        }

        // 2. variant_inventory table columns (if table exists)
        const hasVariantInv = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='variant_inventory'").get();
        if (hasVariantInv) {
            const vInfo = db.prepare('PRAGMA table_info(variant_inventory)').all();
            const vCols = vInfo.map(c => c.name);
            for (const col of newInvCols) {
                if (!vCols.includes(col.name)) {
                    db.exec(`ALTER TABLE variant_inventory ADD COLUMN ${col.name} ${col.def};`);
                }
            }
        }

        // 3. inventory_movements table columns
        const movInfo = db.prepare('PRAGMA table_info(inventory_movements)').all();
        const movCols = movInfo.map(c => c.name);
        const newMovCols = [
            { name: 'from_state', def: "TEXT NOT NULL DEFAULT 'AVAILABLE'" },
            { name: 'to_state', def: "TEXT NOT NULL DEFAULT 'AVAILABLE'" }
        ];
        for (const col of newMovCols) {
            if (!movCols.includes(col.name)) {
                db.exec(`ALTER TABLE inventory_movements ADD COLUMN ${col.name} ${col.def};`);
            }
        }
    } catch (err) {
        console.warn('Inventory states schema migration notice:', err.message);
    }
}

// Initialize schema
function initSchema() {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    migrateAuthSchema();
    migrateCommerceSchema();
    migrateInventoryStatesSchema();
}

module.exports = {
    db,
    initSchema,
    DB_PATH
};
