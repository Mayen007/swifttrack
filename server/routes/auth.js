// server/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { db } = require('../db/database.js');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

function hashPassword(password) {
    const salt = 'swifttrack_secure_salt_2026';
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id, u.password_hash, u.is_active,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE (u.username = ? OR u.email = ?)
    `).get(username, username);

    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_active) {
        return res.status(403).json({ error: 'User account has been deactivated. Please contact Super Admin.' });
    }

    const computedHash = hashPassword(password);
    if (computedHash !== user.password_hash) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Fetch permissions
    const permissionsRows = db.prepare(`
        SELECT p.code
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        JOIN roles r ON rp.role_id = r.id
        WHERE r.name = ?
    `).all(user.role_name);

    const permissions = permissionsRows.map(p => p.code);

    // If driver, fetch driver_id
    let driverProfile = null;
    if (user.role_name === 'DRIVER') {
        driverProfile = db.prepare('SELECT id, license_number, vehicle_id, status FROM drivers WHERE user_id = ?').get(user.id);
    }

    const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role_name,
        branchId: user.branch_id
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Log login audit
    logAuditEvent({
        userId: user.id,
        role: user.role_name,
        action: 'LOGIN',
        resource: 'AUTH',
        resourceId: String(user.id),
        branchId: user.branch_id,
        reason: 'Successful user authentication',
        ipAddress: req.ip || req.socket.remoteAddress
    });

    return res.json({
        token,
        user: {
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
            permissions,
            driverProfile
        }
    });
});

// GET /api/auth/me
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

// POST /api/auth/demo-switch (Allows instant switching among demo roles & branches for evaluation)
router.post('/demo-switch', (req, res) => {
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
            // Mombasa
            if (role === 'CASHIER') targetUsername = 'cashier.mombasa';
            else if (role === 'DRIVER') targetUsername = 'driver.mombasa';
            else targetUsername = 'manager.mombasa';
        } else if (targetBranchId === 3) {
            // Kisumu
            targetUsername = 'manager.kisumu';
        } else if (targetBranchId === 1) {
            // Nairobi
            if (role === 'DISPATCHER') targetUsername = 'dispatcher.nairobi';
            else if (role === 'CASHIER') targetUsername = 'cashier.nairobi';
            else if (role === 'DRIVER') targetUsername = 'driver.nairobi';
            else targetUsername = 'manager.nairobi';
        } else {
            // By role name
            switch (role) {
                case 'SUPER_ADMIN':
                    targetUsername = 'superadmin';
                    break;
                case 'BRANCH_MANAGER':
                case 'BRANCH_MANAGER_NAIROBI':
                    targetUsername = 'manager.nairobi';
                    break;
                case 'BRANCH_MANAGER_MOMBASA':
                    targetUsername = 'manager.mombasa';
                    break;
                case 'BRANCH_MANAGER_KISUMU':
                    targetUsername = 'manager.kisumu';
                    break;
                case 'DISPATCHER':
                    targetUsername = 'dispatcher.nairobi';
                    break;
                case 'CASHIER':
                    targetUsername = 'cashier.nairobi';
                    break;
                case 'DRIVER':
                    targetUsername = 'driver.nairobi';
                    break;
                default:
                    targetUsername = 'superadmin';
            }
        }
    }

    let user = db.prepare(`
        SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id,
               r.name as role_name, r.display_name as role_display_name,
               b.name as branch_name, b.code as branch_code, b.city as branch_city
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.username = ?
    `).get(targetUsername);

    // If specific target username not found, fallback to branch manager or any staff in that branch
    if (!user && targetBranchId) {
        user = db.prepare(`
            SELECT u.id, u.username, u.email, u.full_name, u.phone, u.branch_id,
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

    const tokenPayload = {
        id: user.id,
        username: user.username,
        role: user.role_name,
        branchId: user.branch_id
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
        token,
        user: {
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
            permissions,
            driverProfile
        }
    });
});

module.exports = router;
