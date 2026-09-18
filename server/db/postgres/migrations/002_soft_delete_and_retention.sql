-- Migration 002: Soft Deletion and Data Retention Columns
-- Up migration: Adds soft deletion columns and partial unique indexes to master entities

-- 1. Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 2. Branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 3. Warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 4. Product Categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 5. Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 6. Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- 7. Vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL;

-- Partial unique indexes for active master entities (enabling safe re-use if soft-deleted)
CREATE INDEX IF NOT EXISTS idx_users_active_unique ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku_active ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode_active ON products(barcode) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone_active ON customers(phone) WHERE deleted_at IS NULL;
