// server/services/customerService.js
// SwiftTrack Kenya: Customer Relationship Management Service (Phase 4.1)
const { db } = require('../db/database.js');
const { logAuditEvent } = require('../middleware/audit.js');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'];
const VALID_NOTE_TYPES = ['GENERAL', 'PREFERENCE', 'ISSUE', 'CALL_LOG', 'ACCOUNT'];

/**
 * Generates a collision-resistant Kenyan standard customer number
 * Format: CUST-BR{branchId}-{6 random digits}
 */
function generateCustomerNumber(branchId = 1) {
    let customerNumber;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 20) {
        attempts++;
        const rand = Math.floor(100000 + Math.random() * 900000);
        customerNumber = `CUST-BR${branchId}-${rand}`;
        const row = db.prepare('SELECT id FROM customers WHERE customer_number = ?').get(customerNumber);
        if (!row) exists = false;
    }
    return customerNumber;
}

/**
 * Verifies that the user has branch authorization to access a customer
 */
function assertCustomerBranchAccess(customer, user) {
    if (!customer) {
        const err = new Error('Customer not found');
        err.statusCode = 404;
        throw err;
    }
    if (user.roleName !== 'SUPER_ADMIN' && customer.branch_id !== user.branchId) {
        const err = new Error('Forbidden: Customer belongs to another branch');
        err.statusCode = 403;
        throw err;
    }
}

/**
 * List customers with search, status filtering, and branch isolation
 */
function listCustomers({ branchId, search, status, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    let countQuery = 'SELECT count(*) as total FROM customers c WHERE 1=1';
    let dataQuery = `
        SELECT c.*, b.name as branch_name, b.code as branch_code,
               (SELECT count(*) FROM customer_addresses WHERE customer_id = c.id) as address_count,
               (SELECT count(*) FROM orders WHERE customer_id = c.id) as order_count,
               COALESCE((SELECT sum(total_amount) FROM sales WHERE customer_id = c.id), 0.0) as total_spent,
               (SELECT address_line FROM customer_addresses WHERE customer_id = c.id AND is_default = 1 LIMIT 1) as default_address,
               (SELECT city FROM customer_addresses WHERE customer_id = c.id AND is_default = 1 LIMIT 1) as default_city
        FROM customers c
        JOIN branches b ON c.branch_id = b.id
        WHERE 1=1
    `;
    const params = [];

    if (branchId) {
        countQuery += ' AND c.branch_id = ?';
        dataQuery += ' AND c.branch_id = ?';
        params.push(Number(branchId));
    }

    if (status && VALID_STATUSES.includes(status.toUpperCase())) {
        countQuery += ' AND c.status = ?';
        dataQuery += ' AND c.status = ?';
        params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        const searchClause = ' AND (c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.customer_number LIKE ?)';
        countQuery += searchClause;
        dataQuery += searchClause;
        params.push(s, s, s, s);
    }

    const totalRow = db.prepare(countQuery).get(...params);
    const total = totalRow ? totalRow.total : 0;

    dataQuery += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, pageLimit, offset];
    const customers = db.prepare(dataQuery).all(...dataParams);

    return {
        customers,
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
    };
}

/**
 * Get customer by ID with full addresses, recent notes, and lifetime financial summary
 */
