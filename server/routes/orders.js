// server/routes/orders.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, enforceBranchIsolation } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/orders - List orders scoped by branch isolation
router.get('/', authenticateToken, enforceBranchIsolation, (req, res) => {
    let query = `
        SELECT o.*, c.full_name as customer_name, c.phone as customer_phone,
               u.full_name as cashier_name, b.name as branch_name,
               (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count,
               d.delivery_number, d.status as delivery_status,
               drv_u.full_name as driver_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.cashier_user_id = u.id
        JOIN branches b ON o.branch_id = b.id
        LEFT JOIN deliveries d ON o.id = d.order_id
        LEFT JOIN drivers drv ON d.driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
    `;
    const params = [];

    if (req.effectiveBranchId) {
        query += ' WHERE o.branch_id = ?';
        params.push(req.effectiveBranchId);
    }

    if (req.query.status) {
        query += req.effectiveBranchId ? ' AND o.status = ?' : ' WHERE o.status = ?';
        params.push(req.query.status);
    }

    if (req.query.order_type) {
        query += (req.effectiveBranchId || req.query.status) ? ' AND o.order_type = ?' : ' WHERE o.order_type = ?';
        params.push(req.query.order_type);
    }

    query += ' ORDER BY o.id DESC LIMIT 100';

    const orders = db.prepare(query).all(...params);
    res.json(orders);
});

