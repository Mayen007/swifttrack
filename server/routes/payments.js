// server/routes/payments.js
// SwiftTrack Kenya: Phase 7 Payments Engine REST API Routes
const express = require('express');
const router = express.Router();
const { authenticateToken, enforceBranchIsolation, authorizeRole } = require('../middleware/auth.js');
const paymentService = require('../services/paymentService.js');

// 1. POST /api/payments/callbacks/mpesa - Public Webhook Endpoint for Safaricom Daraja
// Must be publicly accessible without JWT token; validates payload structure and handles deduplication
router.post('/callbacks/mpesa', (req, res) => {
    try {
        const result = paymentService.handleMpesaCallback(req.body);

        // Standard Safaricom Daraja callback acknowledgment response
        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: 'Accepted'
        });
    } catch (err) {
        console.error('[Daraja Webhook] Processing error:', err);
        // Even on error, Safaricom expects a 200 acknowledgment to avoid retry storms
        return res.status(200).json({
            ResultCode: 0,
            ResultDesc: 'Acknowledged with error'
        });
    }
});

// 2. GET /api/payments/export - Export payment intents & ledger to CSV
router.get('/export', authenticateToken, (req, res) => {
    try {
        const csv = paymentService.exportPaymentsToCsv(req.query, req.user);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="payments-export-${Date.now()}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('Export error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 3. POST /api/payments/intents - Create a Payment Intent (supports Idempotency-Key header)
router.post('/intents', authenticateToken, enforceBranchIsolation, (req, res) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
        const payload = {
            ...req.body,
            branch_id: req.effectiveBranchId || req.body.branch_id,
            idempotency_key: idempotencyKey
        };

        const intent = paymentService.createPaymentIntent(payload, req.user);
        const statusCode = intent.is_idempotent_replay ? 200 : 201;

        res.status(statusCode).json({
            success: true,
            intent
        });
    } catch (err) {
        console.error('Create payment intent error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 4. GET /api/payments/intents - List payment intents with multi-axis filters
router.get('/intents', authenticateToken, enforceBranchIsolation, (req, res) => {
    try {
        const filters = {
            ...req.query,
            branch_id: req.effectiveBranchId || req.query.branch_id
        };
        const intents = paymentService.listPaymentIntents(filters, req.user);
        res.json({
            success: true,
            data: intents,
            count: intents.length
        });
    } catch (err) {
        console.error('List payment intents error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 5. GET /api/payments/intents/:id - Get full intent details with callbacks & audit trail
router.get('/intents/:id', authenticateToken, (req, res) => {
    try {
        const intent = paymentService.getPaymentIntentById(req.params.id, req.user);
        if (!intent) {
            return res.status(404).json({ error: 'Payment intent not found' });
        }
        res.json({
            success: true,
            intent
        });
    } catch (err) {
        console.error('Get payment intent details error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 6. POST /api/payments/intents/:id/process - Process / execute intent (STK push, card, cash, bank)
router.post('/intents/:id/process', authenticateToken, async (req, res) => {
    try {
        const updated = await paymentService.processIntent(req.params.id, req.body, req.user);
        res.json({
            success: true,
            intent: updated
        });
    } catch (err) {
        console.error('Process payment intent error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 7. POST /api/payments/intents/:id/cancel - Cancel pending intent
router.post('/intents/:id/cancel', authenticateToken, (req, res) => {
    try {
        const cancelled = paymentService.cancelPaymentIntent(req.params.id, req.body.reason, req.user);
        res.json({
            success: true,
            intent: cancelled
        });
    } catch (err) {
        console.error('Cancel payment intent error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 8. POST /api/payments/intents/:id/query-status - Re-query provider (Daraja STK status query)
router.post('/intents/:id/query-status', authenticateToken, async (req, res) => {
    try {
        const queried = await paymentService.queryPaymentStatus(req.params.id, req.user);
        res.json({
            success: true,
            intent: queried
        });
    } catch (err) {
        console.error('Query payment status error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 9. POST /api/payments/reconcile - Automated payment reconciliation
router.post('/reconcile', authenticateToken, (req, res) => {
    try {
        const result = paymentService.reconcilePayments(req.body, req.user);
        res.json({
            success: true,
            reconciliation: result
        });
    } catch (err) {
        console.error('Reconciliation error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// 10. POST /api/payments/refund - Process full or partial refund
router.post('/refund', authenticateToken, (req, res) => {
    try {
        const { payment_id, amount, reason } = req.body;
        if (!payment_id) {
            return res.status(400).json({ error: 'payment_id is required for refund' });
        }
        const refund = paymentService.refundPayment(payment_id, { amount, reason }, req.user);
        res.json({
            success: true,
            refund
        });
    } catch (err) {
        console.error('Refund error:', err);
        res.status(err.statusCode || 500).json({ error: err.message });
    }
});

module.exports = router;
