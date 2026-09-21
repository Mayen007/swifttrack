-- server/db/postgres/migrations/011_payments_engine.sql
-- SwiftTrack Kenya: Phase 7 Payments Engine Schema Migration

-- 1. Extend payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_intent_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(150);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled_by_user_id INTEGER REFERENCES users(id);

-- 2. Create payment_intents table
CREATE TABLE IF NOT EXISTS payment_intents (
    id SERIAL PRIMARY KEY,
    intent_number VARCHAR(60) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    payment_method VARCHAR(30) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(120) UNIQUE,
    provider_reference VARCHAR(150),
    external_reference VARCHAR(150),
    phone_number VARCHAR(30),
    metadata JSONB,
    failure_reason TEXT,
    timeout_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_number ON payment_intents(intent_number);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_branch ON payment_intents(branch_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_sale ON payment_intents(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_ref ON payment_intents(provider_reference);

-- 3. Create payment_callbacks table (Duplicate callback protection)
CREATE TABLE IF NOT EXISTS payment_callbacks (
    id SERIAL PRIMARY KEY,
    payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
    provider VARCHAR(30) NOT NULL,
    provider_reference VARCHAR(150) NOT NULL,
    result_code INTEGER,
    result_description TEXT,
    raw_payload JSONB NOT NULL,
    is_processed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_callbacks_provider_ref UNIQUE (provider, provider_reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_callbacks_ref ON payment_callbacks(provider, provider_reference);

-- 4. Create payment_audit_trail table
CREATE TABLE IF NOT EXISTS payment_audit_trail (
    id SERIAL PRIMARY KEY,
    payment_intent_id INTEGER NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    actor_type VARCHAR(30) NOT NULL,
    actor_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_intent ON payment_audit_trail(payment_intent_id);

-- 5. Create payment_refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
    id SERIAL PRIMARY KEY,
    refund_number VARCHAR(60) NOT NULL UNIQUE,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(payment_intent_id);
