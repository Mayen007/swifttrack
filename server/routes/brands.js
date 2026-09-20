// server/routes/brands.js
// Brand Entity Master Routing
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');

// GET / - List all active brands with product counts
router.get('/', authenticateToken, (req, res) => {
    const brands = db.prepare(`
        SELECT b.*,
               (SELECT count(*) FROM products WHERE brand_id = b.id AND is_active = 1 AND is_archived = 0) as product_count
        FROM brands b
        WHERE b.is_active = 1
        ORDER BY b.name ASC
    `).all();
    res.json(brands);
});

// POST / - Create brand
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const { code, name, description, logo_url } = req.body;
    if (!code || !name) {
        return res.status(400).json({ error: 'Code and Name are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO brands (code, name, description, logo_url, is_active)
            VALUES (?, ?, ?, ?, 1)
        `).run(code.toUpperCase().trim(), name.trim(), description || '', logo_url || null);

        const created = db.prepare('SELECT * FROM brands WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Brand code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update brand
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const id = Number(req.params.id);
    const { name, description, logo_url, is_active } = req.body;

    db.prepare(`
        UPDATE brands
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            logo_url = COALESCE(?, logo_url),
            is_active = COALESCE(?, is_active)
        WHERE id = ?
    `).run(name, description, logo_url, is_active, id);

    const updated = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
    res.json(updated);
});

module.exports = router;
