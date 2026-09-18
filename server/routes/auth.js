// server/routes/auth.js
// Production Authentication & Identity Security Engine
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { authenticateToken } = require('../middleware/auth.js');
const { getJwtSecret } = require('../utils/env.js');
const { logAuditEvent } = require('../middleware/audit.js');
const {
    hashPassword,
    verifyPassword,
    generateSecureRandom,
    sha256Hash,
    validatePasswordStrength
} = require('../utils/security.js');
const {
    generateSecret,
    getOtpAuthUri,
    verifyTotp,
    generateRecoveryCodes,
    verifyRecoveryCode
} = require('../utils/totp.js');

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

// -----------------------------------------------------------------------------
// 1. PUBLIC PLATFORM CONFIGURATION
// -----------------------------------------------------------------------------
router.get('/config', (req, res) => {
    res.json({
        demoMode: process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production',
        currency: 'KES',
        vatRate: 16.0,
        etimsEnabled: true,
        companyName: 'SwiftTrack Kenya Logistics Ltd',
        passwordMinLength: process.env.NODE_ENV === 'production' ? 12 : 10,
        twoFactorAvailable: true
    });
});

// -----------------------------------------------------------------------------
// 2. CREDENTIAL AUTHENTICATION & LOGIN
// -----------------------------------------------------------------------------
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    const user = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.password_hash, u.is_active,
               u.failed_login_attempts, u.locked_until, u.token_version, u.must_change_password,
               (u.locked_until IS NOT NULL AND datetime(u.locked_until) > datetime(CURRENT_TIMESTAMP)) as is_locked,
               u.two_factor_enabled, u.two_factor_secret, u.two_factor_recovery_codes,
               u.password_changed_at, u.last_login_at,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?)
    `).get(cleanUsername, cleanUsername);

    if (!user) {
        recordLoginAttempt({ username: cleanUsername, status: 'FAILED_USER_NOT_FOUND', failureReason: 'User not found', req });
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 1. Account Inactive Check
    if (!user.is_active) {
        recordLoginAttempt({ userId: user.id, username: user.username, status: 'ACCOUNT_INACTIVE', failureReason: 'Account deactivated', req, branchId: user.branch_id });
        return res.status(403).json({ error: 'User account has been deactivated. Please contact Super Admin.' });
    }

    // 2. Account Lockout Check
    if (user.is_locked) {
        const lockedUntilUtc = user.locked_until.endsWith('Z')
            ? user.locked_until
            : user.locked_until.replace(' ', 'T') + 'Z';
        const remainingMs = new Date(lockedUntilUtc).getTime() - Date.now();
        const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

        recordLoginAttempt({ userId: user.id, username: user.username, status: 'ACCOUNT_LOCKED', failureReason: 'Attempt while locked', req, branchId: user.branch_id });
        return res.status(423).json({
            error: `Account is temporarily locked due to consecutive failed attempts. Please try again in ${remainingMinutes} minute(s) or contact administrator.`,
            remainingMinutes
        });
    } else if (user.locked_until) {
        // Lockout expired, reset counter
        db.prepare('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
        user.failed_login_attempts = 0;
        user.locked_until = null;
    }

    // 3. Password Verification
    const verification = verifyPassword(password, user.password_hash);
    if (!verification.isValid) {
        const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
        let isNowLocked = false;
        let lockUntilSql = null;

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            isNowLocked = true;
            db.prepare(`
                UPDATE users
                SET failed_login_attempts = ?, locked_until = datetime('now', '+${LOCKOUT_MINUTES} minutes')
                WHERE id = ?
            `).run(newFailedAttempts, user.id);

            recordLoginAttempt({
                userId: user.id,
                username: user.username,
                status: 'ACCOUNT_LOCKED',
                failureReason: `Exceeded ${MAX_FAILED_ATTEMPTS} attempts`,
                req,
                branchId: user.branch_id
            });

            logAuditEvent({
                userId: user.id,
                role: user.role_name,
                action: 'ACCOUNT_LOCKED',
                resource: 'USER',
                resourceId: String(user.id),
                branchId: user.branch_id,
                reason: `Account locked for ${LOCKOUT_MINUTES}m after ${MAX_FAILED_ATTEMPTS} failed attempts`,
                ipAddress: req.ip || req.socket?.remoteAddress
            });

            return res.status(423).json({
                error: `Account is now temporarily locked due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes or contact your administrator.`,
                remainingMinutes: LOCKOUT_MINUTES
            });
        } else {
            db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(newFailedAttempts, user.id);
            recordLoginAttempt({
                userId: user.id,
                username: user.username,
                status: 'FAILED_PASSWORD',
                failureReason: `Invalid password (${newFailedAttempts}/${MAX_FAILED_ATTEMPTS})`,
                req,
                branchId: user.branch_id
            });

            const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;
            return res.status(401).json({
                error: `Invalid username or password. ${remainingAttempts} attempt(s) remaining before account lockout.`,
                remainingAttempts
            });
        }
    }

    // 4. Password Succeeded: Clear failed login tracking
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Dynamic salt upgrade if needed
    if (verification.needsUpgrade) {
        const upgradedHash = hashPassword(password);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgradedHash, user.id);
    }

    // 5. 2FA Challenge Check
    if (user.two_factor_enabled === 1 && user.two_factor_secret) {
        const secret = getJwtSecret();
        const tempToken = jwt.sign(
            { id: user.id, username: user.username, purpose: '2FA_CHALLENGE' },
            secret,
            { expiresIn: '5m' }
        );

        recordLoginAttempt({
            userId: user.id,
            username: user.username,
            status: '2FA_PENDING',
            failureReason: 'Awaiting 2FA verification',
            req,
            branchId: user.branch_id
        });

        return res.json({
            require2FA: true,
            tempToken,
            username: user.username,
            message: 'Two-factor authentication required. Enter the 6-digit code from your authenticator app.'
        });
    }

    // 6. Complete Session & Issue Tokens
    recordLoginAttempt({
        userId: user.id,
        username: user.username,
        status: 'SUCCESS',
        req,
        branchId: user.branch_id
    });

    logAuditEvent({
        userId: user.id,
        role: user.role_name,
        action: 'LOGIN',
        resource: 'AUTH',
        resourceId: String(user.id),
        branchId: user.branch_id,
        reason: 'Successful operator authentication',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    const sessionData = createSessionAndTokens(user, req);

    return res.json({
        token: sessionData.token,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresInSeconds,
        user: formatUserResponse(user)
    });
});

// -----------------------------------------------------------------------------
// 3. 2FA LOGIN VERIFICATION
// -----------------------------------------------------------------------------
router.post('/2fa/verify', (req, res) => {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
        return res.status(400).json({ error: 'Temporary token and 2FA code are required' });
    }

    const secret = getJwtSecret();
    let decoded;
    try {
        decoded = jwt.verify(tempToken, secret);
        if (decoded.purpose !== '2FA_CHALLENGE') {
            return res.status(401).json({ error: 'Invalid challenge token' });
        }
    } catch {
        return res.status(401).json({ error: '2FA challenge token has expired or is invalid. Please log in again.' });
    }

    const user = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
               u.token_version, u.must_change_password, u.two_factor_enabled, u.two_factor_secret, u.two_factor_recovery_codes,
               u.password_changed_at, u.last_login_at,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = ?
    `).get(decoded.id);

    if (!user || !user.is_active) {
        return res.status(403).json({ error: 'User account not active' });
    }

    // Try TOTP code first
    const isTotpValid = verifyTotp(code, user.two_factor_secret);
    let isRecoveryValid = false;

    if (!isTotpValid && user.two_factor_recovery_codes) {
        try {
            const recoveryCodes = JSON.parse(user.two_factor_recovery_codes);
            const recoveryResult = verifyRecoveryCode(code, recoveryCodes);
            if (recoveryResult.isValid) {
                isRecoveryValid = true;
                db.prepare('UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?').run(
                    JSON.stringify(recoveryResult.remainingHashedCodes),
                    user.id
                );
            }
        } catch {}
    }

    if (!isTotpValid && !isRecoveryValid) {
        recordLoginAttempt({
            userId: user.id,
            username: user.username,
            status: '2FA_FAILED',
            failureReason: 'Invalid 2FA code provided',
            req,
            branchId: user.branch_id
        });
        return res.status(401).json({ error: 'Invalid two-factor authentication code or backup recovery code.' });
    }

    recordLoginAttempt({
        userId: user.id,
        username: user.username,
        status: 'SUCCESS',
        failureReason: isRecoveryValid ? 'Logged in via backup recovery code' : null,
        req,
        branchId: user.branch_id
    });

    logAuditEvent({
        userId: user.id,
        role: user.role_name,
        action: 'LOGIN_2FA',
        resource: 'AUTH',
        resourceId: String(user.id),
        branchId: user.branch_id,
        reason: isRecoveryValid ? 'Authenticated using 2FA recovery backup code' : 'Authenticated via TOTP 2FA',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    const sessionData = createSessionAndTokens(user, req);

    return res.json({
        token: sessionData.token,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresInSeconds,
        usedRecoveryCode: isRecoveryValid,
        user: formatUserResponse(user)
    });
});

