// server/routes/deliveries.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// // GET /api/deliveries/driver/active - Active runs list for Driver View
router.get('/driver/active', authenticateToken, authorize('delivery', 'view_own'), (req, res) => {
    let driver = null;
    if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE id = ?').get(Number(req.query.driver_id));
    }
    if (!driver) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE user_id = ?').get(req.user.id);
    }
    if (!driver && (req.user.phone || req.user.email)) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE phone = ? OR email = ?').get(req.user.phone || '', req.user.email || '');
    }

    let deliveries = [];
    if (driver) {
        deliveries = db.prepare(`
            SELECT d.*, 
                   COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
                   COALESCE(d.cod_amount_expected, s.cod_amount, o.total_amount, 0) as total_amount, 
                   COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
                   COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
                   COALESCE(d.recipient_name, o.recipient_name, s.recipient_name, c.full_name) as recipient_name, 
                   COALESCE(d.recipient_phone, o.recipient_phone, s.recipient_phone, c.phone) as recipient_phone, 
                   COALESCE(o.special_instructions, s.special_instructions, d.failure_notes) as special_instructions,
                   COALESCE(c.full_name, s.sender_name, 'Direct Client') as customer_name, 
                   COALESCE(c.phone, s.sender_phone) as customer_phone,
                   v.registration_number as vehicle_reg, v.model as vehicle_model
            FROM deliveries d
            LEFT JOIN orders o ON d.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN shipments s ON d.shipment_id = s.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            WHERE d.driver_id = ? AND d.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
            ORDER BY CASE d.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END, d.id ASC
        `).all(driver.id);
    } else {
        deliveries = db.prepare(`
            SELECT d.*, 
                   COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
                   COALESCE(d.cod_amount_expected, s.cod_amount, o.total_amount, 0) as total_amount, 
                   COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
                   COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
                   COALESCE(d.recipient_name, o.recipient_name, s.recipient_name, c.full_name) as recipient_name, 
                   COALESCE(d.recipient_phone, o.recipient_phone, s.recipient_phone, c.phone) as recipient_phone, 
                   COALESCE(o.special_instructions, s.special_instructions, d.failure_notes) as special_instructions,
                   COALESCE(c.full_name, s.sender_name, 'Direct Client') as customer_name, 
                   COALESCE(c.phone, s.sender_phone) as customer_phone,
                   v.registration_number as vehicle_reg, v.model as vehicle_model
            FROM deliveries d
            LEFT JOIN orders o ON d.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN shipments s ON d.shipment_id = s.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            WHERE d.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
            ORDER BY d.id ASC
        `).all();
    }

    const itemsStmt = db.prepare(`
        SELECT di.quantity, p.name as product_name, p.sku, p.unit
        FROM delivery_items di
        JOIN products p ON di.product_id = p.id
        WHERE di.delivery_id = ?
    `);

    const result = deliveries.map(d => {
        const destAddress = d.delivery_address || d.destination_address;
        const destCity = d.delivery_city || d.destination_city;
        const destination = [destAddress, destCity].filter(Boolean).join(', ');
        const phone = d.recipient_phone || d.customer_phone;
        return {
            ...d,
            delivery_address: destAddress,
            delivery_city: destCity,
            recipient_name: d.recipient_name || d.customer_name || 'Valued Customer',
            recipient_phone: phone,
            items: itemsStmt.all(d.id),
            maps_url: destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : null,
            call_url: phone ? `tel:${phone.replace(/\s+/g, '')}` : null,
            whatsapp_url: phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null
        };
    });

    res.json(result);
});

