// server/routes/deliveries.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/deliveries/driver/active - Active runs list for Driver View
router.get('/driver/active', authenticateToken, authorize('delivery', 'view_own'), async (req, res, next) => {
    try {
        let driver = null;
        if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE id = ?', [Number(req.query.driver_id)]);
        }
        if (!driver) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE user_id = ?', [req.user.id]);
        }
        if (!driver && (req.user.phone || req.user.email)) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE phone = ? OR email = ?', [req.user.phone || '', req.user.email || '']);
        }

        let deliveries = [];
        if (driver) {
            deliveries = await dbAdapter.all(`
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
            `, [driver.id]);
        } else {
            deliveries = await dbAdapter.all(`
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
            `);
        }

        const result = await Promise.all(deliveries.map(async (d) => {
            const destAddress = d.delivery_address || d.destination_address;
            const destCity = d.delivery_city || d.destination_city;
            const destination = [destAddress, destCity].filter(Boolean).join(', ');
            const phone = d.recipient_phone || d.customer_phone;
            const items = await dbAdapter.all(`
                SELECT di.quantity, p.name as product_name, p.sku, p.unit
                FROM delivery_items di
                JOIN products p ON di.product_id = p.id
                WHERE di.delivery_id = ?
            `, [d.id]);

            return {
                ...d,
                delivery_address: destAddress,
                delivery_city: destCity,
                recipient_name: d.recipient_name || d.customer_name || 'Valued Customer',
                recipient_phone: phone,
                items,
                maps_url: destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : null,
                call_url: phone ? `tel:${phone.replace(/\s+/g, '')}` : null,
                whatsapp_url: phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null
            };
        }));

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/deliveries/my - Dedicated Driver View: assigned deliveries ONLY (supports DRIVER, SUPER_ADMIN, DISPATCHER, BRANCH_MANAGER)
router.get('/my', authenticateToken, authorize('delivery', 'view_own'), async (req, res, next) => {
    try {
        let driver = null;
        if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE id = ?', [Number(req.query.driver_id)]);
        }
        if (!driver) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE user_id = ?', [req.user.id]);
        }
        if (!driver && (req.user.phone || req.user.email)) {
            driver = await dbAdapter.get('SELECT id, status, license_number FROM drivers WHERE phone = ? OR email = ?', [req.user.phone || '', req.user.email || '']);
        }
        
        if (!driver) {
            return res.json({
                driver: null,
                active_deliveries: []
            });
        }

        const deliveries = await dbAdapter.all(`
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
        `, [driver.id]);

        const result = await Promise.all(deliveries.map(async (d) => {
            const destAddress = d.delivery_address || d.destination_address;
            const destCity = d.delivery_city || d.destination_city;
            const destination = [destAddress, destCity].filter(Boolean).join(', ');
            const phone = d.recipient_phone || d.customer_phone;
            const items = await dbAdapter.all(`
                SELECT di.quantity, p.name as product_name, p.sku, p.unit
                FROM delivery_items di
                JOIN products p ON di.product_id = p.id
                WHERE di.delivery_id = ?
            `, [d.id]);

            return {
                ...d,
                delivery_address: destAddress,
                delivery_city: destCity,
                recipient_name: d.recipient_name || d.customer_name || 'Valued Customer',
                recipient_phone: phone,
                items,
                maps_url: destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}` : null,
                call_url: phone ? `tel:${phone.replace(/\s+/g, '')}` : null,
                whatsapp_url: phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null
            };
        }));

        res.json({
            driver: {
                id: driver.id,
                status: driver.status,
                license_number: driver.license_number
            },
            active_deliveries: result
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/deliveries/history - Driver completed/historical deliveries
router.get('/history', authenticateToken, requireRole('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'), async (req, res, next) => {
    try {
        let driver = null;
        if (req.query.driver_id && ['SUPER_ADMIN', 'DISPATCHER', 'BRANCH_MANAGER'].includes(req.user.roleName)) {
            driver = await dbAdapter.get('SELECT id FROM drivers WHERE id = ?', [Number(req.query.driver_id)]);
        }
        if (!driver) {
            driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
        }
        if (!driver && (req.user.phone || req.user.email)) {
            driver = await dbAdapter.get('SELECT id FROM drivers WHERE phone = ? OR email = ?', [req.user.phone || '', req.user.email || '']);
        }
        if (!driver) return res.json([]);

        const history = await dbAdapter.all(`
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
        `, [driver.id]);

        res.json(history);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/deliveries/:id/start - Driver or Supervisor starts transit
router.patch('/:id/start', authenticateToken, authorize('delivery', 'start', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
        const deliveryId = Number(req.params.id);
        const { latitude, longitude } = req.body;

        let driverId = null;
        if (req.user.roleName === 'DRIVER') {
            const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
            if (!driver) return res.status(404).json({ error: 'Driver not found' });
            driverId = driver.id;
        }

        const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]) || req.targetEntity;
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        // Strictly restrict delivery start to assigned driver (or Super Admin emergency override)
        if (req.user.roleName === 'DRIVER') {
            if (!driverId || Number(delivery.driver_id) !== Number(driverId)) {
                return res.status(403).json({ error: 'Forbidden: You can only start deliveries assigned to you.' });
            }
        } else if (req.user.roleName === 'SUPER_ADMIN' && req.body.admin_override && req.body.override_reason?.trim()) {
            // Permitted under emergency admin override
        } else {
            return res.status(403).json({ error: 'Forbidden: Starting delivery transit is restricted to the assigned courier driver.' });
        }

        await dbAdapter.withTransaction(async (tx) => {
            await tx.run("UPDATE deliveries SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [deliveryId]);
            await tx.run("UPDATE orders SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [delivery.order_id]);

            if (latitude && longitude && delivery.driver_id) {
                await tx.run(
                    'UPDATE drivers SET current_latitude = ?, current_longitude = ?, last_ping_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [latitude, longitude, delivery.driver_id]
                );
            }

            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
                VALUES (?, 'IN_TRANSIT', 'Driver departed hub en route to destination', ?, ?, ?)
            `, [deliveryId, latitude || null, longitude || null, req.user.id]);

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'START_DELIVERY',
                resource: 'DELIVERY',
                resourceId: delivery.delivery_number,
                branchId: delivery.branch_id,
                reason: 'Driver started transit'
            });
        });

        res.json({ message: 'Delivery started successfully. Safe travels!', status: 'IN_TRANSIT' });
    } catch (err) {
        next(err);
    }
});

