// server/routes/dispatch.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/database.js');
const { authenticateToken, requireRole, enforceBranchIsolation, authorize } = require('../middleware/auth.js');
const { logAuditEvent } = require('../middleware/audit.js');

// GET /api/dispatch/kanban - Flattened deliveries for Dispatch Kanban board
router.get('/kanban', authenticateToken, authorize('dispatch', 'view'), (req, res) => {
    const branchId = req.effectiveBranchId;
    let deliveriesQuery = `
        SELECT d.*, o.order_number, o.total_amount, o.delivery_address, o.delivery_city,
               o.recipient_name, o.recipient_phone, o.special_instructions,
               c.full_name as customer_name,
               drv_u.full_name as driver_name, drv.phone as driver_phone,
               v.registration_number as vehicle_reg, v.vehicle_type,
               b.name as branch_name
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN customers c ON o.customer_id = c.id
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
    const deliveries = db.prepare(deliveriesQuery).all(...params);
    res.json(deliveries);
});

// GET /api/dispatch/board - Operational Command Center data
router.get('/board', authenticateToken, authorize('dispatch', 'view'), (req, res) => {
    const branchId = req.effectiveBranchId;

    let deliveriesQuery = `
        SELECT d.*, o.order_number, o.total_amount, o.delivery_address, o.delivery_city,
               o.recipient_name, o.recipient_phone, o.special_instructions,
               c.full_name as customer_name,
               drv_u.full_name as driver_name, drv.phone as driver_phone,
               v.registration_number as vehicle_reg, v.vehicle_type,
               b.name as branch_name
        FROM deliveries d
        JOIN orders o ON d.order_id = o.id
        JOIN customers c ON o.customer_id = c.id
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

    const deliveries = db.prepare(deliveriesQuery).all(...params);

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

    const drivers = db.prepare(driversQuery).all(...driverParams);

    // Available vehicles
    let vehiclesQuery = 'SELECT * FROM vehicles WHERE is_active = 1';
    const vehParams = [];
    if (branchId) {
        vehiclesQuery += ' AND branch_id = ?';
        vehParams.push(branchId);
    }
    const vehicles = db.prepare(vehiclesQuery).all(...vehParams);

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
});

// POST /api/dispatch/assign - Assign Driver & Vehicle to Delivery
router.post('/assign', authenticateToken, authorize('dispatch', 'assign', { entityTable: 'deliveries', idBody: 'delivery_id' }), (req, res) => {
    const { delivery_id, driver_id, vehicle_id, priority, notes } = req.body;

    if (!delivery_id || !driver_id) {
        return res.status(400).json({ error: 'Delivery ID and Driver ID are required.' });
    }

    const delivery = req.targetEntity || db.prepare('SELECT * FROM deliveries WHERE id = ?').get(delivery_id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    // Branch isolation
    if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot assign deliveries of another branch.' });
    }

    const driver = db.prepare(`
        SELECT drv.*, u.full_name
        FROM drivers drv
        JOIN users u ON drv.user_id = u.id
        WHERE drv.id = ?
    `).get(driver_id);

    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    db.transaction(() => {
        // Update delivery
        db.prepare(`
            UPDATE deliveries
            SET driver_id = ?, vehicle_id = ?, dispatcher_user_id = ?,
                status = 'ASSIGNED', priority = COALESCE(?, priority),
                scheduled_pickup_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(driver_id, vehicle_id || driver.vehicle_id || null, req.user.id, priority || null, delivery_id);

        // Update driver status
        db.prepare("UPDATE drivers SET status = 'ON_DELIVERY' WHERE id = ?").run(driver_id);

        // Record delivery history
        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, updated_by_user_id)
            VALUES (?, 'ASSIGNED', ?, ?)
        `).run(delivery_id, `Assigned to driver ${driver.full_name}. Notes: ${notes || 'Standard dispatch'}`, req.user.id);

        // Update parent order status
        db.prepare("UPDATE orders SET status = 'PREPARING' WHERE id = ?").run(delivery.order_id);

        // Notify Driver
        db.prepare(`
            INSERT INTO notifications (branch_id, user_id, type, title, message, reference_type, reference_id)
            VALUES (?, ?, 'DELIVERY_ASSIGNED', 'New Delivery Job Assigned', ?, 'DELIVERY', ?)
        `).run(
            delivery.branch_id, driver.user_id,
            `You have been assigned delivery #${delivery.delivery_number}. Priority: ${priority || delivery.priority}.`,
            String(delivery_id)
        );

        logAuditEvent({
            userId: req.user.id,
            role: req.user.roleName,
            action: 'ASSIGN_DELIVERY',
            resource: 'DELIVERY',
            resourceId: delivery.delivery_number,
            branchId: delivery.branch_id,
            newValue: { driver_id, driver_name: driver.full_name, vehicle_id, priority },
            reason: 'Assigned driver to delivery'
        });
    })();

    res.json({ message: `Delivery assigned to ${driver.full_name}`, status: 'ASSIGNED' });
});

