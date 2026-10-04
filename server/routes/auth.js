// server/routes/auth.js
// Production Authentication & Identity Security Engine
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const dbAdapter = require('../db/dbAdapter.js');
const sessionRepository = require('../repositories/sessionRepository.js');
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
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    try {
        const user = await dbAdapter.get(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.password_hash, u.is_active,
                   u.failed_login_attempts, u.locked_until, u.token_version, u.must_change_password,
                   (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP) as is_locked,
                   u.two_factor_enabled, u.two_factor_secret, u.two_factor_recovery_codes,
                   u.password_changed_at, u.last_login_at,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?)
        `, [cleanUsername, cleanUsername]);

        if (!user) {
            await recordLoginAttempt({ username: cleanUsername, status: 'FAILED_USER_NOT_FOUND', failureReason: 'User not found', req });
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // 1. Account Inactive Check
        if (!user.is_active) {
            await recordLoginAttempt({ userId: user.id, username: user.username, status: 'ACCOUNT_INACTIVE', failureReason: 'Account deactivated', req, branchId: user.branch_id });
            return res.status(403).json({ error: 'User account has been deactivated. Please contact Super Admin.' });
        }

        // 2. Account Lockout Check
        if (user.is_locked) {
            const lockedUntilUtc = String(user.locked_until).endsWith('Z')
                ? user.locked_until
                : String(user.locked_until).replace(' ', 'T') + 'Z';
            const remainingMs = new Date(lockedUntilUtc).getTime() - Date.now();
            const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

            await recordLoginAttempt({ userId: user.id, username: user.username, status: 'ACCOUNT_LOCKED', failureReason: 'Attempt while locked', req, branchId: user.branch_id });
            return res.status(423).json({
                error: `Account is temporarily locked due to consecutive failed attempts. Please try again in ${remainingMinutes} minute(s) or contact administrator.`,
                remainingMinutes
            });
        } else if (user.locked_until) {
            // Lockout expired, reset counter
            await dbAdapter.run('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?', [user.id]);
            user.failed_login_attempts = 0;
            user.locked_until = null;
        }

        // 3. Password Verification
        const verification = verifyPassword(password, user.password_hash);
        if (!verification.isValid) {
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;

            if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
                const lockoutExpiry = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
                await dbAdapter.run(`
                    UPDATE users
                    SET failed_login_attempts = ?, locked_until = ?
                    WHERE id = ?
                `, [newFailedAttempts, lockoutExpiry, user.id]);

                await recordLoginAttempt({
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
                await dbAdapter.run('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [newFailedAttempts, user.id]);
                await recordLoginAttempt({
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
        await dbAdapter.run('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Dynamic salt upgrade if needed
        if (verification.needsUpgrade) {
            const upgradedHash = hashPassword(password);
            await dbAdapter.run('UPDATE users SET password_hash = ? WHERE id = ?', [upgradedHash, user.id]);
        }

        // 5. 2FA Challenge Check
        if (user.two_factor_enabled && user.two_factor_secret) {
            const secret = getJwtSecret();
            const tempToken = jwt.sign(
                { id: user.id, username: user.username, purpose: '2FA_CHALLENGE' },
                secret,
                { expiresIn: '5m' }
            );

            await recordLoginAttempt({
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
        await recordLoginAttempt({
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

        const sessionData = await createSessionAndTokens(user, req);

        return res.json({
            token: sessionData.token,
            refreshToken: sessionData.refreshToken,
            expiresIn: sessionData.expiresInSeconds,
            user: await formatUserResponse(user)
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Authentication service error' });
    }
});

// -----------------------------------------------------------------------------
// 3. TOKEN REFRESH WITH REFRESH TOKEN ROTATION
// -----------------------------------------------------------------------------
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const refreshTokenHash = sha256Hash(refreshToken);

        const session = await dbAdapter.get(`
            SELECT s.id as session_id, s.user_id, s.is_active, s.expires_at,
                   (s.expires_at <= CURRENT_TIMESTAMP) as is_expired,
                   u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active as user_active,
                   u.token_version, u.must_change_password, u.two_factor_enabled,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE s.refresh_token_hash = ?
        `, [refreshTokenHash]);

        if (!session) {
            return res.status(401).json({ error: 'Invalid or revoked refresh token. Please sign in again.' });
        }

        if (!session.is_active || session.is_expired || !session.user_active) {
            await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE id = ?', [session.session_id]);
            return res.status(401).json({ error: 'Session expired or invalidated. Please sign in again.' });
        }

        // Token Rotation: Generate new refresh token and new access token
        const newRefreshToken = generateSecureRandom(32);
        const newRefreshTokenHash = sha256Hash(newRefreshToken);
        const newJti = crypto.randomUUID();
        const secret = getJwtSecret();

        await dbAdapter.run(`
            UPDATE user_sessions
            SET refresh_token_hash = ?, last_activity_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newRefreshTokenHash, session.session_id]);

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
    } catch (err) {
        console.error('Refresh token error:', err);
        res.status(500).json({ error: 'Session refresh error' });
    }
});

// -----------------------------------------------------------------------------
// 4. LOGOUT & TOKEN INVALIDATION
// -----------------------------------------------------------------------------
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        if (req.user.sessionId) {
            await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE id = ?', [req.user.sessionId]);
        }

        if (req.user.jti) {
            const exp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await sessionRepository.revokeToken(req.user.jti, req.user.id, exp);
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
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout error' });
    }
});

