// server/routes/controlTower.js
// SwiftTrack Logistics: Stage 8 Operations Control Tower API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const controlTowerService = require('../services/controlTowerService.js');

function mapErrorStatus(err) {
    if (err.statusCode) return err.statusCode;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('not found')) return 404;
    if (msg.includes('forbidden') || msg.includes('access denied') || msg.includes('privilege escalation') || msg.includes('permission denied')) return 403;
    if (msg.includes('authentication required')) return 401;
    return 400;
}

// GET /api/v1/control-tower/summary - Live operational telemetry summary (Now, Attention, Movement, KPIs)
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await controlTowerService.getLiveOperationalSummary(req.query, req.user);
        res.json(summary);
    } catch (err) {
        console.error('Control tower summary error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// GET /api/v1/control-tower/alerts - Actionable prioritized alerts queue (What needs attention?)
router.get('/alerts', authenticateToken, async (req, res) => {
    try {
        const alerts = await controlTowerService.getOperationalAlerts(req.query, req.user);
        res.json(alerts);
    } catch (err) {
        console.error('Control tower alerts error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// GET /api/v1/control-tower/active-corridors - Active transport runs & corridor movement (What is moving?)
router.get('/active-corridors', authenticateToken, async (req, res) => {
    try {
        const corridors = await controlTowerService.getActiveCorridorTelemetry(req.user);
        res.json(corridors);
    } catch (err) {
        console.error('Control tower corridors error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// GET /api/v1/control-tower/hub-telemetry - Station-by-station hub throughput & bottlenecks
router.get('/hub-telemetry', authenticateToken, async (req, res) => {
    try {
        const telemetry = await controlTowerService.getHubNetworkTelemetry(req.user);
        res.json(telemetry);
    } catch (err) {
        console.error('Control tower hub telemetry error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// POST /api/v1/control-tower/alerts/:type/:id/resolve - Fast-resolve or acknowledge bottleneck alert
router.post('/alerts/:type/:id/resolve', authenticateToken, async (req, res) => {
    try {
        const result = await controlTowerService.resolveAlert(req.params.type, req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Resolve alert error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

module.exports = router;
