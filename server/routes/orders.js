// server/routes/orders.js
const express = require('express');
const router = express.Router();
const { authenticateToken, enforceBranchIsolation } = require('../middleware/auth.js');
const orderService = require('../services/orderService.js');

// GET /api/orders/export - Export filtered orders to CSV
router.get('/export', authenticateToken, (req, res) => {
    try {
        const csv = orderService.exportOrdersToCsv(req.query, req.user);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="orders-export-${Date.now()}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('Export error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orders - List orders scoped by branch isolation and multi-axis filters
router.get('/', authenticateToken, enforceBranchIsolation, (req, res) => {
    try {
        const filters = {
            ...req.query,
            branch_id: req.effectiveBranchId || req.query.branch_id
        };
        const orders = orderService.listOrders(filters, req.user);
        res.json(orders);
    } catch (err) {
        console.error('List orders error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orders/:id - Order details with items, timeline, delivery, and payments
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const order = orderService.getOrderById(req.params.id, req.user);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        console.error('Get order error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/orders/:id/invoice - Printable Commercial Tax Invoice data
router.get('/:id/invoice', authenticateToken, (req, res) => {
    try {
        const invoice = orderService.generateInvoiceData(req.params.id, req.user);
        res.json(invoice);
    } catch (err) {
        console.error('Invoice error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/orders - Create a new order (DRAFT or CONFIRMED)
router.post('/', authenticateToken, (req, res) => {
    try {
        const result = orderService.createOrder(req.body, req.user);
        res.status(201).json(result);
    } catch (err) {
        console.error('Create order error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

// PUT /api/orders/:id - Edit order before fulfillment (DRAFT or CONFIRMED only)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const updated = orderService.editOrder(req.params.id, req.body, req.user);
        res.json({
            message: 'Order updated successfully',
            order: updated
        });
    } catch (err) {
        console.error('Edit order error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

// POST /api/orders/:id/transition - Transition order state through the formal state machine
router.post('/:id/transition', authenticateToken, (req, res) => {
    try {
        const { status, notes, reason } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Target status is required for transition' });
        }
        const updated = orderService.transitionOrderStatus(req.params.id, status, { notes, reason }, req.user);
        res.json({
            message: `Order successfully transitioned to ${status}`,
            order: updated
        });
    } catch (err) {
        console.error('Transition order error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

// PATCH /api/orders/:id/status - Backwards compatible status updater
router.patch('/:id/status', authenticateToken, (req, res) => {
    try {
        const { status, notes, reason } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        const updated = orderService.transitionOrderStatus(req.params.id, status, { notes, reason }, req.user);
        res.json({
            message: 'Order status updated successfully',
            status: updated.status,
            order: updated
        });
    } catch (err) {
        console.error('Patch order status error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

// POST /api/orders/:id/cancel - Cancel order and release reservations
router.post('/:id/cancel', authenticateToken, (req, res) => {
    try {
        const { reason, notes } = req.body;
        const updated = orderService.transitionOrderStatus(req.params.id, 'CANCELLED', { reason, notes }, req.user);
        res.json({
            message: 'Order cancelled successfully and inventory reservations released',
            order: updated
        });
    } catch (err) {
        console.error('Cancel order error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

// POST /api/orders/:id/notes - Add internal staff note
router.post('/:id/notes', authenticateToken, (req, res) => {
    try {
        const { note } = req.body;
        const notes = orderService.addInternalNote(req.params.id, note, req.user);
        res.status(201).json({
            message: 'Internal note added successfully',
            notes
        });
    } catch (err) {
        console.error('Add note error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code
        });
    }
});

module.exports = router;
