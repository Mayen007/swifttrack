// server/middleware/audit.js
const { db } = require('../db/database.js');

/**
 * Append-only Audit Logger
 * Records mutating actions across the platform with previous and new values, reason, user, role, and branch
 */
function logAuditEvent({
    userId,
    role,
    action,
    resource,
    resourceId,
    branchId = null,
    previousValue = null,
    newValue = null,
    reason = null,
    ipAddress = '127.0.0.1',
    userAgent = 'Platform API'
}) {
    try {
        const prevJson = previousValue ? (typeof previousValue === 'string' ? previousValue : JSON.stringify(previousValue)) : null;
        const newJson = newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null;

        db.prepare(`
            INSERT INTO audit_logs (
                user_id, role, action, resource, resource_id, branch_id,
                previous_value, new_value, reason, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            userId || null,
            role || 'SYSTEM',
            action,
            resource,
            resourceId ? String(resourceId) : null,
            branchId || null,
            prevJson,
            newJson,
            reason || null,
            ipAddress,
            userAgent
        );
    } catch (err) {
        console.error('Failed to write immutable audit log:', err.message);
    }
}

module.exports = {
    logAuditEvent
};
