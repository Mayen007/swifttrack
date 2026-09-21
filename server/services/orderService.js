// server/services/orderService.js
// SwiftTrack Kenya: Phase 6 Orders Engine & State Machine Service
const { db } = require('../db/database.js');
const inventoryStateService = require('./inventoryStateService.js');
const { logAuditEvent } = require('../middleware/audit.js');

const ORDER_STATUSES = {
    DRAFT: 'DRAFT',
    CONFIRMED: 'CONFIRMED',
    PAID: 'PAID',
    PROCESSING: 'PROCESSING',
    PACKED: 'PACKED',
    READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
    DISPATCHED: 'DISPATCHED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    FAILED_DELIVERY: 'FAILED_DELIVERY',
    RETURNED: 'RETURNED',
    PARTIALLY_RETURNED: 'PARTIALLY_RETURNED',
    REFUNDED: 'REFUNDED'
};

const ALLOWED_TRANSITIONS = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PAID', 'PROCESSING', 'CANCELLED'],
    PAID: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['PACKED', 'CANCELLED'],
    PACKED: ['READY_FOR_DISPATCH', 'CANCELLED'],
    READY_FOR_DISPATCH: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['IN_TRANSIT', 'FAILED_DELIVERY', 'CANCELLED'],
    IN_TRANSIT: ['DELIVERED', 'FAILED_DELIVERY', 'RETURNED'],
    DELIVERED: ['RETURNED', 'PARTIALLY_RETURNED', 'REFUNDED'],
    FAILED_DELIVERY: ['DISPATCHED', 'RETURNED', 'CANCELLED'],
    RETURNED: ['REFUNDED'],
    PARTIALLY_RETURNED: ['REFUNDED'],
    CANCELLED: [],
    REFUNDED: []
};

/**
 * Resolve primary warehouse for a branch
 */
function getPrimaryWarehouse(branchId) {
    const wh = db.prepare('SELECT id FROM warehouses WHERE branch_id = ? ORDER BY id ASC LIMIT 1').get(branchId);
    return wh ? wh.id : 1;
}

/**
 * List orders with search, multi-axis filtering, pagination, and sorting
 */
function listOrders(filters = {}, user = {}) {
    let query = `
        SELECT o.*,
               c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
               u.full_name as cashier_name, b.name as branch_name, b.code as branch_code,
               (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count,
               (SELECT sum(quantity) FROM order_items WHERE order_id = o.id) as total_units,
               d.delivery_number, d.status as delivery_status,
               drv_u.full_name as driver_name, drv.phone as driver_phone
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.cashier_user_id = u.id
        JOIN branches b ON o.branch_id = b.id
        LEFT JOIN deliveries d ON o.id = d.order_id
        LEFT JOIN drivers drv ON d.driver_id = drv.id
        LEFT JOIN users drv_u ON drv.user_id = drv_u.id
        WHERE 1=1
    `;
    const params = [];

    // Branch isolation
    if (user.roleName !== 'SUPER_ADMIN' && (user.branchId || user.branch_id)) {
        const bId = user.branchId || user.branch_id;
        query += ' AND o.branch_id = ?';
        params.push(bId);
    } else if (filters.branch_id) {
        query += ' AND o.branch_id = ?';
        params.push(Number(filters.branch_id));
    }

    // Status filter
    if (filters.status && filters.status !== 'ALL') {
        query += ' AND o.status = ?';
        params.push(filters.status.toUpperCase());
    }

    // Payment status filter
    if (filters.payment_status && filters.payment_status !== 'ALL') {
        query += ' AND o.payment_status = ?';
        params.push(filters.payment_status.toUpperCase());
    }

    // Order type filter
    if (filters.order_type && filters.order_type !== 'ALL') {
        query += ' AND o.order_type = ?';
        params.push(filters.order_type);
    }

    // Customer filter
    if (filters.customer_id) {
        query += ' AND o.customer_id = ?';
        params.push(Number(filters.customer_id));
    }

    // Search query
    if (filters.search && filters.search.trim()) {
        const q = `%${filters.search.trim().toLowerCase()}%`;
        query += ` AND (
            LOWER(o.order_number) LIKE ? OR
            LOWER(c.full_name) LIKE ? OR
            LOWER(c.phone) LIKE ? OR
            LOWER(d.delivery_number) LIKE ?
        )`;
        params.push(q, q, q, q);
    }

    query += ' ORDER BY o.id DESC';

    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = Math.max(0, Number(filters.offset) || 0);
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    return db.prepare(query).all(...params);
}

