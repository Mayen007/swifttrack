// server/middleware/audit.js
// Enterprise Security & Compliance: Append-Only Audit Logging
const auditRepository = require('../repositories/auditRepository.js');

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
    // Fire-and-forget async write via repository
    auditRepository.log({
        userId,
        role,
        action,
        resource,
        resourceId,
        branchId,
        previousValue,
        newValue,
        reason,
        ipAddress,
        userAgent
    }).catch(err => {
        console.error('Failed to write immutable audit log:', err.message);
    });
}

module.exports = {
    logAuditEvent
};