// GET /api/deliveries/my - Dedicated Driver View: assigned deliveries ONLY (supports DRIVER, SUPER_ADMIN, DISPATCHER, BRANCH_MANAGER)
router.get('/my', authenticateToken, authorize('delivery', 'view_own'), (req, res) => {
    let driver = null;
    if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE id = ?').get(Number(req.query.driver_id));
    }
    if (!driver) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE user_id = ?').get(req.user.id);
    }
    if (!driver && (req.user.phone || req.user.email)) {
        driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE phone = ? OR email = ?').get(req.user.phone || '', req.user.email || '');
    }
    
    // If supervisor role (Super Admin, Dispatcher, Manager) without direct driver record, resolve to first driver for this branch or driver 1
    if (!driver && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
        if (req.user.branchId) {
            driver = db.prepare('SELECT id, status, license_number FROM drivers WHERE branch_id = ? ORDER BY id ASC LIMIT 1').get(req.user.branchId);
        }
        if (!driver) {
            driver = db.prepare('SELECT id, status, license_number FROM drivers ORDER BY id ASC LIMIT 1').get();
        }
    }

    if (!driver) {
        return res.json({
            driver: { id: 0, status: 'STANDBY', license_number: 'HQ-OPERATOR' },
            active_deliveries: []
        });
    }

    const deliveries = db.prepare(`
        SELECT d.*, 
               COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
               COALESCE(d.cod_amount_expected, s.cod_amount, o.total_amount, 0) as total_amount, 
               COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
               COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
               COALESCE(d.recipient_name, o.recipient_name, s.recipient_name, c.full_name) as recipient_name, 
               COALESCE(d.recipient_phone, o.recipient_phone, s.recipient_phone, c.phone) as recipient_phone, 
               COALESCE(o.special_instructions, s.special_instructions, d.failure_notes) as special_instructions,
               COALESCE(c.full_name, s.sender_name, 'Direct Client') as customer_name, 
               COALESCE(c.phone, s.sender_phone) as customer_phone,
               v.registration_number as vehicle_reg, v.model as vehicle_model
        FROM deliveries d
        LEFT JOIN orders o ON d.order_id = o.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN shipments s ON d.shipment_id = s.id
        LEFT JOIN vehicles v ON d.vehicle_id = v.id
        WHERE d.driver_id = ? AND d.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')
        ORDER BY CASE d.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END, d.id ASC
    `).all(driver.id);

    // Attach items for each delivery
    const itemsStmt = db.prepare(`
        SELECT di.quantity, p.name as product_name, p.sku, p.unit
        FROM delivery_items di
        JOIN products p ON di.product_id = p.id
        WHERE di.delivery_id = ?
    `);

    const result = deliveries.map(d => {
        const destAddress = d.delivery_address || d.destination_address;
        const destCity = d.delivery_city || d.destination_city;
        const destination = [destAddress, destCity].filter(Boolean).join(', ');
        const phone = d.recipient_phone || d.customer_phone;
        return {
            ...d,
            delivery_address: destAddress,
            delivery_city: destCity,
            recipient_name: d.recipient_name || d.customer_name || 'Valued Customer',
            recipient_phone: phone,
            items: itemsStmt.all(d.id),
            maps_url: destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : null,
            call_url: phone ? `tel:${phone.replace(/\s+/g, '')}` : null,
            whatsapp_url: phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null
        };
    });

    res.json({
        driver: {
            id: driver.id,
            status: driver.status,
            license_number: driver.license_number
        },
        active_deliveries: result
    });
});

// GET /api/deliveries/history - Driver completed/historical deliveries
router.get('/history', authenticateToken, requireRole('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'), (req, res) => {
    let driver = null;
    if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
        driver = db.prepare('SELECT id FROM drivers WHERE id = ?').get(Number(req.query.driver_id));
    }
    if (!driver) {
        driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
    }
    if (!driver && (req.user.phone || req.user.email)) {
        driver = db.prepare('SELECT id FROM drivers WHERE phone = ? OR email = ?').get(req.user.phone || '', req.user.email || '');
    }
    if (!driver && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
        if (req.user.branchId) {
            driver = db.prepare('SELECT id FROM drivers WHERE branch_id = ? ORDER BY id ASC LIMIT 1').get(req.user.branchId);
        }
        if (!driver) {
            driver = db.prepare('SELECT id FROM drivers ORDER BY id ASC LIMIT 1').get();
        }
    }

    if (!driver) return res.json([]);

    const history = db.prepare(`
        SELECT d.*, 
               COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
               COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
               COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
               COALESCE(d.recipient_name, o.recipient_name, s.recipient_name) as recipient_name,
               pod.verified_at, pod.otp_verified
        FROM deliveries d
        LEFT JOIN orders o ON d.order_id = o.id
        LEFT JOIN shipments s ON d.shipment_id = s.id
        LEFT JOIN proof_of_delivery pod ON d.id = pod.delivery_id
        WHERE d.driver_id = ? AND d.status IN ('DELIVERED', 'FAILED', 'RETURN_TO_BRANCH')
        ORDER BY d.id DESC LIMIT 50
    `).all(driver.id);

    res.json(history);
});

