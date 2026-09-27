-- server/db/postgres/migrations/018_physical_custody_and_hub_operations.sql
-- Stage 4: Physical Custody, Barcode Scans, Handoffs, Hub Receiving, and Discrepancies

-- 1. SCAN EVENTS (High-throughput Barcode/QR scan events)
CREATE TABLE IF NOT EXISTS scan_events (
    id SERIAL PRIMARY KEY,
    scan_uuid VARCHAR(64) UNIQUE NOT NULL, -- Client-generated UUID for offline sync idempotency
    barcode VARCHAR(100) NOT NULL,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    scan_type VARCHAR(50) NOT NULL, -- 'INTAKE', 'RECEIVE', 'SORT', 'LOAD', 'UNLOAD', 'CHECKPOINT', 'DELIVERY_ATTEMPT', 'DELIVERY_SUCCESS', 'RETURN', 'AUDIT'
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    location_desc VARCHAR(255),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    device_id VARCHAR(100),
    app_version VARCHAR(50),
    scanned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_offline_sync BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_scan_events_barcode ON scan_events(barcode);
CREATE INDEX IF NOT EXISTS idx_scan_events_shipment_id ON scan_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_hub_id ON scan_events(hub_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_type ON scan_events(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_events_scanned_at ON scan_events(scanned_at);

-- Immutability enforcement on scan_events
CREATE OR REPLACE FUNCTION enforce_scan_events_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit Violation: scan_events is an immutable chain-of-custody ledger. Updates and deletions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_scan_events_mutation ON scan_events;
CREATE TRIGGER trg_prevent_scan_events_mutation
BEFORE UPDATE OR DELETE ON scan_events
FOR EACH ROW
EXECUTE FUNCTION enforce_scan_events_immutability();


-- 2. CUSTODY HANDOFFS (Physical chain of custody transfers between actors)
CREATE TABLE IF NOT EXISTS handoffs (
    id SERIAL PRIMARY KEY,
    handoff_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. HND-YYYYMMDD-XXXX
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    handoff_type VARCHAR(50) NOT NULL, -- 'INTAKE_TO_HUB', 'HUB_TO_DRIVER', 'DRIVER_TO_HUB', 'HUB_TO_LAST_MILE', 'DRIVER_TO_RECIPIENT', 'HUB_TRANSFER'
    releasing_actor_type VARCHAR(50) NOT NULL, -- 'CUSTOMER', 'AGENT', 'HUB_OPERATOR', 'DRIVER'
    releasing_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    releasing_actor_name VARCHAR(150) NOT NULL,
    receiving_actor_type VARCHAR(50) NOT NULL, -- 'AGENT', 'HUB_OPERATOR', 'DRIVER', 'RECIPIENT'
    receiving_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receiving_actor_name VARCHAR(150) NOT NULL,
    package_condition VARCHAR(50) NOT NULL DEFAULT 'GOOD', -- 'GOOD', 'DAMAGED_EXTERNAL', 'DAMAGED_CRUSHED', 'TAMPERED_SEAL', 'LEAKING'
    seal_number VARCHAR(100),
    verification_method VARCHAR(50) NOT NULL DEFAULT 'BARCODE_SCAN', -- 'BARCODE_SCAN', 'SIGNATURE', 'PIN_OTP', 'VISUAL_INSPECTION'
    signature_data TEXT,
    notes TEXT,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handoffs_shipment_id ON handoffs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_hub_id ON handoffs(hub_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_number ON handoffs(handoff_number);


-- 3. HUB RECEIVING SESSIONS (Receiving station sessions for inbound runs/drop-offs)
CREATE TABLE IF NOT EXISTS hub_receiving_sessions (
    id SERIAL PRIMARY KEY,
    session_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. RCV-YYYYMMDD-XXXX
    hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    station_bay VARCHAR(100),
    operator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'RECONCILED', 'COMPLETED', 'DISCREPANCY_FLAGGED'
    expected_packages_count INTEGER NOT NULL DEFAULT 0,
    scanned_packages_count INTEGER NOT NULL DEFAULT 0,
    intact_count INTEGER NOT NULL DEFAULT 0,
    damaged_count INTEGER NOT NULL DEFAULT 0,
    unexpected_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receiving_sessions_hub ON hub_receiving_sessions(hub_id);
CREATE INDEX IF NOT EXISTS idx_receiving_sessions_run ON hub_receiving_sessions(transport_run_id);
CREATE INDEX IF NOT EXISTS idx_receiving_sessions_status ON hub_receiving_sessions(status);


-- 4. HUB RECEIVING ITEMS (Individual scan records within a receiving session)
CREATE TABLE IF NOT EXISTS hub_receiving_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES hub_receiving_sessions(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    barcode VARCHAR(100) NOT NULL,
    is_expected BOOLEAN NOT NULL DEFAULT TRUE,
    condition VARCHAR(50) NOT NULL DEFAULT 'GOOD', -- 'GOOD', 'DAMAGED', 'TAMPERED', 'LEAKING'
    condition_notes TEXT,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receiving_items_session ON hub_receiving_items(session_id);
CREATE INDEX IF NOT EXISTS idx_receiving_items_shipment ON hub_receiving_items(shipment_id);


-- 5. DISCREPANCIES (Physical inventory variations & exception investigations)
CREATE TABLE IF NOT EXISTS discrepancies (
    id SERIAL PRIMARY KEY,
    discrepancy_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. DISC-YYYYMMDD-XXXX
    discrepancy_type VARCHAR(50) NOT NULL, -- 'MISSING_MANIFEST_ITEM', 'UNEXPECTED_OVERAGE', 'DAMAGED_PACKAGE', 'TAMPERED_SEAL', 'WRONG_DESTINATION_MISROUTED', 'WEIGHT_MISMATCH'
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    receiving_session_id INTEGER REFERENCES hub_receiving_sessions(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'WRITTEN_OFF'
    description TEXT NOT NULL,
    reported_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investigator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_action VARCHAR(100), -- 'FOUND_AND_MERGED', 'DAMAGED_CUSTOMER_NOTIFIED', 'RETURNED_TO_SENDER', 'CLAIM_APPROVED', 'FALSE_ALARM'
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discrepancies_hub ON discrepancies(hub_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_shipment ON discrepancies(shipment_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_discrepancies_type ON discrepancies(discrepancy_type);
