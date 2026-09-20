-- server/db/postgres/migrations/007_advanced_inventory.sql
-- SwiftTrack Kenya: Phase 3.3 Advanced Inventory Schema Migration

-- 1. Product enhancements (Costing strategy and serial tracking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS costing_method VARCHAR(50) NOT NULL DEFAULT 'FIFO';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Inventory enhancements (Moving average cost)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS average_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE variant_inventory ADD COLUMN IF NOT EXISTS average_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00;

-- 3. Sale items enhancements (COGS and batch/serial linkages)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cogs_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS batch_id INTEGER;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

-- 4. Sales enhancements (COGS and margins)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_cogs NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC(8,2) NOT NULL DEFAULT 0.00;

-- 5. Batch / Lot Tracking
CREATE TABLE IF NOT EXISTS inventory_batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    receipt_item_id INTEGER REFERENCES stock_receipt_items(id) ON DELETE SET NULL,
    initial_quantity INTEGER NOT NULL,
    quantity_available INTEGER NOT NULL,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    manufacturing_date DATE,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id, batch_number)
);

-- 6. Serial Numbers
CREATE TABLE IF NOT EXISTS inventory_serials (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    allocated_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    allocated_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_product_wh ON inventory_batches(product_id, warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON inventory_batches(expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_serials_product_wh ON inventory_serials(product_id, warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_serials_batch ON inventory_serials(batch_id);
