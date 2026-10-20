// server/routes/metrics.js
// SwiftTrack Logistics Platform - Production Prometheus & System Telemetry Endpoint
const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService.js');

/**
 * GET /metrics or /api/v1/metrics
 * If client requests text/plain or default Prometheus scrape -> returns Prometheus format
 * If client requests application/json or ?format=json -> returns structured JSON
 */
router.get('/', async (req, res, next) => {
    try {
        const wantsJson = req.query.format === 'json' || req.accepts(['text/plain', 'application/json']) === 'application/json';

        if (wantsJson) {
            const metrics = await metricsService.collectMetrics();
            return res.json(metrics);
        }

        const prometheusText = await metricsService.getPrometheusText();
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return res.send(prometheusText);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
