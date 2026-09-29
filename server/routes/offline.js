// server/routes/offline.js
// SwiftTrack Logistics: Offline-First Field Operations Sync Gateway (PRD Section 21)
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const offlineSyncService = require('../services/offlineSyncService.js');

// POST /api/v1/offline/sync - Process an offline operations sync batch
router.post('/sync', authenticateToken, (req, res) => {
    try {
        const { device_id, app_version, operations } = req.body;
        if (!Array.isArray(operations) || operations.length === 0) {
            return res.status(400).json({
                error: 'operations array is required and must contain at least one queued operation',
                code: 'INVALID_OFFLINE_BATCH'
            });
        }

        const result = offlineSyncService.processOfflineSyncBatch({
            device_id: device_id || req.headers['x-device-id'] || 'WEB_CLIENT',
            app_version: app_version || req.headers['x-app-version'] || '1.0.0',
            operations
        }, req.user);

        res.json(result);
    } catch (err) {
        console.error('Offline sync gateway error:', err);
        res.status(err.statusCode || 400).json({
            error: err.message,
            code: err.code || 'OFFLINE_SYNC_FAILED'
        });
    }
});

// GET /api/v1/offline/status - Check sync telemetry and recent sync logs
router.get('/status', authenticateToken, (req, res) => {
    try {
        const deviceId = req.query.device_id || null;
        const stats = offlineSyncService.getOfflineSyncStats(deviceId);
        res.json(stats);
    } catch (err) {
        console.error('Offline status error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
