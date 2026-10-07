// server/services/customerService.js
// SwiftTrack Kenya: Customer Relationship Management Service (Phase 4.1)
const dbAdapter = require('../db/dbAdapter.js');
const { logAuditEvent } = require('../middleware/audit.js');

const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'];
const VALID_NOTE_TYPES = ['GENERAL', 'PREFERENCE', 'ISSUE', 'CALL_LOG', 'ACCOUNT'];

/**
 * Generates a collision-resistant Kenyan standard customer number
 * Format: CUST-BR{branchId}-{6 random digits}
 */
async function generateCustomerNumber(branchId = 1, client = null) {
    let customerNumber;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 20) {
        attempts++;
        const rand = Math.floor(100000 + Math.random() * 900000);
        customerNumber = `CUST-BR${branchId}-${rand}`;
        const row = await dbAdapter.get('SELECT id FROM customers WHERE customer_number = ?', [customerNumber], client);
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
async function listCustomers({ branchId, search, status, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;
    const defaultCond = dbAdapter.isPostgres ? 'is_default = true' : 'is_default = 1';

    let countQuery = 'SELECT count(*) as total FROM customers c WHERE 1=1';
    let dataQuery = `
        SELECT c.*, b.name as branch_name, b.code as branch_code,
               (SELECT count(*) FROM customer_addresses WHERE customer_id = c.id) as address_count,
               (SELECT count(*) FROM orders WHERE customer_id = c.id) as order_count,
               COALESCE((SELECT sum(total_amount) FROM sales WHERE customer_id = c.id), 0.0) as total_spent,
               (SELECT address_line FROM customer_addresses WHERE customer_id = c.id AND ${defaultCond} LIMIT 1) as default_address,
               (SELECT city FROM customer_addresses WHERE customer_id = c.id AND ${defaultCond} LIMIT 1) as default_city
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

    const totalRow = await dbAdapter.get(countQuery, params);
    const total = totalRow ? Number(totalRow.total) : 0;

    dataQuery += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, pageLimit, offset];
    const customers = await dbAdapter.all(dataQuery, dataParams);

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
async function getCustomerById(customerId, user, client = null) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get(`
        SELECT c.*, b.name as branch_name, b.code as branch_code
        FROM customers c
        JOIN branches b ON c.branch_id = b.id
        WHERE c.id = ?
    `, [custId], client);

    assertCustomerBranchAccess(customer, user);

    // Fetch delivery addresses
    const addresses = await dbAdapter.all(`
        SELECT * FROM customer_addresses
        WHERE customer_id = ?
        ORDER BY is_default DESC, id ASC
    `, [custId], client);

    // Fetch notes
    const notes = await dbAdapter.all(`
        SELECT cn.*, u.full_name as author_name, r.name as author_role
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE cn.customer_id = ?
        ORDER BY cn.created_at DESC, cn.id DESC
        LIMIT 50
    `, [custId], client);

    // Lifetime analytics & statistics
    const orderStats = await dbAdapter.get(`
        SELECT
            count(*) as total_orders,
            sum(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
            sum(CASE WHEN status NOT IN ('COMPLETED', 'CANCELLED', 'DELIVERED') THEN 1 ELSE 0 END) as pending_orders,
            max(created_at) as last_order_date
        FROM orders
        WHERE customer_id = ?
    `, [custId], client);

    const salesStats = await dbAdapter.get(`
        SELECT
            count(*) as total_sales,
            COALESCE(sum(total_amount), 0.0) as total_spent
        FROM sales
        WHERE customer_id = ?
    `, [custId], client);

    const paymentStats = await dbAdapter.get(`
        SELECT COALESCE(sum(amount), 0.0) as total_payments
        FROM payments
        WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
           OR order_id IN (SELECT id FROM orders WHERE customer_id = ?)
    `, [custId, custId], client);

    const refundStats = await dbAdapter.get(`
        SELECT
            count(*) as refund_requests_count,
            COALESCE(sum(amount), 0.0) as total_refunded
        FROM refund_requests
        WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
          AND status = 'APPROVED'
    `, [custId], client);

    const totalSpent = salesStats ? Number(Number(salesStats.total_spent).toFixed(2)) : 0.0;
    const totalRefunded = refundStats ? Number(Number(refundStats.total_refunded).toFixed(2)) : 0.0;

    const summary = {
        total_orders: orderStats ? Number(orderStats.total_orders) : 0,
        completed_orders: orderStats ? Number(orderStats.completed_orders || 0) : 0,
        pending_orders: orderStats ? Number(orderStats.pending_orders || 0) : 0,
        last_order_date: orderStats ? orderStats.last_order_date : null,
        total_sales: salesStats ? Number(salesStats.total_sales) : 0,
        total_spent: totalSpent,
        total_payments: paymentStats ? Number(Number(paymentStats.total_payments).toFixed(2)) : 0.0,
        total_refunded: totalRefunded,
        net_spent: Number((totalSpent - totalRefunded).toFixed(2))
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
async function createCustomer(data, user) {
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
        : await generateCustomerNumber(branchId);

    // Check duplicate customer_number
    const dupNumber = await dbAdapter.get('SELECT id FROM customers WHERE customer_number = ?', [customerNumber]);
    if (dupNumber) {
        const err = new Error(`Customer number '${customerNumber}' already exists.`);
        err.statusCode = 409;
        throw err;
    }

    const status = (data.status && VALID_STATUSES.includes(data.status.toUpperCase()))
        ? data.status.toUpperCase()
        : 'ACTIVE';

    let customerId;

    await dbAdapter.withTransaction(async (tx) => {
        const res = await tx.run(`
            INSERT INTO customers (
                branch_id, customer_number, full_name, phone, email,
                address, city, kra_pin, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            branchId,
            customerNumber,
            data.full_name.trim(),
            data.phone.trim(),
            data.email ? data.email.trim().toLowerCase() : null,
            data.address ? data.address.trim() : null,
            data.city ? data.city.trim() : null,
            data.kra_pin ? data.kra_pin.trim().toUpperCase() : null,
            status,
            data.notes ? data.notes.trim() : null
        ]);

        customerId = res.insertId;

        // Auto-create default delivery address if address is provided
        const primaryAddress = data.delivery_address || data.address;
        if (primaryAddress && primaryAddress.trim()) {
            const defVal = dbAdapter.isPostgres ? true : 1;
            await tx.run(`
                INSERT INTO customer_addresses (
                    customer_id, address_label, address_line, city,
                    contact_name, contact_phone, is_default, delivery_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                customerId,
                data.address_label ? data.address_label.trim() : 'Primary Location',
                primaryAddress.trim(),
                data.city ? data.city.trim() : null,
                data.contact_name ? data.contact_name.trim() : data.full_name.trim(),
                data.contact_phone ? data.contact_phone.trim() : data.phone.trim(),
                defVal,
                data.delivery_notes ? data.delivery_notes.trim() : null
            ]);
        }

        // Add initial note if provided
        if (data.initial_note && data.initial_note.trim()) {
            await tx.run(`
                INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
                VALUES (?, ?, ?, 'GENERAL')
            `, [customerId, user.id, data.initial_note.trim()]);
        }
    });

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
async function updateCustomer(customerId, data, user) {
    const custId = Number(customerId);
    const existing = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
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

    await dbAdapter.run(`
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
    `, [
        branchId,
        data.full_name ? data.full_name.trim() : null,
        data.phone ? data.phone.trim() : null,
        data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : null,
        data.address !== undefined ? (data.address ? data.address.trim() : null) : null,
        data.city !== undefined ? (data.city ? data.city.trim() : null) : null,
        data.kra_pin !== undefined ? (data.kra_pin ? data.kra_pin.trim().toUpperCase() : null) : null,
        data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : null,
        custId
    ]);

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
async function updateCustomerStatus(customerId, newStatus, reason, user) {
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

    const existing = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(existing, user);

    const oldStatus = existing.status;
    if (oldStatus === upperStatus) {
        return getCustomerById(custId, user);
    }

    await dbAdapter.withTransaction(async (tx) => {
        await tx.run('UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [upperStatus, custId]);

        // Record automated status transition note
        const noteText = `Status transitioned from ${oldStatus} to ${upperStatus}.${reason ? ` Reason: ${reason}` : ''}`;
        await tx.run(`
            INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
            VALUES (?, ?, ?, 'ACCOUNT')
        `, [custId, user.id, noteText]);
    });

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
async function addDeliveryAddress(customerId, addressData, user) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    if (!addressData.address_line || !addressData.address_line.trim()) {
        const err = new Error('Address line is required');
        err.statusCode = 400;
        throw err;
    }

    const countExisting = await dbAdapter.get('SELECT count(*) as count FROM customer_addresses WHERE customer_id = ?', [custId]);
    const isFirst = Number(countExisting.count) === 0;
    const shouldBeDefault = Boolean(addressData.is_default) || isFirst;
    const falseVal = dbAdapter.isPostgres ? false : 0;
    const trueVal = dbAdapter.isPostgres ? true : 1;

    let addressId;

    await dbAdapter.withTransaction(async (tx) => {
        if (shouldBeDefault) {
            await tx.run('UPDATE customer_addresses SET is_default = ? WHERE customer_id = ?', [falseVal, custId]);
        }

        const res = await tx.run(`
            INSERT INTO customer_addresses (
                customer_id, address_label, address_line, city,
                contact_name, contact_phone, is_default, delivery_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            custId,
            addressData.address_label ? addressData.address_label.trim() : 'Branch / Site',
            addressData.address_line.trim(),
            addressData.city ? addressData.city.trim() : (customer.city || null),
            addressData.contact_name ? addressData.contact_name.trim() : customer.full_name,
            addressData.contact_phone ? addressData.contact_phone.trim() : customer.phone,
            shouldBeDefault ? trueVal : falseVal,
            addressData.delivery_notes ? addressData.delivery_notes.trim() : null
        ]);

        addressId = res.insertId;
    });

    return dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
}

/**
 * Update an existing delivery address
 */
async function updateDeliveryAddress(customerId, addressId, addressData, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const existingAddr = await dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?', [addrId, custId]);
    if (!existingAddr) {
        const err = new Error('Delivery address not found for this customer');
        err.statusCode = 404;
        throw err;
    }

    const isExistingDefault = dbAdapter.isPostgres ? Boolean(existingAddr.is_default) : existingAddr.is_default === 1;
    const shouldBeDefault = addressData.is_default !== undefined ? Boolean(addressData.is_default) : isExistingDefault;
    const falseVal = dbAdapter.isPostgres ? false : 0;
    const trueVal = dbAdapter.isPostgres ? true : 1;

    await dbAdapter.withTransaction(async (tx) => {
        if (shouldBeDefault && !isExistingDefault) {
            await tx.run('UPDATE customer_addresses SET is_default = ? WHERE customer_id = ?', [falseVal, custId]);
        }

        await tx.run(`
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
        `, [
            addressData.address_label ? addressData.address_label.trim() : null,
            addressData.address_line ? addressData.address_line.trim() : null,
            addressData.city ? addressData.city.trim() : null,
            addressData.contact_name ? addressData.contact_name.trim() : null,
            addressData.contact_phone ? addressData.contact_phone.trim() : null,
            shouldBeDefault ? trueVal : falseVal,
            addressData.delivery_notes !== undefined ? (addressData.delivery_notes ? addressData.delivery_notes.trim() : null) : null,
            addrId
        ]);
    });

    return dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ?', [addrId]);
}

/**
 * Delete a delivery address
 */
async function deleteDeliveryAddress(customerId, addressId, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const addr = await dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?', [addrId, custId]);
    if (!addr) {
        const err = new Error('Delivery address not found');
        err.statusCode = 404;
        throw err;
    }

    const isDefault = dbAdapter.isPostgres ? Boolean(addr.is_default) : addr.is_default === 1;
    const trueVal = dbAdapter.isPostgres ? true : 1;

    await dbAdapter.withTransaction(async (tx) => {
        await tx.run('DELETE FROM customer_addresses WHERE id = ?', [addrId]);

        // If the deleted address was default, promote another address to default if available
        if (isDefault) {
            const nextAddr = await tx.get('SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY id ASC LIMIT 1', [custId]);
            if (nextAddr) {
                await tx.run('UPDATE customer_addresses SET is_default = ? WHERE id = ?', [trueVal, nextAddr.id]);
            }
        }
    });

    return { success: true, deletedId: addrId };
}

/**
 * Set an address as default delivery address
 */
async function setDefaultAddress(customerId, addressId, user) {
    const custId = Number(customerId);
    const addrId = Number(addressId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const addr = await dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?', [addrId, custId]);
    if (!addr) {
        const err = new Error('Delivery address not found');
        err.statusCode = 404;
        throw err;
    }

    const falseVal = dbAdapter.isPostgres ? false : 0;
    const trueVal = dbAdapter.isPostgres ? true : 1;

    await dbAdapter.withTransaction(async (tx) => {
        await tx.run('UPDATE customer_addresses SET is_default = ? WHERE customer_id = ?', [falseVal, custId]);
        await tx.run('UPDATE customer_addresses SET is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [trueVal, addrId]);
    });

    return dbAdapter.get('SELECT * FROM customer_addresses WHERE id = ?', [addrId]);
}

/**
 * Add a customer note
 */
async function addCustomerNote(customerId, { note_text, note_type }, user) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    if (!note_text || !note_text.trim()) {
        const err = new Error('Note text is required');
        err.statusCode = 400;
        throw err;
    }

    const type = note_type && VALID_NOTE_TYPES.includes(note_type.toUpperCase())
        ? note_type.toUpperCase()
        : 'GENERAL';

    const res = await dbAdapter.run(`
        INSERT INTO customer_notes (customer_id, user_id, note_text, note_type)
        VALUES (?, ?, ?, ?)
    `, [custId, user.id, note_text.trim(), type]);

    return dbAdapter.get(`
        SELECT cn.*, u.full_name as author_name, r.name as author_role
        FROM customer_notes cn
        LEFT JOIN users u ON cn.user_id = u.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE cn.id = ?
    `, [res.insertId]);
}

/**
 * Delete a customer note
 */
async function deleteCustomerNote(customerId, noteId, user) {
    const custId = Number(customerId);
    const nId = Number(noteId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const note = await dbAdapter.get('SELECT * FROM customer_notes WHERE id = ? AND customer_id = ?', [nId, custId]);
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

    await dbAdapter.run('DELETE FROM customer_notes WHERE id = ?', [nId]);
    return { success: true, deletedId: nId };
}

/**
 * Get customer order history
 */
async function getCustomerOrderHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = await dbAdapter.get('SELECT count(*) as total FROM orders WHERE customer_id = ?', [custId]);
    const total = totalRow ? Number(totalRow.total) : 0;

    const orders = await dbAdapter.all(`
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
    `, [custId, pageLimit, offset]);

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
async function getCustomerPaymentHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = await dbAdapter.get(`
        SELECT count(*) as total
        FROM payments p
        WHERE p.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
           OR p.order_id IN (SELECT id FROM orders WHERE customer_id = ?)
    `, [custId, custId]);
    const total = totalRow ? Number(totalRow.total) : 0;

    const payments = await dbAdapter.all(`
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
    `, [custId, custId, pageLimit, offset]);

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
async function getCustomerRefundHistory(customerId, user, { page = 1, limit = 50 }) {
    const custId = Number(customerId);
    const customer = await dbAdapter.get('SELECT * FROM customers WHERE id = ?', [custId]);
    assertCustomerBranchAccess(customer, user);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const offset = (pageNum - 1) * pageLimit;

    const totalRow = await dbAdapter.get(`
        SELECT count(*) as total
        FROM refund_requests rr
        WHERE rr.sale_id IN (SELECT id FROM sales WHERE customer_id = ?)
    `, [custId]);
    const total = totalRow ? Number(totalRow.total) : 0;

    const refunds = await dbAdapter.all(`
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
    `, [custId, pageLimit, offset]);

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
