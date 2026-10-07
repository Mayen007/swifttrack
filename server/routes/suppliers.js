// server/routes/suppliers.js
// Supplier Entity Master & Directory Routing (Phase 8 Enhanced)
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { getSupplierPerformance, getSupplierHistory } = require('../services/procurementService.js');

// GET / - List all active suppliers with performance aggregates
router.get('/', authenticateToken, async (req, res) => {
    try {
        const suppliers = await dbAdapter.all(`
            SELECT s.*,
                   (SELECT count(*) FROM products WHERE supplier_id = s.id AND is_active = true AND is_archived = false) as product_count,
                   (SELECT count(*) FROM supplier_contacts WHERE supplier_id = s.id) as contacts_count,
                   (SELECT count(*) FROM purchase_orders WHERE supplier_id = s.id AND status != 'CANCELLED') as total_orders,
                   COALESCE((SELECT sum(total_amount) FROM purchase_orders WHERE supplier_id = s.id AND status != 'CANCELLED'), 0.0) as total_spend
            FROM suppliers s
            WHERE s.is_active = true
            ORDER BY s.name ASC
        `);
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id - Supplier profile with contacts, products, performance, and history
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const supplier = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [id]);
        if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

        const contacts = await dbAdapter.all(`
            SELECT * FROM supplier_contacts WHERE supplier_id = ? ORDER BY is_primary DESC, name ASC
        `, [id]);

        const products = await dbAdapter.all(`
            SELECT sp.*, p.name as product_name, p.sku, p.barcode, p.unit, p.selling_price
            FROM supplier_products sp
            JOIN products p ON sp.product_id = p.id
            WHERE sp.supplier_id = ?
            ORDER BY p.name ASC
        `, [id]);

        let performance = null;
        let history = [];
        try {
            performance = await getSupplierPerformance(id);
            history = await getSupplierHistory(id);
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /:id/performance - Performance scorecard
router.get('/:id/performance', authenticateToken, async (req, res) => {
    try {
        const perf = await getSupplierPerformance(Number(req.params.id));
        res.json(perf);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// GET /:id/history - Chronological procurement history
router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
        const hist = await getSupplierHistory(Number(req.params.id));
        res.json(hist);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// POST / - Create supplier
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    const {
        code, name, contact_person, email, phone, address, city, country,
        lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
        bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no, rating, notes
    } = req.body;

    if (!code || !name || !phone) {
        return res.status(400).json({ error: 'Code, Name, and Phone are required' });
    }

    try {
        const result = await dbAdapter.run(`
            INSERT INTO suppliers (
                code, name, contact_person, email, phone, address, city, country,
                lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
                bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no,
                rating, notes, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
        `, [
            code.toUpperCase().trim(),
            name.trim(),
            contact_person || '',
            email || '',
            phone.trim(),
            address || '',
            city || '',
            country || 'Kenya',
            Number(lead_time_days) || 3,
            payment_terms || 'NET30',
            tax_pin ? tax_pin.toUpperCase().trim() : null,
            vat_registered !== undefined ? Boolean(vat_registered) : true,
            Number(withholding_tax_rate) || 0.0,
            bank_name || null,
            bank_account_no || null,
            bank_branch || null,
            mpesa_paybill || null,
            mpesa_account_no || null,
            Number(rating) || 5.0,
            notes || ''
        ]);

        const created = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('unique') || err.code === '23505') {
            return res.status(409).json({ error: 'Supplier code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /:id - Update supplier
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const prev = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [id]);
        if (!prev) return res.status(404).json({ error: 'Supplier not found' });

        const {
            name, contact_person, email, phone, address, city, country,
            lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
            bank_name, bank_account_no, bank_branch, mpesa_paybill, mpesa_account_no,
            rating, notes, is_active
        } = req.body;

        await dbAdapter.run(`
            UPDATE suppliers
            SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, city = ?, country = ?,
                lead_time_days = ?, payment_terms = ?, tax_pin = ?, vat_registered = ?, withholding_tax_rate = ?,
                bank_name = ?, bank_account_no = ?, bank_branch = ?, mpesa_paybill = ?, mpesa_account_no = ?,
                rating = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
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
            vat_registered !== undefined ? Boolean(vat_registered) : prev.vat_registered,
            withholding_tax_rate !== undefined ? Number(withholding_tax_rate) : prev.withholding_tax_rate,
            bank_name !== undefined ? bank_name : prev.bank_name,
            bank_account_no !== undefined ? bank_account_no : prev.bank_account_no,
            bank_branch !== undefined ? bank_branch : prev.bank_branch,
            mpesa_paybill !== undefined ? mpesa_paybill : prev.mpesa_paybill,
            mpesa_account_no !== undefined ? mpesa_account_no : prev.mpesa_account_no,
            rating !== undefined ? Number(rating) : prev.rating,
            notes !== undefined ? notes : prev.notes,
            is_active !== undefined ? Boolean(is_active) : prev.is_active,
            id
        ]);

        const updated = await dbAdapter.get('SELECT * FROM suppliers WHERE id = ?', [id]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Contacts Management
// POST /:id/contacts - Add contact person
router.post('/:id/contacts', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const supplierId = Number(req.params.id);
        const { name, role, email, phone, is_primary } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Name and Phone are required' });

        if (is_primary) {
            await dbAdapter.run('UPDATE supplier_contacts SET is_primary = false WHERE supplier_id = ?', [supplierId]);
        }

        const resDb = await dbAdapter.run(`
            INSERT INTO supplier_contacts (supplier_id, name, role, email, phone, is_primary)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [supplierId, name.trim(), role || '', email || '', phone.trim(), Boolean(is_primary)]);

        const created = await dbAdapter.get('SELECT * FROM supplier_contacts WHERE id = ?', [resDb.insertId]);
        res.status(201).json(created);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/contacts/:contactId - Delete contact person
router.delete('/:id/contacts/:contactId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        await dbAdapter.run('DELETE FROM supplier_contacts WHERE id = ? AND supplier_id = ?', [
            Number(req.params.contactId),
            Number(req.params.id)
        ]);
        res.json({ success: true, message: 'Contact removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Products Catalog Management
// GET /:id/products - Get supplier products
router.get('/:id/products', authenticateToken, async (req, res) => {
    try {
        const products = await dbAdapter.all(`
            SELECT sp.*, p.name as product_name, p.sku, p.barcode, p.unit, p.selling_price
            FROM supplier_products sp
            JOIN products p ON sp.product_id = p.id
            WHERE sp.supplier_id = ?
            ORDER BY p.name ASC
        `, [Number(req.params.id)]);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/products - Add/update product contracted price
router.post('/:id/products', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        const supplierId = Number(req.params.id);
        const { product_id, supplier_sku, agreed_cost, min_order_quantity, lead_time_days, is_preferred } = req.body;

        if (!product_id || agreed_cost === undefined) {
            return res.status(400).json({ error: 'Product ID and Agreed Cost are required' });
        }

        await dbAdapter.run(`
            INSERT INTO supplier_products (
                supplier_id, product_id, supplier_sku, agreed_cost, min_order_quantity, lead_time_days, is_preferred
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(supplier_id, product_id) DO UPDATE SET
                supplier_sku = excluded.supplier_sku,
                agreed_cost = excluded.agreed_cost,
                min_order_quantity = excluded.min_order_quantity,
                lead_time_days = excluded.lead_time_days,
                is_preferred = excluded.is_preferred
        `, [
            supplierId,
            Number(product_id),
            supplier_sku || null,
            Number(agreed_cost),
            Number(min_order_quantity) || 1,
            Number(lead_time_days) || 3,
            Boolean(is_preferred)
        ]);

        const saved = await dbAdapter.get(`
            SELECT sp.*, p.name as product_name, p.sku, p.unit
            FROM supplier_products sp
            JOIN products p ON sp.product_id = p.id
            WHERE sp.supplier_id = ? AND sp.product_id = ?
        `, [supplierId, Number(product_id)]);

        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /:id/products/:productId - Remove product from supplier catalog
router.delete('/:id/products/:productId', authenticateToken, requireRole('SUPER_ADMIN', 'BRANCH_MANAGER'), async (req, res) => {
    try {
        await dbAdapter.run('DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?', [
            Number(req.params.id),
            Number(req.params.productId)
        ]);
        res.json({ success: true, message: 'Product removed from supplier catalog' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
