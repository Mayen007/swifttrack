// server/routes/deliveryTasks.js
// SwiftTrack Logistics: Stage 5 Last-Mile Delivery & Operational Exceptions API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth.js');
const deliveryExecutionService = require('../services/deliveryExecutionService.js');

// ============================================================================
// 1. DELIVERY TASKS
// ============================================================================

// POST /api/v1/deliveries/tasks - Create delivery task for shipment
router.post('/tasks', authenticateToken, authorize('dispatch', 'create'), async (req, res) => {
    try {
        const task = await deliveryExecutionService.createDeliveryTask(req.body, req.user);
        res.status(201).json(task);
    } catch (err) {
        console.error('Create delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/tasks - List delivery tasks
router.get('/tasks', authenticateToken, authorize('dispatch', 'view'), async (req, res) => {
    try {
        const result = await deliveryExecutionService.listDeliveries(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List delivery tasks error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/tasks/:id - Get delivery task details
router.get('/tasks/:id', authenticateToken, authorize('dispatch', 'view'), async (req, res) => {
    try {
        const task = await deliveryExecutionService.getDeliveryById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Delivery task not found' });
        res.json(task);
    } catch (err) {
        console.error('Get delivery task error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/assign - Assign delivery task to driver/vehicle
router.post('/tasks/:id/assign', authenticateToken, authorize('dispatch', 'assign'), async (req, res) => {
    try {
        const task = await deliveryExecutionService.assignDeliveryTask(req.params.id, req.body, req.user);
        res.json(task);
    } catch (err) {
        console.error('Assign delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/start - Driver starts delivery run
router.post('/tasks/:id/start', authenticateToken, authorize('delivery', 'start'), async (req, res) => {
    try {
        const task = await deliveryExecutionService.startDelivery(req.params.id, req.user);
        res.json(task);
    } catch (err) {
        console.error('Start delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/attempt - Record delivery attempt
router.post('/tasks/:id/attempt', authenticateToken, authorize('delivery', 'problem'), async (req, res) => {
    try {
        const result = await deliveryExecutionService.recordDeliveryAttempt(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Delivery attempt error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/complete - Complete delivery with Proof of Delivery
router.post('/tasks/:id/complete', authenticateToken, authorize('delivery', 'pod_submit'), async (req, res) => {
    try {
        const result = await deliveryExecutionService.completeDeliveryWithPOD(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Complete delivery error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/return-to-hub - Return failed delivery package to hub
router.post('/tasks/:id/return-to-hub', authenticateToken, authorize('dispatch', 'update'), async (req, res) => {
    try {
        const task = await deliveryExecutionService.processReturnToHub(req.params.id, req.body, req.user);
        res.json(task);
    } catch (err) {
        console.error('Return to hub error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// ============================================================================
// 2. OPERATIONAL EXCEPTIONS
// ============================================================================

// POST /api/v1/deliveries/exceptions - Log operational exception
router.post('/exceptions', authenticateToken, authorize('discrepancy', 'create'), async (req, res) => {
    try {
        const exception = await deliveryExecutionService.createException(req.body, req.user);
        res.status(201).json(exception);
    } catch (err) {
        console.error('Create exception error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/exceptions - List exceptions
router.get('/exceptions', authenticateToken, authorize('discrepancy', 'view'), async (req, res) => {
    try {
        const result = await deliveryExecutionService.listExceptions(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List exceptions error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/exceptions/:id - Get exception details
router.get('/exceptions/:id', authenticateToken, authorize('discrepancy', 'view'), async (req, res) => {
    try {
        const exception = await deliveryExecutionService.getExceptionById(req.params.id);
        if (!exception) return res.status(404).json({ error: 'Exception not found' });
        res.json(exception);
    } catch (err) {
        console.error('Get exception error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/exceptions/:id/resolve - Resolve operational exception
router.post('/exceptions/:id/resolve', authenticateToken, authorize('control_tower', 'resolve'), async (req, res) => {
    try {
        const resolved = await deliveryExecutionService.resolveException(req.params.id, req.body, req.user);
        res.json(resolved);
    } catch (err) {
        console.error('Resolve exception error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

module.exports = router;
