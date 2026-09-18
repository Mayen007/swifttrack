// server/routes/users.js
// Enterprise Staff Identity & Access Administration
const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { hashPassword, validatePasswordStrength, generateSecureRandom } = require('../utils/security.js');

// GET /api/users - List users (Super Admin sees all, Branch Manager sees only staff at own branch)
router.get('/', authenticateToken, authorize('users', 'view'), (req, res) => {
    let query = `
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
               u.last_login_at, u.created_at, u.must_change_password, u.token_version,
               u.failed_login_attempts, u.locked_until, u.two_factor_enabled, u.password_changed_at,
               datetime(u.locked_until) > datetime(CURRENT_TIMESTAMP) as is_locked,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
    `;
    const params = [];

    if (req.user.roleName !== 'SUPER_ADMIN') {
        query += ' WHERE u.branch_id = ?';
        params.push(req.user.branchId);
    } else if (req.query.branch_id) {
        query += ' WHERE u.branch_id = ?';
        params.push(Number(req.query.branch_id));
    }

    query += ' ORDER BY u.id ASC';

    const users = db.prepare(query).all(...params);
    res.json(users);
});

// POST /api/users - Provision new staff member
router.post('/', authenticateToken, authorize('users', 'create'), (req, res) => {
    const { username, email, full_name, phone, password, role_id, branch_id, must_change_password = 1 } = req.body;

    if (!username || !email || !full_name || !password || !role_id) {
        return res.status(400).json({ error: 'Username, email, full_name, password, and role_id are required' });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Validate strong password policy
    const policy = validatePasswordStrength(password, { username: cleanUsername, email: cleanEmail });
    if (!policy.isValid) {
        return res.status(400).json({
            error: policy.errors[0],
            errors: policy.errors
        });
    }

    // Role verification
    const targetRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
    if (!targetRole) {
        return res.status(400).json({ error: 'Invalid role selected' });
    }

    let assignedBranchId;

    if (req.user.roleName === 'SUPER_ADMIN') {
        assignedBranchId = targetRole.name === 'SUPER_ADMIN' ? null : (branch_id ? Number(branch_id) : 1);
    } else {
        if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole.name)) {
            return res.status(403).json({ error: 'Forbidden: Branch Managers can only provision operational staff (Cashier, Dispatcher, Driver).' });
        }
        assignedBranchId = req.user.branchId;
    }

    try {
        const passwordHash = hashPassword(password);
        const result = db.prepare(`
            INSERT INTO users (
                branch_id, role_id, username, email, full_name, phone, password_hash,
                is_active, must_change_password, token_version, password_changed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, CURRENT_TIMESTAMP)
        `).run(
            assignedBranchId,
            role_id,
            cleanUsername,
            cleanEmail,
            full_name.trim(),
            phone || '+254 700 000 000',
            passwordHash,
            must_change_password ? 1 : 0
        );

        const newUserId = result.lastInsertRowid;

        // If driver role, create corresponding drivers record
        if (targetRole.name === 'DRIVER') {
            const licenseNo = req.body.license_number || `DL-${cleanUsername.toUpperCase()}-01`;
            db.prepare(`
                INSERT INTO drivers (user_id, branch_id, license_number, phone, status)
                VALUES (?, ?, ?, ?, 'AVAILABLE')
            `).run(newUserId, assignedBranchId, licenseNo, phone || '+254 700 000 000');
        }

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'USER',
            resourceId: String(newUserId),
            branchId: assignedBranchId,
            newValue: { username: cleanUsername, email: cleanEmail, full_name, role: targetRole.name, branch_id: assignedBranchId },
            reason: 'Provisioned new staff user'
        });

        const createdUser = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.must_change_password, u.token_version,
                   r.name as role_name, r.display_name as role_display_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
        `).get(newUserId);

        res.status(201).json(createdUser);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Username or email already exists in system' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:id - Edit staff or toggle active status
router.put('/:id', authenticateToken, authorize('users', 'edit', { entityTable: 'users', idParam: 'id' }), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = req.targetEntity || db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);

    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Branch isolation check: Branch Manager cannot touch users of other branches or Super Admin
    if (req.user.roleName !== 'SUPER_ADMIN') {
        if (targetUser.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: You cannot modify users from another branch.' });
        }
        const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(targetUser.role_id);
        if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole.name)) {
            return res.status(403).json({ error: 'Forbidden: You cannot modify administrative users.' });
        }
    }

    const { full_name, phone, is_active, password } = req.body;
    let passwordHash = targetUser.password_hash;
    let tokenVersion = targetUser.token_version;
    let mustChangePassword = targetUser.must_change_password;

    if (password) {
        const policy = validatePasswordStrength(password, {
            username: targetUser.username,
            email: targetUser.email
        });
        if (!policy.isValid) {
            return res.status(400).json({ error: policy.errors[0], errors: policy.errors });
        }
        passwordHash = hashPassword(password);
        tokenVersion = (tokenVersion || 1) + 1;
        mustChangePassword = 1;
        // Invalidate active sessions
        db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(targetUserId);
    }

    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : targetUser.is_active;

    db.prepare(`
        UPDATE users
        SET full_name = ?, phone = ?, is_active = ?, password_hash = ?,
            token_version = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        full_name || targetUser.full_name,
        phone || targetUser.phone,
        activeVal,
        passwordHash,
        tokenVersion,
        mustChangePassword,
        targetUserId
    );

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'UPDATE',
        resource: 'USER',
        resourceId: String(targetUserId),
        branchId: targetUser.branch_id,
        previousValue: { full_name: targetUser.full_name, is_active: targetUser.is_active },
        newValue: { full_name: full_name || targetUser.full_name, is_active: activeVal },
        reason: 'Updated user details/status'
    });

    res.json({ message: 'User updated successfully' });
});

