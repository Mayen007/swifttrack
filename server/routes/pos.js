// server/routes/pos.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/pos/products - Fast search for POS terminal
router.get('/products', authenticateToken, requireRole('CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'), (req, res) => {
    const branchId = req.user.branchId || 1;
    const { q, category_id } = req.query;

    let query = `
        SELECT p.id, p.sku, p.barcode, p.name, p.unit,
               p.selling_price,
               p.selling_price as price,
               p.min_stock_alert,
               c.name as category,
               c.name as category_name,
               c.id as category_id,
               COALESCE(SUM(i.quantity_available), 0) as available_qty
        FROM products p
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
        WHERE p.is_active = 1
    `;
    const params = [branchId];

    if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(Number(category_id));
    }

    if (q) {
        query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
        const s = `%${q.trim()}%`;
        params.push(s, s, s);
    }

    query += ' GROUP BY p.id ORDER BY p.name ASC LIMIT 50';

    const products = db.prepare(query).all(...params);
    res.json(products);
});

// POST /api/pos/checkout - Complete POS sale with atomic stock deduction and Kenya receipt generation
router.post('/checkout', authenticateToken, requireRole('CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'), (req, res) => {
    const branchId = req.user.branchId || 1;
    const {
        customer_id,
        items, // Array: [{ product_id, quantity, unit_price, discount_amount }]
        payment_method, // 'CASH', 'MPESA', 'CARD', 'BANK_TRANSFER'
        amount_tendered,
        mpesa_phone,
        mpesa_receipt,
        card_ref,
        notes
    } = req.body;

    if (!items || !items.length) {
        return res.status(400).json({ error: 'Cart is empty. Please add items to checkout.' });
    }

    if (!payment_method) {
        return res.status(400).json({ error: 'Payment method is required.' });
    }

    // Default to Walk-in customer (id: 1) if not provided
    const targetCustomerId = customer_id || 1;

    // Pick first available active warehouse for this branch
    const warehouse = db.prepare('SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY id ASC').get(branchId);
    if (!warehouse) {
        return res.status(400).json({ error: 'No active warehouse configured for this branch to deduct stock from.' });
    }
    const warehouseId = warehouse.id;

    // Fetch company settings for tax and eTIMS info
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();
    const vatRate = company ? company.vat_rate : 16.0;

    let subtotal = 0;
    let totalDiscount = 0;

    // Validate item stock & calculate totals
    const preparedItems = [];
    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
            return res.status(404).json({ error: `Product ID ${item.product_id} not found.` });
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = product.selling_price; // POS strictly uses system selling price
        const disc = Math.max(0, Number(item.discount_amount) || 0);

        // Security check: Check discount limit (discounts > 10% require manager role)
        const discountPct = (disc / (unitPrice * qty)) * 100;
        if (discountPct > 10 && req.user.roleName === 'CASHIER') {
            return res.status(403).json({
                error: `Forbidden: Discount of ${discountPct.toFixed(1)}% exceeds the 10% threshold. Branch Manager authorization is required.`
            });
        }

        // Check stock availability
        const inv = db.prepare('SELECT quantity_available, quantity_on_hand FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, item.product_id);
        const available = inv ? inv.quantity_available : 0;
        if (available < qty) {
            return res.status(400).json({
                error: `Insufficient stock for '${product.name}'. Available: ${available}, Requested: ${qty}.`
            });
        }

        const lineTotal = (unitPrice * qty) - disc;
        subtotal += lineTotal;
        totalDiscount += disc;

        preparedItems.push({
            product,
            quantity: qty,
            unit_price: unitPrice,
            unit_cost: product.cost_price,
            discount_amount: disc,
            total_price: lineTotal
        });
    }

    // Standard VAT computation (tax inclusive in Kenya: total = taxable + VAT)
    // subtotal = taxable + vatAmount => vatAmount = subtotal * (vatRate / (100 + vatRate))
    const taxAmount = Number((subtotal * (vatRate / (100 + vatRate))).toFixed(2));
    const totalAmount = Number(subtotal.toFixed(2));

    const saleNumber = `SALE-${branchId}-${Date.now().toString().slice(-6)}`;
    const orderNumber = `ORD-POS-${branchId}-${Date.now().toString().slice(-6)}`;
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // Generate Kenya eTIMS invoice control numbers
    const etimsInvoiceNumber = `KRA-CU-${company ? company.etims_branch_code : '00'}-${Date.now().toString().slice(-8)}`;

    let saleId;
    let orderId;
    let paymentRecord;

    db.transaction(() => {
        // 1. Create order record
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required
            ) VALUES (?, ?, ?, ?, 'POS_WALKIN', 'COMPLETED', ?, ?, ?, ?, 'PAID', 0)
        `).run(branchId, orderNumber, targetCustomerId, req.user.id, subtotal, totalDiscount, taxAmount, totalAmount);
        orderId = ordRes.lastInsertRowid;

        // 2. Create order items
        const insertOrderItem = db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of preparedItems) {
            const lineTax = Number((item.total_price * (vatRate / (100 + vatRate))).toFixed(2));
            insertOrderItem.run(orderId, item.product.id, item.quantity, item.unit_price, item.discount_amount, vatRate, lineTax, item.total_price);
        }

        // 3. Create sale record
        const saleRes = db.prepare(`
            INSERT INTO sales (
                branch_id, order_id, sale_number, cashier_user_id, customer_id,
                subtotal, discount_amount, tax_amount, total_amount, payment_status,
                receipt_printed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', CURRENT_TIMESTAMP)
        `).run(branchId, orderId, saleNumber, req.user.id, targetCustomerId, subtotal, totalDiscount, taxAmount, totalAmount);
        saleId = saleRes.lastInsertRowid;

        // 4. Create sale items & atomically deduct inventory with ledger entry
        const insertSaleItem = db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_cost, unit_price, discount_amount, tax_amount, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateInv = db.prepare(`
            UPDATE inventory
            SET quantity_on_hand = quantity_on_hand - ?,
                quantity_available = quantity_available - ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE warehouse_id = ? AND product_id = ?
        `);

        const insertMovement = db.prepare(`
            INSERT INTO inventory_movements (
                branch_id, warehouse_id, product_id, movement_type,
                quantity_change, previous_quantity, new_quantity,
                reference_type, reference_id, reason, user_id
            ) VALUES (?, ?, ?, 'SALE_DEDUCTION', ?, ?, ?, 'SALE', ?, 'POS Customer Checkout', ?)
        `);

        for (const item of preparedItems) {
            const lineTax = Number((item.total_price * (vatRate / (100 + vatRate))).toFixed(2));
            insertSaleItem.run(saleId, item.product.id, item.quantity, item.unit_cost, item.unit_price, item.discount_amount, lineTax, item.total_price);

            // Fetch current stock before deduction for accurate ledger
            const curInv = db.prepare('SELECT quantity_on_hand FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, item.product.id);
            const prevQty = curInv ? curInv.quantity_on_hand : 0;
            const newQty = prevQty - item.quantity;

            updateInv.run(item.quantity, item.quantity, warehouseId, item.product.id);
            insertMovement.run(branchId, warehouseId, item.product.id, -item.quantity, prevQty, newQty, saleNumber, req.user.id);
        }

        // 5. Create Payment record
        let refCode = card_ref || (payment_method === 'MPESA' ? (mpesa_receipt || `MP-${Date.now().toString().slice(-6)}`) : `CSH-${Date.now().toString().slice(-6)}`);
        const payRes = db.prepare(`
            INSERT INTO payments (
                branch_id, sale_id, order_id, payment_number, payment_method,
                amount, currency, reference_code, mpesa_receipt_number, mpesa_phone_number,
                status, cashier_user_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, 'KES', ?, ?, ?, 'COMPLETED', ?, ?)
        `).run(
            branchId, saleId, orderId, paymentNumber, payment_method,
            totalAmount, refCode, mpesa_receipt || null, mpesa_phone || null,
            req.user.id, notes || ''
        );

        paymentRecord = {
            payment_number: paymentNumber,
            payment_method,
            amount: totalAmount,
            reference_code: refCode,
            change: payment_method === 'CASH' && amount_tendered ? Math.max(0, Number(amount_tendered) - totalAmount) : 0
        };

        // 6. Log immutable audit log
        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE_SALE',
            resource: 'SALE',
            resourceId: saleNumber,
            branchId,
            newValue: { sale_number: saleNumber, total_amount: totalAmount, payment_method, items_count: preparedItems.length },
            reason: 'POS Sale Checkout'
        });
    })();

    // Fetch customer details
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(targetCustomerId);
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);

    // Return complete receipt data for instant printing & screen display
    res.status(201).json({
        success: true,
        sale: {
            id: saleId,
            sale_number: saleNumber,
            order_number: orderNumber,
            created_at: new Date().toISOString(),
            subtotal,
            discount_amount: totalDiscount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            vat_rate: vatRate,
            etims_invoice_number: etimsInvoiceNumber,
            payment: paymentRecord,
            customer: customer || { full_name: 'Walk-in Customer' },
            branch: branch || { name: 'Nairobi Central Hub', address: 'Enterprise Rd, Nairobi' },
            company: {
                name: company.company_name,
                pin: company.kra_pin,
                phone: company.phone,
                email: company.email,
                address: company.address,
                receipt_header: company.receipt_header,
                receipt_footer: company.receipt_footer
            },
            cashier: {
                full_name: req.user.fullName,
                username: req.user.username
            },
            items: preparedItems.map(i => ({
                name: i.product.name,
                sku: i.product.sku,
                unit: i.product.unit,
                quantity: i.quantity,
                unit_price: i.unit_price,
                discount_amount: i.discount_amount,
                total_price: i.total_price
            }))
        }
    });
});

// POST /api/pos/hold - Hold current sale
router.post('/hold', authenticateToken, requireRole('CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'), (req, res) => {
    const branchId = req.user.branchId || 1;
    const { customer_name, customer_phone, cart_data, subtotal, total, notes } = req.body;

    if (!cart_data || !cart_data.length) {
        return res.status(400).json({ error: 'Cannot hold an empty cart' });
    }

    const holdRef = `HOLD-${Date.now().toString().slice(-6)}`;

    db.prepare(`
        INSERT INTO held_sales (
            branch_id, cashier_user_id, hold_reference, customer_name,
            customer_phone, cart_data_json, subtotal, total, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        branchId, req.user.id, holdRef, customer_name || 'Walk-in',
        customer_phone || '', JSON.stringify(cart_data),
        Number(subtotal) || 0, Number(total) || 0, notes || ''
    );

    res.status(201).json({ hold_reference: holdRef, message: 'Sale held successfully' });
});

// GET /api/pos/held - List held sales for this branch
router.get('/held', authenticateToken, requireRole('CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'), (req, res) => {
    const branchId = req.user.branchId || 1;
    const held = db.prepare(`
        SELECT hs.*, u.full_name as cashier_name
        FROM held_sales hs
        JOIN users u ON hs.cashier_user_id = u.id
        WHERE hs.branch_id = ?
        ORDER BY hs.id DESC
    `).all(branchId);

    const parsed = held.map(h => ({
        ...h,
        cart_data: JSON.parse(h.cart_data_json)
    }));

    res.json(parsed);
});

// DELETE /api/pos/held/:id - Resume or discard held sale
router.delete('/held/:id', authenticateToken, requireRole('CASHIER', 'BRANCH_MANAGER', 'SUPER_ADMIN'), (req, res) => {
    const heldId = Number(req.params.id);
    db.prepare('DELETE FROM held_sales WHERE id = ?').run(heldId);
    res.json({ message: 'Held sale cleared successfully' });
});

module.exports = router;