// GET /api/orders/:id - Order details with items and status timeline
router.get('/:id', authenticateToken, (req, res) => {
    const orderId = Number(req.params.id);
    const order = db.prepare(`
        SELECT o.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
               u.full_name as cashier_name, b.name as branch_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.cashier_user_id = u.id
        JOIN branches b ON o.branch_id = b.id
        WHERE o.id = ?
    `).get(orderId);

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    // Branch isolation check
    if (req.user.roleName !== 'SUPER_ADMIN' && order.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Access to order belonging to another branch is denied.' });
    }

    const items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.sku, p.unit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `).all(orderId);

    const delivery = db.prepare(`
        SELECT d.*, drv_u.full_name as driver_name, drv.phone as driver_phone,
               v.registration_number, v.model as vehicle_model,
               pod.recipient_name as pod_recipient, pod.signature_data as pod_signature,
               pod.verified_at as pod_verified_at
        FROM deliveries d
        LEFT JOIN drivers drv ON d.driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        LEFT JOIN proof_of_delivery pod ON d.id = pod.delivery_id
        WHERE d.order_id = ?
    `).get(orderId);

    res.json({
        ...order,
        items,
        delivery
    });
});

// POST /api/orders - Create a Delivery Order
router.post('/', authenticateToken, (req, res) => {
    const branchId = req.user.branchId || (req.body.branch_id ? Number(req.body.branch_id) : 1);

    if (req.user.roleName !== 'SUPER_ADMIN' && branchId !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot create orders for another branch.' });
    }

    const {
        customer_id,
        items,
        delivery_address,
        delivery_city,
        recipient_name,
        recipient_phone,
        special_instructions,
        priority
    } = req.body;

    if (!customer_id || !items || !items.length) {
        return res.status(400).json({ error: 'Customer and items are required.' });
    }

    // Customer status check & branch access check
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(customer_id));
    if (!customer) {
        return res.status(404).json({ error: `Customer ID ${customer_id} not found.` });
    }

    if (customer.status === 'BLOCKED' || customer.status === 'SUSPENDED') {
        return res.status(403).json({
            error: `Order rejected: Customer '${customer.full_name}' is currently ${customer.status}. Cannot place new orders.`,
            code: 'CUSTOMER_STATUS_BLOCKED'
        });
    }

    // Resolve delivery address and recipient from customer_addresses if not provided
    let finalDeliveryAddress = delivery_address;
    let finalDeliveryCity = delivery_city;
    let finalRecipientName = recipient_name || customer.full_name;
    let finalRecipientPhone = recipient_phone || customer.phone;

    if (!finalDeliveryAddress) {
        const defaultAddr = db.prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, id ASC LIMIT 1').get(customer.id);
        if (defaultAddr) {
            finalDeliveryAddress = defaultAddr.address_line;
            finalDeliveryCity = finalDeliveryCity || defaultAddr.city;
            finalRecipientName = recipient_name || defaultAddr.contact_name || customer.full_name;
            finalRecipientPhone = recipient_phone || defaultAddr.contact_phone || customer.phone;
        } else {
            finalDeliveryAddress = customer.address || 'Customer Delivery Address';
            finalDeliveryCity = finalDeliveryCity || customer.city || 'Nairobi';
        }
    }

    const company = db.prepare('SELECT vat_rate FROM company_settings WHERE id = 1').get();
    const vatRate = company ? company.vat_rate : 16.0;

    let subtotal = 0;
    const preparedItems = [];

    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found.` });

        const qty = Math.max(1, Number(item.quantity) || 1);
        const lineTotal = product.selling_price * qty;
        subtotal += lineTotal;

        preparedItems.push({
            product,
            quantity: qty,
            unit_price: product.selling_price,
            total_price: lineTotal
        });
    }

    const taxAmount = Number((subtotal * (vatRate / (100 + vatRate))).toFixed(2));
    const totalAmount = Number(subtotal.toFixed(2));
    const orderNumber = `ORD-DEL-${branchId}-${Date.now().toString().slice(-6)}`;
    const deliveryNumber = `DEL-${branchId}-${Date.now().toString().slice(-6)}`;

    let orderId;
    let deliveryId;

    db.transaction(() => {
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required, delivery_address, delivery_city, recipient_name,
                recipient_phone, special_instructions
            ) VALUES (?, ?, ?, ?, 'DELIVERY_ORDER', 'READY_FOR_DISPATCH', ?, 0, ?, ?, 'PAID', 1, ?, ?, ?, ?, ?)
        `).run(
            branchId, orderNumber, customer_id, req.user.id,
            subtotal, taxAmount, totalAmount,
            finalDeliveryAddress,
            finalDeliveryCity || 'Nairobi',
            finalRecipientName,
            finalRecipientPhone,
            special_instructions || ''
        );
        orderId = ordRes.lastInsertRowid;

        const insertItem = db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `);

        for (const item of preparedItems) {
            const lineTax = Number((item.total_price * (vatRate / (100 + vatRate))).toFixed(2));
            insertItem.run(orderId, item.product.id, item.quantity, item.unit_price, vatRate, lineTax, item.total_price);
        }

        // Create initial delivery record
        const delRes = db.prepare(`
            INSERT INTO deliveries (
                branch_id, delivery_number, order_id, dispatcher_user_id,
                status, priority, scheduled_pickup_at, estimated_delivery_at
            ) VALUES (?, ?, ?, ?, 'READY_FOR_DISPATCH', ?, CURRENT_TIMESTAMP, datetime('now', '+3 hours'))
        `).run(branchId, deliveryNumber, orderId, req.user.id, priority || 'NORMAL');
        deliveryId = delRes.lastInsertRowid;

        // Populate delivery items
        const delItemInsert = db.prepare(`
            INSERT INTO delivery_items (delivery_id, order_item_id, product_id, quantity)
            SELECT ?, id, product_id, quantity FROM order_items WHERE order_id = ?
        `);
        delItemInsert.run(deliveryId, orderId);

        // Notify dispatchers of this branch
        db.prepare(`
            INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
            VALUES (?, 'NEW_ORDER', 'New Delivery Order Ready', ?, 'ORDER', ?)
        `).run(branchId, `Delivery order ${orderNumber} is ready for driver assignment.`, String(orderId));

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'CREATE_ORDER',
            resource: 'ORDER',
            resourceId: orderNumber,
            branchId,
            newValue: { order_number: orderNumber, delivery_number: deliveryNumber, total_amount: totalAmount },
            reason: 'Created customer delivery order'
        });
    })();

    res.status(201).json({
        id: orderId,
        order_number: orderNumber,
        delivery_number: deliveryNumber,
        status: 'READY_FOR_DISPATCH'
    });
});

// PATCH /api/orders/:id/status - Update order lifecycle status
router.patch('/:id/status', authenticateToken, (req, res) => {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && order.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot modify orders of another branch.' });
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, orderId);

    logAuditEvent({
        userId: req.user.id,
        role: req.user.roleName,
        action: 'UPDATE_ORDER_STATUS',
        resource: 'ORDER',
        resourceId: order.order_number,
        branchId: order.branch_id,
        previousValue: { status: order.status },
        newValue: { status },
        reason: `Order status transitioned from ${order.status} to ${status}`
    });

    res.json({ message: 'Order status updated successfully', status });
});

module.exports = router;
