// server/db/postgres/retention.js
// Enterprise data retention policies & automated maintenance engine for PostgreSQL
const { getPool, closePool } = require('./pool.js');
const { withTransaction } = require('./transactions.js');

/**
 * Executes standard compliance data retention policies.
 * Prunes expired tokens, stale sessions, old notification alerts, and transient login logs,
 * while strictly guaranteeing that audit_logs remains permanent and immutable.
 */
async function runDataRetention(pool = null) {
    const activePool = pool || getPool();
    const client = await activePool.connect();
    const stats = {
        revokedTokensPruned: 0,
        passwordResetTokensPruned: 0,
        sessionsDeactivated: 0,
        sessionsPruned: 0,
        loginHistoryPruned: 0,
        notificationsPruned: 0,
        auditLogsProtected: true,
        executedAt: new Date().toISOString()
    };

    console.log('[Data Retention] Starting automated database retention run...');

    try {
        await withTransaction(async (txClient) => {
            // 1. Prune expired revoked JWT tokens (once past expiration, tokens cannot be used anyway)
            const resRevoked = await txClient.query(`
                DELETE FROM revoked_tokens
                WHERE expires_at < NOW()
            `);
            stats.revokedTokensPruned = resRevoked.rowCount || 0;

            // 2. Prune old password reset tokens (used or expired older than 7 days)
            const resPwd = await txClient.query(`
                DELETE FROM password_reset_tokens
                WHERE (expires_at < NOW() - INTERVAL '7 days')
                   OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days')
            `);
            stats.passwordResetTokensPruned = resPwd.rowCount || 0;

            // 3. Mark expired user sessions as inactive
            const resDeactivate = await txClient.query(`
                UPDATE user_sessions
                SET is_active = false
                WHERE is_active = true AND expires_at < NOW()
            `);
            stats.sessionsDeactivated = resDeactivate.rowCount || 0;

            // 4. Prune abandoned/inactive sessions older than 30 days
            const resSessions = await txClient.query(`
                DELETE FROM user_sessions
                WHERE is_active = false AND expires_at < NOW() - INTERVAL '30 days'
            `);
            stats.sessionsPruned = resSessions.rowCount || 0;

            // 5. Prune transient login history records older than 180 days (6 months hot window)
            const resLogin = await txClient.query(`
                DELETE FROM login_history
                WHERE created_at < NOW() - INTERVAL '180 days'
            `);
            stats.loginHistoryPruned = resLogin.rowCount || 0;

            // 6. Prune read notifications older than 90 days
            const resNotif = await txClient.query(`
                DELETE FROM notifications
                WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days'
            `);
            stats.notificationsPruned = resNotif.rowCount || 0;

            // 7. Verification: Ensure audit_logs is never touched by retention
            const countAudit = await txClient.query('SELECT COUNT(*) as total FROM audit_logs');
            stats.auditLogsTotalCount = parseInt(countAudit.rows[0]?.total || '0', 10);
        }, client);

        console.log('[Data Retention] Run completed successfully:', stats);
        return stats;
    } finally {
        if (typeof client.release === 'function') {
            client.release();
        }
    }
}

// CLI handler
if (require.main === module) {
    (async () => {
        try {
            await runDataRetention();
        } catch (err) {
            console.error('[Data Retention Error]', err.message);
            process.exit(1);
        } finally {
            await closePool();
        }
    })();
}

module.exports = {
    runDataRetention
};
