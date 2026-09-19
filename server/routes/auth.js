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
    sha256Hash
} = require('../utils/security.js');
const {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_MINUTES,
    ACCESS_TOKEN_EXPIRY,
    recordLoginAttempt,
    createSessionAndTokens,
    formatUserResponse,
} = require('../services/authService.js');

// Sub-routers
const totpRouter = require('./auth/totp.js');
const sessionsRouter = require('./auth/sessions.js');
const passwordsRouter = require('./auth/passwords.js');

// Mount sub-routers for 2FA, sessions, and password operations
router.use(totpRouter);
router.use(sessionsRouter);
router.use(passwordsRouter);

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

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
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
// 3. TOKEN REFRESH WITH REFRESH TOKEN ROTATION
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
// 4. LOGOUT & TOKEN INVALIDATION
// -----------------------------------------------------------------------------
router.post('/logout', authenticateToken, (req, res) => {
    if (req.user.sessionId) {
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE id = ?').run(req.user.sessionId);
    }

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
// 5. USER PROFILE & DEMO PERSONA SWITCHING
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
