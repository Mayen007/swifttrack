// server/repositories/auditRepository.js
// Enterprise Data Access Layer: Append-Only Audit Trail & Compliance Governance

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

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
}

module.exports = new AuditRepository();
