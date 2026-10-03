// server/repositories/sessionRepository.js
// Enterprise Data Access Layer: User Sessions, Token Revocation & Refresh Tokens
const dbAdapter = require('../db/dbAdapter.js');

class SessionRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Checks if a token JTI has been added to the revocation blacklist.
     */
    async isTokenRevoked(jti, tx = null) {
        const sql = 'SELECT id FROM revoked_tokens WHERE jti = ? LIMIT 1';
        const row = await dbAdapter.get(sql, [jti], tx?.client);
        return Boolean(row);
    }

    /**
     * Adds a token JTI to the revocation blacklist.
     */
    async revokeToken(jti, userId, expiresAt, tx = null) {
        const sql = `
            INSERT INTO revoked_tokens (jti, user_id, expires_at)
            VALUES (?, ?, ?)
        `;
        return await dbAdapter.run(sql, [jti, userId, expiresAt], tx?.client);
    }

    /**
     * Finds a user session by primary ID and checks if expired.
     */
    async findSessionById(sessionId, tx = null) {
        const sql = `
            SELECT id, user_id, refresh_token_hash, is_active, expires_at,
                   CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN true ELSE false END as is_expired
            FROM user_sessions
            WHERE id = ?
        `;
        return await dbAdapter.get(sql, [sessionId], tx?.client);
    }

    /**
     * Updates session last activity timestamp.
     */
    async touchSession(sessionId, tx = null) {
        const sql = 'UPDATE user_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?';
        return await dbAdapter.run(sql, [sessionId], tx?.client);
    }

    /**
     * Creates a new user session record.
     */
    async createSession(sessionData, tx = null) {
        const sql = `
            INSERT INTO user_sessions (
                id, user_id, refresh_token_hash, ip_address, user_agent, device_info,
                is_active, last_activity_at, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        `;
        const res = await dbAdapter.run(sql, [
            sessionData.id,
            sessionData.user_id,
            sessionData.refresh_token_hash,
            sessionData.ip_address || null,
            sessionData.user_agent || null,
            sessionData.device_info ? JSON.stringify(sessionData.device_info) : null,
            sessionData.expires_at
        ], tx?.client);
        return sessionData.id;
    }

    /**
     * Deactivates/terminates a specific session.
     */
    async terminateSession(sessionId, tx = null) {
        const sql = 'UPDATE user_sessions SET is_active = false WHERE id = ?';
        return await dbAdapter.run(sql, [sessionId], tx?.client);
    }

    /**
     * Deactivates all active sessions for a user.
     */
    async terminateAllUserSessions(userId, tx = null) {
        const sql = 'UPDATE user_sessions SET is_active = false WHERE user_id = ?';
        return await dbAdapter.run(sql, [userId], tx?.client);
    }
}

module.exports = new SessionRepository();
