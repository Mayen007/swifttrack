-- server/db/postgres/migrations/016_shipment_core.sql
-- SwiftTrack Logistics: Stage 2 Shipment Core Domain Schema Migration

-- 1. LOGISTICS PRICING TARIFFS
CREATE TABLE IF NOT EXISTS logistics_pricing_tariffs (
    id SERIAL PRIMARY KEY,
    origin_hub_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    destination_hub_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    service_type VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    
    -- Weight Band Definitions
    base_weight_kg NUMERIC(8, 2) NOT NULL DEFAULT 5.00,
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 350.00,
    per_kg_above_base NUMERIC(12, 2) NOT NULL DEFAULT 50.00,
    
    -- Surcharges
    cod_fee_percent NUMERIC(5, 2) DEFAULT 2.00,
    min_cod_fee NUMERIC(12, 2) DEFAULT 100.00,
    insurance_rate_percent NUMERIC(5, 2) DEFAULT 1.00,
    remote_area_surcharge NUMERIC(12, 2) DEFAULT 0.00,
    
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tariff_route UNIQUE (origin_hub_id, destination_hub_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_tariffs_route ON logistics_pricing_tariffs(origin_hub_id, destination_hub_id, service_type);

-- 2. SHIPMENTS TABLE
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(60) NOT NULL UNIQUE,
    waybill_number VARCHAR(60) UNIQUE,
    
    -- Scope & Route
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    current_hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    current_location_desc VARCHAR(255),

    -- Sender Information
    sender_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sender_name VARCHAR(150) NOT NULL,
    sender_phone VARCHAR(50) NOT NULL,
    sender_email VARCHAR(120),
    sender_address TEXT NOT NULL,
    sender_city VARCHAR(100) NOT NULL,
    
    -- Recipient Information
    recipient_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(120),
    recipient_address TEXT NOT NULL,
    recipient_city VARCHAR(100) NOT NULL,

    -- Service & Configuration
    service_type VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
    delivery_type VARCHAR(40) NOT NULL DEFAULT 'LAST_MILE',
    
    -- Lifecycle State
    status VARCHAR(40) NOT NULL DEFAULT 'BOOKED',
    
    -- Physical Metrics
    total_parcels INTEGER NOT NULL DEFAULT 1,
    actual_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    volumetric_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    chargeable_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    declared_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Financials & Pricing
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    base_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    weight_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    surcharges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Payment Terms & COD
    payment_terms VARCHAR(30) NOT NULL DEFAULT 'PREPAID',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    cod_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cod_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    -- Metadata & Auditing
    special_instructions TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_origin ON shipments(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_destination ON shipments(destination_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_current_hub ON shipments(current_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);

-- 3. PARCELS TABLE
CREATE TABLE IF NOT EXISTS parcels (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_number VARCHAR(80) NOT NULL UNIQUE,
    parcel_index INTEGER NOT NULL DEFAULT 1,
    
    -- Dimensions & Weight
    weight_kg NUMERIC(8, 2) NOT NULL,
    length_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    width_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    height_cm NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    volumetric_weight_kg NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    
    package_type VARCHAR(40) NOT NULL DEFAULT 'BOX',
    description TEXT,
    condition_at_intake VARCHAR(40) NOT NULL DEFAULT 'INTACT',
    intake_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parcels_shipment ON parcels(shipment_id);
CREATE INDEX IF NOT EXISTS idx_parcels_number ON parcels(parcel_number);

-- 4. SHIPMENT LEGS TABLE
CREATE TABLE IF NOT EXISTS shipment_legs (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    leg_sequence INTEGER NOT NULL,
    
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    
    transport_run_id INTEGER,
    manifest_id INTEGER,
    
    -- Cross-Border Attributes
    is_cross_border BOOLEAN NOT NULL DEFAULT FALSE,
    border_post_name VARCHAR(100),
    customs_status VARCHAR(40) DEFAULT 'NOT_APPLICABLE',
    customs_hold_reason TEXT,
    
    scheduled_departure TIMESTAMP WITH TIME ZONE,
    actual_departure TIMESTAMP WITH TIME ZONE,
    scheduled_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_shipment_leg_seq UNIQUE (shipment_id, leg_sequence)
);

CREATE INDEX IF NOT EXISTS idx_shipment_legs_shipment ON shipment_legs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_legs_status ON shipment_legs(status);

-- 5. TRACKING EVENTS TABLE
CREATE TABLE IF NOT EXISTS tracking_events (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    leg_id INTEGER REFERENCES shipment_legs(id) ON DELETE SET NULL,
    
    event_code VARCHAR(60) NOT NULL,
    event_name VARCHAR(120) NOT NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    location_desc VARCHAR(200),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(40) NOT NULL DEFAULT 'STAFF',
    actor_name VARCHAR(120),
    
    description TEXT NOT NULL,
    is_customer_visible BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON tracking_events(shipment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_code ON tracking_events(event_code);

-- 6. IMMUTABILITY ENFORCEMENT ON TRACKING EVENTS
CREATE OR REPLACE FUNCTION enforce_tracking_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: tracking_events is strictly append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tracking_events_immutable ON tracking_events;
CREATE TRIGGER trg_tracking_events_immutable
BEFORE UPDATE OR DELETE ON tracking_events
FOR EACH ROW EXECUTE FUNCTION enforce_tracking_events_immutable();
