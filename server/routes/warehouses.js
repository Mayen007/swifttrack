// server/routes/warehouses.js
// Warehouse Master & Storage Facilities Router
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');

// GET /api/warehouses - List warehouses (respecting branch isolation)
router.get('/', authenticateToken, (req, res) => {
    try {
        const { branch_id, search, is_active } = req.query;
        const isSuperAdmin = req.user.roleName === 'SUPER_ADMIN';
        
        let targetBranchId = null;
        if (!isSuperAdmin) {
            targetBranchId = req.user.branchId;
        } else if (branch_id && branch_id !== 'all') {
            targetBranchId = Number(branch_id);
        }

        let query = `
            SELECT w.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM warehouses w
            JOIN branches b ON w.branch_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (targetBranchId) {
            query += ' AND w.branch_id = ?';
            params.push(targetBranchId);
        }

        if (is_active !== undefined) {
            query += ' AND w.is_active = ?';
            params.push(Number(is_active));
        } else {
            query += ' AND w.is_active = 1';
        }

        if (search) {
            query += ' AND (w.name LIKE ? OR w.code LIKE ? OR w.location_desc LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        query += ' ORDER BY w.branch_id ASC, w.id ASC';
        const warehouses = db.prepare(query).all(...params);
        res.json(warehouses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/warehouses/:id - Get specific warehouse details
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const id = Number(req.params.id);
        const wh = db.prepare(`
            SELECT w.*, b.name as branch_name, b.code as branch_code, b.city as branch_city
            FROM warehouses w
            JOIN branches b ON w.branch_id = b.id
            WHERE w.id = ?
        `).get(id);

        if (!wh) {
            return res.status(404).json({ error: 'Warehouse not found' });
        }

        if (req.user.roleName !== 'SUPER_ADMIN' && wh.branch_id !== Number(req.user.branchId)) {
            return res.status(403).json({ error: 'Forbidden: Cannot view warehouse belonging to another branch' });
        }

        res.json(wh);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/warehouses - Create warehouse (SUPER_ADMIN or BRANCH_MANAGER of own branch)
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    try {
        const { branch_id, code, name, location_desc } = req.body;
        const targetBranchId = req.user.roleName === 'SUPER_ADMIN'
            ? Number(branch_id || req.user.branchId || 1)
            : Number(req.user.branchId);

        if (!code || !name) {
            return res.status(400).json({ error: 'Warehouse code and name are required' });
        }

        const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code.trim().toUpperCase());
        if (existing) {
            return res.status(400).json({ error: `Warehouse with code '${code}' already exists` });
        }

        const result = db.prepare(`
            INSERT INTO warehouses (branch_id, code, name, location_desc, is_active)
            VALUES (?, ?, ?, ?, 1)
        `).run(targetBranchId, code.trim().toUpperCase(), name.trim(), location_desc ? location_desc.trim() : null);

        const created = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