// POST /api/users/:id/force-logout - Admin forcibly terminates all sessions for a user
router.post('/:id/force-logout', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = db.prepare('SELECT id, branch_id, role_id, username, token_version FROM users WHERE id = ?').get(targetUserId);

    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.roleName !== 'SUPER_ADMIN') {
        if (targetUser.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: You cannot force logout staff from another branch.' });
        }
        const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(targetUser.role_id);
        if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole.name)) {
            return res.status(403).json({ error: 'Forbidden: Cannot terminate administrative user sessions.' });
        }
    }

    // Increment token version
    db.prepare(`
        UPDATE users
        SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(targetUserId);

    // Terminate all sessions
    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(targetUserId);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'ADMIN_FORCE_LOGOUT',
        resource: 'USER',
        resourceId: String(targetUserId),
        branchId: targetUser.branch_id,
        reason: `Administrator terminated all sessions for ${targetUser.username}`,
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: `Successfully terminated all active sessions for ${targetUser.username}.` });
});

// POST /api/users/:id/reset-password - Admin resets password & enforces first-login password change
router.post('/:id/reset-password', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = req.targetEntity || db.prepare('SELECT id, branch_id, role_id, username, email FROM users WHERE id = ?').get(targetUserId);

    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.roleName !== 'SUPER_ADMIN') {
        if (targetUser.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot reset password for staff at another branch.' });
        }
        const targetRole = db.prepare('SELECT name FROM roles WHERE id = ?').get(targetUser.role_id);
        if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole.name)) {
            return res.status(403).json({ error: 'Forbidden: Cannot reset password for administrative users.' });
        }
    }

    // Auto-generate strong temporary password or use provided password
    const tempPassword = req.body.password || `Temp#${generateSecureRandom(4).toUpperCase()}!2026`;

    const policy = validatePasswordStrength(tempPassword, {
        username: targetUser.username,
        email: targetUser.email
    });

    if (!policy.isValid) {
        return res.status(400).json({ error: policy.errors[0], errors: policy.errors });
    }

    const passwordHash = hashPassword(tempPassword);

    db.prepare(`
        UPDATE users
        SET password_hash = ?,
            must_change_password = 1,
            token_version = token_version + 1,
            failed_login_attempts = 0,
            locked_until = NULL,
            password_changed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(passwordHash, targetUserId);

    // Deactivate all existing sessions
    db.prepare('UPDATE user_sessions SET is_active = 0 WHERE user_id = ?').run(targetUserId);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'ADMIN_PASSWORD_RESET',
        resource: 'USER',
        resourceId: String(targetUserId),
        branchId: targetUser.branch_id,
        reason: `Administrator reset password for ${targetUser.username} with mandatory change required`,
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({
        message: `Password reset successfully for ${targetUser.username}. The user will be required to change this password on next login.`,
        temporaryPassword: tempPassword
    });
});

// POST /api/users/:id/unlock - Admin manually unlocks locked account
router.post('/:id/unlock', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = req.targetEntity || db.prepare('SELECT id, branch_id, role_id, username FROM users WHERE id = ?').get(targetUserId);

    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.roleName !== 'SUPER_ADMIN') {
        if (targetUser.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot unlock user from another branch.' });
        }
    }

    db.prepare(`
        UPDATE users
        SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(targetUserId);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'ADMIN_ACCOUNT_UNLOCK',
        resource: 'USER',
        resourceId: String(targetUserId),
        branchId: targetUser.branch_id,
        reason: `Administrator manually unlocked account for ${targetUser.username}`,
        ipAddress: req.ip || req.socket?.remoteAddress
    });

    res.json({ message: `Account for ${targetUser.username} has been unlocked.` });
});

// GET /api/users/:id/login-history - Admin audits login history for user
router.get('/:id/login-history', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = req.targetEntity || db.prepare('SELECT id, branch_id, username FROM users WHERE id = ?').get(targetUserId);

    if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.roleName !== 'SUPER_ADMIN' && targetUser.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot view login history for staff from another branch.' });
    }

    const history = db.prepare(`
        SELECT id, username_attempted, status, failure_reason, ip_address, user_agent, created_at
        FROM login_history
        WHERE user_id = ? OR username_attempted = ?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(targetUserId, targetUser.username);

    res.json(history);
});

// GET /api/users/security/failed-logins - Admin audits system failed logins
router.get('/security/failed-logins', authenticateToken, authorize('audit', 'failed_logins'), (req, res) => {
    let query = `
        SELECT lh.id, lh.user_id, lh.username_attempted, lh.status, lh.failure_reason,
               lh.ip_address, lh.user_agent, lh.created_at, lh.branch_id,
               b.name as branch_name, b.code as branch_code
        FROM login_history lh
        LEFT JOIN branches b ON lh.branch_id = b.id
        WHERE lh.status != 'SUCCESS'
    `;
    const params = [];

    if (req.user.roleName !== 'SUPER_ADMIN') {
        query += ' AND (lh.branch_id = ? OR lh.branch_id IS NULL)';
        params.push(req.user.branchId);
    }

    query += ' ORDER BY lh.created_at DESC LIMIT 100';

    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

// GET /api/users/roles - List available roles
router.get('/roles', authenticateToken, (req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
    res.json(roles);
});

module.exports = router;
