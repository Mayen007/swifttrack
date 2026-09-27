// server/routes/deliveryTasks.js
// SwiftTrack Logistics: Stage 5 Last-Mile Delivery & Operational Exceptions API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const deliveryExecutionService = require('../services/deliveryExecutionService.js');

// ============================================================================
// 1. DELIVERY TASKS
// ============================================================================

// POST /api/v1/deliveries/tasks - Create delivery task for shipment
router.post('/tasks', authenticateToken, (req, res) => {
    try {
        const task = deliveryExecutionService.createDeliveryTask(req.body, req.user);
        res.status(201).json(task);
    } catch (err) {
        console.error('Create delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/tasks - List delivery tasks
router.get('/tasks', authenticateToken, (req, res) => {
    try {
        const result = deliveryExecutionService.listDeliveries(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List delivery tasks error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/tasks/:id - Get delivery task details
router.get('/tasks/:id', authenticateToken, (req, res) => {
    try {
        const task = deliveryExecutionService.getDeliveryById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Delivery task not found' });
        res.json(task);
    } catch (err) {
        console.error('Get delivery task error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/assign - Assign delivery task to driver/vehicle
router.post('/tasks/:id/assign', authenticateToken, (req, res) => {
    try {
        const task = deliveryExecutionService.assignDeliveryTask(req.params.id, req.body, req.user);
        res.json(task);
    } catch (err) {
        console.error('Assign delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/start - Driver starts delivery run
router.post('/tasks/:id/start', authenticateToken, (req, res) => {
    try {
        const task = deliveryExecutionService.startDelivery(req.params.id, req.user);
        res.json(task);
    } catch (err) {
        console.error('Start delivery task error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/attempt - Record delivery attempt
router.post('/tasks/:id/attempt', authenticateToken, (req, res) => {
    try {
        const result = deliveryExecutionService.recordDeliveryAttempt(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Delivery attempt error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/complete - Complete delivery with Proof of Delivery
router.post('/tasks/:id/complete', authenticateToken, (req, res) => {
    try {
        const result = deliveryExecutionService.completeDeliveryWithPOD(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Complete delivery error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/tasks/:id/return-to-hub - Return failed delivery package to hub
router.post('/tasks/:id/return-to-hub', authenticateToken, (req, res) => {
    try {
        const task = deliveryExecutionService.processReturnToHub(req.params.id, req.body, req.user);
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
router.post('/exceptions', authenticateToken, (req, res) => {
    try {
        const exception = deliveryExecutionService.createException(req.body, req.user);
        res.status(201).json(exception);
    } catch (err) {
        console.error('Create exception error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/exceptions - List exceptions
router.get('/exceptions', authenticateToken, (req, res) => {
    try {
        const result = deliveryExecutionService.listExceptions(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List exceptions error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/deliveries/exceptions/:id - Get exception details
router.get('/exceptions/:id', authenticateToken, (req, res) => {
    try {
        const exception = deliveryExecutionService.getExceptionById(req.params.id);
        if (!exception) return res.status(404).json({ error: 'Exception not found' });
        res.json(exception);
    } catch (err) {
        console.error('Get exception error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/deliveries/exceptions/:id/resolve - Resolve operational exception
router.post('/exceptions/:id/resolve', authenticateToken, (req, res) => {
    try {
        const resolved = deliveryExecutionService.resolveException(req.params.id, req.body, req.user);
        res.json(resolved);
    } catch (err) {
        console.error('Resolve exception error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

module.exports = router;
