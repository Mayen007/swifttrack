// server/routes/promotions.js
// Scheduled Promotions & Discount Vouchers Route
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET / - List promotions (with status & branch filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { active_only, branch_id } = req.query;
        let query = 'SELECT * FROM promotions WHERE 1=1';
        const params = [];

        if (active_only === 'true') {
            const nowIso = new Date().toISOString();
            query += ' AND is_active = true AND start_date <= ? AND end_date >= ?';
            params.push(nowIso, nowIso);
        }
        if (branch_id) {
            query += ' AND (branch_id IS NULL OR branch_id = ?)';
            params.push(Number(branch_id));
        }

        query += ' ORDER BY created_at DESC';
        const promos = await dbAdapter.all(query, params);
        res.json(promos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id - Get specific promotion
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const promo = await dbAdapter.get('SELECT * FROM promotions WHERE id = ?', [Number(req.params.id)]);
        if (!promo) return res.status(404).json({ error: 'Promotion not found' });
        res.json(promo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST / - Create promotion
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    const {
        promo_code, name, description, discount_type, discount_value,
        scope, target_id, branch_id, min_spend, min_quantity, usage_limit,
        start_date, end_date
    } = req.body;

    if (!name || !discount_type || discount_value === undefined || !start_date || !end_date) {
        return res.status(400).json({ error: 'Name, discount type, discount value, start date, and end date are required' });
    }

    try {
        const result = await dbAdapter.run(`
            INSERT INTO promotions (
                promo_code, name, description, discount_type, discount_value,
                scope, target_id, branch_id, min_spend, min_quantity, usage_limit,
                start_date, end_date, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
        `, [
            promo_code ? promo_code.toUpperCase().trim() : null,
            name.trim(),
            description || '',
            discount_type,
            Number(discount_value),
            scope || 'ALL',
            target_id ? Number(target_id) : null,
            branch_id ? Number(branch_id) : null,
            min_spend ? Number(min_spend) : 0.0,
            min_quantity ? Number(min_quantity) : 1,
            usage_limit ? Number(usage_limit) : null,
            start_date,
            end_date
        ]);

        await logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE',
            resource: 'PROMOTION',
            resourceId: String(result.insertId),
            branchId: req.user.branchId,
            newValue: { name, promo_code, discount_type, discount_value },
            reason: 'Created promotional campaign / discount code'
        });

        const created = await dbAdapter.get('SELECT * FROM promotions WHERE id = ?', [result.insertId]);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique') || err.code === '23505') {
            return res.status(409).json({ error: 'Promo code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update promotion
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const promoId = Number(req.params.id);
        const prev = await dbAdapter.get('SELECT * FROM promotions WHERE id = ?', [promoId]);
        if (!prev) return res.status(404).json({ error: 'Promotion not found' });

        const {
            promo_code, name, description, discount_type, discount_value,
            scope, target_id, branch_id, min_spend, min_quantity, usage_limit,
            start_date, end_date, is_active
        } = req.body;

        await dbAdapter.run(`
            UPDATE promotions
            SET promo_code = ?, name = ?, description = ?, discount_type = ?, discount_value = ?,
                scope = ?, target_id = ?, branch_id = ?, min_spend = ?, min_quantity = ?,
                usage_limit = ?, start_date = ?, end_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            promo_code !== undefined ? (promo_code ? promo_code.toUpperCase().trim() : null) : prev.promo_code,
            name || prev.name,
            description !== undefined ? description : prev.description,
            discount_type || prev.discount_type,
            discount_value !== undefined ? Number(discount_value) : prev.discount_value,
            scope || prev.scope,
            target_id !== undefined ? (target_id ? Number(target_id) : null) : prev.target_id,
            branch_id !== undefined ? (branch_id ? Number(branch_id) : null) : prev.branch_id,
            min_spend !== undefined ? Number(min_spend) : prev.min_spend,
            min_quantity !== undefined ? Number(min_quantity) : prev.min_quantity,
            usage_limit !== undefined ? (usage_limit ? Number(usage_limit) : null) : prev.usage_limit,
            start_date || prev.start_date,
            end_date || prev.end_date,
            is_active !== undefined ? Boolean(is_active) : prev.is_active,
            promoId
        ]);

        const updated = await dbAdapter.get('SELECT * FROM promotions WHERE id = ?', [promoId]);
        res.json(updated);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique') || err.code === '23505') {
            return res.status(409).json({ error: 'Promo code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id - Deactivate promotion
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const promoId = Number(req.params.id);
        await dbAdapter.run('UPDATE promotions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [promoId]);
        res.json({ success: true, message: 'Promotion deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
