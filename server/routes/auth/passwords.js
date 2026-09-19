// server/routes/auth/passwords.js
// Password Reset and Credential Modification Routes
const express = require('express');
const router = express.Router();
const { db } = require('../../db/database.js');
const { authenticateToken } = require('../../middleware/auth.js');
const { logAuditEvent } = require('../../middleware/audit.js');
const {
    hashPassword,
    verifyPassword,
    generateSecureRandom,
    sha256Hash,
    validatePasswordStrength
} = require('../../utils/security.js');
const { createSessionAndTokens } = require('../../services/authService.js');

/**
 * Change password for authenticated operator
 */
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

/**
 * Self-service forgot password initiation
 */
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

    // In dev / test / sandbox mode, return resetToken in payload to facilitate automated tests
    const isDevOrDemo = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true' || process.env.AUTH_TEST_MODE === 'true';

    return res.json({
        ...genericResponse,
        ...(isDevOrDemo ? { resetToken } : {})
    });
});

/**
 * Self-service password reset submission
 */
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

module.exports = router;
