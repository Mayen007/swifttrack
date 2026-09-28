// server/routes/shipments.js
// SwiftTrack Logistics: Stage 2 Shipment Core Management Endpoints
const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermission, authorize } = require('../middleware/auth.js');
const shipmentService = require('../services/shipmentService.js');
const shipmentPricingService = require('../services/shipmentPricingService.js');

// POST /api/v1/shipments/quote - Calculate rated pricing breakdown before booking
router.post('/quote', (req, res) => {
    try {
        const quote = shipmentPricingService.calculateShipmentQuote(req.body);
        if (typeof res.apiSuccess === 'function') {
            return res.apiSuccess(quote);
        }
        res.json(quote);
    } catch (err) {
        console.error('Shipment quote error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code || 'PRICING_CALCULATION_ERROR'
        });
    }
});

// POST /api/v1/shipments - Create a new parcel shipment booking
router.post('/', authenticateToken, (req, res, next) => {
    // Check permission
    if (req.user.roleName !== 'SUPER_ADMIN' && !req.user.permissions?.includes('shipments:create')) {
        return res.status(403).json({ error: 'Permission denied: shipments:create required' });
    }
    next();
}, (req, res) => {
    try {
        const result = shipmentService.createShipment(req.body, req.user);
        res.status(201).json(result);
    } catch (err) {
        console.error('Create shipment error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code || 'SHIPMENT_CREATION_FAILED'
        });
    }
});

// GET /api/v1/shipments - List shipments filtered by hub, status, or search query
router.get('/', authenticateToken, (req, res) => {
    try {
        const shipments = shipmentService.listShipments(req.query, req.user);
        res.json(shipments);
    } catch (err) {
        console.error('List shipments error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/shipments/:id - Detailed view with parcels, legs, and timeline
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const shipment = shipmentService.getShipmentById(req.params.id, req.user);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.json(shipment);
    } catch (err) {
        console.error('Get shipment error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/shipments/:id/transition - Advance status through formal state machine
router.post('/:id/transition', authenticateToken, (req, res, next) => {
    if (req.user.roleName !== 'SUPER_ADMIN' && !req.user.permissions?.includes('shipments:status:update')) {
        return res.status(403).json({ error: 'Permission denied: shipments:status:update required' });
    }
    next();
}, (req, res) => {
    try {
        const { target_status, ...payload } = req.body;
        if (!target_status) {
            return res.status(400).json({ error: 'target_status is required for status transition' });
        }
        const result = shipmentService.transitionShipmentStatus(req.params.id, target_status, payload, req.user);
        res.json({
            message: `Shipment successfully transitioned to ${target_status}`,
            data: result
        });
    } catch (err) {
        console.error('Status transition error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code || 'TRANSITION_ERROR'
        });
    }
});

// GET /api/v1/shipments/:id/waybill - Retrieve printable official waybill
router.get('/:id/waybill', authenticateToken, (req, res) => {
    try {
        const counterBookingService = require('../services/counterBookingService.js');
        const waybill = counterBookingService.getWaybillByIdentifier(req.params.id, req.user);
        if (!waybill) {
            return res.status(404).json({ error: 'Waybill not found for shipment' });
        }
        res.json({
            success: true,
            waybill
        });
    } catch (err) {
        console.error('Get shipment waybill error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;