function getCustomerById(customerId, user) {
    const custId = Number(customerId);
    const customer = db.prepare(`
        SELECT c.*, b.name as branch_name, b.code as branch_code
        FROM customers c
        JOIN branches b ON c.branch_id = b.id
        WHERE c.id = ?
    `).get(custId);

    assertCustomerBranchAccess(customer, user);

    // Fetch delivery addresses
    const addresses = db.prepare(`
        SELECT * FROM customer_addresses
        WHERE customer_id = ?
        ORDER BY is_default DESC, id ASC
    `).all(custId);

    // Fetch notes
    const notes = db.prepare(`
        SELECT cn.*, u.full_name as author_name, r.name as author_role
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE cn.customer_id = ?
        ORDER BY cn.created_at DESC, cn.id DESC
        LIMIT 50
    `).all(custId);

    // Lifetime analytics & statistics
    const orderStats = db.prepare(`
        SELECT
            count(*) as total_orders,
            sum(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
            sum(CASE WHEN status NOT IN ('COMPLETED', 'CANCELLED', 'DELIVERED') THEN 1 ELSE 0 END) as pending_orders,
            max(created_at) as last_order_date
        FROM orders
        WHERE customer_id = ?
    `).get(custId);

    const salesStats = db.prepare(`
        SELECT
            count(*) as total_sales,
            COALESCE(sum(total_amount), 0.0) as total_spent
        FROM sales
        WHERE customer_id = ?
    `).get(custId);

    const paymentStats = db.prepare(`
        SELECT COALESCE(sum(amount), 0.0) as total_payments
        FROM payments
        WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
           OR order_id IN (SELECT id FROM orders WHERE customer_id = ?)
    `).get(custId, custId);

    const refundStats = db.prepare(`
        SELECT
            count(*) as refund_requests_count,
            COALESCE(sum(amount), 0.0) as total_refunded
        FROM refund_requests
        WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
          AND status = 'APPROVED'
    `).get(custId);

    const summary = {
        total_orders: orderStats ? orderStats.total_orders : 0,
        completed_orders: orderStats ? orderStats.completed_orders : 0,
        pending_orders: orderStats ? orderStats.pending_orders : 0,
        last_order_date: orderStats ? orderStats.last_order_date : null,
        total_sales: salesStats ? salesStats.total_sales : 0,
        total_spent: salesStats ? Number(salesStats.total_spent.toFixed(2)) : 0.0,
        total_payments: paymentStats ? Number(paymentStats.total_payments.toFixed(2)) : 0.0,
        total_refunded: refundStats ? Number(refundStats.total_refunded.toFixed(2)) : 0.0,
        net_spent: Number(((salesStats?.total_spent || 0) - (refundStats?.total_refunded || 0)).toFixed(2))
    };

    return {
        ...customer,
        addresses,
        notes,
        summary
    };
}

/**
 * Create a new customer profile
 */
function createCustomer(data, user) {
    if (!data.full_name || !data.full_name.trim()) {
        const err = new Error('Full name is required');
        err.statusCode = 400;
        throw err;
    }
    if (!data.phone || !data.phone.trim()) {
        const err = new Error('Phone number is required');
        err.statusCode = 400;
        throw err;
    }

    const branchId = (user.roleName === 'SUPER_ADMIN' && data.branch_id)
        ? Number(data.branch_id)
        : (user.branchId || 1);

    const customerNumber = data.customer_number && data.customer_number.trim()
        ? data.customer_number.trim().toUpperCase()
        : generateCustomerNumber(branchId);

    // Check duplicate customer_number
    const dupNumber = db.prepare('SELECT id FROM customers WHERE customer_number = ?').get(customerNumber);
    if (dupNumber) {
        const err = new Error(`Customer number '${customerNumber}' already exists.`);
        err.statusCode = 409;
        throw err;
    }

    const status = (data.status && VALID_STATUSES.includes(data.status.toUpperCase()))
        ? data.status.toUpperCase()
        : 'ACTIVE';

    let customerId;

    db.transaction(() => {
        const res = db.prepare(`
            INSERT INTO customers (
                branch_id, customer_number, full_name, phone, email,
                address, city, kra_pin, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            branchId,
            customerNumber,
            data.full_name.trim(),
            data.phone.trim(),
            data.email ? data.email.trim().toLowerCase() : null,
            data.address ? data.address.trim() : null,
            data.city ? data.city.trim() : 'Nairobi',
            data.kra_pin ? data.kra_pin.trim().toUpperCase() : null,
            status,
            data.notes ? data.notes.trim() : null
        );

        customerId = res.lastInsertRowid;

        // Auto-create default delivery address if address is provided
        const primaryAddress = data.delivery_address || data.address;
        if (primaryAddress && primaryAddress.trim()) {
            db.prepare(`
                INSERT INTO customer_addresses (
                    customer_id, address_label, address_line, city,
                    contact_name, contact_phone, is_default, delivery_notes
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
                customerId,
                data.address_label ? data.address_label.trim() : 'Primary Location',
                primaryAddress.trim(),
                data.city ? data.city.trim() : 'Nairobi',
                data.contact_name ? data.contact_name.trim() : data.full_name.trim(),
                data.contact_phone ? data.contact_phone.trim() : data.phone.trim(),
                data.delivery_notes ? data.delivery_notes.trim() : null
            );
        }

        // Add initial note if provided
        if (data.initial_note && data.initial_note.trim()) {
            db.prepare(`
                INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
                VALUES (?, ?, ?, 'GENERAL')
            `).run(customerId, user.id, data.initial_note.trim());
        }
    })();

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'CREATE',
        resource: 'CUSTOMER',
        resourceId: String(customerId),
        branchId,
        newValue: { customerNumber, full_name: data.full_name, phone: data.phone, status },
        reason: 'Registered new customer profile'
    });

    return getCustomerById(customerId, user);
}

