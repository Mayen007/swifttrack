// server/routes/users.js
// Enterprise Staff Identity & Access Administration
const express = require('express');
const router = express.Router();
const userRepository = require('../repositories/userRepository.js');
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { hashPassword, validatePasswordStrength, generateSecureRandom } = require('../utils/security.js');

// GET /api/users - List users (Super Admin sees all, Branch Manager sees only staff at own branch)
router.get('/', authenticateToken, authorize('users', 'view'), async (req, res) => {
    try {
        let sql = `
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.last_login_at, u.created_at, u.must_change_password, u.token_version,
                   u.failed_login_attempts, u.locked_until, u.two_factor_enabled, u.password_changed_at,
                   (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP) as is_locked,
                   r.name as role_name, r.display_name as role_display_name,
                   b.name as branch_name, b.code as branch_code
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN branches b ON u.branch_id = b.id
        `;
        const params = [];

        if (req.user.roleName !== 'SUPER_ADMIN') {
            sql += ' WHERE u.branch_id = ?';
            params.push(req.user.branchId);
        } else if (req.query.branch_id) {
            sql += ' WHERE u.branch_id = ?';
            params.push(Number(req.query.branch_id));
        }

        sql += ' ORDER BY u.id ASC';

        const users = await dbAdapter.all(sql, params);
        res.json(users);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// POST /api/users - Provision new staff member
router.post('/', authenticateToken, authorize('users', 'create'), async (req, res) => {
    const { username, email, full_name, phone, password, role_id, branch_id, must_change_password = true } = req.body;

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

    try {
        // Role verification
        const targetRole = await dbAdapter.get('SELECT * FROM roles WHERE id = ?', [role_id]);
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

        const passwordHash = hashPassword(password);
        const insertRes = await dbAdapter.run(`
            INSERT INTO users (
                branch_id, role_id, username, email, full_name, phone, password_hash,
                is_active, must_change_password, token_version, password_changed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, 1, CURRENT_TIMESTAMP)
        `, [
            assignedBranchId,
            role_id,
            cleanUsername,
            cleanEmail,
            full_name.trim(),
            phone || '+254 700 000 000',
            passwordHash,
            Boolean(must_change_password)
        ]);

        const newUserId = insertRes.insertId;

        // If driver role, create corresponding drivers record
        if (targetRole.name === 'DRIVER') {
            const licenseNo = req.body.license_number || `DL-${cleanUsername.toUpperCase()}-01`;
            await dbAdapter.run(`
                INSERT INTO drivers (user_id, branch_id, license_number, phone, status)
                VALUES (?, ?, ?, ?, 'AVAILABLE')
            `, [newUserId, assignedBranchId, licenseNo, phone || '+254 700 000 000']);
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

        const createdUser = await dbAdapter.get(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
                   u.must_change_password, u.token_version,
                   r.name as role_name, r.display_name as role_display_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
        `, [newUserId]);

        res.status(201).json(createdUser);
    } catch (err) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('duplicate key'))) {
            return res.status(409).json({ error: 'Username or email already exists in system' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/:id - Edit staff or toggle active status
router.put('/:id', authenticateToken, authorize('users', 'edit', { entityTable: 'users', idParam: 'id' }), async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
        const targetUser = req.targetEntity || await dbAdapter.get('SELECT * FROM users WHERE id = ?', [targetUserId]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Branch isolation check: Branch Manager cannot touch users of other branches or Super Admin
        if (req.user.roleName !== 'SUPER_ADMIN') {
            if (targetUser.branch_id !== req.user.branchId) {
                return res.status(403).json({ error: 'Forbidden: You cannot modify users from another branch.' });
            }
            const targetRole = await dbAdapter.get('SELECT name FROM roles WHERE id = ?', [targetUser.role_id]);
            if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole?.name)) {
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
            mustChangePassword = true;
            // Invalidate active sessions
            await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE user_id = ?', [targetUserId]);
        }

        const activeVal = is_active !== undefined ? Boolean(is_active) : Boolean(targetUser.is_active);

        await dbAdapter.run(`
            UPDATE users
            SET full_name = ?, phone = ?, is_active = ?, password_hash = ?,
                token_version = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            full_name || targetUser.full_name,
            phone || targetUser.phone,
            activeVal,
            passwordHash,
            tokenVersion,
            Boolean(mustChangePassword),
            targetUserId
        ]);

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
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/:id/force-logout - Admin forcibly terminates all sessions for a user
router.post('/:id/force-logout', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
        const targetUser = await dbAdapter.get('SELECT id, branch_id, role_id, username, token_version FROM users WHERE id = ?', [targetUserId]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.roleName !== 'SUPER_ADMIN') {
            if (targetUser.branch_id !== req.user.branchId) {
                return res.status(403).json({ error: 'Forbidden: You cannot force logout staff from another branch.' });
            }
            const targetRole = await dbAdapter.get('SELECT name FROM roles WHERE id = ?', [targetUser.role_id]);
            if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole?.name)) {
                return res.status(403).json({ error: 'Forbidden: Cannot terminate administrative user sessions.' });
            }
        }

        // Increment token version
        await dbAdapter.run(`
            UPDATE users
            SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [targetUserId]);

        // Terminate all sessions
        await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE user_id = ?', [targetUserId]);

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
    } catch (err) {
        console.error('Force logout error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/:id/reset-password - Admin resets password & enforces first-login password change
router.post('/:id/reset-password', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
        const targetUser = req.targetEntity || await dbAdapter.get('SELECT id, branch_id, role_id, username, email FROM users WHERE id = ?', [targetUserId]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.roleName !== 'SUPER_ADMIN') {
            if (targetUser.branch_id !== req.user.branchId) {
                return res.status(403).json({ error: 'Forbidden: Cannot reset password for staff at another branch.' });
            }
            const targetRole = await dbAdapter.get('SELECT name FROM roles WHERE id = ?', [targetUser.role_id]);
            if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole?.name)) {
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

        await dbAdapter.run(`
            UPDATE users
            SET password_hash = ?,
                must_change_password = true,
                token_version = token_version + 1,
                failed_login_attempts = 0,
                locked_until = NULL,
                password_changed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [passwordHash, targetUserId]);

        // Deactivate all existing sessions
        await dbAdapter.run('UPDATE user_sessions SET is_active = false WHERE user_id = ?', [targetUserId]);

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
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/:id/unlock - Admin manually unlocks locked account
router.post('/:id/unlock', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
        const targetUser = req.targetEntity || await dbAdapter.get('SELECT id, branch_id, role_id, username FROM users WHERE id = ?', [targetUserId]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.roleName !== 'SUPER_ADMIN') {
            if (targetUser.branch_id !== req.user.branchId) {
                return res.status(403).json({ error: 'Forbidden: Cannot unlock user from another branch.' });
            }
        }

        await dbAdapter.run(`
            UPDATE users
            SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [targetUserId]);

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
    } catch (err) {
        console.error('Unlock user error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:id/login-history - Admin audits login history for user
router.get('/:id/login-history', authenticateToken, authorize('users', 'manage', { entityTable: 'users', idParam: 'id' }), async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
        const targetUser = req.targetEntity || await dbAdapter.get('SELECT id, branch_id, username FROM users WHERE id = ?', [targetUserId]);

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.user.roleName !== 'SUPER_ADMIN' && targetUser.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot view login history for staff from another branch.' });
        }

        const history = await dbAdapter.all(`
            SELECT id, username_attempted, status, failure_reason, ip_address, user_agent, created_at
            FROM login_history
            WHERE user_id = ? OR username_attempted = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [targetUserId, targetUser.username]);

        res.json(history);
    } catch (err) {
        console.error('Login history error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/security/failed-logins - Admin audits system failed logins
router.get('/security/failed-logins', authenticateToken, authorize('audit', 'failed_logins'), async (req, res) => {
    try {
        let sql = `
            SELECT lh.id, lh.user_id, lh.username_attempted, lh.status, lh.failure_reason,
                   lh.ip_address, lh.user_agent, lh.created_at, lh.branch_id,
                   b.name as branch_name, b.code as branch_code
            FROM login_history lh
            LEFT JOIN branches b ON lh.branch_id = b.id
            WHERE lh.status != 'SUCCESS'
        `;
        const params = [];

        if (req.user.roleName !== 'SUPER_ADMIN') {
            sql += ' AND (lh.branch_id = ? OR lh.branch_id IS NULL)';
            params.push(req.user.branchId);
        }

        sql += ' ORDER BY lh.created_at DESC LIMIT 100';

        const logs = await dbAdapter.all(sql, params);
        res.json(logs);
    } catch (err) {
        console.error('Security failed logins error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/roles - List available roles
router.get('/roles', authenticateToken, async (req, res) => {
    try {
        const roles = await dbAdapter.all('SELECT * FROM roles ORDER BY id ASC');
        res.json(roles);
    } catch (err) {
        console.error('List roles error:', err);
        res.status(500).json({ error: 'Failed to list roles' });
    }
});

module.exports = router;
