-- server/db/postgres/migrations/015_logistics_hubs_and_foundations.sql
-- SwiftTrack Logistics: Stage 1 Hubs & Foundational Extensions

-- 1. Extend branches with logistics hub capabilities
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_hub BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS hub_type VARCHAR(40) NOT NULL DEFAULT 'REGIONAL_HUB';
-- hub_type: 'ORIGIN_OFFICE', 'TRANSIT_HUB', 'REGIONAL_HUB', 'HEADQUARTERS', 'CROSS_DOCK', 'BORDER_STATION'
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 6);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 6);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{"mon_fri": "08:00-18:00", "sat": "08:00-14:00", "sun": "closed"}';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS max_parcels_capacity INTEGER DEFAULT 5000;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);

-- 2. Principal-Bound Idempotency Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(128) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    CONSTRAINT uq_idempotency_principal_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);

-- 3. Register logistics permissions
INSERT INTO permissions (code, module, description) VALUES
    ('shipments:create', 'Shipments', 'Create new parcel shipment booking'),
    ('shipments:view:all', 'Shipments', 'View shipments organization-wide'),
    ('shipments:view:own', 'Shipments', 'View shipments within assigned hub'),
    ('shipments:cancel', 'Shipments', 'Cancel un-dispatched shipments'),
    ('shipments:status:update', 'Shipments', 'Perform lifecycle state transitions'),
    ('shipments:price:override', 'Shipments', 'Apply discount or custom rating override')
ON CONFLICT (code) DO NOTHING;