// -----------------------------------------------------------------------------
// 4. TOKEN REFRESH WITH REFRESH TOKEN ROTATION
// -----------------------------------------------------------------------------
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    const refreshTokenHash = sha256Hash(refreshToken);

    const session = db.prepare(`
        SELECT s.id as session_id, s.user_id, s.is_active, s.expires_at,
               datetime(s.expires_at) <= datetime(CURRENT_TIMESTAMP) as is_expired,
               u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active as user_active,
               u.token_version, u.must_change_password, u.two_factor_enabled,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE s.refresh_token_hash = ?
    `).get(refreshTokenHash);

    if (!session) {
        return res.status(401).json({ error: 'Invalid or revoked refresh token. Please sign in again.' });
    }

    if (!session.is_active || session.is_expired || !session.user_active) {
        // Reuse or expired session detected
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ?').run(session.session_id);
        return res.status(401).json({ error: 'Session expired or invalidated. Please sign in again.' });
    }

    // Token Rotation: Generate new refresh token and new access token
    const newRefreshToken = generateSecureRandom(32);
    const newRefreshTokenHash = sha256Hash(newRefreshToken);
    const newJti = crypto.randomUUID();
    const secret = getJwtSecret();

    db.prepare(`
        UPDATE user_sessions
        SET refresh_token_hash = ?, last_activity_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(newRefreshTokenHash, session.session_id);

    const tokenPayload = {
        id: session.id,
        username: session.username,
        role: session.role_name,
        branchId: session.branch_id,
        sessionId: session.session_id,
        jti: newJti,
        tokenVersion: session.token_version
    };

    const token = jwt.sign(tokenPayload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });

    res.json({
        token,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60
    });
});

// -----------------------------------------------------------------------------
// 5. LOGOUT & TOKEN INVALIDATION
// -----------------------------------------------------------------------------
router.post('/logout', authenticateToken, (req, res) => {
    // 1. Deactivate session in user_sessions
    if (req.user.sessionId) {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ?').run(req.user.sessionId);
    }

    // 2. Blacklist current JWT jti
    if (req.user.jti) {
        db.prepare(`
            INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at)
            VALUES (?, ?, datetime('now', '+1 day'))
        `).run(req.user.jti, req.user.id);
    }

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'LOGOUT',
        resource: 'AUTH',
        resourceId: String(req.user.id),
        branchId: req.user.branchId,
        reason: 'User logged out and session invalidated',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: 'Signed out successfully' });
});

// -----------------------------------------------------------------------------
// 6. PASSWORD CHANGE (Authenticated)
// -----------------------------------------------------------------------------
router.post('/change-password', authenticateToken, (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (confirm_password && new_password !== confirm_password) {
        return res.status(400).json({ error: 'New password and confirmation do not match' });
    }

    const user = db.prepare('SELECT id, password_hash, username, email FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User record not found' });
    }

    // Verify current password
    const verification = verifyPassword(current_password, user.password_hash);
    if (!verification.isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (current_password === new_password) {
        return res.status(400).json({ error: 'New password must be different from your current password' });
    }

    // Validate strong password policy
    const policyResult = validatePasswordStrength(new_password, {
        username: user.username,
        email: user.email
    });

    if (!policyResult.isValid) {
        return res.status(400).json({
            error: policyResult.errors[0],
            errors: policyResult.errors
        });
    }

    const newHash = hashPassword(new_password);

    // Update password, reset must_change_password, and increment token_version (invalidates old tokens)
    db.prepare(`
        UPDATE users
        SET password_hash = ?,
            password_changed_at = CURRENT_TIMESTAMP,
            must_change_password = 0,
            token_version = token_version + 1,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(newHash, user.id);

    // Deactivate all existing sessions
    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(user.id);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'PASSWORD_CHANGE',
        resource: 'USER',
        resourceId: String(req.user.id),
        branchId: req.user.branchId,
        reason: 'User successfully changed account password',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    // Fetch fresh user record with new token version
    const updatedUser = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.token_version,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = ?
    `).get(user.id);

    // Issue new session and tokens
    const sessionData = createSessionAndTokens(updatedUser, req);

    res.json({
        message: 'Password changed successfully. All previous sessions have been invalidated.',
        token: sessionData.token,
        refreshToken: sessionData.refreshToken
    });
});

// -----------------------------------------------------------------------------
// 7. SELF-SERVICE FORGOT & RESET PASSWORD
// -----------------------------------------------------------------------------
router.post('/forgot-password', (req, res) => {
    const { identifier } = req.body;

    if (!identifier) {
        return res.status(400).json({ error: 'Username or email address is required' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = db.prepare('SELECT id, username, email, is_active FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanId, cleanId);

    // Always respond with uniform success message to avoid account enumeration
    const genericResponse = {
        message: 'If a matching active account exists, password reset instructions have been generated.',
        success: true
    };

    if (!user || !user.is_active) {
        return res.json(genericResponse);
    }

    const resetToken = generateSecureRandom(32);
    const tokenHash = sha256Hash(resetToken);

    // Expire any pending tokens for this user
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    // Insert 15-minute reset token
    db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, datetime('now', '+15 minutes'), CURRENT_TIMESTAMP)
    `).run(user.id, tokenHash);

    console.log(`🔑 [Password Reset] Issued reset token for user '${user.username}': ${resetToken}`);

    // In dev / test / sandbox mode, return resetToken in payload to facilitate automated tests and evaluation
    const isDevOrDemo = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true' || process.env.AUTH_TEST_MODE === 'true';

    return res.json({
        ...genericResponse,
        ...(isDevOrDemo ? { resetToken } : {})
    });
});