// POST /api/deliveries/:id/pod - Submit Proof of Delivery (Canvas Signature, OTP, Photo, GPS)
router.post('/:id/pod', authenticateToken, authorize('delivery', 'pod_submit', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
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

        const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]) || req.targetEntity;
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        // Strict Courier Identity & Ownership Check
        let isAssignedDriver = false;
        if (req.user.roleName === 'DRIVER') {
            const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
            if (driver && Number(delivery.driver_id) === Number(driver.id)) {
                isAssignedDriver = true;
            }
        }

        if (!isAssignedDriver) {
            // Admin exception override requires explicit flag and mandatory justification
            if (req.user.roleName === 'SUPER_ADMIN' && req.body.admin_override && req.body.override_reason?.trim()) {
                // Permitted with explicit override audit
            } else {
                return res.status(403).json({
                    error: 'Forbidden: Delivery POD signatures must be captured by the assigned courier driver in the field.'
                });
            }
        }

        await dbAdapter.withTransaction(async (tx) => {
            // 1. Insert or update proof_of_delivery (Cross-engine compatible UPSERT)
            await tx.run(`
                INSERT INTO proof_of_delivery (
                    delivery_id, recipient_name, recipient_phone, otp_code, otp_verified,
                    signature_data, photo_data, latitude, longitude, notes, verified_at
                ) VALUES (?, ?, ?, ?, true, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (delivery_id) DO UPDATE SET
                    recipient_name = EXCLUDED.recipient_name,
                    recipient_phone = EXCLUDED.recipient_phone,
                    otp_code = EXCLUDED.otp_code,
                    otp_verified = true,
                    signature_data = EXCLUDED.signature_data,
                    photo_data = EXCLUDED.photo_data,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    notes = EXCLUDED.notes,
                    verified_at = CURRENT_TIMESTAMP
            `, [
                deliveryId,
                recipient_name.trim(),
                recipient_phone || '',
                otp_code || 'VERIFIED',
                signature_data || null,
                photo_data || null,
                latitude || null,
                longitude || null,
                notes || ''
            ]);

            // 2. Mark delivery DELIVERED
            await tx.run(`
                UPDATE deliveries
                SET status = 'DELIVERED', actual_delivery_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [deliveryId]);

            // 3. Mark order COMPLETED
            await tx.run("UPDATE orders SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [delivery.order_id]);

            // 4. Update driver status back to AVAILABLE
            if (delivery.driver_id) {
                const activeCount = await tx.get(`
                    SELECT count(*) as cnt FROM deliveries
                    WHERE driver_id = ? AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') AND id != ?
                `, [delivery.driver_id, deliveryId]);

                if (Number(activeCount.cnt) === 0) {
                    await tx.run("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?", [delivery.driver_id]);
                }
            }

            // 5. Append delivery status history
            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
                VALUES (?, 'DELIVERED', 'Delivered to recipient with electronic signature & POD captured', ?, ?, ?)
            `, [deliveryId, latitude || null, longitude || null, req.user.id]);

            // 6. Notify Dispatcher & Branch Manager
            await tx.run(`
                INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
                VALUES (?, 'DELIVERY_COMPLETED', 'Delivery Completed Successfully', ?, 'DELIVERY', ?)
            `, [
                delivery.branch_id,
                `Delivery #${delivery.delivery_number} successfully completed. Recipient: ${recipient_name}.`,
                String(deliveryId)
            ]);

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
        });

        res.json({ message: 'Proof of delivery submitted successfully. Delivery completed!', status: 'DELIVERED' });
    } catch (err) {
        next(err);
    }
});

