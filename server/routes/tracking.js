// server/routes/tracking.js
// SwiftTrack Logistics: Public Unauthenticated Tracking API
const express = require('express');
const router = express.Router();
const shipmentService = require('../services/shipmentService.js');

// GET /api/v1/tracking/:trackingNumber - Public shipment milestone tracking
router.get('/:trackingNumber', (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const trackingData = shipmentService.getPublicTracking(trackingNumber);

        if (!trackingData) {
            return res.status(404).json({
                error: `Tracking number '${trackingNumber}' was not found. Please verify and try again.`,
                code: 'SHIPMENT_NOT_FOUND'
            });
        }

        if (typeof res.apiSuccess === 'function') {
            return res.apiSuccess(trackingData);
        }
        res.json(trackingData);
    } catch (err) {
        console.error('Public tracking error:', err);
        res.status(500).json({
            error: err.message,
            code: 'TRACKING_LOOKUP_ERROR'
        });
    }
});

module.exports = router;
