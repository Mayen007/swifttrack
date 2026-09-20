// server/routes/pos.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { calculateCOGS, markSerialSold } = require('../services/advancedInventoryService.js');

// GET /api/pos/products - Fast search for POS terminal
router.get('/products', authenticateToken, authorize('pos', 'view'), (req, res) => {
    const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.query.branch_id)
        ? Number(req.query.branch_id)
        : (req.user.branchId || 1);
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

// POST /api/pos/checkout - Complete POS sale with atomic stock deduction, concurrency guard, and COGS calculation
router.post('/checkout', authenticateToken, authorize('pos', 'create'), (req, res) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.body.branch_id)
            ? Number(req.body.branch_id)
            : (req.user.branchId || 1);
        const {
            customer_id,
            items, // Array: [{ product_id, quantity, unit_price, discount_amount, serial_number }]
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

            // Quick pre-check before starting transaction
            const inv = db.prepare('SELECT quantity_available, quantity_on_hand FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, item.product_id);
            const available = inv ? inv.quantity_available : 0;
            if (available < qty) {
                return res.status(409).json({
                    error: `Insufficient stock for '${product.name}'. Available: ${available}, Requested: ${qty}.`,
                    code: 'STOCK_CONFLICT'
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
                total_price: lineTotal,
                serial_number: item.serial_number || item.serialNumber || null
            });
        }

        // Standard VAT computation (tax inclusive in Kenya: total = taxable + VAT)
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
        let totalSaleCogs = 0;

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
                    subtotal, discount_amount, tax_amount, total_amount,
                    total_cogs, gross_profit, gross_margin_pct,
                    payment_status, receipt_printed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'PAID', CURRENT_TIMESTAMP)
            `).run(branchId, orderId, saleNumber, req.user.id, targetCustomerId, subtotal, totalDiscount, taxAmount, totalAmount);
            saleId = saleRes.lastInsertRowid;

            // 4. Create sale items & atomically deduct inventory with concurrency guard
            const insertSaleItem = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_cost, unit_price,
                    discount_amount, tax_amount, total_price, cogs_amount, batch_id, serial_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // Concurrency guard: Only update if quantity_available >= requested quantity!
            const updateInv = db.prepare(`
                UPDATE inventory
                SET quantity_on_hand = quantity_on_hand - ?,
                    quantity_available = quantity_available - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE warehouse_id = ? AND product_id = ? AND quantity_available >= ?
            `);

            const insertMovement = db.prepare(`
                INSERT INTO inventory_movements (
                    branch_id, warehouse_id, product_id, movement_type,
                    quantity_change, previous_quantity, new_quantity,
                    from_state, to_state, reference_type, reference_id, reason, user_id
                ) VALUES (?, ?, ?, 'SALE_DEDUCTION', ?, ?, ?, 'AVAILABLE', 'SOLD', 'SALE', ?, 'POS Customer Checkout', ?)
            `);

            for (const item of preparedItems) {
                const lineTax = Number((item.total_price * (vatRate / (100 + vatRate))).toFixed(2));

                // Fetch current stock before deduction for accurate ledger
                const curInv = db.prepare('SELECT quantity_on_hand, quantity_available FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, item.product.id);
                const prevOnHand = curInv ? curInv.quantity_on_hand : 0;
                const prevAvail = curInv ? curInv.quantity_available : 0;

                // Atomic conditional update - changes will be 0 if concurrent checkout took stock!
                const dedRes = updateInv.run(item.quantity, item.quantity, warehouseId, item.product.id, item.quantity);
                if (dedRes.changes === 0) {
                    const conflictErr = new Error(`Insufficient stock for '${item.product.name}'. Available: ${prevAvail}, Requested: ${item.quantity}.`);
                    conflictErr.statusCode = 409;
                    conflictErr.code = 'STOCK_CONFLICT';
                    throw conflictErr;
                }

                const newOnHand = prevOnHand - item.quantity;

                // Calculate COGS (FIFO batch depletion or Weighted Average)
                const cogsInfo = calculateCOGS({
                    warehouseId,
                    productId: item.product.id,
                    quantity: item.quantity,
                    costingMethod: item.product.costing_method
                });
                const itemCogs = cogsInfo.totalCogs;
                totalSaleCogs += itemCogs;
                const allocatedBatchId = (cogsInfo.allocations && cogsInfo.allocations[0]) ? cogsInfo.allocations[0].batchId : null;

                if (item.serial_number) {
                    try {
                        markSerialSold({ serialNumber: item.serial_number, saleId });
                    } catch (snErr) {
                        // Keep serial_number on sale_items even if unindexed
                    }
                }

                insertSaleItem.run(
                    saleId, item.product.id, item.quantity, item.unit_cost, item.unit_price,
                    item.discount_amount, lineTax, item.total_price, itemCogs, allocatedBatchId, item.serial_number
                );

                insertMovement.run(branchId, warehouseId, item.product.id, -item.quantity, prevOnHand, newOnHand, saleNumber, req.user.id);
            }

            // Update sale record with total COGS and Gross Profit Margin
            const grossProfit = Number((subtotal - totalSaleCogs).toFixed(2));
            const grossMarginPct = subtotal > 0 ? Number(((grossProfit / subtotal) * 100).toFixed(2)) : 0.0;

            db.prepare(`
                UPDATE sales
                SET total_cogs = ?, gross_profit = ?, gross_margin_pct = ?
                WHERE id = ?
            `).run(Number(totalSaleCogs.toFixed(2)), grossProfit, grossMarginPct, saleId);

            // 5. Create Payment record
            let refCode = card_ref || (payment_method === 'MPESA' ? (mpesa_receipt || `MP-${Date.now().toString().slice(-6)}`) : `CSH-${Date.now().toString().slice(-6)}`);
            db.prepare(`
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
                newValue: {
                    sale_number: saleNumber,
                    total_amount: totalAmount,
                    total_cogs: totalSaleCogs,
                    gross_profit: grossProfit,
                    gross_margin_pct: grossMarginPct,
                    payment_method,
                    items_count: preparedItems.length
                },
                reason: 'POS Sale Checkout'
            });
        })();

        // Fetch customer & branch details
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(targetCustomerId);
        const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);

        // Return complete receipt data for instant printing & screen display
        return res.status(201).json({
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
                total_cogs: Number(totalSaleCogs.toFixed(2)),
                gross_profit: Number((subtotal - totalSaleCogs).toFixed(2)),
                gross_margin_pct: subtotal > 0 ? Number((((subtotal - totalSaleCogs) / subtotal) * 100).toFixed(2)) : 0.0,
                vat_rate: vatRate,
                etims_invoice_number: etimsInvoiceNumber,
                payment: paymentRecord,
                customer: customer || { full_name: 'Walk-in Customer' },
                branch: branch || { name: 'Nairobi Central Hub', address: 'Enterprise Rd, Nairobi' },
                company: {
                    name: company ? company.company_name : 'SwiftTrack Kenya',
                    pin: company ? company.kra_pin : '',
                    phone: company ? company.phone : '',
                    email: company ? company.email : '',
                    address: company ? company.address : '',
                    receipt_header: company ? company.receipt_header : '',
                    receipt_footer: company ? company.receipt_footer : ''
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
    } catch (err) {
        if (err.statusCode === 409 || err.code === 'STOCK_CONFLICT') {
            return res.status(409).json({
                error: err.message,
                code: 'STOCK_CONFLICT'
            });
        }
        console.error('POS Checkout error:', err);
        return res.status(500).json({ error: 'Internal server error during checkout: ' + err.message });
    }
});

// POST /api/pos/hold - Hold current sale
router.post('/hold', authenticateToken, authorize('pos', 'hold'), (req, res) => {
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
router.get('/held', authenticateToken, authorize('pos', 'view'), (req, res) => {
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
router.delete('/held/:id', authenticateToken, authorize('pos', 'hold', { entityTable: 'held_sales' }), (req, res) => {
    const heldId = Number(req.params.id);
    db.prepare('DELETE FROM held_sales WHERE id = ?').run(heldId);
    res.json({ message: 'Held sale cleared successfully' });
});

module.exports = router;
