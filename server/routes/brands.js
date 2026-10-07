// server/routes/brands.js
// Brand Entity Master Routing
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');

// GET / - List all active brands with product counts
router.get('/', authenticateToken, async (req, res) => {
    try {
        const brands = await dbAdapter.all(`
            SELECT b.*,
                   (SELECT count(*) FROM products WHERE brand_id = b.id AND is_active = true AND is_archived = false) as product_count
            FROM brands b
            WHERE b.is_active = true
            ORDER BY b.name ASC
        `);
        res.json(brands);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST / - Create brand
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    const { code, name, description, logo_url } = req.body;
    if (!code || !name) {
        return res.status(400).json({ error: 'Code and Name are required' });
    }

    try {
        const result = await dbAdapter.run(`
            INSERT INTO brands (code, name, description, logo_url, is_active)
            VALUES (?, ?, ?, ?, true)
        `, [code.toUpperCase().trim(), name.trim(), description || '', logo_url || null]);

        const created = await dbAdapter.get('SELECT * FROM brands WHERE id = ?', [result.insertId]);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique') || err.code === '23505') {
            return res.status(409).json({ error: 'Brand code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update brand
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, description, logo_url, is_active } = req.body;

        await dbAdapter.run(`
            UPDATE brands
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                logo_url = COALESCE(?, logo_url),
                is_active = COALESCE(?, is_active)
            WHERE id = ?
        `, [name, description, logo_url, is_active !== undefined ? is_active : null, id]);

        const updated = await dbAdapter.get('SELECT * FROM brands WHERE id = ?', [id]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
