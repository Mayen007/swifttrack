// server/routes/branches.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/branches - List branches (Super Admin sees detailed metrics; operational roles see network directory)
router.get('/', authenticateToken, authorize('branches', 'view'), (req, res) => {
    const { city, search, is_active } = req.query;

    if (req.user.roleName === 'SUPER_ADMIN') {
        const where = [];
        const params = [];

        if (city) {
            where.push('b.city = ?');
            params.push(city);
        }
        if (search) {
            where.push('(b.name LIKE ? OR b.code LIKE ? OR b.city LIKE ?)');
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }
        if (is_active !== undefined) {
            where.push('b.is_active = ?');
            params.push(Number(is_active));
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const branches = db.prepare(`
            SELECT b.*,
                   (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = 1) as staff_count,
                   (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = 1) as warehouse_count,
                   (SELECT count(*) FROM orders WHERE branch_id = b.id) as total_orders
            FROM branches b
            ${whereSql}
            ORDER BY b.id ASC
        `).all(...params);
        return res.json(branches);
    }

    // Operational staff see active branch directory (needed for inter-hub transfers, dispatch routing, and station switching)
    const where = ['b.is_active = 1'];
    const params = [req.user.branchId || 0, req.user.branchId || 0];

    if (city) {
        where.push('b.city = ?');
        params.push(city);
    }
    if (search) {
        where.push('(b.name LIKE ? OR b.code LIKE ? OR b.city LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const branches = db.prepare(`
        SELECT b.id, b.code, b.name, b.city, b.address, b.phone, b.email, b.is_active,
               CASE WHEN b.id = ? THEN (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = 1) ELSE 0 END as staff_count,
               (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = 1) as warehouse_count,
               CASE WHEN b.id = ? THEN (SELECT count(*) FROM orders WHERE branch_id = b.id) ELSE 0 END as total_orders
        FROM branches b
        ${whereSql}
        ORDER BY b.id ASC
    `).all(...params);

    res.json(branches);
});

// GET /api/branches/:id - Get specific branch (Enforces branch isolation)
router.get('/:id', authenticateToken, authorize('branches', 'view'), (req, res) => {
    const targetBranchId = Number(req.params.id);

    if (req.user.roleName !== 'SUPER_ADMIN' && targetBranchId !== Number(req.user.branchId)) {
        return res.status(403).json({
            error: `Forbidden: Branch isolation policy blocks access to branch ${targetBranchId}. You are bound to branch ${req.user.branchId}.`
        });
    }

    const branch = db.prepare(`
        SELECT b.*,
               (SELECT count(*) FROM users WHERE branch_id = b.id AND is_active = 1) as staff_count,
               (SELECT count(*) FROM warehouses WHERE branch_id = b.id AND is_active = 1) as warehouse_count
        FROM branches b
        WHERE b.id = ?
    `).get(targetBranchId);

    if (!branch) {
        return res.status(404).json({ error: 'Branch not found' });
    }

    const warehouses = db.prepare('SELECT * FROM warehouses WHERE branch_id = ? AND is_active = 1').all(targetBranchId);

    res.json({ ...branch, warehouses });
});

// POST /api/branches - Create branch (SUPER_ADMIN ONLY)
router.post('/', authenticateToken, authorize('branches', 'create'), (req, res) => {
    const { code, name, city, address, phone, email } = req.body;

    if (!code || !name || !city || !address || !phone || !email) {
        return res.status(400).json({ error: 'All branch details (code, name, city, address, phone, email) are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO branches (code, name, city, address, phone, email, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(code.toUpperCase().trim(), name.trim(), city.trim(), address.trim(), phone.trim(), email.trim());

        const newBranchId = result.lastInsertRowid;

        // Automatically create a default retail depot warehouse for this new branch
        const warehouseCode = `W-${code.toUpperCase().trim()}-01`;
        db.prepare(`
            INSERT INTO warehouses (branch_id, code, name, location_desc, is_active)
            VALUES (?, ?, ?, 'Main Depot', 1)
        `).run(newBranchId, warehouseCode, `${name} Depot`);

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'BRANCH',
            resourceId: String(newBranchId),
            branchId: newBranchId,
            newValue: { code, name, city, address },
            reason: 'Created new company branch'
        });

        const createdBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(newBranchId);
        res.status(201).json(createdBranch);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: `Branch code '${code}' already exists.` });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/branches/:id - Edit branch
router.put('/:id', authenticateToken, authorize('branches', 'manage', { entityTable: 'branches', idParam: 'id', branchColumn: 'id' }), (req, res) => {
    const targetBranchId = Number(req.params.id);

    const { name, city, address, phone, email, is_active } = req.body;
    const previous = db.prepare('SELECT * FROM branches WHERE id = ?').get(targetBranchId);

    if (!previous) {
        return res.status(404).json({ error: 'Branch not found' });
    }

    const activeVal = (req.user.roleName === 'SUPER_ADMIN' && is_active !== undefined) ? (is_active ? 1 : 0) : previous.is_active;

    db.prepare(`
        UPDATE branches
        SET name = ?, city = ?, address = ?, phone = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name || previous.name,
        city || previous.city,
        address || previous.address,
        phone || previous.phone,
        email || previous.email,
        activeVal,
        targetBranchId
    );

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'UPDATE',
        resource: 'BRANCH',
        resourceId: String(targetBranchId),
        branchId: targetBranchId,
        previousValue: previous,
        newValue: { name, city, address, phone, email, is_active: activeVal },
        reason: 'Updated branch profile'
    });

    const updated = db.prepare('SELECT * FROM branches WHERE id = ?').get(targetBranchId);
    res.json(updated);
});

// GET /api/branches/:id/warehouses - List warehouses for a branch
router.get('/:id/warehouses', authenticateToken, (req, res) => {
    const targetBranchId = Number(req.params.id);

    if (req.user.roleName !== 'SUPER_ADMIN' && targetBranchId !== Number(req.user.branchId)) {
        return res.status(403).json({ error: 'Forbidden: Cannot view warehouses of an unauthorized branch.' });
    }

    const warehouses = db.prepare('SELECT * FROM warehouses WHERE branch_id = ? AND is_active = 1').all(targetBranchId);
    res.json(warehouses);
});

// POST /api/branches/:id/warehouses - Create warehouse (SUPER_ADMIN or BRANCH_MANAGER of own branch)
router.post('/:id/warehouses', authenticateToken, (req, res) => {
    const targetBranchId = Number(req.params.id);

    if (req.user.roleName !== 'SUPER_ADMIN' && (req.user.roleName !== 'BRANCH_MANAGER' || targetBranchId !== Number(req.user.branchId))) {
        return res.status(403).json({ error: 'Forbidden: Cannot create warehouses for this branch.' });
    }

    const { code, name, location_desc } = req.body;
    if (!code || !name) {
        return res.status(400).json({ error: 'Warehouse code and name are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO warehouses (branch_id, code, name, location_desc, is_active)
            VALUES (?, ?, ?, ?, 1)
        `).run(targetBranchId, code.toUpperCase().trim(), name.trim(), location_desc || '');

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'WAREHOUSE',
            resourceId: String(result.lastInsertRowid),
            branchId: targetBranchId,
            newValue: { code, name, branch_id: targetBranchId },
            reason: 'Added new warehouse facility'
        });

        res.status(201).json({ id: result.lastInsertRowid, branch_id: targetBranchId, code, name });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