// -----------------------------------------------------------------------------
// 5. USER PROFILE & DEMO PERSONA SWITCHING
// -----------------------------------------------------------------------------
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const company = await dbAdapter.get('SELECT company_name, kra_pin, vat_rate, currency, phone, email, address, city FROM company_settings WHERE id = 1');

        let driverProfile = null;
        if (req.user.roleName === 'DRIVER') {
            driverProfile = await dbAdapter.get('SELECT id, license_number, vehicle_id, status FROM drivers WHERE user_id = ?', [req.user.id]);
        }

        res.json({
            user: {
                ...req.user,
                driverProfile
            },
            company
        });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Failed to retrieve profile' });
    }
});

router.post('/demo-switch', async (req, res) => {
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
    let user = null;

    try {
        if (username) {
            user = await dbAdapter.get(`
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                       u.token_version, u.must_change_password, u.two_factor_enabled,
                       r.name as role_name, r.display_name as role_display_name,
                       b.name as branch_name, b.code as branch_code, b.city as branch_city
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN branches b ON u.branch_id = b.id
                WHERE u.username = ?
            `, [username]);
        } else if (role === 'SUPER_ADMIN' || (!role && targetBranchId === null)) {
            user = await dbAdapter.get(`
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                       u.token_version, u.must_change_password, u.two_factor_enabled,
                       r.name as role_name, r.display_name as role_display_name,
                       b.name as branch_name, b.code as branch_code, b.city as branch_city
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN branches b ON u.branch_id = b.id
                WHERE u.username IN ('superadmin', 'admin') OR r.name = 'SUPER_ADMIN'
                ORDER BY u.id ASC
                LIMIT 1
            `);
        } else if (targetBranchId) {
            let branchUserSql = `
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                       u.token_version, u.must_change_password, u.two_factor_enabled,
                       r.name as role_name, r.display_name as role_display_name,
                       b.name as branch_name, b.code as branch_code, b.city as branch_city
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN branches b ON u.branch_id = b.id
                WHERE u.branch_id = ?
            `;
            const branchUserParams = [targetBranchId];

            if (role) {
                branchUserSql += ' AND r.name = ? ORDER BY u.id ASC';
                branchUserParams.push(role);
            } else {
                branchUserSql += " ORDER BY CASE WHEN r.name = 'BRANCH_MANAGER' THEN 1 ELSE 2 END, u.id ASC";
            }

            user = await dbAdapter.get(branchUserSql, branchUserParams);

            if (!user) {
                const targetBranch = await dbAdapter.get('SELECT * FROM branches WHERE id = ?', [targetBranchId]);
                if (targetBranch) {
                    const roleRow = await dbAdapter.get('SELECT id, name, display_name FROM roles WHERE name = ?', [role || 'BRANCH_MANAGER'])
                        || await dbAdapter.get("SELECT id, name, display_name FROM roles WHERE name = 'BRANCH_MANAGER'");
                    const sanitizedCode = targetBranch.code.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const rolePrefix = (role || 'manager').toLowerCase().replace('branch_', '').replace('_', '');
                    const demoUsername = `${rolePrefix}.${sanitizedCode}`;
                    
                    const existingUser = await dbAdapter.get('SELECT id FROM users WHERE username = ?', [demoUsername]);
                    const finalUsername = existingUser ? `${demoUsername}_${targetBranchId}` : demoUsername;

                    const randomPass = generateSecureRandom(12) + '!9A';
                    const hashed = hashPassword(randomPass);

                    await dbAdapter.run(`
                        INSERT INTO users (username, password_hash, email, full_name, role_id, branch_id, is_active, phone)
                        VALUES (?, ?, ?, ?, ?, ?, true, ?)
                    `, [
                        finalUsername,
                        hashed,
                        `${finalUsername}@swifttrack.co.ke`,
                        `${targetBranch.name} ${roleRow.display_name || 'Operator'}`,
                        roleRow.id,
                        targetBranchId,
                        targetBranch.phone || '+254 700 000 000'
                    ]);

                    user = await dbAdapter.get(`
                        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                               u.token_version, u.must_change_password, u.two_factor_enabled,
                               r.name as role_name, r.display_name as role_display_name,
                               b.name as branch_name, b.code as branch_code, b.city as branch_city
                        FROM users u
                        JOIN roles r ON u.role_id = r.id
                        LEFT JOIN branches b ON u.branch_id = b.id
                        WHERE u.username = ?
                    `, [finalUsername]);
                }
            }
        } else {
            const fallbackUsernames = {
                SUPER_ADMIN: 'superadmin',
                BRANCH_MANAGER: 'manager.nairobi',
                BRANCH_MANAGER_NAIROBI: 'manager.nairobi',
                BRANCH_MANAGER_MOMBASA: 'manager.mombasa',
                BRANCH_MANAGER_KISUMU: 'manager.kisumu',
                DISPATCHER: 'dispatcher.nairobi',
                CASHIER: 'cashier.nairobi',
                DRIVER: 'driver.nairobi',
            };
            const targetUsername = fallbackUsernames[role] || 'superadmin';
            user = await dbAdapter.get(`
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                       u.token_version, u.must_change_password, u.two_factor_enabled,
                       r.name as role_name, r.display_name as role_display_name,
                       b.name as branch_name, b.code as branch_code, b.city as branch_city
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN branches b ON u.branch_id = b.id
                WHERE u.username = ?
            `, [targetUsername]);
        }

        if (!user) {
            return res.status(404).json({ error: 'Demo user account not found' });
        }

        const sessionData = await createSessionAndTokens(user, req);

        res.json({
            token: sessionData.token,
            refreshToken: sessionData.refreshToken,
            expiresIn: sessionData.expiresInSeconds,
            user: await formatUserResponse(user)
        });
    } catch (err) {
        console.error('Demo switch error:', err);
        res.status(500).json({ error: 'Demo switch error: ' + err.message });
    }
});

module.exports = router;
