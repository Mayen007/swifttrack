-- server/db/postgres/migrations/013_fleet_drivers.sql
-- SwiftTrack Kenya: Phase 9 Logistics & Fleet (9.1 Drivers) Schema Migration

-- 1. Extend drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50) UNIQUE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) NOT NULL DEFAULT 'FULL_TIME';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS alt_phone VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Nairobi';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS nhif_number VARCHAR(50);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_classes VARCHAR(100) NOT NULL DEFAULT 'B, C1';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_issue_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_expiry_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ntsa_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ntsa_verification_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 5.0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Driver status transition history
CREATE TABLE IF NOT EXISTS driver_status_history (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    reason TEXT,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_status_hist ON driver_status_history(driver_id);

-- 3. Driver safety and incident logs
CREATE TABLE IF NOT EXISTS driver_incident_logs (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
    incident_date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_incidents ON driver_incident_logs(driver_id);

-- 4. Driver lookup and performance indexes
CREATE INDEX IF NOT EXISTS idx_drivers_branch ON drivers(branch_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_drivers_national_id ON drivers(national_id);