// PATCH /api/dispatch/:id/priority - Update delivery priority
router.patch('/:id/priority', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const { priority } = req.body; // 'NORMAL', 'HIGH', 'URGENT'

    const delivery = req.targetEntity || db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot alter deliveries of another branch.' });
    }

    db.prepare('UPDATE deliveries SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(priority, deliveryId);
    res.json({ message: 'Priority updated successfully', priority });
});

// POST /api/dispatch/:id/fail - Mark delivery as failed and initiate return-to-branch
router.post('/:id/fail', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const { failure_reason, failure_notes, initiate_return } = req.body;

    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    if (req.user.roleName !== 'SUPER_ADMIN' && delivery.branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Cannot alter deliveries of another branch.' });
    }

    const nextStatus = initiate_return ? 'RETURN_TO_BRANCH' : 'FAILED';

    db.transaction(() => {
        db.prepare(`
            UPDATE deliveries
            SET status = ?, failure_reason = ?, failure_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(nextStatus, failure_reason || 'Other', failure_notes || '', deliveryId);

        // Update driver back to available if no other active deliveries
        if (delivery.driver_id) {
            const activeCount = db.prepare(`
                SELECT count(*) as cnt FROM deliveries
                WHERE driver_id = ? AND status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT') AND id != ?
            `).get(delivery.driver_id, deliveryId);

            if (activeCount.cnt === 0) {
                db.prepare("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?").run(delivery.driver_id);
            }
        }

        // History
        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, updated_by_user_id)
            VALUES (?, ?, ?, ?)
        `).run(deliveryId, nextStatus, `Delivery marked ${nextStatus}. Reason: ${failure_reason}. Notes: ${failure_notes}`, req.user.id);

        // Notify Branch Manager
        db.prepare(`
            INSERT INTO notifications (branch_id, type, title, message, reference_type, reference_id)
            VALUES (?, 'DELIVERY_FAILED', 'Delivery Failed / Return Initiated', ?, 'DELIVERY', ?)
        `).run(delivery.branch_id, `Delivery #${delivery.delivery_number} failed: ${failure_reason}. Status: ${nextStatus}.`, String(deliveryId));

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
    })();

    res.json({ message: `Delivery marked as ${nextStatus}`, status: nextStatus });
});

// PUT /api/dispatch/:id/status - Update delivery stage
router.put('/:id/status', authenticateToken, authorize('dispatch', 'update', { entityTable: 'deliveries', idParam: 'id' }), (req, res) => {
    const deliveryId = Number(req.params.id);
    const { status, latitude, longitude } = req.body;

    const delivery = req.targetEntity || db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

    db.transaction(() => {
        db.prepare('UPDATE deliveries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, deliveryId);

        if (status === 'IN_TRANSIT') {
            db.prepare("UPDATE orders SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(delivery.order_id);
        } else if (status === 'DELIVERED') {
            db.prepare("UPDATE orders SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(delivery.order_id);
            if (delivery.driver_id) {
                db.prepare("UPDATE drivers SET status = 'AVAILABLE' WHERE id = ?").run(delivery.driver_id);
            }
        }

        db.prepare(`
            INSERT INTO delivery_status_history (delivery_id, status, notes, latitude, longitude, updated_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(deliveryId, status, `Status changed to ${status}`, latitude || null, longitude || null, req.user.id);
    })();

    res.json({ message: `Delivery status updated to ${status}`, status });
});

module.exports = router;
