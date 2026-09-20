-- server/db/postgres/migrations/006_inventory_operations.sql
-- SwiftTrack Kenya: Phase 3.2 Inventory Operations Schema Migration

ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity_discrepancy INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS discrepancy_reason TEXT;

CREATE TABLE IF NOT EXISTS stock_receipts (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_invoice_no VARCHAR(100),
    delivery_note_no VARCHAR(100),
    received_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
    id SERIAL PRIMARY KEY,
    stock_receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity_received INTEGER NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    batch_number VARCHAR(100),
    expiry_date DATE,
    condition VARCHAR(50) NOT NULL DEFAULT 'GOOD'
);

CREATE TABLE IF NOT EXISTS stocktakes (
    id SERIAL PRIMARY KEY,
    stocktake_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    count_type VARCHAR(50) NOT NULL DEFAULT 'CYCLE_COUNT',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reconciled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_products_counted INTEGER NOT NULL DEFAULT 0,
    total_variance_units INTEGER NOT NULL DEFAULT 0,
    total_variance_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stocktake_items (
    id SERIAL PRIMARY KEY,
    stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    system_quantity INTEGER NOT NULL DEFAULT 0,
    counted_quantity INTEGER,
    variance_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    variance_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    counted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    counted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS stock_write_offs (
    id SERIAL PRIMARY KEY,
    write_off_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    from_state VARCHAR(50) NOT NULL DEFAULT 'DAMAGED',
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_loss_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reason_category VARCHAR(100) NOT NULL,
    disposal_method VARCHAR(50) NOT NULL DEFAULT 'SCRAPPED',
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_branch ON stock_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_stocktakes_branch ON stocktakes(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_write_offs_branch ON stock_write_offs(branch_id);
