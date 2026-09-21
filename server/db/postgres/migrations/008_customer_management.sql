-- server/db/postgres/migrations/008_customer_management.sql
-- SwiftTrack Kenya: Phase 4.1 Customer Management Schema Migration

-- 1. Customers status enhancement
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- 2. Customer delivery addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_label VARCHAR(100) NOT NULL DEFAULT 'Primary',
    address_line TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Nairobi',
    contact_name VARCHAR(150),
    contact_phone VARCHAR(50),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- 3. Customer structured notes
CREATE TABLE IF NOT EXISTS customer_notes (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    note_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
