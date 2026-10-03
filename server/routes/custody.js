// server/routes/custody.js
// SwiftTrack Logistics: Stage 4 Physical Custody & Hub Operations API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.js');
const custodyService = require('../services/custodyService.js');

// ============================================================================
// 1. BARCODE SCANS
// ============================================================================

// POST /api/v1/custody/scans - Record a barcode scan event
router.post('/scans', authenticateToken, async (req, res) => {
    try {
        const scan = await custodyService.recordScanEvent(req.body, req.user);
        res.status(201).json(scan);
    } catch (err) {
        console.error('Scan event error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/custody/scans/batch - Sync a batch of scans (offline mobile scanner sync)
router.post('/scans/batch', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.recordBatchScans(req.body.scans, req.user);
        res.status(200).json(result);
    } catch (err) {
        console.error('Batch scan error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/custody/scans - List scan events
router.get('/scans', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.listScanEvents(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List scans error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// ============================================================================
// 2. CHAIN OF CUSTODY HANDOFFS
// ============================================================================

// POST /api/v1/custody/handoffs - Record a physical chain of custody handoff
router.post('/handoffs', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.recordHandoff(req.body, req.user);
        res.status(201).json(result);
    } catch (err) {
        console.error('Handoff error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/custody/handoffs - List handoffs
router.get('/handoffs', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.listHandoffs(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List handoffs error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/custody/handoffs/:id - Get handoff details
router.get('/handoffs/:id', authenticateToken, async (req, res) => {
    try {
        const handoff = await custodyService.getHandoffById(req.params.id);
        if (!handoff) return res.status(404).json({ error: 'Handoff record not found' });
        res.json(handoff);
    } catch (err) {
        console.error('Get handoff error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// ============================================================================
// 3. HUB RECEIVING SESSIONS
// ============================================================================

// POST /api/v1/custody/receiving-sessions - Open a hub receiving session
router.post('/receiving-sessions', authenticateToken, async (req, res) => {
    try {
        const session = await custodyService.openReceivingSession(req.body, req.user);
        res.status(201).json(session);
    } catch (err) {
        console.error('Open receiving session error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/custody/receiving-sessions - List receiving sessions
router.get('/receiving-sessions', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.listReceivingSessions(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List receiving sessions error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/custody/receiving-sessions/:id - Get receiving session details
router.get('/receiving-sessions/:id', authenticateToken, async (req, res) => {
    try {
        const session = await custodyService.getReceivingSessionById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Receiving session not found' });
        res.json(session);
    } catch (err) {
        console.error('Get receiving session error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/custody/receiving-sessions/:id/scan - Scan item in receiving session
router.post('/receiving-sessions/:id/scan', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.scanReceivingItem(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Scan receiving item error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// POST /api/v1/custody/receiving-sessions/:id/complete - Complete receiving session
router.post('/receiving-sessions/:id/complete', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.completeReceivingSession(req.params.id, req.body, req.user);
        res.json(result);
    } catch (err) {
        console.error('Complete receiving session error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// ============================================================================
// 4. DISCREPANCIES
// ============================================================================

// POST /api/v1/custody/discrepancies - Report manual discrepancy
router.post('/discrepancies', authenticateToken, async (req, res) => {
    try {
        const discrepancy = await custodyService.createDiscrepancy(req.body, req.user);
        res.status(201).json(discrepancy);
    } catch (err) {
        console.error('Create discrepancy error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

// GET /api/v1/custody/discrepancies - List discrepancies
router.get('/discrepancies', authenticateToken, async (req, res) => {
    try {
        const result = await custodyService.listDiscrepancies(req.query, req.user);
        res.json(result);
    } catch (err) {
        console.error('List discrepancies error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// GET /api/v1/custody/discrepancies/:id - Get discrepancy details
router.get('/discrepancies/:id', authenticateToken, async (req, res) => {
    try {
        const discrepancy = await custodyService.getDiscrepancyById(req.params.id);
        if (!discrepancy) return res.status(404).json({ error: 'Discrepancy not found' });
        res.json(discrepancy);
    } catch (err) {
        console.error('Get discrepancy error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// POST /api/v1/custody/discrepancies/:id/resolve - Resolve discrepancy
router.post('/discrepancies/:id/resolve', authenticateToken, async (req, res) => {
    try {
        const resolved = await custodyService.resolveDiscrepancy(req.params.id, req.body, req.user);
        res.json(resolved);
    } catch (err) {
        console.error('Resolve discrepancy error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

module.exports = router;
