-- server/db/postgres/migrations/019_last_mile_delivery_and_exceptions.sql
-- Stage 5: Last-Mile Delivery, Multi-Attempt Deliveries, POD Evidence & Centralized Exceptions

-- 1. Enhance DELIVERIES table to support shipments and multi-attempts
ALTER TABLE deliveries 
    ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50) DEFAULT 'LAST_MILE',
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3,
    ADD COLUMN IF NOT EXISTS pod_required_methods VARCHAR(100) DEFAULT 'SIGNATURE,GPS',
    ADD COLUMN IF NOT EXISTS destination_address VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destination_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS cod_amount_expected DECIMAL(12, 2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS cod_amount_collected DECIMAL(12, 2) DEFAULT 0.0,
    ALTER COLUMN order_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_shipment_id ON deliveries(shipment_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_hub_id ON deliveries(hub_id);


-- 2. DELIVERY ATTEMPTS (Tracking individual delivery visits & failure reasons)
CREATE TABLE IF NOT EXISTS delivery_attempts (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'RESCHEDULED'
    failure_reason VARCHAR(100), -- 'RECIPIENT_UNAVAILABLE', 'WRONG_ADDRESS', 'RECIPIENT_REFUSED', 'SECURITY_ACCESS_DENIED', 'CUSTOMER_REQUESTED_RESCHEDULE', 'PAYMENT_FAILED_COD', 'DAMAGED_ON_DELIVERY', 'WEATHER_ACCESS_BLOCKED'
    failure_notes TEXT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    rescheduled_for TIMESTAMPTZ,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery ON delivery_attempts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_shipment ON delivery_attempts(shipment_id);


-- 3. Enhance PROOF_OF_DELIVERY table
ALTER TABLE proof_of_delivery
    ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pod_shipment_id ON proof_of_delivery(shipment_id);

-- Immutability enforcement on proof_of_delivery (Rule POD-005)
CREATE OR REPLACE FUNCTION enforce_pod_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Violation: proof_of_delivery records are legally binding evidence and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_pod_mutation ON proof_of_delivery;
CREATE TRIGGER trg_prevent_pod_mutation
BEFORE UPDATE OR DELETE ON proof_of_delivery
FOR EACH ROW
EXECUTE FUNCTION enforce_pod_immutability();


-- 4. EXCEPTIONS (Centralized operational exception management)
CREATE TABLE IF NOT EXISTS exceptions (
    id SERIAL PRIMARY KEY,
    exception_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. EXC-YYYYMMDD-XXXX
    exception_type VARCHAR(50) NOT NULL, -- 'DELIVERY_FAILURE', 'DELAYED_TRANSIT', 'MISROUTED', 'LOST_PACKAGE', 'DAMAGED_PACKAGE', 'COD_VARIANCE', 'PAYMENT_FAILURE', 'CUSTOMS_HOLD'
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'
    description TEXT NOT NULL,
    root_cause TEXT,
    resolution_notes TEXT,
    reported_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exceptions_shipment ON exceptions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_delivery ON exceptions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_type ON exceptions(exception_type);
