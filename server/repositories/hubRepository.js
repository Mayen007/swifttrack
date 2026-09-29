// server/repositories/hubRepository.js
// Enterprise Data Access Layer: Regional Hubs, Branches, Warehouses & Network Facilities

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

class HubRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a hub/branch by primary ID (Async).
     */
    async findById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM branches WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds a hub/branch by primary ID (Sync).
     */
    findByIdSync(id) {
        if (!sqliteDb) throw new Error('Sync operations only supported under SQLite engine');
        return sqliteDb.prepare('SELECT * FROM branches WHERE id = ?').get(id) || null;
    }

    /**
     * Finds a hub by branch code (Async).
     */
    async findByCode(code, tx = null) {
        return await dbAdapter.get('SELECT * FROM branches WHERE UPPER(code) = UPPER(?)', [code], tx?.client);
    }

    /**
     * Lists all operational hubs and branches (Async).
     */
    async listAll(activeOnly = true, tx = null) {
        let sql = 'SELECT * FROM branches';
        const params = [];
        if (activeOnly) {
            sql += ' WHERE is_active = ?';
            params.push(1);
        }
        sql += ' ORDER BY id ASC';
        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Finds warehouses associated with a hub (Async).
     */
    async findWarehousesByHub(hubId, tx = null) {
        return await dbAdapter.all('SELECT * FROM warehouses WHERE branch_id = ? AND is_active = 1', [hubId], tx?.client);
    }
}

module.exports = new HubRepository();
