// server/repositories/branchRepository.js
// Enterprise Data Access Layer: Branches, Hubs, & Warehouses
const dbAdapter = require('../db/dbAdapter.js');

class BranchRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds a branch by primary ID.
     */
    async findById(id, tx = null) {
        const sql = 'SELECT * FROM branches WHERE id = ?';
        return await dbAdapter.get(sql, [id], tx?.client);
    }

    /**
     * Finds a branch by code.
     */
    async findByCode(code, tx = null) {
        const sql = 'SELECT * FROM branches WHERE code = ?';
        return await dbAdapter.get(sql, [code], tx?.client);
    }

    /**
     * Lists all active branches.
     */
    async listAll(activeOnly = true, tx = null) {
        let sql = 'SELECT * FROM branches';
        if (activeOnly) {
            sql += ' WHERE is_active = true';
        }
        sql += ' ORDER BY id ASC';
        return await dbAdapter.all(sql, [], tx?.client);
    }

    /**
     * Creates a new branch.
     */
    async create(branchData, tx = null) {
        const sql = `
            INSERT INTO branches (name, code, city, address, phone, email, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const res = await dbAdapter.run(sql, [
            branchData.name,
            branchData.code,
            branchData.city,
            branchData.address || null,
            branchData.phone || null,
            branchData.email || null,
            branchData.is_active !== undefined ? branchData.is_active : true
        ], tx?.client);
        return res.insertId;
    }

    /**
     * Updates an existing branch.
     */
    async update(id, branchData, tx = null) {
        const sql = `
            UPDATE branches
            SET name = ?, code = ?, city = ?, address = ?, phone = ?, email = ?,
                is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [
            branchData.name,
            branchData.code,
            branchData.city,
            branchData.address || null,
            branchData.phone || null,
            branchData.email || null,
            branchData.is_active !== undefined ? branchData.is_active : true,
            id
        ], tx?.client);
    }

    /**
     * Finds branches with metrics for Super Admin.
     */
    async findWithMetrics(filters = {}, tx = null) {
        const where = [];
        const params = [];

        if (filters.city) {
            where.push('b.city = ?');
            params.push(filters.city);
        }
        if (filters.search) {
            where.push('(b.name ILIKE ? OR b.code ILIKE ? OR b.city ILIKE ?)');
            const s = `%${filters.search.trim()}%`;
            params.push(s, s, s);
        }
        if (filters.isActive !== undefined) {
            where.push('b.is_active = ?');
            params.push(Boolean(filters.isActive));
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const sql = `
            SELECT b.*,
                   (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = true) as staff_count,
                   (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = true) as warehouse_count,
                   (SELECT count(*) FROM orders WHERE branch_id = b.id) as total_orders
            FROM branches b
            ${whereSql}
            ORDER BY b.id ASC
        `;
        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Operational staff branch directory query.
     */
    async findForStaff(userBranchId, filters = {}, tx = null) {
        const where = ['b.is_active = true'];
        const params = [userBranchId || 0, userBranchId || 0];

        if (filters.city) {
            where.push('b.city = ?');
            params.push(filters.city);
        }
        if (filters.search) {
            where.push('(b.name ILIKE ? OR b.code ILIKE ? OR b.city ILIKE ?)');
            const s = `%${filters.search.trim()}%`;
            params.push(s, s, s);
        }

        const whereSql = `WHERE ${where.join(' AND ')}`;
        const sql = `
            SELECT b.id, b.code, b.name, b.city, b.address, b.phone, b.email, b.is_active,
                   CASE WHEN b.id = ? THEN (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = true) ELSE 0 END as staff_count,
                   (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = true) as warehouse_count,
                   CASE WHEN b.id = ? THEN (SELECT count(*) FROM orders WHERE branch_id = b.id) ELSE 0 END as total_orders
            FROM branches b
            ${whereSql}
            ORDER BY b.id ASC
        `;
        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Finds single branch with staff and warehouse counts.
     */
    async findByIdWithMetrics(id, tx = null) {
        const sql = `
            SELECT b.*,
                   (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = true) as staff_count,
                   (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = true) as warehouse_count
            FROM branches b
            WHERE b.id = ?
        `;
        return await dbAdapter.get(sql, [id], tx?.client);
    }

    /**
     * Lists active warehouses for a branch.
     */
    async getWarehousesByBranchId(branchId, tx = null) {
        const sql = 'SELECT * FROM warehouses WHERE branch_id = ? AND is_active = true ORDER BY id ASC';
        return await dbAdapter.all(sql, [branchId], tx?.client);
    }

    /**
     * Creates a new warehouse for a branch.
     */
    async createWarehouse(warehouseData, tx = null) {
        const sql = `
            INSERT INTO warehouses (branch_id, code, name, location_desc, is_active)
            VALUES (?, ?, ?, ?, true)
        `;
        const res = await dbAdapter.run(sql, [
            warehouseData.branch_id,
            warehouseData.code.toUpperCase().trim(),
            warehouseData.name.trim(),
            warehouseData.location_desc || 'Main Depot'
        ], tx?.client);
        return res.insertId;
    }
}

module.exports = new BranchRepository();