/**
 * Get single order with complete details, items, status history, notes, and payments
 */
function getOrderById(orderId, user = {}) {
    const order = db.prepare(`
        SELECT o.*,
               c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
               c.customer_number, c.kra_pin as customer_kra_pin,
               u.full_name as cashier_name, b.name as branch_name, b.code as branch_code
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.cashier_user_id = u.id
        JOIN branches b ON o.branch_id = b.id
        WHERE o.id = ?
    `).get(Number(orderId));

    if (!order) return null;

    // Branch isolation
    if (user.roleName && user.roleName !== 'SUPER_ADMIN' && order.branch_id !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Access to order belonging to another branch is denied.');
        err.statusCode = 403;
        throw err;
    }

    // Items
    const items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.sku, p.unit, p.barcode
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `).all(order.id);

    // Status Timeline
    const timeline = db.prepare(`
        SELECT osh.*, u.full_name as user_name, r.name as user_role
        FROM order_status_history osh
        LEFT JOIN users u ON osh.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE osh.order_id = ?
        ORDER BY osh.created_at ASC, osh.id ASC
    `).all(order.id);

    // Internal notes
    const internalNotes = db.prepare(`
        SELECT oin.*, u.full_name as author_name, r.name as author_role
        FROM order_internal_notes oin
        LEFT JOIN users u ON oin.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE oin.order_id = ?
        ORDER BY oin.created_at DESC
    `).all(order.id);

    // Delivery details
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
    `).get(order.id);

    // Payments
    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(order.id);

    return {
        ...order,
        items,
        timeline,
        internal_notes_list: internalNotes,
        delivery: delivery || null,
        payments
    };
}

/**
 * Create a new order (DRAFT or CONFIRMED)
 */