// PATCH /api/deliveries/:id/start - Driver or Supervisor starts transit
router.patch('/:id/start', authenticateToken, authorize('delivery', 'start', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const { latitude, longitude } = req.body;

    let driverId = null;
    if (req.user.roleName === 'DRIVER') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });
        driverId = driver.id;
    }

    const delivery = req.targetEntity || db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    // Enforce driver ownership only for actual drivers (Super Admin / Dispatcher can supervise)
    if (req.user.roleName === 'DRIVER' && delivery.driver_id !== driverId) {
        return res.status(403).json({ error: 'Forbidden: You can only start deliveries assigned to you.' });
    }

    db.transaction(() => {
        db.prepare("UPDATE deliveries SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(deliveryId);
        db.prepare("UPDATE orders SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(delivery.order_id);

        if (latitude && longitude && delivery.driver_id) {
            db.prepare('UPDATE drivers SET current_latitude = ?, current_longitude = ?, last_ping_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(latitude, longitude, delivery.driver_id);
        }

        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
            VALUES (?, 'IN_TRANSIT', 'Driver departed hub en route to destination', ?, ?, ?)
        `).run(deliveryId, latitude || null, longitude || null, req.user.id);

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'START_DELIVERY',
            resource: 'DELIVERY',
            resourceId: delivery.delivery_number,
            branchId: delivery.branch_id,
            reason: 'Driver started transit'
        });
    })();

    res.json({ message: 'Delivery started successfully. Safe travels!', status: 'IN_TRANSIT' });
});

// POST /api/deliveries/:id/pod - Submit Proof of Delivery (Canvas Signature, OTP, Photo, GPS)
router.post('/:id/pod', authenticateToken, authorize('delivery', 'pod_submit', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const {
        recipient_name,
        recipient_phone,
        otp_code,
        signature_data, // Base64 Canvas data URI
        photo_data,     // Base64 image
        latitude,
        longitude,
        notes
    } = req.body;

    if (!recipient_name) {
        return res.status(400).json({ error: 'Recipient name is required for proof of delivery.' });
    }

    const delivery = req.targetEntity || db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    // Driver ownership check
    if (req.user.roleName === 'DRIVER') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
        if (!driver || delivery.driver_id !== driver.id) {
            return res.status(403).json({ error: 'Forbidden: You can only complete deliveries assigned to you.' });
        }
    }

    db.transaction(() => {
        // 1. Insert or update proof_of_delivery
        db.prepare(`
            INSERT OR REPLACE INTO proof_of_delivery (
                delivery_id, recipient_name, recipient_phone, otp_code, otp_verified,
                signature_data, photo_data, latitude, longitude, notes, verified_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            deliveryId,
            recipient_name.trim(),
            recipient_phone || '',
            otp_code || 'VERIFIED',
            signature_data || null,
            photo_data || null,
            latitude || null,
            longitude || null,
            notes || ''
        );

        // 2. Mark delivery DELIVERED
        db.prepare(`
            UPDATE deliveries
            SET status = 'DELIVERED', actual_delivery_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(deliveryId);

        // 3. Mark order COMPLETED
        db.prepare("UPDATE orders SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(delivery.order_id);

        // 4. Update driver status back to AVAILABLE
        if (delivery.driver_id) {
            const activeCount = db.prepare(`
                SELECT count(*) as cnt FROM deliveries
                WHERE driver_id = ? AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') AND id != ?
            `).get(delivery.driver_id, deliveryId);

            if (activeCount.cnt === 0) {
                db.prepare("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?").run(delivery.driver_id);
            }
        }

        // 5. Append delivery status history
        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
            VALUES (?, 'DELIVERED', 'Delivered to recipient with electronic signature & POD captured', ?, ?, ?)
        `).run(deliveryId, latitude || null, longitude || null, req.user.id);

        // 6. Notify Dispatcher & Branch Manager
        db.prepare(`
            INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
            VALUES (?, 'DELIVERY_COMPLETED', 'Delivery Completed Successfully', ?, 'DELIVERY', ?)
        `).run(
            delivery.branch_id,
            `Delivery #${delivery.delivery_number} successfully completed. Recipient: ${recipient_name}.`,
            String(deliveryId)
        );

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'COMPLETE_DELIVERY',
            resource: 'DELIVERY',
            resourceId: delivery.delivery_number,
            branchId: delivery.branch_id,
            newValue: { recipient_name, status: 'DELIVERED' },
            reason: 'Driver submitted valid POD with electronic signature'
        });
    })();

    res.json({ message: 'Proof of delivery submitted successfully. Delivery completed!', status: 'DELIVERED' });
});

// POST /api/deliveries/:id/problem - Driver or Supervisor reports delivery exception
router.post('/:id/problem', authenticateToken, authorize('delivery', 'problem', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const { failure_reason, failure_notes, latitude, longitude } = req.body;

    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (req.user.roleName === 'DRIVER') {
        const driver = db.prepare('SELECT id FROM drivers WHERE user_id = ?').get(req.user.id);
        if (!driver || delivery.driver_id !== driver.id) {
            return res.status(403).json({ error: 'Forbidden: You can only report problems on your assigned delivery.' });
        }
    }

    db.transaction(() => {
        db.prepare(`
            UPDATE deliveries
            SET status = 'FAILED', failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(failure_reason || 'Other', failure_notes || '', deliveryId);

        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
            VALUES (?, 'FAILED', ?, ?, ?, ?)
        `).run(deliveryId, `Driver reported exception: ${failure_reason}. Notes: ${failure_notes}`, latitude || null, longitude || null, req.user.id);

        // Notify Dispatcher & Branch Manager
        db.prepare(`
            INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
            VALUES (?, 'DELIVERY_FAILED', 'Driver Exception Reported', ?, 'DELIVERY', ?)
        `).run(
            delivery.branch_id,
            `Driver reported failure for #${delivery.delivery_number}: ${failure_reason}. Check dispatch center.`,
            String(deliveryId)
        );

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'DRIVER_REPORT_PROBLEM',
            resource: 'DELIVERY',
            resourceId: delivery.delivery_number,
            branchId: delivery.branch_id,
            newValue: { failure_reason, failure_notes },
            reason: `Driver delivery exception: ${failure_reason}`
        });
    })();

    res.json({ message: 'Problem report logged. Dispatcher and Branch Manager have been alerted.', status: 'FAILED' });
});

module.exports = router;
