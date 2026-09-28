// server/routes/e2eAcceptance.js
// SwiftTrack Kenya Logistics: Stage 10 End-to-End Acceptance Simulator API
const express = require('express');
const router = express.Router();
const e2eAcceptanceService = require('../services/e2eAcceptanceService.js');
const { authenticateToken } = require('../middleware/auth.js');
const { requirePermission } = require('../config/permissions.js');

/**
 * GET /api/v1/e2e/steps
 * Returns the 23 PRD Section 30 acceptance steps specification
 */
router.get('/steps', authenticateToken, (req, res) => {
    const steps = [
        { step: 1, name: 'Shipment Creation', desc: 'Consignment created with multi-leg routing sequence' },
        { step: 2, name: 'Tracking Number Generation', desc: 'System generates unique human-readable STK tracking code' },
        { step: 3, name: 'Charge Calculation', desc: 'Volumetric vs actual rating and pricing engine execution' },
        { step: 4, name: 'Payment Recording', desc: 'M-Pesa or Cash settlement recorded at counter' },
        { step: 5, name: 'Parcel Acceptance', desc: 'Consignment formally accepted by origin hub agent' },
        { step: 6, name: 'Origin Physical Scan', desc: 'Barcode scanned and custody event logged at origin' },
        { step: 7, name: 'Manifest Provisioning', desc: 'Consignment assigned to corridor manifest' },
        { step: 8, name: 'Transport Run Assignment', desc: 'Manifest attached to linehaul run, vehicle, and driver' },
        { step: 9, name: 'Lock & Load', desc: 'Manifest locked, shipments transition to LOADED (Rule BR-005)' },
        { step: 10, name: 'Transport Run Departure', desc: 'Run dispatches and transitions fleet to IN_TRANSIT' },
        { step: 11, name: 'Transit Waypoint Scan', desc: 'Mid-corridor waypoint checkpoint logged with GPS coordinates' },
        { step: 12, name: 'Intermediate Hub Arrival', desc: 'Consignment arrives at transfer station (Nakuru)' },
        { step: 13, name: 'Discrepancy Check', desc: 'Manifest items verified against physical unload (Rule BR-006)' },
        { step: 14, name: 'Transshipment Assignment', desc: 'Shipment assigned to Leg 2 manifest and dispatched' },
        { step: 15, name: 'Destination Hub Arrival', desc: 'Consignment received at final destination hub (Mombasa)' },
        { step: 16, name: 'Last-Mile Task Provisioning', desc: 'Delivery task created with required POD verification rules' },
        { step: 17, name: 'Courier Driver Assignment', desc: 'Delivery assigned to local courier driver' },
        { step: 18, name: 'Out for Delivery Run', desc: 'Run starts, dynamic 6-digit OTP generated & sent to recipient' },
        { step: 19, name: 'Proof of Delivery Capture', desc: 'OTP authenticated, recipient signature & GPS verified (Rule BR-007)' },
        { step: 20, name: 'Delivered State Transition', desc: 'Shipment transitions to DELIVERED with immutable evidence' },
        { step: 21, name: 'Customer Tracking Reflection', desc: 'Sanitized tracking reflects full milestone journey' },
        { step: 22, name: 'Audit Log Verification', desc: 'All state transitions and actors recorded in audit trail' },
        { step: 23, name: 'COD Financial Reconciliation', desc: 'Collection, remittance, and manager reconciliation closed' }
    ];
    res.apiSuccess({ steps }, 'PRD Section 30 acceptance steps specification');
});

/**
 * POST /api/v1/e2e/simulate-acceptance-run
 * Executes the complete 23-step multi-leg journey in real time
 */
router.post('/simulate-acceptance-run', authenticateToken, requirePermission('shipments', 'create'), async (req, res, next) => {
    try {
        const result = await e2eAcceptanceService.executeFullAcceptanceScenario(req.body, req.user);
        res.apiSuccess(result, 'End-to-End Acceptance Scenario completed successfully (23/23 steps passed)');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