function createOrder(orderData, user) {
    const branchId = Number(orderData.branch_id) || user.branchId || user.branch_id || 1;

    if (user.roleName !== 'SUPER_ADMIN' && branchId !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Cannot create orders for another branch.');
        err.statusCode = 403;
        throw err;
    }

    const {
        customer_id,
        items,
        initial_status = 'DRAFT',
        order_type = 'DELIVERY_ORDER',
        delivery_address,
        delivery_city,
        recipient_name,
        recipient_phone,
        special_instructions,
        delivery_fee = 0,
        priority = 'NORMAL'
    } = orderData;

    if (!customer_id || !items || !items.length) {
        const err = new Error('Customer and items are required to create an order.');
        err.statusCode = 400;
        throw err;
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(customer_id));
    if (!customer) {
        const err = new Error(`Customer ID ${customer_id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    if (customer.status === 'BLOCKED' || customer.status === 'SUSPENDED') {
        const err = new Error(`Order rejected: Customer '${customer.full_name}' is ${customer.status}. Cannot place new orders.`);
        err.statusCode = 403;
        err.code = 'CUSTOMER_STATUS_BLOCKED';
        throw err;
    }

    // Resolve delivery address and recipient
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
    const vatRate = company ? Number(company.vat_rate) : 16.0;

    let subtotal = 0;
    const preparedItems = [];

    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.product_id));
        if (!product) {
            const err = new Error(`Product ID ${item.product_id} not found.`);
            err.statusCode = 404;
            throw err;
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Number(item.unit_price ?? product.selling_price ?? product.price ?? 0);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;

        preparedItems.push({
            product,
            quantity: qty,
            unit_price: unitPrice,
            total_price: lineTotal
        });
    }

    const delFee = Math.max(0, Number(delivery_fee) || 0);
    const taxAmount = Number((subtotal * (vatRate / (100 + vatRate))).toFixed(2));
    const totalAmount = Number((subtotal + delFee).toFixed(2));

    const requestedStatus = String(initial_status).toUpperCase();
    const targetStatus = ['DRAFT', 'CONFIRMED', 'READY_FOR_DISPATCH'].includes(requestedStatus)
        ? requestedStatus
        : 'DRAFT';

    const orderNumber = `ORD-${branchId}-${Date.now().toString().slice(-6)}`;
    const deliveryNumber = `DEL-${branchId}-${Date.now().toString().slice(-6)}`;
    const warehouseId = getPrimaryWarehouse(branchId);

    let createdOrderId = null;
    let createdDeliveryId = null;

    db.transaction(() => {
        const ordRes = db.prepare(`
            INSERT INTO orders (
                branch_id, order_number, customer_id, cashier_user_id, order_type,
                status, subtotal, discount_amount, tax_amount, total_amount, payment_status,
                delivery_required, delivery_fee, delivery_address, delivery_city,
                recipient_name, recipient_phone, special_instructions,
                inventory_allocated, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'UNPAID', 1, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
            branchId,
            orderNumber,
            customer.id,
            user.id,
            order_type,
            targetStatus,
            subtotal,
            taxAmount,
            totalAmount,
            delFee,
            finalDeliveryAddress,
            finalDeliveryCity || 'Nairobi',
            finalRecipientName,
            finalRecipientPhone,
            special_instructions || ''
        );
        createdOrderId = ordRes.lastInsertRowid;

        // Insert line items
        const insertItem = db.prepare(`
            INSERT INTO order_items (
                order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
            ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `);

        for (const it of preparedItems) {
            const lineTax = Number((it.total_price * (vatRate / (100 + vatRate))).toFixed(2));
            insertItem.run(createdOrderId, it.product.id, it.quantity, it.unit_price, vatRate, lineTax, it.total_price);
        }

        // Record initial status history
        db.prepare(`
            INSERT INTO order_status_history (order_id, from_status, to_status, user_id, notes)
            VALUES (?, NULL, ?, ?, ?)
        `).run(createdOrderId, targetStatus, user.id, `Order created in ${targetStatus} status`);

        // If targetStatus is CONFIRMED or READY_FOR_DISPATCH, allocate inventory reservations
        if (targetStatus === 'CONFIRMED' || targetStatus === 'READY_FOR_DISPATCH') {
            for (const it of preparedItems) {
                inventoryStateService.reserveStock({
                    branchId,
                    warehouseId,
                    productId: it.product.id,
                    quantity: it.quantity,
                    referenceType: 'ORDER',
                    referenceId: orderNumber,
                    userId: user.id,
                    reason: `Reserved for order ${orderNumber}`
                });
            }

            db.prepare(`
                UPDATE orders
                SET inventory_allocated = 1, allocated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(createdOrderId);
        }

        // Create linked delivery record for courier orders
        const delRes = db.prepare(`
            INSERT INTO deliveries (
                branch_id, delivery_number, order_id, dispatcher_user_id,
                status, priority, scheduled_pickup_at, estimated_delivery_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+3 hours'))
        `).run(branchId, deliveryNumber, createdOrderId, user.id, targetStatus === 'READY_FOR_DISPATCH' ? 'READY_FOR_DISPATCH' : 'PENDING', priority || 'NORMAL');
        createdDeliveryId = delRes.lastInsertRowid;

        // Populate delivery items
        db.prepare(`
            INSERT INTO delivery_items (delivery_id, order_item_id, product_id, quantity)
            SELECT ?, id, product_id, quantity FROM order_items WHERE order_id = ?
        `).run(createdDeliveryId, createdOrderId);

        logAuditEvent({
            userId: user.id,
            role: user.roleName || user.role,
            action: 'CREATE_ORDER',
            resource: 'ORDER',
            resourceId: orderNumber,
            branchId,
            newValue: { order_number: orderNumber, status: targetStatus, total_amount: totalAmount },
            reason: `Created order in ${targetStatus}`
        });
    })();

    return {
        id: createdOrderId,
        order_number: orderNumber,
        delivery_number: deliveryNumber,
        status: targetStatus,
        total_amount: totalAmount,
        subtotal,
        delivery_fee: delFee
    };
}

/**
 * Edit order before fulfillment (Allowed only in DRAFT or CONFIRMED)
 */
function editOrder(orderId, updateData, user) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
    if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }

    if (user.roleName !== 'SUPER_ADMIN' && order.branch_id !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Cannot edit order of another branch.');
        err.statusCode = 403;
        throw err;
    }

    // FULFILLMENT EDIT GUARD: Only DRAFT or CONFIRMED orders can be edited
    if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        const err = new Error(`Cannot edit order in '${order.status}' status. Editing is only permitted prior to fulfillment (DRAFT or CONFIRMED).`);
        err.statusCode = 400;
        err.code = 'ORDER_LOCKED_FOR_EDITING';
        throw err;
    }

    const warehouseId = getPrimaryWarehouse(order.branch_id);
    const company = db.prepare('SELECT vat_rate FROM company_settings WHERE id = 1').get();
    const vatRate = company ? Number(company.vat_rate) : 16.0;

    return db.transaction(() => {
        // If items are being updated
        if (updateData.items && Array.isArray(updateData.items) && updateData.items.length > 0) {
            // If inventory was reserved, release existing reservations first
            if (order.inventory_allocated === 1) {
                const existingItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
                for (const it of existingItems) {
                    inventoryStateService.releaseReservation({
                        branchId: order.branch_id,
                        warehouseId,
                        productId: it.product_id,
                        quantity: it.quantity,
                        referenceType: 'ORDER',
                        referenceId: order.order_number,
                        userId: user.id,
                        reason: `Release previous items for order ${order.order_number} edit`
                    });
                }
            }

            // If delivery items reference these order items, remove delivery_items first
            db.prepare(`
                DELETE FROM delivery_items
                WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)
            `).run(order.id);

            // Remove previous items
            db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);

            let subtotal = 0;
            const insertItem = db.prepare(`
                INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_price
                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)
            `);

            for (const it of updateData.items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.product_id));
                if (!product) throw new Error(`Product ${it.product_id} not found.`);

                const qty = Math.max(1, Number(it.quantity) || 1);
                const unitPrice = Number(it.unit_price ?? product.selling_price ?? product.price ?? 0);
                const lineTotal = unitPrice * qty;
                const lineTax = Number((lineTotal * (vatRate / (100 + vatRate))).toFixed(2));
                subtotal += lineTotal;

                insertItem.run(order.id, product.id, qty, unitPrice, vatRate, lineTax, lineTotal);

                // Re-reserve if in CONFIRMED state
                if (order.status === 'CONFIRMED') {
                    inventoryStateService.reserveStock({
                        branchId: order.branch_id,
                        warehouseId,
                        productId: product.id,
                        quantity: qty,
                        referenceType: 'ORDER',
                        referenceId: order.order_number,
                        userId: user.id,
                        reason: `Reserved for edited order ${order.order_number}`
                    });
                }
            }

            // Re-populate delivery items if delivery exists
            const delivery = db.prepare('SELECT id FROM deliveries WHERE order_id = ?').get(order.id);
            if (delivery) {
                db.prepare(`
                    INSERT INTO delivery_items (delivery_id, order_item_id, product_id, quantity)
                    SELECT ?, id, product_id, quantity FROM order_items WHERE order_id = ?
                `).run(delivery.id, order.id);
            }

            const delFee = updateData.delivery_fee !== undefined
                ? Number(updateData.delivery_fee)
                : Number(order.delivery_fee);
            const taxAmount = Number((subtotal * (vatRate / (100 + vatRate))).toFixed(2));
            const totalAmount = Number((subtotal + delFee).toFixed(2));

            db.prepare(`
                UPDATE orders
                SET subtotal = ?, tax_amount = ?, total_amount = ?, delivery_fee = ?,
                    inventory_allocated = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(subtotal, taxAmount, totalAmount, delFee, order.status === 'CONFIRMED' ? 1 : 0, order.id);
        } else if (updateData.delivery_fee !== undefined) {
            const delFee = Number(updateData.delivery_fee);
            const totalAmount = Number((order.subtotal + delFee).toFixed(2));
            db.prepare('UPDATE orders SET delivery_fee = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(delFee, totalAmount, order.id);
        }

        // Update address/recipient info if provided
        if (updateData.delivery_address || updateData.delivery_city || updateData.recipient_name || updateData.recipient_phone || updateData.special_instructions) {
            db.prepare(`
                UPDATE orders
                SET delivery_address = COALESCE(?, delivery_address),
                    delivery_city = COALESCE(?, delivery_city),
                    recipient_name = COALESCE(?, recipient_name),
                    recipient_phone = COALESCE(?, recipient_phone),
                    special_instructions = COALESCE(?, special_instructions),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                updateData.delivery_address || null,
                updateData.delivery_city || null,
                updateData.recipient_name || null,
                updateData.recipient_phone || null,
                updateData.special_instructions || null,
                order.id
            );
        }

        // Record history entry for edit
        db.prepare(`
            INSERT INTO order_status_history (order_id, from_status, to_status, user_id, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(order.id, order.status, order.status, user.id, 'Order details modified before fulfillment');

        return getOrderById(order.id, user);
    })();
}

/**
 * Transition order state through the formal state machine
 */
function transitionOrderStatus(orderId, toStatus, { notes = '', reason = '' } = {}, user) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
    if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }

    if (user.roleName !== 'SUPER_ADMIN' && order.branch_id !== (user.branchId || user.branch_id)) {
        const err = new Error('Forbidden: Cannot modify orders of another branch.');
        err.statusCode = 403;
        throw err;
    }

    const currentStatus = order.status;
    const targetStatus = String(toStatus).toUpperCase();

    if (!ORDER_STATUSES[targetStatus]) {
        const err = new Error(`Invalid target status '${toStatus}'.`);
        err.statusCode = 400;
        throw err;
    }

    // Validate state machine transition validity
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus) && user.roleName !== 'SUPER_ADMIN') {
        const err = new Error(`Invalid state transition: Cannot move order from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ')}]`);
        err.statusCode = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
    }

    const warehouseId = getPrimaryWarehouse(order.branch_id);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    return db.transaction(() => {
        // -------------------------------------------------------------
        // CRITICAL INVARIANT: READY_FOR_DISPATCH requires allocated inventory
        // -------------------------------------------------------------
        if (targetStatus === 'READY_FOR_DISPATCH') {
            // Check if inventory has already been allocated
            if (order.inventory_allocated !== 1) {
                // Attempt to reserve stock now if not already reserved
                for (const it of orderItems) {
                    const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, it.product_id);
                    if (!inv || inv.quantity_available < it.quantity) {
                        const avail = inv ? inv.quantity_available : 0;
                        const err = new Error(
                            `CRITICAL INVARIANT VIOLATION: Cannot transition order ${order.order_number} to READY_FOR_DISPATCH. Product ID ${it.product_id} has insufficient available inventory to allocate (Required: ${it.quantity}, Available: ${avail}).`
                        );
                        err.statusCode = 409;
                        err.code = 'INVENTORY_NOT_ALLOCATED';
                        throw err;
                    }

                    inventoryStateService.reserveStock({
                        branchId: order.branch_id,
                        warehouseId,
                        productId: it.product_id,
                        quantity: it.quantity,
                        referenceType: 'ORDER',
                        referenceId: order.order_number,
                        userId: user.id,
                        reason: `Auto-allocated reservation for READY_FOR_DISPATCH`
                    });
                }

                db.prepare(`
                    UPDATE orders
                    SET inventory_allocated = 1, allocated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(order.id);
            } else {
                // Verify existing allocated reservation integrity
                for (const it of orderItems) {
                    const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, it.product_id);
                    if (!inv || inv.quantity_reserved < it.quantity) {
                        const err = new Error(
                            `CRITICAL INVARIANT VIOLATION: Reserved inventory missing for Product ID ${it.product_id}. Required: ${it.quantity}, Reserved: ${inv ? inv.quantity_reserved : 0}.`
                        );
                        err.statusCode = 409;
                        err.code = 'INVENTORY_NOT_ALLOCATED';
                        throw err;
                    }
                }
            }

            // Update delivery record if linked
            db.prepare(`
                UPDATE deliveries
                SET status = 'READY_FOR_DISPATCH', updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
            `).run(order.id);
        }

        // -------------------------------------------------------------
        // CONFIRMATION: Allocate inventory reservation
        // -------------------------------------------------------------
        if (targetStatus === 'CONFIRMED' && order.inventory_allocated === 0) {
            for (const it of orderItems) {
                inventoryStateService.reserveStock({
                    branchId: order.branch_id,
                    warehouseId,
                    productId: it.product_id,
                    quantity: it.quantity,
                    referenceType: 'ORDER',
                    referenceId: order.order_number,
                    userId: user.id,
                    reason: `Reserved for confirmed order ${order.order_number}`
                });
            }

            db.prepare(`
                UPDATE orders
                SET inventory_allocated = 1, allocated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(order.id);
        }

        // -------------------------------------------------------------
        // DISPATCHED: Decrement physical ON_HAND, move to IN_TRANSIT
        // -------------------------------------------------------------
        if (targetStatus === 'DISPATCHED') {
            for (const it of orderItems) {
                inventoryStateService.dispatchStock({
                    branchId: order.branch_id,
                    warehouseId,
                    productId: it.product_id,
                    quantity: it.quantity,
                    referenceType: 'ORDER',
                    referenceId: order.order_number,
                    userId: user.id,
                    reason: `Dispatched order ${order.order_number}`
                });
            }

            db.prepare(`
                UPDATE orders
                SET dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(order.id);

            db.prepare(`
                UPDATE deliveries
                SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
            `).run(order.id);
        }

        // -------------------------------------------------------------
        // DELIVERED: Mark delivery completed
        // -------------------------------------------------------------
        if (targetStatus === 'DELIVERED') {
            db.prepare(`
                UPDATE orders
                SET delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(order.id);

            db.prepare(`
                UPDATE deliveries
                SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
            `).run(order.id);
        }

        // -------------------------------------------------------------
        // CANCELLATION: Release reserved inventory back to AVAILABLE
        // -------------------------------------------------------------
        if (targetStatus === 'CANCELLED') {
            if (order.inventory_allocated === 1 && currentStatus !== 'DISPATCHED' && currentStatus !== 'IN_TRANSIT' && currentStatus !== 'DELIVERED') {
                for (const it of orderItems) {
                    inventoryStateService.releaseReservation({
                        branchId: order.branch_id,
                        warehouseId,
                        productId: it.product_id,
                        quantity: it.quantity,
                        referenceType: 'ORDER',
                        referenceId: order.order_number,
                        userId: user.id,
                        reason: `Order cancelled: ${reason || notes || 'Released reservation'}`
                    });
                }
            }

            db.prepare(`
                UPDATE orders
                SET inventory_allocated = 0,
                    cancelled_at = CURRENT_TIMESTAMP,
                    cancellation_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(reason || notes || 'Cancelled by staff', order.id);

            db.prepare(`
                UPDATE deliveries
                SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
            `).run(order.id);
        }

        // Update order status
        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(targetStatus, order.id);

        // Record history entry
        db.prepare(`
            INSERT INTO order_status_history (order_id, from_status, to_status, user_id, notes)
            VALUES (?, ?, ?, ?, ?)
        `).run(order.id, currentStatus, targetStatus, user.id, notes || reason || `Status changed to ${targetStatus}`);

        logAuditEvent({
            userId: user.id,
            role: user.roleName || user.role,
            action: 'UPDATE_ORDER_STATUS',
            resource: 'ORDER',
            resourceId: order.order_number,
            branchId: order.branch_id,
            previousValue: { status: currentStatus },
            newValue: { status: targetStatus },
            reason: notes || reason || `Transition from ${currentStatus} to ${targetStatus}`
        });

        return getOrderById(order.id, user);
    })();
}

/**
 * Add internal staff note to order
 */
function addInternalNote(orderId, note, user) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
    if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }

    if (!note || !note.trim()) {
        const err = new Error('Note content cannot be empty');
        err.statusCode = 400;
        throw err;
    }

    db.prepare(`
        INSERT INTO order_internal_notes (order_id, user_id, note)
        VALUES (?, ?, ?)
    `).run(order.id, user.id, note.trim());

    return db.prepare(`
        SELECT oin.*, u.full_name as author_name, r.name as author_role
        FROM order_internal_notes oin
        LEFT JOIN users u ON oin.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE oin.order_id = ?
        ORDER BY oin.created_at DESC
    `).all(order.id);
}

/**
 * Generate printable Commercial Tax Invoice data
 */
function generateInvoiceData(orderId, user) {
    const order = getOrderById(orderId, user);
    if (!order) {
        const err = new Error('Order not found');
        err.statusCode = 404;
        throw err;
    }

    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() || {
        company_name: 'SwiftTrack Kenya Limited',
        kra_pin: 'P051234567Z',
        address: 'Nairobi Logistics Hub, Enterprise Road',
        phone: '+254 700 000 000',
        email: 'billing@swifttrack.co.ke'
    };

    return {
        invoice_number: `INV-${order.order_number}`,
        order_number: order.order_number,
        date: order.created_at,
        company,
        customer: {
            name: order.customer_name,
            phone: order.customer_phone,
            email: order.customer_email,
            customer_number: order.customer_number,
            kra_pin: order.customer_kra_pin || 'NOT_PROVIDED',
            delivery_address: order.delivery_address,
            delivery_city: order.delivery_city
        },
        items: order.items.map((it) => ({
            id: it.id,
            sku: it.sku,
            name: it.product_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            tax_amount: it.tax_amount,
            line_total: it.total_price
        })),
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        delivery_fee: order.delivery_fee,
        total_amount: order.total_amount,
        status: order.status,
        payment_status: order.payment_status,
        etr_compliance: {
            fiscal_code: `ETR-KENYA-${Date.now().toString(36).toUpperCase()}`,
            qr_signature: `KRA-ETR-STK-${order.order_number}-${order.total_amount}`
        }
    };
}

/**
 * Export filtered orders to CSV string
 */
function exportOrdersToCsv(filters = {}, user = {}) {
    const orders = listOrders({ ...filters, limit: 1000 }, user);

    const headers = [
        'Order Number',
        'Date',
        'Branch',
        'Customer Name',
        'Customer Phone',
        'Delivery City',
        'Items Count',
        'Subtotal (KES)',
        'Tax (KES)',
        'Delivery Fee (KES)',
        'Total (KES)',
        'Payment Status',
        'Order Status'
    ];

    const rows = orders.map((o) => [
        o.order_number,
        o.created_at,
        `"${o.branch_name || ''}"`,
        `"${o.customer_name || ''}"`,
        `"${o.customer_phone || ''}"`,
        `"${o.delivery_city || ''}"`,
        o.items_count || 0,
        o.subtotal || 0,
        o.tax_amount || 0,
        o.delivery_fee || 0,
        o.total_amount || 0,
        o.payment_status,
        o.status
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

module.exports = {
    ORDER_STATUSES,
    ALLOWED_TRANSITIONS,
    listOrders,
    getOrderById,
    createOrder,
    editOrder,
    transitionOrderStatus,
    addInternalNote,
    generateInvoiceData,
    exportOrdersToCsv
};
