// server/routes/users.js
const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { hashPassword } = require('../utils/security.js');

// GET /api/users - List users (Super Admin sees all, Branch Manager sees only staff at own branch)
router.get('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    let query = `
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active, u.last_login_at, u.created_at,
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

// POST /api/users - Create staff member
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const { username, email, full_name, phone, password, role_id, branch_id } = req.body;

    if (!username || !email || !full_name || !password || !role_id) {
        return res.status(400).json({ error: 'Username, email, full_name, password, and role_id are required' });
    }

    // Role verification
    const targetRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(role_id);
    if (!targetRole) {
        return res.status(400).json({ error: 'Invalid role selected' });
    }

    let assignedBranchId;

    if (req.user.roleName === 'SUPER_ADMIN') {
        // Super Admin can assign to any branch or none (for global admin)
        assignedBranchId = targetRole.name === 'SUPER_ADMIN' ? null : (branch_id ? Number(branch_id) : 1);
    } else {
        // Branch Manager restrictions:
        // 1. Cannot create SUPER_ADMIN or BRANCH_MANAGER
        if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(targetRole.name)) {
            return res.status(403).json({ error: 'Forbidden: Branch Managers can only provision operational staff (Cashier, Dispatcher, Driver).' });
        }
        // 2. Must assign to their own branch strictly
        assignedBranchId = req.user.branchId;
    }

    try {
        const passwordHash = hashPassword(password);
        const result = db.prepare(`
            INSERT INTO users (branch_id, role_id, username, email, full_name, phone, password_hash, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            assignedBranchId,
            role_id,
            username.toLowerCase().trim(),
            email.toLowerCase().trim(),
            full_name.trim(),
            phone || '+254 700 000 000',
            passwordHash
        );

        const newUserId = result.lastInsertRowid;

        // If driver role, create corresponding drivers record
        if (targetRole.name === 'DRIVER') {
            const licenseNo = req.body.license_number || `DL-${username.toUpperCase()}-01`;
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
            newValue: { username, email, full_name, role: targetRole.name, branch_id: assignedBranchId },
            reason: 'Provisioned new staff user'
        });

        const createdUser = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.is_active,
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
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const targetUserId = Number(req.params.id);
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);

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
    if (password && password.length >= 6) {
        passwordHash = hashPassword(password);
    }

    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : targetUser.is_active;

    db.prepare(`
        UPDATE users
        SET full_name = ?, phone = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        full_name || targetUser.full_name,
        phone || targetUser.phone,
        activeVal,
        passwordHash,
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

// GET /api/users/roles - List available roles
router.get('/roles', authenticateToken, (req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
    res.json(roles);
});

module.exports = router;
