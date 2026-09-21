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
let transactionDepth = 0;
db.transaction = (fn) => {
    return (...args) => {
        if (transactionDepth > 0) {
            return fn(...args);
        }
        transactionDepth++;
        db.exec('BEGIN IMMEDIATE;');
        try {
            const result = fn(...args);
            transactionDepth--;
            if (transactionDepth === 0) {
                db.exec('COMMIT;');
            }
            return result;
        } catch (error) {
            transactionDepth = 0;
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
            { name: 'archived_at', def: 'DATETIME' },
            { name: 'unit_of_measure', def: "TEXT NOT NULL DEFAULT 'PCS'" }
        ];

        for (const col of newProductCols) {
            if (!productCols.includes(col.name)) {
                db.exec(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def};`);
            }
        }

        // Sync unit_of_measure with unit column
        db.exec("UPDATE products SET unit_of_measure = unit WHERE unit IS NOT NULL AND (unit_of_measure IS NULL OR unit_of_measure = 'PCS');");
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

/**
 * Non-destructive runtime migration for Phase 3: 3.2 Inventory Operations
 * Ensures stock_receipts, stock_receipt_items, stocktakes, stocktake_items,
 * and stock_write_offs tables exist, plus transfer discrepancy columns.
 */
function migrateInventoryOperationsSchema() {
    try {
        // 1. Check stock_transfer_items columns
        const stiInfo = db.prepare('PRAGMA table_info(stock_transfer_items)').all();
        const stiCols = stiInfo.map(c => c.name);
        if (!stiCols.includes('quantity_discrepancy')) {
            db.exec('ALTER TABLE stock_transfer_items ADD COLUMN quantity_discrepancy INTEGER NOT NULL DEFAULT 0;');
        }
        if (!stiCols.includes('discrepancy_reason')) {
            db.exec('ALTER TABLE stock_transfer_items ADD COLUMN discrepancy_reason TEXT;');
        }

        // 2. Ensure stock_receipts
        db.exec(`
            CREATE TABLE IF NOT EXISTS stock_receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_number TEXT NOT NULL UNIQUE,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
                supplier_invoice_no TEXT,
                delivery_note_no TEXT,
                received_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                total_items INTEGER NOT NULL DEFAULT 0,
                total_cost REAL NOT NULL DEFAULT 0.0,
                status TEXT NOT NULL DEFAULT 'RECEIVED',
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Ensure stock_receipt_items
        db.exec(`
            CREATE TABLE IF NOT EXISTS stock_receipt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stock_receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
                quantity_received INTEGER NOT NULL,
                unit_cost REAL NOT NULL DEFAULT 0.0,
                batch_number TEXT,
                expiry_date DATE,
                condition TEXT NOT NULL DEFAULT 'GOOD'
            );
        `);

        // 4. Ensure stocktakes
        db.exec(`
            CREATE TABLE IF NOT EXISTS stocktakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stocktake_number TEXT NOT NULL UNIQUE,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                title TEXT NOT NULL,
                count_type TEXT NOT NULL DEFAULT 'CYCLE_COUNT',
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
                created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                reconciled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                total_products_counted INTEGER NOT NULL DEFAULT 0,
                total_variance_units INTEGER NOT NULL DEFAULT 0,
                total_variance_value REAL NOT NULL DEFAULT 0.0,
                notes TEXT,
                started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                reconciled_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Ensure stocktake_items
        db.exec(`
            CREATE TABLE IF NOT EXISTS stocktake_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
                system_quantity INTEGER NOT NULL DEFAULT 0,
                counted_quantity INTEGER,
                variance_quantity INTEGER NOT NULL DEFAULT 0,
                unit_cost REAL NOT NULL DEFAULT 0.0,
                variance_value REAL NOT NULL DEFAULT 0.0,
                counted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                notes TEXT,
                counted_at DATETIME
            );
        `);

        // 6. Ensure stock_write_offs
        db.exec(`
            CREATE TABLE IF NOT EXISTS stock_write_offs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                write_off_number TEXT NOT NULL UNIQUE,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
                from_state TEXT NOT NULL DEFAULT 'DAMAGED',
                quantity INTEGER NOT NULL,
                unit_cost REAL NOT NULL DEFAULT 0.0,
                total_loss_value REAL NOT NULL DEFAULT 0.0,
                reason_category TEXT NOT NULL,
                disposal_method TEXT NOT NULL DEFAULT 'SCRAPPED',
                status TEXT NOT NULL DEFAULT 'APPROVED',
                requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (err) {
        console.warn('Inventory operations schema migration notice:', err.message);
    }
}

/**
 * Non-destructive runtime migration for Phase 3: 3.3 Advanced Inventory
 * Batches, Expiries, Serial Numbers, Valuation, COGS, and Concurrency Guards.
 */
function migrateAdvancedInventorySchema() {
    try {
        // 1. Products: costing_method, is_serialized
        const pInfo = db.prepare('PRAGMA table_info(products)').all();
        const pCols = pInfo.map(c => c.name);
        if (!pCols.includes('costing_method')) {
            db.exec("ALTER TABLE products ADD COLUMN costing_method TEXT NOT NULL DEFAULT 'FIFO';");
        }
        if (!pCols.includes('is_serialized')) {
            db.exec("ALTER TABLE products ADD COLUMN is_serialized INTEGER NOT NULL DEFAULT 0;");
        }

        // 2. Inventory: average_cost
        const invInfo = db.prepare('PRAGMA table_info(inventory)').all();
        const invCols = invInfo.map(c => c.name);
        if (!invCols.includes('average_cost')) {
            db.exec('ALTER TABLE inventory ADD COLUMN average_cost REAL NOT NULL DEFAULT 0.0;');
        }

        // 3. Variant inventory: average_cost
        const hasVariantInv = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='variant_inventory'").get();
        if (hasVariantInv) {
            const viInfo = db.prepare('PRAGMA table_info(variant_inventory)').all();
            const viCols = viInfo.map(c => c.name);
            if (!viCols.includes('average_cost')) {
                db.exec('ALTER TABLE variant_inventory ADD COLUMN average_cost REAL NOT NULL DEFAULT 0.0;');
            }
        }

        // 4. Sale items: cogs_amount, batch_id, serial_number
        const siInfo = db.prepare('PRAGMA table_info(sale_items)').all();
        const siCols = siInfo.map(c => c.name);
        if (!siCols.includes('cogs_amount')) {
            db.exec('ALTER TABLE sale_items ADD COLUMN cogs_amount REAL NOT NULL DEFAULT 0.0;');
        }
        if (!siCols.includes('batch_id')) {
            db.exec('ALTER TABLE sale_items ADD COLUMN batch_id INTEGER REFERENCES inventory_batches(id);');
        }
        if (!siCols.includes('serial_number')) {
            db.exec('ALTER TABLE sale_items ADD COLUMN serial_number TEXT;');
        }

        // 5. Sales: total_cogs, gross_profit, gross_margin_pct
        const sInfo = db.prepare('PRAGMA table_info(sales)').all();
        const sCols = sInfo.map(c => c.name);
        if (!sCols.includes('total_cogs')) {
            db.exec('ALTER TABLE sales ADD COLUMN total_cogs REAL NOT NULL DEFAULT 0.0;');
        }
        if (!sCols.includes('gross_profit')) {
            db.exec('ALTER TABLE sales ADD COLUMN gross_profit REAL NOT NULL DEFAULT 0.0;');
        }
        if (!sCols.includes('gross_margin_pct')) {
            db.exec('ALTER TABLE sales ADD COLUMN gross_margin_pct REAL NOT NULL DEFAULT 0.0;');
        }

        // 6. Ensure inventory_batches table
        db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_number TEXT NOT NULL,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
                receipt_item_id INTEGER REFERENCES stock_receipt_items(id) ON DELETE SET NULL,
                initial_quantity INTEGER NOT NULL,
                quantity_available INTEGER NOT NULL,
                quantity_reserved INTEGER NOT NULL DEFAULT 0,
                unit_cost REAL NOT NULL DEFAULT 0.0,
                manufacturing_date DATE,
                expiry_date DATE,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(warehouse_id, product_id, batch_number)
            );
        `);

        // 7. Ensure inventory_serials table
        db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_serials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                serial_number TEXT NOT NULL UNIQUE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
                status TEXT NOT NULL DEFAULT 'AVAILABLE',
                unit_cost REAL NOT NULL DEFAULT 0.0,
                allocated_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
                allocated_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (err) {
        console.warn('Advanced inventory schema migration notice:', err.message);
    }
}

/**
 * Non-destructive runtime migration for Phase 4: 4.1 Customer Management
 * Adds status column to customers if missing, and ensures customer_addresses
 * and customer_notes tables exist.
 */
function migrateCustomerSchema() {
    try {
        const custInfo = db.prepare('PRAGMA table_info(customers)').all();
        const custCols = custInfo.map(c => c.name);
        if (!custCols.includes('status')) {
            db.exec("ALTER TABLE customers ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';");
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS customer_addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                address_label TEXT NOT NULL DEFAULT 'Primary',
                address_line TEXT NOT NULL,
                city TEXT NOT NULL DEFAULT 'Nairobi',
                contact_name TEXT,
                contact_phone TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                delivery_notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS customer_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                note_text TEXT NOT NULL,
                note_type TEXT NOT NULL DEFAULT 'GENERAL',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);');
    } catch (err) {
        console.warn('Customer schema migration notice:', err.message);
    }
}

/**
 * Non-destructive runtime migration for Phase 5: 5.1 POS Shifts & Cash Drawer Control
 * Adds shift_id to sales if missing, and ensures pos_shifts and cash_drawer_movements exist.
 */
function migratePosShiftSchema() {
    try {
        const salesCols = db.prepare('PRAGMA table_info(sales)').all().map(c => c.name);
        if (!salesCols.includes('shift_id')) {
            db.exec('ALTER TABLE sales ADD COLUMN shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE SET NULL;');
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS pos_shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                shift_number TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'OPEN',
                opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                reconciled_at DATETIME,
                reconciled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                opening_cash REAL NOT NULL DEFAULT 0.0,
                closing_cash REAL,
                expected_cash REAL NOT NULL DEFAULT 0.0,
                cash_variance REAL DEFAULT 0.0,
                total_sales_amount REAL NOT NULL DEFAULT 0.0,
                total_sales_count INTEGER NOT NULL DEFAULT 0,
                total_cash_amount REAL NOT NULL DEFAULT 0.0,
                total_mpesa_amount REAL NOT NULL DEFAULT 0.0,
                total_card_amount REAL NOT NULL DEFAULT 0.0,
                total_bank_amount REAL NOT NULL DEFAULT 0.0,
                total_refunds_amount REAL NOT NULL DEFAULT 0.0,
                notes TEXT,
                reconciliation_notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS cash_drawer_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_id INTEGER NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                movement_type TEXT NOT NULL,
                amount REAL NOT NULL,
                reference_id TEXT,
                reason TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON pos_shifts(cashier_user_id, status);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_pos_shifts_branch ON pos_shifts(branch_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_cash_drawer_movements_shift ON cash_drawer_movements(shift_id);');
    } catch (err) {
        console.warn('POS shift schema migration notice:', err.message);
    }
}

/**
 * Non-destructive runtime migration for Phase 6: Orders Engine
 * Adds delivery_fee, inventory_allocated, and lifecycle timestamps to orders if missing,
 * and ensures order_status_history and order_internal_notes tables exist.
 */
function migrateOrdersEngineSchema() {
    try {
        const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

        const newCols = [
            { name: 'delivery_fee', def: 'REAL NOT NULL DEFAULT 0.0' },
            { name: 'inventory_allocated', def: 'INTEGER NOT NULL DEFAULT 0' },
            { name: 'allocated_at', def: 'DATETIME' },
            { name: 'dispatched_at', def: 'DATETIME' },
            { name: 'delivered_at', def: 'DATETIME' },
            { name: 'cancelled_at', def: 'DATETIME' },
            { name: 'cancellation_reason', def: 'TEXT' },
            { name: 'internal_notes', def: 'TEXT' }
        ];

        for (const col of newCols) {
            if (!orderCols.includes(col.name)) {
                db.exec(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.def};`);
            }
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS order_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                from_status TEXT,
                to_status TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS order_internal_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                note TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_order_internal_notes_order ON order_internal_notes(order_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_orders_allocated ON orders(inventory_allocated);');
    } catch (err) {
        console.warn('Orders Engine schema migration notice:', err.message);
    }
}

// Non-destructive runtime migration: Phase 7 Payments Engine
function migratePaymentsEngineSchema() {
    try {
        // 1. Check and add new columns to payments table
        const paymentCols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
        const newCols = [
            { name: 'payment_intent_id', def: 'INTEGER REFERENCES payment_intents(id)' },
            { name: 'provider_reference', def: 'TEXT' },
            { name: 'reconciled_at', def: 'DATETIME' },
            { name: 'reconciled_by_user_id', def: 'INTEGER REFERENCES users(id)' }
        ];

        for (const col of newCols) {
            if (!paymentCols.includes(col.name)) {
                db.exec(`ALTER TABLE payments ADD COLUMN ${col.name} ${col.def};`);
            }
        }

        // 2. payment_intents table
        db.exec(`
            CREATE TABLE IF NOT EXISTS payment_intents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                intent_number TEXT NOT NULL UNIQUE,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
                order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
                sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
                customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
                payment_method TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'KES',
                status TEXT NOT NULL DEFAULT 'PENDING',
                idempotency_key TEXT UNIQUE,
                provider_reference TEXT,
                external_reference TEXT,
                phone_number TEXT,
                metadata TEXT,
                failure_reason TEXT,
                timeout_at DATETIME,
                created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME
            );
        `);

        // 3. payment_callbacks table (Duplicate callback protection)
        db.exec(`
            CREATE TABLE IF NOT EXISTS payment_callbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
                provider TEXT NOT NULL,
                provider_reference TEXT NOT NULL,
                result_code INTEGER,
                result_description TEXT,
                raw_payload TEXT NOT NULL,
                is_processed INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_reference)
            );
        `);

        // 4. payment_audit_trail table
        db.exec(`
            CREATE TABLE IF NOT EXISTS payment_audit_trail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_intent_id INTEGER NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
                from_status TEXT,
                to_status TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                actor_id TEXT,
                details TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. payment_refunds table
        db.exec(`
            CREATE TABLE IF NOT EXISTS payment_refunds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                refund_number TEXT NOT NULL UNIQUE,
                payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
                payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
                amount REAL NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'COMPLETED',
                processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 6. Indexes
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_number ON payment_intents(intent_number);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_branch ON payment_intents(branch_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_sale ON payment_intents(sale_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_ref ON payment_intents(provider_reference);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_callbacks_ref ON payment_callbacks(provider, provider_reference);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payment_audit_intent ON payment_audit_trail(payment_intent_id);');
        db.exec('CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(payment_intent_id);');
    } catch (err) {
        console.warn('Payments Engine schema migration notice:', err.message);
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
    migrateInventoryOperationsSchema();
    migrateAdvancedInventorySchema();
    migrateCustomerSchema();
    migratePosShiftSchema();
    migrateOrdersEngineSchema();
    migratePaymentsEngineSchema();
}

// Run non-destructive migrations on load
migrateAuthSchema();
migrateCommerceSchema();
migrateInventoryStatesSchema();
migrateInventoryOperationsSchema();
migrateAdvancedInventorySchema();
migrateCustomerSchema();
migratePosShiftSchema();
migrateOrdersEngineSchema();
migratePaymentsEngineSchema();

module.exports = {
    db,
    initSchema,
    DB_PATH
};


