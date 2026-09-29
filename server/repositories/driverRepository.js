// server/repositories/driverRepository.js
// Enterprise Data Access Layer: Drivers, Licensing, Assignments & Safety Compliance

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

class DriverRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a driver by primary ID (Async).
     */
    async findById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM drivers WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a driver by primary ID (Sync).
     */
    findByIdSync(id) {
        if (!sqliteDb) throw new Error('Sync operations only supported under SQLite engine');
        return sqliteDb.prepare('SELECT * FROM drivers WHERE id = ?').get(id) || null;
    }

    /**
     * Finds a driver by linked user account ID (Async).
     */
    async findByUserId(userId, tx = null) {
        return await dbAdapter.get('SELECT * FROM drivers WHERE user_id = ?', [userId], tx?.client);
    }

    /**
     * Finds a driver by license number (Async).
     */
    async findByLicense(licenseNumber, tx = null) {
        return await dbAdapter.get(
            'SELECT * FROM drivers WHERE UPPER(TRIM(license_number)) = UPPER(TRIM(?))',
            [licenseNumber],
            tx?.client
        );
    }

    /**
     * Lists drivers with optional scoping filters (Async).
     */
    async list(filters = {}, tx = null) {
        let sql = `
            SELECT d.*, u.full_name, u.phone, u.email, u.branch_id
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.branchId) {
            sql += ' AND (u.branch_id = ? OR d.assigned_hub_id = ?)';
            params.push(filters.branchId, filters.branchId);
        }
        if (filters.status) {
            sql += ' AND d.status = ?';
            params.push(filters.status);
        }

        sql += ' ORDER BY d.created_at DESC';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Updates driver operational status (Async).
     */
    async updateStatus(id, status, tx = null) {
        const sql = 'UPDATE drivers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [status, id], tx?.client);
    }

    /**
     * Assigns vehicle to driver (Async).
     */
    async assignVehicle(driverId, vehicleId, tx = null) {
        const sql = 'UPDATE drivers SET current_vehicle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [vehicleId, driverId], tx?.client);
    }
}

module.exports = new DriverRepository();
