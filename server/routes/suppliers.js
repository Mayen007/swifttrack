// server/routes/suppliers.js
// Supplier Entity Master & Directory Routing (Phase 8 Enhanced)
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { getSupplierPerformance, getSupplierHistory } = require('../services/procurementService.js');

// GET / - List all active suppliers with performance aggregates
router.get('/', authenticateToken, (req, res) => {
    const suppliers = db.prepare(`
        SELECT s.*,
               (SELECT count(*) FROM products WHERE supplier_id = s.id AND is_active = 1 AND is_archived = 0) as product_count,
               (SELECT count(*) FROM supplier_contacts WHERE supplier_id = s.id) as contacts_count,
               (SELECT count(*) FROM purchase_orders WHERE supplier_id = s.id AND status != 'CANCELLED') as total_orders,
               COALESCE((SELECT sum(total_amount) FROM purchase_orders WHERE supplier_id = s.id AND status != 'CANCELLED'), 0.0) as total_spend
        FROM suppliers s
        WHERE s.is_active = 1
        ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
});

// GET /:id - Supplier profile with contacts, products, performance, and history
router.get('/:id', authenticateToken, (req, res) => {
    const id = Number(req.params.id);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const contacts = db.prepare(`
        SELECT * FROM supplier_contacts WHERE supplier_id = ? ORDER BY is_primary DESC, name ASC
    `).all(id);

    const products = db.prepare(`
        SELECT sp.*, p.name as product_name, p.sku, p.barcode, p.unit, p.selling_price
        FROM supplier_products sp
        JOIN products p ON sp.product_id = p.id
        WHERE sp.supplier_id = ?
        ORDER BY p.name ASC
    `).all(id);

    let performance = null;
    let history = [];
    try {
        performance = getSupplierPerformance(id);
        history = getSupplierHistory(id);
    } catch (err) {
        console.warn('Supplier telemetry notice:', err.message);
    }

    res.json({
        ...supplier,
        contacts,
        products,
        performance,
        history
    });
});

// GET /:id/performance - Performance scorecard
router.get('/:id/performance', authenticateToken, (req, res) => {
    try {
        const perf = getSupplierPerformance(Number(req.params.id));
        res.json(perf);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// GET /:id/history - Chronological procurement history
router.get('/:id/history', authenticateToken, (req, res) => {
    try {
        const hist = getSupplierHistory(Number(req.params.id));
        res.json(hist);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// POST / - Create supplier
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const {
        code, name, contact_person, email, phone, address, city, country,
        lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
        bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no, rating, notes
    } = req.body;

    if (!code || !name || !phone) {
        return res.status(400).json({ error: 'Code, Name, and Phone are required' });
    }

    try {
        const result = db.prepare(`
            INSERT INTO suppliers (
                code, name, contact_person, email, phone, address, city, country,
                lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
                bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no,
                rating, notes, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            code.toUpperCase().trim(),
            name.trim(),
            contact_person || '',
            email || '',
            phone.trim(),
            address || '',
            city || 'Nairobi',
            country || 'Kenya',
            Number(lead_time_days) || 3,
            payment_terms || 'NET30',
            tax_pin ? tax_pin.toUpperCase().trim() : null,
            vat_registered !== undefined ? (vat_registered ? 1 : 0) : 1,
            Number(withholding_tax_rate) || 0.0,
            bank_name || null,
            bank_account_no || null,
            bank_branch || null,
            mpesa_paybill || null,
            mpesa_account_no || null,
            Number(rating) || 5.0,
            notes || ''
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

    const {
        name, contact_person, email, phone, address, city, country,
        lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
        bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no,
        rating, notes, is_active
    } = req.body;

    db.prepare(`
        UPDATE suppliers
        SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, city = ?, country = ?,
            lead_time_days = ?, payment_terms = ?, tax_pin = ?, vat_registered = ?, withholding_tax_rate = ?,
            bank_name = ?, bank_account_no = ?, bank_branch = ?, mpesa_paybill = ?, mpesa_account_no = ?,
            rating = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name || prev.name,
        contact_person !== undefined ? contact_person : prev.contact_person,
        email !== undefined ? email : prev.email,
        phone || prev.phone,
        address !== undefined ? address : prev.address,
        city || prev.city,
        country || prev.country,
        lead_time_days !== undefined ? Number(lead_time_days) : prev.lead_time_days,
        payment_terms || prev.payment_terms,
        tax_pin !== undefined ? (tax_pin ? tax_pin.toUpperCase().trim() : null) : prev.tax_pin,
        vat_registered !== undefined ? (vat_registered ? 1 : 0) : prev.vat_registered,
        withholding_tax_rate !== undefined ? Number(withholding_tax_rate) : prev.withholding_tax_rate,
        bank_name !== undefined ? bank_name : prev.bank_name,
        bank_account_no !== undefined ? bank_account_no : prev.bank_account_no,
        bank_branch !== undefined ? bank_branch : prev.bank_branch,
        mpesa_paybill !== undefined ? mpesa_paybill : prev.mpesa_paybill,
        mpesa_account_no !== undefined ? mpesa_account_no : prev.mpesa_account_no,
        rating !== undefined ? Number(rating) : prev.rating,
        notes !== undefined ? notes : prev.notes,
        is_active !== undefined ? (is_active ? 1 : 0) : prev.is_active,
        id
    );

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.json(updated);
});

// Contacts Management
// POST /:id/contacts - Add contact person
router.post('/:id/contacts', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const supplierId = Number(req.params.id);
    const { name, role, email, phone, is_primary } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and Phone are required' });

    if (is_primary) {
        db.prepare('UPDATE supplier_contacts SET is_primary = 0 WHERE supplier_id = ?').run(supplierId);
    }

    const resDb = db.prepare(`
        INSERT INTO supplier_contacts (supplier_id, name, role, email, phone, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(supplierId, name.trim(), role || '', email || '', phone.trim(), is_primary ? 1 : 0);

    const created = db.prepare('SELECT * FROM supplier_contacts WHERE id = ?').get(resDb.lastInsertRowid);
    res.status(201).json(created);
});

// DELETE /:id/contacts/:contactId - Delete contact person
router.delete('/:id/contacts/:contactId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    db.prepare('DELETE FROM supplier_contacts WHERE id = ? AND supplier_id = ?').run(
        Number(req.params.contactId),
        Number(req.params.id)
    );
    res.json({ success: true, message: 'Contact removed' });
});

// Products Catalog Management
// GET /:id/products - Get supplier products
router.get('/:id/products', authenticateToken, (req, res) => {
    const products = db.prepare(`
        SELECT sp.*, p.name as product_name, p.sku, p.barcode, p.unit, p.selling_price
        FROM supplier_products sp
        JOIN products p ON sp.product_id = p.id
        WHERE sp.supplier_id = ?
        ORDER BY p.name ASC
    `).all(Number(req.params.id));
    res.json(products);
});

// POST /:id/products - Add/update product contracted price
router.post('/:id/products', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    const supplierId = Number(req.params.id);
    const { product_id, supplier_sku, agreed_cost, min_order_quantity, lead_time_days, is_preferred } = req.body;

    if (!product_id || agreed_cost === undefined) {
        return res.status(400).json({ error: 'Product ID and Agreed Cost are required' });
    }

    db.prepare(`
        INSERT INTO supplier_products (
            supplier_id, product_id, supplier_sku, agreed_cost, min_order_quantity, lead_time_days, is_preferred
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(supplier_id, product_id) DO UPDATE SET
            supplier_sku = excluded.supplier_sku,
            agreed_cost = excluded.agreed_cost,
            min_order_quantity = excluded.min_order_quantity,
            lead_time_days = excluded.lead_time_days,
            is_preferred = excluded.is_preferred
    `).run(
        supplierId,
        Number(product_id),
        supplier_sku || null,
        Number(agreed_cost),
        Number(min_order_quantity) || 1,
        Number(lead_time_days) || 3,
        is_preferred ? 1 : 0
    );

    const saved = db.prepare(`
        SELECT sp.*, p.name as product_name, p.sku, p.unit
        FROM supplier_products sp
        JOIN products p ON sp.product_id = p.id
        WHERE sp.supplier_id = ? AND sp.product_id = ?
    `).get(supplierId, Number(product_id));

    res.status(201).json(saved);
});

// DELETE /:id/products/:productId - Remove product from supplier catalog
router.delete('/:id/products/:productId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), (req, res) => {
    db.prepare('DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?').run(
        Number(req.params.id),
        Number(req.params.productId)
    );
    res.json({ success: true, message: 'Product removed from supplier catalog' });
});

module.exports = router;