router.post('/reset-password', (req, res) => {
    const { token, new_password, confirm_password } = req.body;

    if (!token || !new_password) {
        return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (confirm_password && new_password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    const tokenHash = sha256Hash(token);

    const record = db.prepare(`
        SELECT pr.id, pr.user_id, pr.used_at,
               datetime(pr.expires_at) <= datetime(CURRENT_TIMESTAMP) as is_expired,
               u.username, u.email, u.is_active
        FROM password_reset_tokens pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.token_hash = ?
    `).get(tokenHash);

    if (!record || record.used_at || record.is_expired) {
        return res.status(400).json({ error: 'Password reset link has expired or has already been used. Please request a new one.' });
    }

    if (!record.is_active) {
        return res.status(403).json({ error: 'User account is deactivated' });
    }

    // Validate strong password policy
    const policyResult = validatePasswordStrength(new_password, {
        username: record.username,
        email: record.email
    });

    if (!policyResult.isValid) {
        return res.status(400).json({
            error: policyResult.errors[0],
            errors: policyResult.errors
        });
    }

    const newHash = hashPassword(new_password);

    // Update password, mark token as used, increment token_version
    db.prepare(`
        UPDATE users
        SET password_hash = ?,
            password_changed_at = CURRENT_TIMESTAMP,
            must_change_password = 0,
            token_version = token_version + 1,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(newHash, record.user_id);

    db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(record.id);

    // Deactivate all active sessions for this user
    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(record.user_id);

    logAuditEvent({
        userId: record.user_id,
        role: 'SYSTEM',
        action: 'PASSWORD_RESET',
        resource: 'USER',
        resourceId: String(record.user_id),
        reason: 'Password reset completed via recovery token',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
});

// -----------------------------------------------------------------------------
// 8. TWO-FACTOR AUTHENTICATION MANAGEMENT
// -----------------------------------------------------------------------------
router.post('/2fa/setup', authenticateToken, (req, res) => {
    const secret = generateSecret(20);
    const otpAuthUri = getOtpAuthUri({
        secret,
        username: req.user.username,
        issuer: 'SwiftTrack Kenya'
    });
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

    res.json({
        secret,
        otpAuthUri,
        recoveryCodes: plainCodes,
        hashedRecoveryCodes: hashedCodes
    });
});

router.post('/2fa/enable', authenticateToken, (req, res) => {
    const { secret, code, hashedRecoveryCodes } = req.body;

    if (!secret || !code) {
        return res.status(400).json({ error: 'Secret and verification code are required' });
    }

    const isValid = verifyTotp(code, secret);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid 2FA code. Please verify the code on your authenticator app.' });
    }

    const recoveryCodesJson = Array.isArray(hashedRecoveryCodes) ? JSON.stringify(hashedRecoveryCodes) : '[]';

    db.prepare(`
        UPDATE users
        SET two_factor_enabled = 1,
            two_factor_secret = ?,
            two_factor_recovery_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(secret, recoveryCodesJson, req.user.id);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: '2FA_ENABLED',
        resource: 'USER',
        resourceId: String(req.user.id),
        branchId: req.user.branchId,
        reason: 'Operator enabled two-factor authentication',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: 'Two-factor authentication successfully enabled on your account.', twoFactorEnabled: true });
});

router.post('/2fa/disable', authenticateToken, (req, res) => {
    const { password, code } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Current password is required to disable two-factor authentication' });
    }

    const user = db.prepare('SELECT password_hash, two_factor_secret FROM users WHERE id = ?').get(req.user.id);
    const passCheck = verifyPassword(password, user.password_hash);
    if (!passCheck.isValid) {
        return res.status(400).json({ error: 'Password is incorrect' });
    }

    if (code && user.two_factor_secret) {
        const isTotpValid = verifyTotp(code, user.two_factor_secret);
        if (!isTotpValid) {
            return res.status(400).json({ error: 'Invalid 2FA security code' });
        }
    }

    db.prepare(`
        UPDATE users
        SET two_factor_enabled = 0,
            two_factor_secret = NULL,
            two_factor_recovery_codes = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(req.user.id);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: '2FA_DISABLED',
        resource: 'USER',
        resourceId: String(req.user.id),
        branchId: req.user.branchId,
        reason: 'Operator disabled two-factor authentication',
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: 'Two-factor authentication disabled.', twoFactorEnabled: false });
});

router.post('/2fa/recovery-codes', authenticateToken, (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password required to regenerate recovery backup codes' });
    }

    const user = db.prepare('SELECT password_hash, two_factor_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(password, user.password_hash).isValid) {
        return res.status(400).json({ error: 'Password incorrect' });
    }

    if (!user.two_factor_enabled) {
        return res.status(400).json({ error: '2FA is not enabled on this account' });
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    db.prepare('UPDATE users SET two_factor_recovery_codes = ? WHERE id = ?').run(JSON.stringify(hashedCodes), req.user.id);

    res.json({
        recoveryCodes: plainCodes,
        message: 'New recovery codes generated. Store them in a secure location.'
    });
});

// -----------------------------------------------------------------------------
// 9. SESSION MANAGEMENT
// -----------------------------------------------------------------------------
router.get('/sessions', authenticateToken, (req, res) => {
    const sessions = db.prepare(`
        SELECT id, ip_address, user_agent, device_info, is_active, last_activity_at, created_at, expires_at,
               datetime(expires_at) <= datetime(CURRENT_TIMESTAMP) as is_expired
        FROM user_sessions
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_activity_at DESC
    `).all(req.user.id);

    const formatted = sessions.map(s => ({
        ...s,
        isCurrent: s.id === req.user.sessionId
    }));

    res.json(formatted);
});

router.delete('/sessions/:id', authenticateToken, (req, res) => {
    const targetSessionId = req.params.id;

    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?').run(targetSessionId, req.user.id);

    res.json({ message: 'Session terminated' });
});

router.delete('/sessions', authenticateToken, (req, res) => {
    // Terminate all sessions EXCEPT the current session
    if (req.user.sessionId) {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND id != ?').run(req.user.id, req.user.sessionId);
    } else {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    }

    res.json({ message: 'All other sessions have been terminated' });
});

// -----------------------------------------------------------------------------
// 10. LOGIN HISTORY AUDIT
// -----------------------------------------------------------------------------
router.get('/login-history', authenticateToken, (req, res) => {
    const history = db.prepare(`
        SELECT id, username_attempted, status, failure_reason, ip_address, user_agent, created_at
        FROM login_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 25
    `).all(req.user.id);

    res.json(history);
});

// -----------------------------------------------------------------------------
// 11. USER PROFILE & DEMO PERSONA SWITCHING
// -----------------------------------------------------------------------------
router.get('/me', authenticateToken, (req, res) => {
    const company = db.prepare('SELECT company_name, kra_pin, vat_rate, currency, phone, email, address, city FROM company_settings WHERE id = 1').get();

    let driverProfile = null;
    if (req.user.roleName === 'DRIVER') {
        driverProfile = db.prepare('SELECT id, license_number, vehicle_id, status FROM drivers WHERE user_id = ?').get(req.user.id);
    }

    res.json({
        user: {
            ...req.user,
            driverProfile
        },
        company
    });
});

router.post('/demo-switch', (req, res) => {
    if (process.env.DEMO_MODE !== 'true' && process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Forbidden: Demo persona switching is disabled in production mode.'
        });
    }

    const { role, branch_id, branchId, username } = req.body;
    const targetBranchId = (branch_id !== undefined && branch_id !== null && branch_id !== '')
        ? Number(branch_id)
        : (branchId !== undefined && branchId !== null && branchId !== '')
            ? Number(branchId)
            : null;
    let targetUsername = username;

    if (!targetUsername) {
        if (role === 'SUPER_ADMIN' || (!role && targetBranchId === null)) {
            targetUsername = 'superadmin';
        } else if (targetBranchId === 2) {
            if (role === 'CASHIER') targetUsername = 'cashier.mombasa';
            else if (role === 'DRIVER') targetUsername = 'driver.mombasa';
            else targetUsername = 'manager.mombasa';
        } else if (targetBranchId === 3) {
            targetUsername = 'manager.kisumu';
        } else if (targetBranchId === 1) {
            if (role === 'DISPATCHER') targetUsername = 'dispatcher.nairobi';
            else if (role === 'CASHIER') targetUsername = 'cashier.nairobi';
            else if (role === 'DRIVER') targetUsername = 'driver.nairobi';
            else targetUsername = 'manager.nairobi';
        } else {
            switch (role) {
                case 'SUPER_ADMIN': targetUsername = 'superadmin'; break;
                case 'BRANCH_MANAGER':
                case 'BRANCH_MANAGER_NAIROBI': targetUsername = 'manager.nairobi'; break;
                case 'BRANCH_MANAGER_MOMBASA': targetUsername = 'manager.mombasa'; break;
                case 'BRANCH_MANAGER_KISUMU': targetUsername = 'manager.kisumu'; break;
                case 'DISPATCHER': targetUsername = 'dispatcher.nairobi'; break;
                case 'CASHIER': targetUsername = 'cashier.nairobi'; break;
                case 'DRIVER': targetUsername = 'driver.nairobi'; break;
                default: targetUsername = 'superadmin';
            }
        }
    }

    let user = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
               u.token_version, u.must_change_password, u.two_factor_enabled,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.username = ?
    `).get(targetUsername);

    if (!user && targetBranchId) {
        user = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.token_version, u.must_change_password, u.two_factor_enabled,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE u.branch_id = ?
            ORDER BY CASE WHEN r.name = 'BRANCH_MANAGER' THEN 1 ELSE 2 END, u.id ASC
        `).get(targetBranchId);
    }

    if (!user) {
        return res.status(404).json({ error: 'Demo user account not found' });
    }

    const sessionData = createSessionAndTokens(user, req);

    res.json({
        token: sessionData.token,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresInSeconds,
        user: formatUserResponse(user)
    });
});

module.exports = router;
