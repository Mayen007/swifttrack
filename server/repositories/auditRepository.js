// server/repositories/auditRepository.js
// Enterprise Data Access Layer: Append-Only Audit Trail & Compliance Governance

const dbAdapter = require('../db/dbAdapter.js');

class AuditRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Appends an immutable audit log record (Async).
     */
    async log(auditData, tx = null) {
        const sql = `
            INSERT INTO audit_logs (
                user_id, role, action, resource, resource_id,
                branch_id, previous_value, new_value, reason, ip_address, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const params = [
            auditData.userId || null,
            auditData.role || 'SYSTEM',
            auditData.action,
            auditData.resource,
            auditData.resourceId ? String(auditData.resourceId) : null,
            auditData.branchId || null,
            auditData.previousValue ? JSON.stringify(auditData.previousValue) : null,
            auditData.newValue ? JSON.stringify(auditData.newValue) : null,
            auditData.reason || null,
            auditData.ipAddress || null
        ];

        return await dbAdapter.run(sql, params, tx?.client);
    }

    /**
     * Queries audit logs with filtering and pagination (Async).
     */
    async query(filters = {}, tx = null) {
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (filters.resource) {
            sql += ' AND resource = ?';
            params.push(filters.resource);
        }
        if (filters.resourceId) {
            sql += ' AND resource_id = ?';
            params.push(String(filters.resourceId));
        }
        if (filters.action) {
            sql += ' AND action = ?';
            params.push(filters.action);
        }
        if (filters.branchId) {
            sql += ' AND branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.userId) {
            sql += ' AND user_id = ?';
            params.push(filters.userId);
        }

        sql += ' ORDER BY created_at DESC';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Queries audit logs with user and branch join info (Async).
     */
    async queryWithJoins(filters = {}, tx = null) {
        let sql = `
            SELECT a.*, u.full_name as user_full_name, u.username,
                   b.name as branch_name, b.code as branch_code
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            LEFT JOIN branches b ON a.branch_id = b.id
        `;
        const params = [];
        const where = [];

        if (filters.branchId) {
            where.push('(a.branch_id = ? OR a.branch_id IS NULL)');
            params.push(filters.branchId);
        }
        if (filters.resource) {
            where.push('a.resource = ?');
            params.push(filters.resource);
        }
        if (filters.action) {
            where.push('a.action = ?');
            params.push(filters.action);
        }
        if (filters.date) {
            where.push('CAST(a.created_at AS DATE) = CAST(? AS DATE)');
            params.push(filters.date);
        }

        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }

        sql += ' ORDER BY a.id DESC LIMIT 150';
        return await dbAdapter.all(sql, params, tx?.client);
    }

    /**
     * Queries failed login attempt telemetry (Async).
     */
    async queryFailedLogins(filters = {}, tx = null) {
        let sql = `
            SELECT lh.id, lh.user_id, lh.username_attempted, lh.status, lh.failure_reason,
                   lh.ip_address, lh.user_agent, lh.created_at, lh.branch_id,
                   b.name as branch_name, b.code as branch_code
            FROM login_history lh
            LEFT JOIN branches b ON lh.branch_id = b.id
            WHERE lh.status != 'SUCCESS'
        `;
        const params = [];

        if (filters.branchId) {
            sql += ' AND (lh.branch_id = ? OR lh.branch_id IS NULL)';
            params.push(filters.branchId);
        }

        sql += ' ORDER BY lh.created_at DESC LIMIT 100';
        return await dbAdapter.all(sql, params, tx?.client);
    }
}

module.exports = new AuditRepository();
