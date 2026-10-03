// server/routes/transport.js
// SwiftTrack Logistics: Stage 3 Transport & Manifest Management API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const transportService = require('../services/transportService.js');

// --- ROUTES ---

// GET /api/v1/transport/routes - List all routes
router.get('/routes', authenticateToken, async (req, res) => {
    try {
        const routes = await transportService.listRoutes(req.query);
        res.json(routes);
    } catch (err) {
        console.error('List routes error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/transport/routes - Create a new planned route
router.post('/routes', authenticateToken, async (req, res) => {
    try {
        const route = await transportService.createRoute(req.body, req.user);
        res.status(201).json(route);
    } catch (err) {
        console.error('Create route error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/transport/routes/:id - Get route details
router.get('/routes/:id', authenticateToken, async (req, res) => {
    try {
        const route = await transportService.getRouteById(req.params.id);
        if (!route) return res.status(404).json({ error: 'Route not found' });
        res.json(route);
    } catch (err) {
        console.error('Get route error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// --- TRANSPORT RUNS ---

// GET /api/v1/transport/runs - List transport runs
router.get('/runs', authenticateToken, async (req, res) => {
    try {
        const runs = await transportService.listTransportRuns(req.query, req.user);
        res.json(runs);
    } catch (err) {
        console.error('List transport runs error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs - Create transport run and manifest
router.post('/runs', authenticateToken, async (req, res) => {
    try {
        const run = await transportService.createTransportRun(req.body, req.user);
        res.status(201).json(run);
    } catch (err) {
        console.error('Create transport run error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/transport/runs/:id - Get transport run with manifest & items
router.get('/runs/:id', authenticateToken, async (req, res) => {
    try {
        const run = await transportService.getTransportRunById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Transport run not found' });
        res.json(run);
    } catch (err) {
        console.error('Get transport run error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/manifest/items - Add shipment to run manifest
router.post('/runs/:id/manifest/items', authenticateToken, async (req, res) => {
    try {
        const { shipment_id } = req.body;
        if (!shipment_id) return res.status(400).json({ error: 'shipment_id is required' });
        const updatedRun = await transportService.addShipmentToManifest(req.params.id, shipment_id, req.user);
        res.status(200).json(updatedRun);
    } catch (err) {
        console.error('Add manifest item error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// DELETE /api/v1/transport/runs/:id/manifest/items/:shipmentId - Remove shipment from manifest
router.delete('/runs/:id/manifest/items/:shipmentId', authenticateToken, async (req, res) => {
    try {
        const updatedRun = await transportService.removeShipmentFromManifest(req.params.id, req.params.shipmentId, req.user);
        res.status(200).json(updatedRun);
    } catch (err) {
        console.error('Remove manifest item error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/manifest/lock - Lock manifest and mark shipments LOADED (BR-005)
router.post('/runs/:id/manifest/lock', authenticateToken, async (req, res) => {
    try {
        const run = await transportService.lockManifest(req.params.id, req.user);
        res.json({ message: 'Manifest successfully locked and shipments marked loaded', run });
    } catch (err) {
        console.error('Lock manifest error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/dispatch - Dispatch transport run
router.post('/runs/:id/dispatch', authenticateToken, async (req, res) => {
    try {
        const run = await transportService.dispatchTransportRun(req.params.id, req.body, req.user);
        res.json({ message: 'Transport run successfully dispatched', run });
    } catch (err) {
        console.error('Dispatch transport run error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/checkpoints - Record transit checkpoint
router.post('/runs/:id/checkpoints', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.recordCheckpoint(req.params.id, req.body, req.user);
        res.status(201).json(result);
    } catch (err) {
        console.error('Record checkpoint error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/arrive - Record arrival at destination hub
router.post('/runs/:id/arrive', authenticateToken, async (req, res) => {
    try {
        const run = await transportService.arriveTransportRun(req.params.id, req.body, req.user);
        res.json({ message: 'Transport run arrived at destination hub', run });
    } catch (err) {
        console.error('Arrive transport run error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/runs/:id/receive - Destination hub receiving & discrepancy check (BR-006)
router.post('/runs/:id/receive', authenticateToken, async (req, res) => {
    try {
        const { received_shipment_ids } = req.body;
        if (!Array.isArray(received_shipment_ids)) {
            return res.status(400).json({ error: 'received_shipment_ids array is required for hub receiving' });
        }
        const result = await transportService.receiveManifest(req.params.id, received_shipment_ids, req.user);
        res.json(result);
    } catch (err) {
        console.error('Receive manifest error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// --- MANIFESTS DIRECT LEDGER ---

// GET /api/v1/transport/manifests - List linehaul manifests
router.get('/manifests', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.listManifests(req.query);
        res.json(result);
    } catch (err) {
        console.error('List manifests error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/transport/manifests/:id - Get manifest details with loaded items
router.get('/manifests/:id', authenticateToken, async (req, res) => {
    try {
        const manifest = await transportService.getManifestById(req.params.id);
        if (!manifest) return res.status(404).json({ error: 'Manifest not found' });
        res.json(manifest);
    } catch (err) {
        console.error('Get manifest error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// --- CROSS-BORDER LOGISTICS & CUSTOMS WORKFLOWS ---

// GET /api/v1/transport/cross-border/legs - List cross-border corridor legs
router.get('/cross-border/legs', authenticateToken, async (req, res) => {
    try {
        const legs = await transportService.getCrossBorderLegs(req.query);
        res.json(legs);
    } catch (err) {
        console.error('List cross border legs error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/transport/legs/:id/customs/submit - Submit customs declaration
router.post('/legs/:id/customs/submit', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.submitCustomsDeclaration(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Submit customs declaration error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/legs/:id/customs/inspect - Record customs physical inspection
router.post('/legs/:id/customs/inspect', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.inspectCustomsLeg(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Inspect customs leg error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/legs/:id/customs/hold - Place customs hold with mandatory reason
router.post('/legs/:id/customs/hold', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.holdCustomsLeg(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Hold customs leg error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/legs/:id/customs/clear - Record customs clearance certificate
router.post('/legs/:id/customs/clear', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.clearCustomsLeg(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Clear customs leg error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/transport/legs/:id/customs/release - Release customs inspection to proceed
router.post('/legs/:id/customs/release', authenticateToken, async (req, res) => {
    try {
        const result = await transportService.releaseCustomsLeg(req.params.id, req.user);
        res.json(result);
    } catch (err) {
        console.error('Release customs leg error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

module.exports = router;
