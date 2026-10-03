// server/repositories/vehicleRepository.js
// Enterprise Data Access Layer: Vehicles, Telemetry, Maintenance & Fuel Logs

const dbAdapter = require('../db/dbAdapter.js');

class VehicleRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a vehicle by primary ID (Async).
     */
    async findById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM vehicles WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a vehicle by registration plate (Async).
     */
    async findByRegistration(registrationNumber, tx = null) {
        return await dbAdapter.get(
            'SELECT * FROM vehicles WHERE UPPER(TRIM(registration_number)) = UPPER(TRIM(?))',
            [registrationNumber],
            tx?.client
        );
    }

    /**
     * Lists vehicles with optional filtering (Async).
     */
    async list(filters = {}, tx = null) {
        let sql = 'SELECT * FROM vehicles WHERE 1=1';
        const params = [];

        if (filters.branchId) {
            sql += ' AND branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.vehicleType) {
            sql += ' AND vehicle_type = ?';
            params.push(filters.vehicleType);
        }
        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }

        sql += ' ORDER BY created_at DESC';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Inserts a new vehicle record (Async).
     */
    async create(data, tx = null) {
        const sql = `
            INSERT INTO vehicles (
                registration_number, vehicle_type, make, model, year_of_manufacture,
                chassis_number, engine_number, color, fuel_type, fuel_tank_capacity_liters,
                ownership_type, capacity_kg, cargo_volume_cbm, initial_odometer_km,
                current_odometer_km, next_service_odometer_km, next_service_date,
                branch_id, assigned_driver_id, status, is_active, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.registration_number, data.vehicle_type || 'VAN', data.make, data.model,
            data.year_of_manufacture || null, data.chassis_number || null, data.engine_number || null,
            data.color || null, data.fuel_type || 'DIESEL', data.fuel_tank_capacity_liters || null,
            data.ownership_type || 'COMPANY_OWNED', data.capacity_kg || 1000, data.cargo_volume_cbm || 5.0,
            data.initial_odometer_km || 0, data.current_odometer_km || data.initial_odometer_km || 0,
            data.next_service_odometer_km || null, data.next_service_date || null,
            data.branch_id, data.assigned_driver_id || null, data.status || 'AVAILABLE',
            data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1, data.notes || null
        ];

        const res = await dbAdapter.run(sql, params, tx?.client);
        return res.insertId;
    }

    /**
     * Updates vehicle status (Async).
     */
    async updateStatus(id, status, reason = null, tx = null) {
        const sql = 'UPDATE vehicles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [status, id], tx?.client);
    }

    /**
     * Updates vehicle odometer & telemetry (Async).
     */
    async updateOdometer(id, newOdometerKm, tx = null) {
        const sql = 'UPDATE vehicles SET current_odometer_km = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [newOdometerKm, id], tx?.client);
    }
}

module.exports = new VehicleRepository();
