// server/routes/pos.js
// SwiftTrack Kenya: Complete POS Terminal, Cashier Shifts, Split Payments & Cash Drawer Control
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');
const { calculateCOGS, markSerialSold } = require('../services/advancedInventoryService.js');
const posShiftService = require('../services/posShiftService.js');

// =========================================================================
// 1. CASHIER SHIFTS & CASH DRAWER CONTROL
// =========================================================================

// GET /api/pos/shift/current - Current active open shift for logged-in cashier
router.get('/shift/current', authenticateToken, (req, res, next) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.query.branch_id)
            ? Number(req.query.branch_id)
            : (req.user.branchId || 1);
        const shift = posShiftService.getCurrentShift(req.user.id, branchId);
        res.json({ shift });
    } catch (err) {
        next(err);
    }
});

// POST /api/pos/shift/open - Open shift with initial cash float
router.post('/shift/open', authenticateToken, (req, res, next) => {
    try {
        const shift = posShiftService.openShift(req.body, req.user);
        res.status(201).json({ success: true, shift });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        next(err);
    }
});

// POST /api/pos/shift/close - Close shift with physical cash drawer count
router.post('/shift/close', authenticateToken, (req, res, next) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.body.branch_id)
            ? Number(req.body.branch_id)
            : (req.user.branchId || 1);
        const currentShift = posShiftService.getCurrentShift(req.user.id, branchId);
        if (!currentShift) {
            return res.status(400).json({ error: 'No active open shift found to close.' });
        }
        const closed = posShiftService.closeShift(currentShift.id, req.body, req.user);
        res.json({ success: true, shift: closed });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        next(err);
    }
});

// POST /api/pos/shift/movement - Record cash drawer payout or drop
router.post('/shift/movement', authenticateToken, (req, res, next) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.body.branch_id)
            ? Number(req.body.branch_id)
            : (req.user.branchId || 1);
        const currentShift = posShiftService.getCurrentShift(req.user.id, branchId);
        if (!currentShift) {
            return res.status(400).json({ error: 'No active open shift found for drawer movement.' });
        }
        const updated = posShiftService.recordDrawerMovement(currentShift.id, req.body, req.user);
        res.json({ success: true, shift: updated });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        next(err);
    }
});

// POST /api/pos/shift/:id/reconcile - Branch Manager or Super Admin end-of-day sign-off
router.post('/shift/:id/reconcile', authenticateToken, (req, res, next) => {
    try {
        const reconciled = posShiftService.reconcileShift(req.params.id, req.body, req.user);
        res.json({ success: true, shift: reconciled });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        next(err);
    }
});

// GET /api/pos/shift/history - Shift history and variance review
router.get('/shift/history', authenticateToken, (req, res, next) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.query.branch_id)
            ? Number(req.query.branch_id)
            : req.user.branchId;
        const cashierId = req.user.roleName === 'CASHIER'
            ? req.user.id
            : (req.query.cashier_id ? Number(req.query.cashier_id) : null);
        const shifts = posShiftService.listShifts({
            branchId,
            cashierId,
            status: req.query.status,
            date: req.query.date,
            page: req.query.page,
            limit: req.query.limit
        });
        res.json(shifts);
    } catch (err) {
        next(err);
    }
});

// =========================================================================
// 2. PRODUCT LOOKUP & POS CATALOG
// =========================================================================

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

// =========================================================================
// 3. COMPLETE CHECKOUT & MIXED/SPLIT PAYMENTS
// =========================================================================