/**
 * Update an existing customer profile
 */
function updateCustomer(customerId, data, user) {
    const custId = Number(customerId);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(existing, user);

    if (data.full_name !== undefined && !data.full_name.trim()) {
        const err = new Error('Full name cannot be empty');
        err.statusCode = 400;
        throw err;
    }
    if (data.phone !== undefined && !data.phone.trim()) {
        const err = new Error('Phone cannot be empty');
        err.statusCode = 400;
        throw err;
    }

    const branchId = (user.roleName === 'SUPER_ADMIN' && data.branch_id)
        ? Number(data.branch_id)
        : existing.branch_id;

    db.prepare(`
        UPDATE customers
        SET branch_id = ?,
            full_name = COALESCE(?, full_name),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            kra_pin = COALESCE(?, kra_pin),
            notes = COALESCE(?, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        branchId,
        data.full_name ? data.full_name.trim() : null,
        data.phone ? data.phone.trim() : null,
        data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : null,
        data.address !== undefined ? (data.address ? data.address.trim() : null) : null,
        data.city !== undefined ? (data.city ? data.city.trim() : null) : null,
        data.kra_pin !== undefined ? (data.kra_pin ? data.kra_pin.trim().toUpperCase() : null) : null,
        data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : null,
        custId
    );

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'UPDATE',
        resource: 'CUSTOMER',
        resourceId: String(custId),
        branchId: existing.branch_id,
        previousValue: existing,
        newValue: data,
        reason: 'Updated customer profile information'
    });

    return getCustomerById(custId, user);
}

/**
 * Update customer status (ACTIVE, INACTIVE, SUSPENDED, BLOCKED)
 */
function updateCustomerStatus(customerId, newStatus, reason, user) {
    const custId = Number(customerId);
    const upperStatus = String(newStatus).toUpperCase().trim();

    if (!VALID_STATUSES.includes(upperStatus)) {
        const err = new Error(`Invalid status '${newStatus}'. Must be one of: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
    }

    // Protect default walk-in customer (id 1)
    if (custId === 1 && (upperStatus === 'SUSPENDED' || upperStatus === 'BLOCKED')) {
        const err = new Error('Walk-in default customer cannot be suspended or blocked.');
        err.statusCode = 400;
        throw err;
    }

    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(existing, user);

    const oldStatus = existing.status;
    if (oldStatus === upperStatus) {
        return getCustomerById(custId, user);
    }

    db.transaction(() => {
        db.prepare('UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(upperStatus, custId);

        // Record automated status transition note
        const noteText = `Status transitioned from ${oldStatus} to ${upperStatus}.${reason ? ` Reason: ${reason}` : ''}`;
        db.prepare(`
            INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
            VALUES (?, ?, ?, 'ACCOUNT')
        `).run(custId, user.id, noteText);
    })();

    logAuditEvent({
        userId: user.id,
        role: user.roleName,
        action: 'STATUS_CHANGE',
        resource: 'CUSTOMER',
        resourceId: String(custId),
        branchId: existing.branch_id,
        previousValue: { status: oldStatus },
        newValue: { status: upperStatus, reason },
        reason: `Customer status updated to ${upperStatus}`
    });

    return getCustomerById(custId, user);
}

/**
 * Add delivery address to customer
 */
function addDeliveryAddress(customerId, addressData, user) {
    const custId = Number(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    if (!addressData.address_line || !addressData.address_line.trim()) {
        const err = new Error('Address line is required');
        err.statusCode = 400;
        throw err;
    }

    const countExisting = db.prepare('SELECT count(*) as count FROM customer_addresses WHERE customer_id = ?').get(custId);
    const isFirst = countExisting.count === 0;
    const shouldBeDefault = Boolean(addressData.is_default) || isFirst;

    let addressId;

    db.transaction(() => {
        if (shouldBeDefault) {
            db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(custId);
        }

        const res = db.prepare(`
            INSERT INTO customer_addresses (
                customer_id, address_label, address_line, city,
                contact_name, contact_phone, is_default, delivery_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            custId,
            addressData.address_label ? addressData.address_label.trim() : 'Branch / Site',
            addressData.address_line.trim(),
            addressData.city ? addressData.city.trim() : 'Nairobi',
            addressData.contact_name ? addressData.contact_name.trim() : customer.full_name,
            addressData.contact_phone ? addressData.contact_phone.trim() : customer.phone,
            shouldBeDefault ? 1 : 0,
            addressData.delivery_notes ? addressData.delivery_notes.trim() : null
        );

        addressId = res.lastInsertRowid;
    })();

    return db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(addressId);
}

/**
 * Update an existing delivery address
 */
function updateDeliveryAddress(customerId, addressId, addressData, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const existingAddr = db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?').get(addrId, custId);
    if (!existingAddr) {
        const err = new Error('Delivery address not found for this customer');
        err.statusCode = 404;
        throw err;
    }

    const shouldBeDefault = addressData.is_default !== undefined ? Boolean(addressData.is_default) : existingAddr.is_default === 1;

    db.transaction(() => {
        if (shouldBeDefault && existingAddr.is_default !== 1) {
            db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(custId);
        }

        db.prepare(`
            UPDATE customer_addresses
            SET address_label = COALESCE(?, address_label),
                address_line = COALESCE(?, address_line),
                city = COALESCE(?, city),
                contact_name = COALESCE(?, contact_name),
                contact_phone = COALESCE(?, contact_phone),
                is_default = ?,
                delivery_notes = COALESCE(?, delivery_notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            addressData.address_label ? addressData.address_label.trim() : null,
            addressData.address_line ? addressData.address_line.trim() : null,
            addressData.city ? addressData.city.trim() : null,
            addressData.contact_name ? addressData.contact_name.trim() : null,
            addressData.contact_phone ? addressData.contact_phone.trim() : null,
            shouldBeDefault ? 1 : 0,
            addressData.delivery_notes !== undefined ? (addressData.delivery_notes ? addressData.delivery_notes.trim() : null) : null,
            addrId
        );
    })();

    return db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(addrId);
}

/**
 * Delete a delivery address
 */
function deleteDeliveryAddress(customerId, addressId, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const addr = db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?').get(addrId, custId);
    if (!addr) {
        const err = new Error('Delivery address not found');
        err.statusCode = 404;
        throw err;
    }

    db.transaction(() => {
        db.prepare('DELETE FROM customer_addresses WHERE id = ?').run(addrId);

        // If the deleted address was default, promote another address to default if available
        if (addr.is_default === 1) {
            const nextAddr = db.prepare('SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id ASC LIMIT 1').get(custId);
            if (nextAddr) {
                db.prepare('UPDATE customer_addresses SET is_default = 1 WHERE id = ?').run(nextAddr.id);
            }
        }
    })();

    return { success: true, deletedId: addrId };
}

/**
 * Set an address as default delivery address
 */
function setDefaultAddress(customerId, addressId, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const addr = db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?').get(addrId, custId);
    if (!addr) {
        const err = new Error('Delivery address not found');
        err.statusCode = 404;
        throw err;
    }

    db.transaction(() => {
        db.prepare('UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?').run(custId);
        db.prepare('UPDATE customer_addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(addrId);
    })();

    return db.prepare('SELECT * FROM customer_addresses WHERE id = ?').get(addrId);
}

/**
 * Add a customer note
 */
function addCustomerNote(customerId, { note_text, note_type }, user) {
    const custId = Number(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    if (!note_text || !note_text.trim()) {
        const err = new Error('Note text is required');
        err.statusCode = 400;
        throw err;
    }

    const type = note_type && VALID_NOTE_TYPES.includes(note_type.toUpperCase())
        ? note_type.toUpperCase()
        : 'GENERAL';

    const res = db.prepare(`
        INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
        VALUES (?, ?, ?, ?)
    `).run(custId, user.id, note_text.trim(), type);

    return db.prepare(`
        SELECT cn.*, u.full_name as author_name, r.name as author_role
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE cn.id = ?
    `).get(res.lastInsertRowid);
}

/**
 * Delete a customer note
 */
function deleteCustomerNote(customerId, noteId, user) {
    const custId = Number(customerId);
    const nId = Number(noteId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const note = db.prepare('SELECT * FROM customer_notes WHERE id = ? AND customer_id = ?').get(nId, custId);
    if (!note) {
        const err = new Error('Note not found');
        err.statusCode = 404;
        throw err;
    }

    // Only author or SUPER_ADMIN can delete note
    if (user.roleName !== 'SUPER_ADMIN' && note.user_id !== user.id) {
        const err = new Error('Forbidden: You can only delete notes created by yourself');
        err.statusCode = 403;
        throw err;
    }

    db.prepare('DELETE FROM customer_notes WHERE id = ?').run(nId);
    return { success: true, deletedId: nId };
}

/**
 * Get customer order history
 */
function getCustomerOrderHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = db.prepare('SELECT count(*) as total FROM orders WHERE customer_id = ?').get(custId);
    const total = totalRow ? totalRow.total : 0;

    const orders = db.prepare(`
        SELECT o.*, b.name as branch_name, u.full_name as cashier_name,
               (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count,
               d.delivery_number, d.status as delivery_status
        FROM orders o
        JOIN branches b ON o.branch_id = b.id
        JOIN users u ON o.cashier_user_id = u.id
        LEFT JOIN deliveries d ON o.id = d.order_id
        WHERE o.customer_id = ?
        ORDER BY o.id DESC
        LIMIT ? OFFSET ?
    `).all(custId, pageLimit, offset);

    return {
        orders,
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
    };
}

/**
 * Get customer payment history
 */
function getCustomerPaymentHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = db.prepare(`
        SELECT count(*) as total
        FROM payments p
        WHERE p.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
           OR p.order_id IN (SELECT id FROM orders WHERE customer_id = ?)
    `).get(custId, custId);
    const total = totalRow ? totalRow.total : 0;

    const payments = db.prepare(`
        SELECT p.*, b.name as branch_name, u.full_name as cashier_name,
               s.sale_number, o.order_number
        FROM payments p
        JOIN branches b ON p.branch_id = b.id
        JOIN users u ON p.cashier_user_id = u.id
        LEFT JOIN sales s ON p.sale_id = s.id
        LEFT JOIN orders o ON p.order_id = o.id
        WHERE p.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
           OR p.order_id IN (SELECT id FROM orders WHERE customer_id = ?)
        ORDER BY p.id DESC
        LIMIT ? OFFSET ?
    `).all(custId, custId, pageLimit, offset);

    return {
        payments,
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
    };
}

/**
 * Get customer refund history
 */
function getCustomerRefundHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = db.prepare(`
        SELECT count(*) as total
        FROM refund_requests rr
        WHERE rr.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
    `).get(custId);
    const total = totalRow ? totalRow.total : 0;

    const refunds = db.prepare(`
        SELECT rr.*, b.name as branch_name, cashier.full_name as cashier_name,
               approver.full_name as approved_by_name,
               s.sale_number, s.total_amount as original_sale_amount,
               r.refund_number, r.created_at as processed_at, r.payment_method as refund_method
        FROM refund_requests rr
        JOIN branches b ON rr.branch_id = b.id
        JOIN users cashier ON rr.cashier_user_id = cashier.id
        LEFT JOIN users approver ON rr.approved_by_user_id = approver.id
        JOIN sales s ON rr.sale_id = s.id
        LEFT JOIN refunds r ON rr.id = r.refund_request_id
        WHERE rr.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
        ORDER BY rr.id DESC
        LIMIT ? OFFSET ?
    `).all(custId, pageLimit, offset);

    return {
        refunds,
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
    };
}

module.exports = {
    VALID_STATUSES,
    VALID_NOTE_TYPES,
    generateCustomerNumber,
    listCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    updateCustomerStatus,
    addDeliveryAddress,
    updateDeliveryAddress,
    deleteDeliveryAddress,
    setDefaultAddress,
    addCustomerNote,
    deleteCustomerNote,
    getCustomerOrderHistory,
    getCustomerPaymentHistory,
    getCustomerRefundHistory
};
