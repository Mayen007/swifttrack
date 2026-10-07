// server/routes/dispatch.js
const express = require('express');
const router = express.Router();
const dbAdapter = require('../db/dbAdapter.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/dispatch/kanban - Flattened deliveries for Dispatch Kanban board
router.get('/kanban', authenticateToken, authorize('dispatch', 'view'), async (req, res, next) => {
    try {
        const branchId = req.effectiveBranchId;
        let deliveriesQuery = `
            SELECT d.*, 
                   COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
                   COALESCE(d.cod_amount_expected, s.cod_amount, o.total_amount, 0) as total_amount, 
                   COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
                   COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
                   COALESCE(d.recipient_name, o.recipient_name, s.recipient_name, c.full_name) as recipient_name, 
                   COALESCE(d.recipient_phone, o.recipient_phone, s.recipient_phone, c.phone) as recipient_phone, 
                   COALESCE(o.special_instructions, s.special_instructions, d.failure_notes) as special_instructions,
                   COALESCE(c.full_name, s.sender_name, 'Direct Client') as customer_name,
                   drv_u.full_name as driver_name, drv.phone as driver_phone,
                   v.registration_number as vehicle_reg, v.vehicle_type,
                   b.name as branch_name
            FROM deliveries d
            LEFT JOIN orders o ON d.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN shipments s ON d.shipment_id = s.id
            JOIN branches b ON d.branch_id = b.id
            LEFT JOIN drivers drv ON d.driver_id = drv.id
            LEFT JOIN users drv_u ON drv.user_id = drv_u.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
        `;
        const params = [];
        if (branchId) {
            deliveriesQuery += ' WHERE d.branch_id = ?';
            params.push(branchId);
        }
        deliveriesQuery += ' ORDER BY d.id DESC';
        const deliveries = await dbAdapter.all(deliveriesQuery, params);
        res.json(deliveries);
    } catch (err) {
        next(err);
    }
});

// GET /api/dispatch/board - Operational Command Center data
router.get('/board', authenticateToken, authorize('dispatch', 'view'), async (req, res, next) => {
    try {
        const branchId = req.effectiveBranchId;

        let deliveriesQuery = `
            SELECT d.*, 
                   COALESCE(o.order_number, s.tracking_number, d.delivery_number) as order_number, 
                   COALESCE(d.cod_amount_expected, s.cod_amount, o.total_amount, 0) as total_amount, 
                   COALESCE(d.destination_address, o.delivery_address, s.recipient_address) as delivery_address, 
                   COALESCE(d.destination_city, o.delivery_city, s.recipient_city) as delivery_city,
                   COALESCE(d.recipient_name, o.recipient_name, s.recipient_name, c.full_name) as recipient_name, 
                   COALESCE(d.recipient_phone, o.recipient_phone, s.recipient_phone, c.phone) as recipient_phone, 
                   COALESCE(o.special_instructions, s.special_instructions, d.failure_notes) as special_instructions,
                   COALESCE(c.full_name, s.sender_name, 'Direct Client') as customer_name,
                   drv_u.full_name as driver_name, drv.phone as driver_phone,
                   v.registration_number as vehicle_reg, v.vehicle_type,
                   b.name as branch_name
            FROM deliveries d
            LEFT JOIN orders o ON d.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN shipments s ON d.shipment_id = s.id
            JOIN branches b ON d.branch_id = b.id
            LEFT JOIN drivers drv ON d.driver_id = drv.id
            LEFT JOIN users drv_u ON drv.user_id = drv_u.id
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
        `;
        const params = [];

        if (branchId) {
            deliveriesQuery += ' WHERE d.branch_id = ?';
            params.push(branchId);
        }

        deliveriesQuery += ' ORDER BY d.id DESC';

        const deliveries = await dbAdapter.all(deliveriesQuery, params);

        // Group deliveries by pipeline stages
        const board = {
            READY_FOR_DISPATCH: deliveries.filter(d => ['READY_FOR_DISPATCH', 'PENDING_ASSIGNMENT'].includes(d.status)),
            ASSIGNED: deliveries.filter(d => d.status === 'ASSIGNED'),
            PICKED_UP: deliveries.filter(d => d.status === 'PICKED_UP'),
            IN_TRANSIT: deliveries.filter(d => d.status === 'IN_TRANSIT'),
            DELIVERED: deliveries.filter(d => d.status === 'DELIVERED'),
            FAILED: deliveries.filter(d => ['FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED'].includes(d.status))
        };

        // Drivers status & workload
        let driversQuery = `
            SELECT drv.id, drv.user_id, drv.branch_id, drv.phone, drv.status, drv.current_latitude, drv.current_longitude,
                   u.full_name, u.username,
                   v.registration_number, v.vehicle_type,
                   (SELECT count(*) FROM deliveries WHERE driver_id = drv.id AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')) as active_deliveries_count
            FROM drivers drv
            JOIN users u ON drv.user_id = u.id
            LEFT JOIN vehicles v ON drv.vehicle_id = v.id
        `;
        const driverParams = [];
        if (branchId) {
            driversQuery += ' WHERE drv.branch_id = ?';
            driverParams.push(branchId);
        }

        const drivers = await dbAdapter.all(driversQuery, driverParams);

        // Available vehicles
        let vehiclesQuery = 'SELECT * FROM vehicles WHERE is_active = true';
        const vehParams = [];
        if (branchId) {
            vehiclesQuery += ' AND branch_id = ?';
            vehParams.push(branchId);
        }
        const vehicles = await dbAdapter.all(vehiclesQuery, vehParams);

        res.json({
            board,
            summary: {
                total_active: board.READY_FOR_DISPATCH.length + board.ASSIGNED.length + board.PICKED_UP.length + board.IN_TRANSIT.length,
                ready_count: board.READY_FOR_DISPATCH.length,
                in_transit_count: board.IN_TRANSIT.length,
                delivered_count: board.DELIVERED.length,
                failed_count: board.FAILED.length
            },
            drivers,
            vehicles
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/dispatch/assign - Assign Driver & Vehicle to Delivery
router.post('/assign', authenticateToken, authorize('dispatch', 'assign', { entityTable: 'deliveries', idBody: 'delivery_id' }), async (req, res, next) => {
    try {
        const { delivery_id, driver_id, vehicle_id, priority, notes } = req.body;

        if (!delivery_id || !driver_id) {
            return res.status(400).json({ error: 'Delivery ID and Driver ID are required.' });
        }

        const delivery = req.targetEntity || await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [delivery_id]);
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        // Branch isolation
        if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot assign deliveries of another branch.' });
        }

        const driver = await dbAdapter.get(`
            SELECT drv.*, u.full_name
            FROM drivers drv
            JOIN users u ON drv.user_id = u.id
            WHERE drv.id = ? OR drv.user_id = ?
        `, [driver_id, driver_id]);

        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        await dbAdapter.withTransaction(async (tx) => {
            // Update delivery
            await tx.run(`
                UPDATE deliveries
                SET driver_id = ?, vehicle_id = ?, dispatcher_user_id = ?,
                    status = 'ASSIGNED', priority = COALESCE(?, priority),
                    scheduled_pickup_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [driver.id, vehicle_id || driver.vehicle_id || null, req.user.id, priority || null, delivery_id]);

            // Update driver status
            await tx.run("UPDATE drivers SET status = 'ON_DELIVERY' WHERE id = ?", [driver.id]);

            // Record delivery history
            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, updated_by_user_id)
                VALUES (?, 'ASSIGNED', ?, ?)
            `, [delivery_id, `Assigned to driver ${driver.full_name}. Notes: ${notes || 'Standard dispatch'}`, req.user.id]);

            // Update parent order status
            await tx.run("UPDATE orders SET status = 'PREPARING' WHERE id = ?", [delivery.order_id]);

            // Notify Driver
            await tx.run(`
                INSERT INTO notifications (branch_id, user_id, type, title, message, reference_type, reference_id)
                VALUES (?, ?, 'DELIVERY_ASSIGNED', 'New Delivery Job Assigned', ?, 'DELIVERY', ?)
            `, [
                delivery.branch_id, driver.user_id,
                `You have been assigned delivery #${delivery.delivery_number}. Priority: ${priority || delivery.priority}.`,
                String(delivery_id)
            ]);

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'ASSIGN_DELIVERY',
                resource: 'DELIVERY',
                resourceId: delivery.delivery_number,
                branchId: delivery.branch_id,
                newValue: { driver_id: driver.id, driver_name: driver.full_name, vehicle_id, priority },
                reason: 'Assigned driver to delivery'
            });
        });

        res.json({ message: `Delivery assigned to ${driver.full_name}`, status: 'ASSIGNED' });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/dispatch/:id/priority - Update delivery priority
router.patch('/:id/priority', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
        const deliveryId = Number(req.params.id);
        const { priority } = req.body; // 'NORMAL', 'HIGH', 'URGENT'

        const delivery = req.targetEntity || await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot alter deliveries of another branch.' });
        }

        await dbAdapter.run('UPDATE deliveries SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [priority, deliveryId]);
        res.json({ message: 'Priority updated successfully', priority });
    } catch (err) {
        next(err);
    }
});

// POST /api/dispatch/:id/fail - Mark delivery as failed and initiate return-to-branch
router.post('/:id/fail', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
        const deliveryId = Number(req.params.id);
        const { failure_reason, failure_notes, initiate_return } = req.body;

        const delivery = await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
            return res.status(403).json({ error: 'Forbidden: Cannot alter deliveries of another branch.' });
        }

        const nextStatus = initiate_return ? 'RETURN_TO_BRANCH' : 'FAILED';

        await dbAdapter.withTransaction(async (tx) => {
            await tx.run(`
                UPDATE deliveries
                SET status = ?, failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nextStatus, failure_reason || 'Other', failure_notes || '', deliveryId]);

            // Update driver back to available if no other active deliveries
            if (delivery.driver_id) {
                const activeCount = await tx.get(`
                    SELECT count(*) as cnt FROM deliveries
                    WHERE driver_id = ? AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') AND id != ?
                `, [delivery.driver_id, deliveryId]);

                if (Number(activeCount.cnt) === 0) {
                    await tx.run("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?", [delivery.driver_id]);
                }
            }

            // History
            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, updated_by_user_id)
                VALUES (?, ?, ?, ?)
            `, [deliveryId, nextStatus, `Delivery marked ${nextStatus}. Reason: ${failure_reason}. Notes: ${failure_notes}`, req.user.id]);

            // Notify Branch Manager
            await tx.run(`
                INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
                VALUES (?, 'DELIVERY_FAILED', 'Delivery Failed / Return Initiated', ?, 'DELIVERY', ?)
            `, [delivery.branch_id, `Delivery #${delivery.delivery_number} failed: ${failure_reason}. Status: ${nextStatus}.`, String(deliveryId)]);

            logAuditEvent({
                userId: req.user.id,
                role: req.user.roleName,
                action: 'DELIVERY_FAILED',
                resource: 'DELIVERY',
                resourceId: delivery.delivery_number,
                branchId: delivery.branch_id,
                newValue: { status: nextStatus, failure_reason, failure_notes },
                reason: `Dispatcher marked delivery failed: ${failure_reason}`
            });
        });

        res.json({ message: `Delivery marked as ${nextStatus}`, status: nextStatus });
    } catch (err) {
        next(err);
    }
});

// PUT /api/dispatch/:id/status - Update delivery stage
router.put('/:id/status', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), async (req, res, next) => {
    try {
        const deliveryId = Number(req.params.id);
        const { status, latitude, longitude } = req.body;

        const delivery = req.targetEntity || await dbAdapter.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
        if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

        await dbAdapter.withTransaction(async (tx) => {
            await tx.run('UPDATE deliveries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, deliveryId]);

            if (status === 'IN_TRANSIT') {
                await tx.run("UPDATE orders SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [delivery.order_id]);
            } else if (status === 'DELIVERED') {
                await tx.run("UPDATE orders SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [delivery.order_id]);
                if (delivery.driver_id) {
                    await tx.run("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?", [delivery.driver_id]);
                }
            }

            await tx.run(`
                INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [deliveryId, status, `Status changed to ${status}`, latitude || null, longitude || null, req.user.id]);
        });

        res.json({ message: `Delivery status updated to ${status}`, status });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
