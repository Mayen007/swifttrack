// server/routes/auth/totp.js
// Two-Factor Authentication (TOTP) & Recovery Routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../../db/database.js');
const { authenticateToken } = require('../../middleware/auth.js');
const { getJwtSecret } = require('../../utils/env.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const { verifyPassword } = require('../../utils/security.js');
const {
    generateSecret,
    getOtpAuthUri,
    verifyTotp,
    generateRecoveryCodes,
    verifyRecoveryCode
} = require('../../utils/totp.js');
const {
    recordLoginAttempt,
    createSessionAndTokens,
    formatUserResponse
} = require('../../services/authService.js');

/**
 * 2FA LOGIN VERIFICATION (Public challenge verification)
 */
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

/**
 * 2FA SETUP (Authenticated)
 */
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

/**
 * 2FA ENABLE (Authenticated)
 */
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

/**
 * 2FA DISABLE (Authenticated)
 */
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

/**
 * REGENERATE 2FA RECOVERY CODES (Authenticated)
 */
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

module.exports = router;
