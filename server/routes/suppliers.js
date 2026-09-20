// server/routes/suppliers.js
// Supplier Entity Master Routing
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');

// GET / - List all active suppliers
router.get('/', authenticateToken, (req, res) => {
    const suppliers = db.prepare(`
        SELECT s.*,
               (SELECT count(*) FROM products WHERE supplier_id = s.id AND is_active = 1 AND is_archived = 0) as product_count
        FROM suppliers s
        WHERE s.is_active = 1
        ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
});

// POST / - Create supplier
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const { code, name, contact_person, email, phone, address, city, lead_time_days, payment_terms } = req.body;
    if (!code || !name || !phone) {
        return res.status(400).json({ error: 'Code, Name, and Phone are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO suppliers (
                code, name, contact_person, email, phone, address, city, lead_time_days, payment_terms, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            code.toUpperCase().trim(),
            name.trim(),
            contact_person || '',
            email || '',
            phone.trim(),
            address || '',
            city || 'Nairobi',
            Number(lead_time_days) || 3,
            payment_terms || 'NET30'
        );

        const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Supplier code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update supplier
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const id = Number(req.params.id);
    const prev = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!prev) return res.status(404).json({ error: 'Supplier not found' });

    const { name, contact_person, email, phone, address, city, lead_time_days, payment_terms, is_active } = req.body;

    db.prepare(`
        UPDATE suppliers
        SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, city = ?,
            lead_time_days = ?, payment_terms = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name || prev.name,
        contact_person !== undefined ? contact_person : prev.contact_person,
        email !== undefined ? email : prev.email,
        phone || prev.phone,
        address !== undefined ? address : prev.address,
        city || prev.city,
        lead_time_days !== undefined ? Number(lead_time_days) : prev.lead_time_days,
        payment_terms || prev.payment_terms,
        is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
        id
    );

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.json(updated);
});

module.exports = router;
