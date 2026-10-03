// server/routes/notificationsLogistics.js
// SwiftTrack Logistics — Stage 9: Communications Engine & Notification Outbox REST API
// PRD Section 7.13 & Section 14 (NTF-001..004)

const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService.js');
const { executeImmediateRun } = require('../workers/notificationWorker.js');
const { authenticateToken, requirePermission } = require('../middleware/auth.js');

/**
 * GET /api/v1/notifications-engine/stats
 * Telemetry and delivery rates across SMS, WhatsApp, and Email
 */
router.get('/stats', authenticateToken, requirePermission('notifications', 'view'), async (req, res, next) => {
    try {
        const stats = await notificationService.getNotificationStats();
        res.apiSuccess(stats);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/notifications-engine/outbox
 * List notifications outbox with filter & pagination
 */
router.get('/outbox', authenticateToken, requirePermission('notifications', 'view'), async (req, res, next) => {
    try {
        const items = await notificationService.getOutbox(req.query);
        res.apiSuccess({
            items,
            count: items.length
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/v1/notifications-engine/templates
 * List all configurable milestone templates
 */
router.get('/templates', authenticateToken, requirePermission('notifications', 'view'), async (req, res, next) => {
    try {
        const templates = await notificationService.getTemplates();
        res.apiSuccess({ templates });
    } catch (err) {
        next(err);
    }
});

/**
 * PUT /api/v1/notifications-engine/templates/:code
 * Update milestone template text, subject, and channels
 */
router.put('/templates/:code', authenticateToken, requirePermission('notifications', 'manage'), async (req, res, next) => {
    try {
        const updated = await notificationService.updateTemplate(req.params.code, req.body, req.user);
        res.apiSuccess(updated, 'Notification template updated successfully');
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/notifications-engine/outbox/:id/retry
 * Operator manual retry / immediate resend
 */
router.post('/outbox/:id/retry', authenticateToken, requirePermission('notifications', 'resend'), async (req, res, next) => {
    try {
        const result = await notificationService.resendOutboxItem(Number(req.params.id), req.user);
        res.apiSuccess(result, 'Notification outbox item queued for immediate retry');
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/notifications-engine/process-queue
 * Manually trigger outbox queue processing sweep
 */
router.post('/process-queue', authenticateToken, requirePermission('notifications', 'manage'), async (req, res, next) => {
    try {
        const batchSize = Number(req.body.batch_size || 25);
        const result = await executeImmediateRun(batchSize);
        res.apiSuccess(result, 'Notification outbox queue sweep completed');
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/notifications-engine/test-send
 * Send test communication to verify channel gateways
 */
router.post('/test-send', authenticateToken, requirePermission('notifications', 'manage'), async (req, res, next) => {
    try {
        const { channel = 'SMS', destination, message, template_code = 'BOOKED_CONFIRMATION' } = req.body;

        if (!destination) {
            return res.apiError('Destination phone number or email is required.', 'VALIDATION_ERROR', 400);
        }

        const template = notificationService.getTemplateByCode(template_code);
        const contentToSend = message || (template ? template.sms_template : 'SwiftTrack Logistics test dispatch message');

        const normalizedDest = channel === 'EMAIL' ? destination : notificationService.normalizePhone(destination);

        const sendResult = await notificationService.sendViaChannel(
            channel,
            normalizedDest,
            contentToSend,
            'SwiftTrack Test Dispatch'
        );

        res.apiSuccess(sendResult, `Test message sent via ${channel}`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
