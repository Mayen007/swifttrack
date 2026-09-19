// server/services/authService.js
// Authentication & Identity Service Helpers
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { getJwtSecret } = require('../utils/env.js');
const { generateSecureRandom, sha256Hash } = require('../utils/security.js');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Record a login event in the audit login_history table
 */
function recordLoginAttempt({ userId = null, username, status, failureReason = null, req, branchId = null }) {
    try {
        const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Unknown Client';

        db.prepare(`
            INSERT INTO login_history (
                user_id, username_attempted, status, failure_reason, ip_address, user_agent, branch_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(userId, username, status, failureReason, ip, userAgent, branchId);
    } catch (err) {
        console.warn('Failed to record login history:', err.message);
    }
}

/**
 * Issue new access & refresh tokens and persist active session
 */
function createSessionAndTokens(user, req) {
    const secret = getJwtSecret();
    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const refreshToken = generateSecureRandom(32);
    const refreshTokenHash = sha256Hash(refreshToken);

    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser Client';

    // Persist session
    db.prepare(`
        INSERT INTO user_sessions (
            id, user_id, refresh_token_hash, ip_address, user_agent, device_info,
            is_active, last_activity_at, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, datetime('now', '+${REFRESH_TOKEN_EXPIRY_DAYS} days'), CURRENT_TIMESTAMP)
    `).run(sessionId, user.id, refreshTokenHash, ip, userAgent, userAgent.substring(0, 50));

    const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role_name,
        branchId: user.branch_id,
        sessionId,
        jti,
        tokenVersion: user.token_version || 1
    };

    const token = jwt.sign(tokenPayload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });

    return {
        token,
        refreshToken,
        sessionId,
        expiresInSeconds: 15 * 60
    };
}

/**
 * Hydrates complete user profile object for client responses
 */
function formatUserResponse(user) {
    // Fetch role permissions
    const permissionsRows = db.prepare(`
        SELECT p.code
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        JOIN roles r ON rp.role_id = r.id
        WHERE r.name = ?
    `).all(user.role_name);

    const permissions = permissionsRows.map(p => p.code);

    let driverProfile = null;
    if (user.role_name === 'DRIVER') {
        driverProfile = db.prepare('SELECT id, license_number, vehicle_id, status FROM drivers WHERE user_id = ?').get(user.id);
    }

    return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        branchId: user.branch_id,
        branchName: user.branch_name,
        branchCode: user.branch_code,
        branchCity: user.branch_city,
        roleName: user.role_name,
        roleDisplayName: user.role_display_name,
        mustChangePassword: Boolean(user.must_change_password),
        twoFactorEnabled: Boolean(user.two_factor_enabled),
        lastLoginAt: user.last_login_at,
        passwordChangedAt: user.password_changed_at,
        permissions,
        driverProfile
    };
}

module.exports = {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_MINUTES,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_DAYS,
    recordLoginAttempt,
    createSessionAndTokens,
    formatUserResponse,
};
