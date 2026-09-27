-- server/db/postgres/migrations/017_transport_management.sql
-- SwiftTrack Logistics: Stage 3 Transport & Manifest Management Schema Migration

-- 1. ROUTES
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    estimated_duration_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routes_origin_dest ON routes(origin_hub_id, destination_hub_id);

-- 2. ROUTE LEGS
CREATE TABLE IF NOT EXISTS route_legs (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    leg_sequence INTEGER NOT NULL DEFAULT 1,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    distance_km NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    estimated_duration_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_cross_border BOOLEAN NOT NULL DEFAULT FALSE,
    border_post_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_route_leg_seq UNIQUE (route_id, leg_sequence)
);

CREATE INDEX IF NOT EXISTS idx_route_legs_origin_dest ON route_legs(origin_hub_id, destination_hub_id);

-- 3. TRANSPORT RUNS
CREATE TABLE IF NOT EXISTS transport_runs (
    id SERIAL PRIMARY KEY,
    run_number VARCHAR(60) NOT NULL UNIQUE,
    route_leg_id INTEGER REFERENCES route_legs(id) ON DELETE RESTRICT,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatcher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    status VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
    -- PLANNED, READY_FOR_LOADING, LOADING, LOADED, DISPATCHED, IN_TRANSIT,
    -- ARRIVED, UNLOADING, COMPLETED, DELAYED, BREAKDOWN, CANCELLED
    
    scheduled_departure TIMESTAMP WITH TIME ZONE,
    actual_departure TIMESTAMP WITH TIME ZONE,
    scheduled_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    
    current_odometer_km NUMERIC(10, 2) DEFAULT 0.00,
    departure_odometer_km NUMERIC(10, 2) DEFAULT 0.00,
    arrival_odometer_km NUMERIC(10, 2) DEFAULT 0.00,
    
    total_shipments_count INTEGER NOT NULL DEFAULT 0,
    total_parcels_count INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transport_runs_status ON transport_runs(status);
CREATE INDEX IF NOT EXISTS idx_transport_runs_driver ON transport_runs(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_runs_vehicle ON transport_runs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_runs_hubs ON transport_runs(origin_hub_id, destination_hub_id);

-- 4. MANIFESTS
CREATE TABLE IF NOT EXISTS manifests (
    id SERIAL PRIMARY KEY,
    manifest_number VARCHAR(60) NOT NULL UNIQUE,
    transport_run_id INTEGER NOT NULL REFERENCES transport_runs(id) ON DELETE CASCADE,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, OPEN, LOCKED, DISPATCHED, RECEIVED, RECONCILED
    
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    total_shipments INTEGER NOT NULL DEFAULT 0,
    total_parcels INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manifests_run ON manifests(transport_run_id);
CREATE INDEX IF NOT EXISTS idx_manifests_status ON manifests(status);

-- 5. MANIFEST ITEMS
CREATE TABLE IF NOT EXISTS manifest_items (
    id SERIAL PRIMARY KEY,
    manifest_id INTEGER NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    shipment_leg_id INTEGER REFERENCES shipment_legs(id) ON DELETE SET NULL,
    
    loaded_at TIMESTAMP WITH TIME ZONE,
    loaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    received_at TIMESTAMP WITH TIME ZONE,
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    -- ASSIGNED, LOADED, IN_TRANSIT, RECEIVED, SHORTAGE, OVERAGE, DAMAGED
    
    discrepancy_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_manifest_shipment UNIQUE (manifest_id, shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_manifest_items_manifest ON manifest_items(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_items_shipment ON manifest_items(shipment_id);

-- 6. RUN CHECKPOINTS
CREATE TABLE IF NOT EXISTS run_checkpoints (
    id SERIAL PRIMARY KEY,
    transport_run_id INTEGER NOT NULL REFERENCES transport_runs(id) ON DELETE CASCADE,
    checkpoint_name VARCHAR(150) NOT NULL,
    location_desc VARCHAR(200),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    recorded_by_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON run_checkpoints(transport_run_id);

-- 7. TRANSPORT PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
    ('transport:view:all', 'Transport', 'View transport runs across all routes'),
    ('transport:view:own', 'Transport', 'View transport runs touching assigned hub'),
    ('transport:create', 'Transport', 'Create and plan transport runs'),
    ('transport:dispatch', 'Transport', 'Dispatch transport runs with manifest'),
    ('transport:receive', 'Transport', 'Receive and verify transport runs at destination hub')
ON CONFLICT (code) DO NOTHING;
