-- server/db/postgres/migrations/014_fleet_vehicles.sql
-- SwiftTrack Kenya: Phase 9 Logistics & Fleet (9.2 Vehicles) Schema Migration

-- 1. Extend vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make VARCHAR(100) NOT NULL DEFAULT 'Toyota';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year_of_manufacture INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_number VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT 'White';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(30) NOT NULL DEFAULT 'DIESEL';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_tank_capacity_liters NUMERIC(6,2) DEFAULT 70.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(30) NOT NULL DEFAULT 'COMPANY_OWNED';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cargo_volume_cbm NUMERIC(6,2) DEFAULT 6.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_odometer_km NUMERIC(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_odometer_km NUMERIC(10,2) NOT NULL DEFAULT 0.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_odometer_km NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_service_odometer_km NUMERIC(10,2) DEFAULT 5000.0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_service_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS next_service_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Vehicle fuel logs
CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    fuel_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fuel_type VARCHAR(30) NOT NULL DEFAULT 'DIESEL',
    quantity_liters NUMERIC(8,2) NOT NULL,
    cost_per_liter NUMERIC(8,2) NOT NULL,
    total_cost NUMERIC(12,2) NOT NULL,
    odometer_km NUMERIC(10,2) NOT NULL,
    fuel_station VARCHAR(150),
    receipt_voucher_no VARCHAR(100),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CORPORATE_CARD',
    full_tank_flag INTEGER NOT NULL DEFAULT 1,
    calculated_consumption_kml NUMERIC(6,2),
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_vehicle ON vehicle_fuel_logs(vehicle_id);

-- 3. Vehicle maintenance and garage records
CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_number VARCHAR(60) NOT NULL UNIQUE,
    service_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
    service_date DATE NOT NULL,
    odometer_km NUMERIC(10,2) NOT NULL,
    service_provider VARCHAR(150) NOT NULL,
    invoice_reference VARCHAR(100),
    parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0.0,
    labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0.0,
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    description TEXT NOT NULL,
    parts_replaced TEXT,
    next_service_due_date DATE,
    next_service_due_km NUMERIC(10,2),
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maint_vehicle ON vehicle_maintenance_records(vehicle_id);

-- 4. Vehicle mileage and trip logs
CREATE TABLE IF NOT EXISTS vehicle_mileage_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    trip_type VARCHAR(30) NOT NULL DEFAULT 'DELIVERY_RUN',
    start_odometer_km NUMERIC(10,2) NOT NULL,
    end_odometer_km NUMERIC(10,2) NOT NULL,
    distance_km NUMERIC(10,2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_vehicle ON vehicle_mileage_logs(vehicle_id);

-- 5. Vehicle status transition history
CREATE TABLE IF NOT EXISTS vehicle_status_history (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    reason TEXT,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_status_hist ON vehicle_status_history(vehicle_id);

-- 6. Vehicle lookup and filter indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_branch ON vehicles(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(registration_number);