// POST /api/pos/checkout - Complete POS sale with shift guard, atomic stock deduction, and mixed payments
router.post('/checkout', authenticateToken, authorize('pos', 'create'), (req, res) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.body.branch_id)
            ? Number(req.body.branch_id)
            : (req.user.branchId || 1);
        const {
            customer_id,
            items, // Array: [{ product_id, quantity, unit_price, discount_amount, serial_number }]
            payment_method, // Optional if split_payments provided: 'CASH', 'MPESA', 'CARD', 'BANK_TRANSFER'
            split_payments, // Optional Array: [{ method, amount, amount_tendered, mpesa_phone, mpesa_receipt, card_ref }]
            amount_tendered,
            mpesa_phone,
            mpesa_receipt,
            card_ref,
            notes
        } = req.body;

        if (!items || !items.length) {
            return res.status(400).json({ error: 'Cart is empty. Please add items to checkout.' });
        }

        // 1. Shift Verification Guard: Cashier must have an active open shift
        let activeShift = posShiftService.getCurrentShift(req.user.id, branchId);
        if (!activeShift) {
            if (req.user.roleName === 'SUPER_ADMIN') {
                // Auto-open administrative shift for Super Admin to streamline testing
                activeShift = posShiftService.openShift({ opening_cash: 5000, notes: 'Super Admin Auto-Open Shift' }, req.user);
            } else {
                return res.status(403).json({
                    error: 'Cannot process sale: No active shift open for this cashier. Please open a shift with starting cash float to begin checkout.',
                    code: 'NO_ACTIVE_SHIFT'
                });
            }
        }

        // 2. Customer validation & status check
        const targetCustomerId = customer_id ? Number(customer_id) : 1;
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(targetCustomerId);
        if (!customer) {
            return res.status(404).json({ error: `Customer ID ${targetCustomerId} not found.` });
        }
        if (customer.status === 'BLOCKED' || customer.status === 'SUSPENDED') {
            return res.status(403).json({
                error: `Checkout rejected: Customer '${customer.full_name}' is currently ${customer.status}. POS transactions are prohibited.`,
                code: 'CUSTOMER_STATUS_BLOCKED'
            });
        }

        // 3. Pick first available active warehouse for this branch
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

        // 4. Payment breakdown normalization (Single or Split/Mixed payments)
        let paymentsList = [];
        if (Array.isArray(split_payments) && split_payments.length > 0) {
            paymentsList = split_payments.map(p => ({
                method: String(p.method || p.payment_method || 'CASH').toUpperCase(),
                amount: Number(p.amount) || 0,
                tendered: p.amount_tendered !== undefined ? Number(p.amount_tendered) : Number(p.amount),
                mpesa_phone: p.mpesa_phone || null,
                mpesa_receipt: p.mpesa_receipt || null,
                card_ref: p.card_ref || null
            }));
        } else if (payment_method) {
            paymentsList = [{
                method: String(payment_method).toUpperCase(),
                amount: totalAmount,
                tendered: amount_tendered !== undefined ? Number(amount_tendered) : totalAmount,
                mpesa_phone: mpesa_phone || null,
                mpesa_receipt: mpesa_receipt || null,
                card_ref: card_ref || null
            }];
        } else {
            return res.status(400).json({ error: 'Payment method or split payments breakdown is required.' });
        }

        // Validate sum of payments
        const totalPaid = Number(paymentsList.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
        if (totalPaid < totalAmount - 0.05) {
            return res.status(400).json({
                error: `Total payment of KES ${totalPaid.toFixed(2)} is less than total sale amount of KES ${totalAmount.toFixed(2)}.`
            });
        }

        const saleNumber = `SALE-${branchId}-${Date.now().toString().slice(-6)}`;
        const orderNumber = `ORD-POS-${branchId}-${Date.now().toString().slice(-6)}`;
        const etimsInvoiceNumber = `KRA-CU-${company ? company.etims_branch_code : '00'}-${Date.now().toString().slice(-8)}`;

        let saleId;
        let orderId;
        let totalSaleCogs = 0;
        const createdPayments = [];

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

            // 3. Create sale record linked to active shift
            const saleRes = db.prepare(`
                INSERT INTO sales (
                    branch_id, shift_id, order_id, sale_number, cashier_user_id, customer_id,
                    subtotal, discount_amount, tax_amount, total_amount,
                    total_cogs, gross_profit, gross_margin_pct,
                    payment_status, receipt_printed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'PAID', CURRENT_TIMESTAMP)
            `).run(branchId, activeShift.id, orderId, saleNumber, req.user.id, targetCustomerId, subtotal, totalDiscount, taxAmount, totalAmount);
            saleId = saleRes.lastInsertRowid;

            // 4. Create sale items & atomically deduct inventory with concurrency guard
            const insertSaleItem = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, quantity, unit_cost, unit_price,
                    discount_amount, tax_amount, total_price, cogs_amount, batch_id, serial_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

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

                const curInv = db.prepare('SELECT quantity_on_hand, quantity_available FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, item.product.id);
                const prevOnHand = curInv ? curInv.quantity_on_hand : 0;
                const prevAvail = curInv ? curInv.quantity_available : 0;

                const dedRes = updateInv.run(item.quantity, item.quantity, warehouseId, item.product.id, item.quantity);
                if (dedRes.changes === 0) {
                    const conflictErr = new Error(`Insufficient stock for '${item.product.name}'. Available: ${prevAvail}, Requested: ${item.quantity}.`);
                    conflictErr.statusCode = 409;
                    conflictErr.code = 'STOCK_CONFLICT';
                    throw conflictErr;
                }

                const newOnHand = prevOnHand - item.quantity;

                // Calculate COGS
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
                    } catch (snErr) {}
                }

                insertSaleItem.run(
                    saleId, item.product.id, item.quantity, item.unit_cost, item.unit_price,
                    item.discount_amount, lineTax, item.total_price, itemCogs, allocatedBatchId, item.serial_number
                );

                insertMovement.run(branchId, warehouseId, item.product.id, -item.quantity, prevOnHand, newOnHand, saleNumber, req.user.id);
            }

            // Update sale COGS & profit
            const grossProfit = Number((subtotal - totalSaleCogs).toFixed(2));
            const grossMarginPct = subtotal > 0 ? Number(((grossProfit / subtotal) * 100).toFixed(2)) : 0.0;

            db.prepare(`
                UPDATE sales
                SET total_cogs = ?, gross_profit = ?, gross_margin_pct = ?
                WHERE id = ?
            `).run(Number(totalSaleCogs.toFixed(2)), grossProfit, grossMarginPct, saleId);

            // 5. Create Payment record(s) for split/mixed tenders
            for (let idx = 0; idx < paymentsList.length; idx++) {
                const p = paymentsList[idx];
                const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${idx + 1}`;
                const refCode = p.card_ref || (p.method === 'MPESA' ? (p.mpesa_receipt || `MP-${Date.now().toString().slice(-6)}`) : `CSH-${Date.now().toString().slice(-6)}`);

                db.prepare(`
                    INSERT INTO payments (
                        branch_id, sale_id, order_id, payment_number, payment_method,
                        amount, currency, reference_code, mpesa_receipt_number, mpesa_phone_number,
                        status, cashier_user_id, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, 'KES', ?, ?, ?, 'COMPLETED', ?, ?)
                `).run(
                    branchId, saleId, orderId, paymentNumber, p.method,
                    p.amount, refCode, p.mpesa_receipt || null, p.mpesa_phone || null,
                    req.user.id, notes || ''
                );

                createdPayments.push({
                    payment_number: paymentNumber,
                    payment_method: p.method,
                    amount: p.amount,
                    reference_code: refCode,
                    change: (p.method === 'CASH' && p.tendered > p.amount) ? Number((p.tendered - p.amount).toFixed(2)) : 0
                });
            }

            // 6. Update Shift Totals and Drawer Cash Ledger
            posShiftService.recordSaleInShift(activeShift.id, totalAmount, paymentsList, req.user);

            // 7. Audit log
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
                    shift_id: activeShift.id,
                    payments_count: paymentsList.length,
                    items_count: preparedItems.length
                },
                reason: 'POS Sale Checkout Completed'
            });
        })();

        const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);

        return res.status(201).json({
            success: true,
            sale: {
                id: saleId,
                sale_number: saleNumber,
                order_number: orderNumber,
                shift_id: activeShift.id,
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
                payments: createdPayments,
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
            return res.status(409).json({ error: err.message, code: 'STOCK_CONFLICT' });
        }
        console.error('POS Checkout error:', err);
        return res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error during checkout' });
    }
});

// =========================================================================
// 4. THERMAL RECEIPT REPRINT & DETAIL RETRIEVAL
// =========================================================================

// GET /api/pos/receipt/:id - Fetch complete receipt data for reprinting
router.get('/receipt/:id', authenticateToken, authorize('pos', 'view'), (req, res) => {
    const param = String(req.params.id).trim();
    let sale = null;

    if (/^\d+$/.test(param)) {
        sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(Number(param));
    }
    if (!sale) {
        sale = db.prepare('SELECT * FROM sales WHERE sale_number = ?').get(param);
    }

    if (!sale) {
        return res.status(404).json({ error: `Sale record '${param}' not found.` });
    }

    if (req.user.roleName !== 'SUPER_ADMIN' && sale.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Access to receipt belonging to another branch is denied.' });
    }

    const items = db.prepare(`
        SELECT si.*, p.name as product_name, p.sku, p.unit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `).all(sale.id);

    const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id);
    const cashier = db.prepare('SELECT id, full_name, username FROM users WHERE id = ?').get(sale.cashier_user_id);
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(sale.branch_id);
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get();

    // Kenya eTIMS invoice number
    const etimsCode = `KRA-CU-${company ? company.etims_branch_code : '00'}-${sale.id.toString().padStart(8, '0')}`;

    res.json({
        sale: {
            id: sale.id,
            sale_number: sale.sale_number,
            order_id: sale.order_id,
            shift_id: sale.shift_id,
            subtotal: sale.subtotal,
            discount_amount: sale.discount_amount,
            tax_amount: sale.tax_amount,
            total_amount: sale.total_amount,
            payment_status: sale.payment_status,
            created_at: sale.created_at,
            etims_invoice_number: etimsCode
        },
        items: items.map(i => ({
            name: i.product_name,
            sku: i.sku,
            unit: i.unit,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_amount: i.discount_amount,
            total_price: i.total_price
        })),
        payments: payments.map(p => ({
            payment_number: p.payment_number,
            method: p.payment_method,
            amount: p.amount,
            reference_code: p.reference_code,
            mpesa_receipt: p.mpesa_receipt_number,
            status: p.status
        })),
        customer: customer || { full_name: 'Walk-in Customer', phone: '' },
        cashier: cashier || { full_name: 'POS Cashier' },
        branch: branch || { name: 'Main Branch' },
        company: {
            name: company ? company.company_name : 'SwiftTrack Kenya',
            pin: company ? company.kra_pin : '',
            phone: company ? company.phone : '',
            address: company ? company.address : '',
            receipt_header: company ? company.receipt_header : '',
            receipt_footer: company ? company.receipt_footer : ''
        }
    });
});

// =========================================================================
// 5. TRANSACTION VOID & REVERSALS
// =========================================================================

// POST /api/pos/void - Void an active cart or cancel in-flight transaction
router.post('/void', authenticateToken, authorize('pos', 'create'), (req, res) => {
    const { cart_reference, reason } = req.body;
    const branchId = req.user.branchId || 1;

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'VOID_TRANSACTION',
        resource: 'POS',
        resourceId: cart_reference || 'ACTIVE_CART',
        branchId,
        newValue: { reason: reason || 'Cashier cancelled transaction before tender commit' },
        reason: 'Voided active POS checkout transaction'
    });

    res.json({ success: true, message: 'Transaction voided successfully.' });
});

// =========================================================================
// 6. PRODUCT EXCHANGE WITH NET SETTLEMENT
// =========================================================================

// POST /api/pos/exchange - Exchange returned product(s) for new product(s)
router.post('/exchange', authenticateToken, authorize('pos', 'create'), (req, res) => {
    try {
        const branchId = (req.user.roleName === 'SUPER_ADMIN' && req.body.branch_id)
            ? Number(req.body.branch_id)
            : (req.user.branchId || 1);

        const {
            customer_id,
            returned_items, // [{ product_id, quantity, reason }]
            purchased_items, // [{ product_id, quantity }]
            payment_method, // Tender method if net > 0
            amount_tendered,
            notes
        } = req.body;

        if (!returned_items || !returned_items.length || !purchased_items || !purchased_items.length) {
            return res.status(400).json({ error: 'Both returned items and new purchased items are required for an exchange.' });
        }

        // Active shift verification
        let activeShift = posShiftService.getCurrentShift(req.user.id, branchId);
        if (!activeShift) {
            if (req.user.roleName === 'SUPER_ADMIN') {
                activeShift = posShiftService.openShift({ opening_cash: 5000, notes: 'Super Admin Auto-Open' }, req.user);
            } else {
                return res.status(403).json({ error: 'Cannot process exchange: No active shift open.', code: 'NO_ACTIVE_SHIFT' });
            }
        }

        const warehouse = db.prepare('SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY id ASC').get(branchId);
        if (!warehouse) return res.status(400).json({ error: 'No active warehouse for branch.' });
        const warehouseId = warehouse.id;

        let returnTotal = 0;
        const preparedReturns = [];
        for (const ret of returned_items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(ret.product_id);
            if (!product) return res.status(404).json({ error: `Returned product ${ret.product_id} not found.` });
            const qty = Math.max(1, Number(ret.quantity) || 1);
            const lineTotal = product.selling_price * qty;
            returnTotal += lineTotal;
            preparedReturns.push({ product, quantity: qty, lineTotal, reason: ret.reason || 'Customer Exchange' });
        }

        let purchaseTotal = 0;
        const preparedPurchases = [];
        for (const pur of purchased_items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(pur.product_id);
            if (!product) return res.status(404).json({ error: `Purchased product ${pur.product_id} not found.` });
            const qty = Math.max(1, Number(pur.quantity) || 1);

            const inv = db.prepare('SELECT quantity_available FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, pur.product_id);
            if (!inv || inv.quantity_available < qty) {
                return res.status(409).json({ error: `Insufficient stock for '${product.name}' in exchange. Available: ${inv?.quantity_available || 0}`, code: 'STOCK_CONFLICT' });
            }

            const lineTotal = product.selling_price * qty;
            purchaseTotal += lineTotal;
            preparedPurchases.push({ product, quantity: qty, lineTotal });
        }

        const netDifference = Number((purchaseTotal - returnTotal).toFixed(2));
        const exchangeNumber = `EXC-${branchId}-${Date.now().toString().slice(-6)}`;
        const orderNumber = `ORD-EXC-${branchId}-${Date.now().toString().slice(-6)}`;

        db.transaction(() => {
            // 1. Restock returned items
            for (const ret of preparedReturns) {
                db.prepare(`
                    UPDATE inventory
                    SET quantity_on_hand = quantity_on_hand + ?,
                        quantity_available = quantity_available + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE warehouse_id = ? AND product_id = ?
                `).run(ret.quantity, ret.quantity, warehouseId, ret.product.id);

                db.prepare(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        from_state, to_state, reference_type, reference_id, reason, user_id
                    ) VALUES (?, ?, ?, 'SALE_RETURN', ?, 0, 0, 'SOLD', 'AVAILABLE', 'EXCHANGE', ?, ?, ?)
                `).run(branchId, warehouseId, ret.product.id, ret.quantity, exchangeNumber, ret.reason, req.user.id);
            }

            // 2. Deduct purchased items
            for (const pur of preparedPurchases) {
                db.prepare(`
                    UPDATE inventory
                    SET quantity_on_hand = quantity_on_hand - ?,
                        quantity_available = quantity_available - ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE warehouse_id = ? AND product_id = ?
                `).run(pur.quantity, pur.quantity, warehouseId, pur.product.id);

                db.prepare(`
                    INSERT INTO inventory_movements (
                        branch_id, warehouse_id, product_id, movement_type,
                        quantity_change, previous_quantity, new_quantity,
                        from_state, to_state, reference_type, reference_id, reason, user_id
                    ) VALUES (?, ?, ?, 'SALE_DEDUCTION', ?, 0, 0, 'AVAILABLE', 'SOLD', 'EXCHANGE', ?, 'Exchange Outbound', ?)
                `).run(branchId, warehouseId, pur.product.id, -pur.quantity, exchangeNumber, req.user.id);
            }

            // 3. Create Sale record
            const targetCustId = customer_id ? Number(customer_id) : 1;
            const saleRes = db.prepare(`
                INSERT INTO sales (
                    branch_id, shift_id, sale_number, cashier_user_id, customer_id,
                    subtotal, discount_amount, tax_amount, total_amount,
                    payment_status, receipt_printed_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'PAID', CURRENT_TIMESTAMP)
            `).run(branchId, activeShift.id, exchangeNumber, req.user.id, targetCustId, purchaseTotal, Math.max(0, netDifference));
            const saleId = saleRes.lastInsertRowid;

            // 4. Record Net Payment / Refund in shift
            if (netDifference > 0) {
                const method = (payment_method || 'CASH').toUpperCase();
                db.prepare(`
                    INSERT INTO payments (
                        branch_id, sale_id, payment_number, payment_method,
                        amount, currency, status, cashier_user_id, notes
                    ) VALUES (?, ?, ?, ?, ?, 'KES', 'COMPLETED', ?, 'Exchange Customer Difference Payment')
                `).run(branchId, saleId, `PAY-EXC-${Date.now().toString().slice(-6)}`, method, netDifference, req.user.id);

                posShiftService.recordSaleInShift(activeShift.id, netDifference, [{ method, amount: netDifference }], req.user);
            } else if (netDifference < 0) {
                const refundDue = Math.abs(netDifference);
                db.prepare(`
                    INSERT INTO payments (
                        branch_id, sale_id, payment_number, payment_method,
                        amount, currency, status, cashier_user_id, notes
                    ) VALUES (?, ?, ?, 'CASH', ?, 'KES', 'REFUNDED', ?, 'Exchange Customer Payout Refund')
                `).run(branchId, saleId, `REF-EXC-${Date.now().toString().slice(-6)}`, refundDue, req.user.id);

                posShiftService.recordDrawerMovement(activeShift.id, {
                    movement_type: 'PAYOUT',
                    amount: refundDue,
                    reason: 'Exchange store cash difference refund'
                }, req.user);
            }

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'PRODUCT_EXCHANGE',
                resource: 'EXCHANGE',
                resourceId: exchangeNumber,
                branchId,
                newValue: { returnTotal, purchaseTotal, netDifference },
                reason: 'Processed item exchange and inventory adjustment'
            });
        })();

        res.status(201).json({
            success: true,
            exchange_number: exchangeNumber,
            returned_total: returnTotal,
            purchased_total: purchaseTotal,
            net_difference: netDifference,
            status: 'COMPLETED'
        });
    } catch (err) {
        if (err.statusCode === 409) return res.status(409).json({ error: err.message, code: 'STOCK_CONFLICT' });
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// 7. HELD SALES (HOLD / RESUME CARTS)
// =========================================================================

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