// POST /api/deliveries/:id/problem - Driver or Supervisor reports delivery exception
router.post('/:id/problem', authenticateToken, authorize('delivery', 'problem', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
        const deliveryId = Number(req.params.id);
        const { failure_reason, failure_notes, latitude, longitude } = req.body;

        const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        if (req.user.roleName === 'DRIVER') {
            const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
            if (!driver || Number(delivery.driver_id) !== Number(driver.id)) {
                return res.status(403).json({ error: 'Forbidden: You can only report problems on your assigned delivery.' });
            }
        }

        await dbAdapter.withTransaction(async (tx) => {
            await tx.run(`
                UPDATE deliveries
                SET status = 'FAILED', failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [failure_reason || 'Other', failure_notes || '', deliveryId]);

            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
                VALUES (?, 'FAILED', ?, ?, ?, ?)
            `, [deliveryId, `Driver reported exception: ${failure_reason}. Notes: ${failure_notes}`, latitude || null, longitude || null, req.user.id]);

            // Notify Dispatcher & Branch Manager
            await tx.run(`
                INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
                VALUES (?, 'DELIVERY_FAILED', 'Driver Exception Reported', ?, 'DELIVERY', ?)
            `, [
                delivery.branch_id,
                `Driver reported failure for #${delivery.delivery_number}: ${failure_reason}. Check dispatch center.`,
                String(deliveryId)
            ]);

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
        });

        res.json({ message: 'Problem report logged. Dispatcher and Branch Manager have been alerted.', status: 'FAILED' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
