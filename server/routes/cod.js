// server/routes/cod.js
// SwiftTrack Logistics: Stage 7 COD Settlement & Financial Reconciliation API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const codService = require('../services/codService.js');

function mapErrorStatus(err) {
    if (err.statusCode) return err.statusCode;
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('not found')) return 404;
    if (msg.includes('forbidden') || msg.includes('access denied') || msg.includes('privilege escalation') || msg.includes('permission denied')) return 403;
    if (msg.includes('authentication required')) return 401;
    return 400;
}

// ============================================================================
// COD SETTLEMENTS & FINANCIAL RECONCILIATION
// ============================================================================

// GET /api/v1/cod/settlements/summary (and aliases /summary, /metrics) - Aggregated COD summary metrics for Control Tower / Finance
router.get(['/settlements/summary', '/summary', '/metrics'], authenticateToken, async (req, res) => {
    try {
        const metrics = await codService.getCODSummaryMetrics(req.query.hub_id, req.user);
        res.json(metrics);
    } catch (err) {
        console.error('COD metrics summary error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// GET /api/v1/cod/settlements - List COD settlements with filtering, branch scoping, and pagination
router.get('/settlements', authenticateToken, async (req, res) => {
    try {
        const result = await codService.listSettlements(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List COD settlements error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// GET /api/v1/cod/settlements/:id - Get COD settlement details
router.get('/settlements/:id', authenticateToken, async (req, res) => {
    try {
        const settlement = await codService.getSettlementById(req.params.id, req.user);
        if (!settlement) {
            return res.status(404).json({ error: `COD settlement ${req.params.id} not found` });
        }
        res.json(settlement);
    } catch (err) {
        console.error('Get COD settlement error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// POST /api/v1/cod/settlements - Initialize expected COD settlement record
router.post('/settlements', authenticateToken, async (req, res) => {
    try {
        const settlement = await codService.createExpectedSettlement(req.body, req.user);
        res.status(201).json(settlement);
    } catch (err) {
        console.error('Create COD settlement error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// POST /api/v1/cod/settlements/:id/collect - Record recipient COD collection (Driver/Cashier)
router.post('/settlements/:id/collect', authenticateToken, async (req, res) => {
    try {
        const settlement = await codService.recordCollection(req.params.id, req.body, req.user);
        res.json(settlement);
    } catch (err) {
        console.error('Record COD collection error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// POST /api/v1/cod/settlements/:id/remit - Record remittance to hub/finance/bank
router.post('/settlements/:id/remit', authenticateToken, async (req, res) => {
    try {
        const settlement = await codService.recordRemittance(req.params.id, req.body, req.user);
        res.json(settlement);
    } catch (err) {
        console.error('Record COD remittance error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

// POST /api/v1/cod/settlements/:id/reconcile - Reconcile settlement & sign off variances (Manager/Super Admin)
router.post('/settlements/:id/reconcile', authenticateToken, async (req, res) => {
    try {
        const settlement = await codService.reconcileSettlement(req.params.id, req.body, req.user);
        res.json(settlement);
    } catch (err) {
        console.error('Reconcile COD settlement error:', err);
        res.status(mapErrorStatus(err)).json({ error: err.message });
    }
});

module.exports = router;
