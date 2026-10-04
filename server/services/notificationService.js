// server/services/notificationService.js
// SwiftTrack Logistics — Stage 9: Automated Milestone Notifications & Communications Dispatch Engine
// PRD Section 7.13 & Section 14 (NTF-001..004): Outbox Pattern, Multi-Channel Delivery, Exponential Backoff

const crypto = require('crypto');
const dbAdapter = require('../db/dbAdapter.js');
const { logAuditEvent } = require('../middleware/audit.js');

class NotificationService {
    constructor() {
        this.simulationFailureMode = false; // Flag for test error injection
    }

    /**
     * Normalize Kenyan phone numbers into international E.164 format (+254...)
     */
    normalizePhone(phone) {
        if (!phone) return null;
        let str = String(phone).trim();
        // Extract digits only to prevent duplicate or misplaced pluses
        const digits = str.replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('254')) {
            return '+' + digits;
        }
        if (digits.startsWith('07') || digits.startsWith('01')) {
            return '+254' + digits.substring(1);
        }
        if (digits.startsWith('7') || digits.startsWith('1')) {
            return '+254' + digits;
        }
        return '+' + digits;
    }

    /**
     * Interpolates {{variable}} tokens within message text
     */
    interpolate(templateText, tokens = {}) {
        if (!templateText) return '';
        return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
            return tokens[key] !== undefined && tokens[key] !== null ? String(tokens[key]) : '';
        });
    }

    /**
     * Retrieve all notification templates
     */
    async getTemplates() {
        return await dbAdapter.all('SELECT * FROM notification_templates ORDER BY id ASC');
    }

    /**
     * Retrieve template by code
     */
    async getTemplateByCode(code) {
        return await dbAdapter.get('SELECT * FROM notification_templates WHERE code = ?', [code]);
    }

    /**
     * Update an existing notification template
     */
    async updateTemplate(code, data, user) {
        const existing = await this.getTemplateByCode(code);
        if (!existing) {
            throw new Error(`Template with code '${code}' not found.`);
        }

        const name = data.name !== undefined ? data.name : existing.name;
        const smsTemplate = data.sms_template !== undefined ? data.sms_template : existing.sms_template;
        const whatsappTemplate = data.whatsapp_template !== undefined ? data.whatsapp_template : existing.whatsapp_template;
        const emailSubject = data.email_subject !== undefined ? data.email_subject : existing.email_subject;
        const emailTemplate = data.email_template !== undefined ? data.email_template : existing.email_template;
        let channels = data.channels !== undefined ? data.channels : existing.channels;
        if (typeof channels !== 'string') {
            channels = JSON.stringify(channels || ['SMS', 'WHATSAPP', 'EMAIL']);
        }
        const isActive = data.is_active !== undefined ? (data.is_active ? true : false) : (existing.is_active ? true : false);

        await dbAdapter.run(`
            UPDATE notification_templates
            SET name = ?, sms_template = ?, whatsapp_template = ?, email_subject = ?, email_template = ?, channels = ?::jsonb, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE code = ?
        `, [name, smsTemplate, whatsappTemplate, emailSubject, emailTemplate, channels, isActive, code]);

        logAuditEvent({
            userId: user?.id,
            role: user?.roleName || 'STAFF',
            action: 'UPDATE',
            resource: 'NOTIFICATION_TEMPLATE',
            resourceId: String(existing.id),
            reason: `Updated communication template ${code}`
        });

        return await this.getTemplateByCode(code);
    }

    /**
     * Queue Milestone Notification (Non-blocking Outbox Pattern - Rule NTF-002)
     * Automatically extracts relevant parties and enqueues to notification_outbox.
     * Guaranteed to never throw errors that would break parent shipment operations.
     */
    async queueMilestoneNotification(eventType, context = {}) {
        try {
            const shipment = context.shipment || {};
            const delivery = context.delivery || {};
            const run = context.run || {};
            const discrepancy = context.discrepancy || {};

            // Map eventType to standard template code
            let templateCode = 'BOOKED_CONFIRMATION';
            if (eventType === 'BOOKED') templateCode = 'BOOKED_CONFIRMATION';
            else if (eventType === 'ACCEPTED') templateCode = 'ACCEPTED_AT_HUB';
            else if (eventType === 'DISPATCHED') templateCode = 'DISPATCHED_IN_TRANSIT';
            else if (eventType === 'OUT_FOR_DELIVERY') templateCode = 'OUT_FOR_DELIVERY';
            else if (eventType === 'DELIVERED') templateCode = 'DELIVERED_POD';
            else if (eventType === 'DELIVERY_FAILED') templateCode = 'DELIVERY_FAILED';
            else if (eventType === 'EXCEPTION') templateCode = 'OPERATIONAL_EXCEPTION';

            const template = await this.getTemplateByCode(templateCode);
            if (!template || !template.is_active) {
                return [];
            }

            let enabledChannels = ['SMS', 'WHATSAPP'];
            if (Array.isArray(template.channels)) {
                enabledChannels = template.channels;
            } else if (typeof template.channels === 'string') {
                try {
                    enabledChannels = JSON.parse(template.channels);
                } catch (e) {
                    enabledChannels = ['SMS', 'WHATSAPP'];
                }
            }

            // Consolidate dynamic tokens
            const trackingNumber = shipment.tracking_number || context.tracking_number || 'STK-UNKNOWN';
            const trackingUrl = `https://swifttrack.co.ke/track/${trackingNumber}`;
            const recipientName = shipment.recipient_name || delivery.recipient_name || context.recipient_name || 'Valued Customer';
            const recipientPhone = this.normalizePhone(shipment.recipient_phone || delivery.recipient_phone || context.recipient_phone);
            const recipientEmail = shipment.recipient_email || delivery.recipient_email || context.recipient_email;

            const senderName = shipment.sender_name || context.sender_name || 'Sender';
            const senderPhone = this.normalizePhone(shipment.sender_phone || context.sender_phone);
            const senderEmail = shipment.sender_email || context.sender_email;

            const originCity = shipment.origin_city || run.origin_city || 'Origin Station';
            const destCity = shipment.dest_city || run.dest_city || 'Destination';
            const originHubName = shipment.origin_hub_name || run.origin_hub_code || 'Central Hub';
            const driverName = delivery.driver_name || run.driver_name || context.driver_name || 'SwiftTrack Courier';
            const driverPhone = delivery.driver_phone || run.driver_phone || context.driver_phone || '+254700000000';
            const otpCode = context.otp_code || delivery.pod_otp || '123456';
            const reason = context.reason || delivery.failure_reason || discrepancy.discrepancy_type || 'Operational clearance';
            const eta = context.eta || 'Today 5:00 PM';

            const tokens = {
                tracking_number: trackingNumber,
                tracking_url: trackingUrl,
                recipient_name: recipientName,
                sender_name: senderName,
                origin_city: originCity,
                dest_city: destCity,
                origin_hub_name: originHubName,
                driver_name: driverName,
                driver_phone: driverPhone,
                otp_code: otpCode,
                reason: reason,
                eta: eta
            };

            const queuedOutbox = [];

            // Helper to insert an outbox item
            const insertOutbox = async (recipientType, contactName, phone, email) => {
                for (const ch of enabledChannels) {
                    let contact = ch === 'EMAIL' ? email : phone;
                    if (!contact) continue; // Skip if contact information for this channel is not available

                    let renderedContent = '';
                    let subject = null;

                    if (ch === 'SMS') {
                        renderedContent = this.interpolate(template.sms_template, tokens);
                    } else if (ch === 'WHATSAPP') {
                        renderedContent = this.interpolate(template.whatsapp_template, tokens);
                    } else if (ch === 'EMAIL') {
                        renderedContent = this.interpolate(template.email_template || template.sms_template, tokens);
                        subject = this.interpolate(template.email_subject || 'SwiftTrack Shipment Update', tokens);
                    }

                    const uuid = `NTF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

                    const info = await dbAdapter.query(`
                        INSERT INTO notification_outbox (
                            outbox_uuid, shipment_id, delivery_id, recipient_type, recipient_name,
                            recipient_phone, recipient_email, channel, event_type, template_code,
                            subject, rendered_content, payload, status, retry_count, max_retries,
                            next_retry_at, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?,
                            ?, ?, ?, 'PENDING', 0, 3,
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                    `, [
                        uuid,
                        shipment.id || context.shipment_id || null,
                        delivery.id || context.delivery_id || null,
                        recipientType,
                        contactName,
                        phone || null,
                        email || null,
                        ch,
                        eventType,
                        templateCode,
                        subject,
                        renderedContent,
                        JSON.stringify(tokens)
                    ]);

                    queuedOutbox.push({
                        id: info.insertId,
                        uuid,
                        channel: ch,
                        recipient_type: recipientType,
                        contact
                    });
                }
            };

            // 1. Enqueue for Recipient
            if (recipientPhone || recipientEmail) {
                await insertOutbox('RECIPIENT', recipientName, recipientPhone, recipientEmail);
            }

            // 2. Enqueue for Sender on key milestones (BOOKED, DELIVERED, EXCEPTION)
            if (['BOOKED', 'DELIVERED', 'EXCEPTION'].includes(eventType) && (senderPhone || senderEmail)) {
                await insertOutbox('SENDER', senderName, senderPhone, senderEmail);
            }

            return queuedOutbox;
        } catch (err) {
            // Rule NTF-002: Notification processing must never crash the shipment mutation
            console.warn('[NotificationService] Enqueue warning (non-blocking):', err.message);
            return [];
        }
    }

    /**
     * Dispatch an item via its specific channel gateway
     */
    async sendViaChannel(channel, recipientContact, renderedContent, subject, metadata = {}) {
        // Test Simulation Error Hook
        if (this.simulationFailureMode || metadata.simulateFailure) {
            throw new Error(`Simulated Gateway Failure on ${channel} provider (Network timeout)`);
        }

        const contact = String(recipientContact).trim();

        if (channel === 'SMS') {
            // Simulated / Africa's Talking / Safaricom SMS Gateway
            if (!contact.startsWith('+')) {
                throw new Error(`Invalid SMS phone number ${contact}. Must be in E.164 format (+254...).`);
            }
            const msgId = `AT-SMS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
            return {
                provider: 'AFRICAS_TALKING_SMS',
                messageId: msgId,
                status: 'DELIVERED_TO_TELCO',
                credits: 1.0,
                cost: '0.80 KES'
            };
        } else if (channel === 'WHATSAPP') {
            // Simulated Twilio / Meta WhatsApp Business Cloud API
            const msgId = `WA-MSG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
            return {
                provider: 'TWILIO_WHATSAPP',
                messageId: msgId,
                status: 'SENT_TO_META',
                meta_conversation_id: `CONV-${crypto.randomBytes(4).toString('hex')}`
            };
        } else if (channel === 'EMAIL') {
            // Simulated SMTP / SendGrid Transactional Mailer
            if (!contact.includes('@')) {
                throw new Error(`Invalid email address: ${contact}`);
            }
            const msgId = `EMAIL-${crypto.randomBytes(6).toString('hex').toUpperCase()}@swifttrack.co.ke`;
            return {
                provider: 'SWIFTTRACK_SMTP',
                messageId: msgId,
                status: 'ACCEPTED_BY_RELAY'
            };
        } else {
            throw new Error(`Unsupported communication channel: '${channel}'`);
        }
    }

    /**
     * Process a batch of pending/retryable outbox records (Outbox Worker Execution)
     */
    async processOutboxBatch(batchSize = 25) {
        // Query pending or eligible failed records
        const pendingItems = await dbAdapter.all(`
            SELECT * FROM notification_outbox
            WHERE (status = 'PENDING' OR (status = 'FAILED' AND retry_count < max_retries))
              AND next_retry_at <= CURRENT_TIMESTAMP
            ORDER BY id ASC
            LIMIT ?
        `, [batchSize]);

        const results = {
            total_selected: pendingItems.length,
            processed_count: pendingItems.length,
            success_count: 0,
            failed_count: 0,
            details: []
        };

        for (const item of pendingItems) {
            const attemptNumber = (item.retry_count || 0) + 1;
            const contact = item.channel === 'EMAIL' ? item.recipient_email : item.recipient_phone;

            try {
                // Parse metadata payload if present
                let payload = {};
                try {
                    payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
                } catch (e) {
                    payload = {};
                }

                // Check for simulation override in payload
                if (payload._simulateFailure) {
                    throw new Error(payload._simulateFailureReason || 'Simulated provider error for retry test');
                }

                // Dispatch via gateway adapter
                const sendResult = await this.sendViaChannel(
                    item.channel,
                    contact,
                    item.rendered_content,
                    item.subject,
                    payload
                );

                // Mark outbox row as SENT
                await dbAdapter.run(`
                    UPDATE notification_outbox
                    SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [item.id]);

                // Log audit delivery entry (Rule NTF-004)
                await dbAdapter.run(`
                    INSERT INTO notification_logs (
                        outbox_id, shipment_id, channel, provider, provider_message_id,
                        recipient_contact, attempt_number, status, response_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, CURRENT_TIMESTAMP)
                `, [
                    item.id,
                    item.shipment_id,
                    item.channel,
                    sendResult.provider || 'GATEWAY',
                    sendResult.messageId || null,
                    contact,
                    attemptNumber,
                    JSON.stringify(sendResult)
                ]);

                results.success_count++;
                results.details.push({ id: item.id, status: 'SENT', messageId: sendResult.messageId });
            } catch (err) {
                const nextRetryCount = (item.retry_count || 0) + 1;
                const isFinalFailure = nextRetryCount >= item.max_retries;

                // Exponential backoff strategy:
                // Attempt 1: +30s
                // Attempt 2: +120s (2m)
                // Attempt 3+: +600s (10m)
                const backoffSeconds = nextRetryCount === 1 ? 30 : (nextRetryCount === 2 ? 120 : 600);
                const nextRetryDate = new Date(Date.now() + backoffSeconds * 1000).toISOString();

                await dbAdapter.run(`
                    UPDATE notification_outbox
                    SET status = 'FAILED',
                        retry_count = ?,
                        last_error = ?,
                        next_retry_at = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    nextRetryCount,
                    err.message,
                    nextRetryDate,
                    item.id
                ]);

                // Log failed attempt audit
                await dbAdapter.run(`
                    INSERT INTO notification_logs (
                        outbox_id, shipment_id, channel, provider, provider_message_id,
                        recipient_contact, attempt_number, status, error_message, created_at
                    ) VALUES (?, ?, ?, 'GATEWAY', NULL, ?, ?, 'FAILED', ?, CURRENT_TIMESTAMP)
                `, [
                    item.id,
                    item.shipment_id,
                    item.channel,
                    contact || 'N/A',
                    attemptNumber,
                    err.message
                ]);

                results.failed_count++;
                results.details.push({
                    id: item.id,
                    status: 'FAILED',
                    error: err.message,
                    retry_count: nextRetryCount,
                    is_final: isFinalFailure
                });
            }
        }

        return results;
    }

    /**
     * Manual Trigger / Operator Resend (Rule NTF-003)
     */
    async resendOutboxItem(outboxId, user) {
        const item = await dbAdapter.get('SELECT * FROM notification_outbox WHERE id = ?', [outboxId]);
        if (!item) {
            throw new Error(`Notification outbox item with ID ${outboxId} not found.`);
        }

        const retryDate = new Date(Date.now() - 60000).toISOString();

        // Reset outbox item for immediate reprocessing
        await dbAdapter.run(`
            UPDATE notification_outbox
            SET status = 'PENDING',
                next_retry_at = ?,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [retryDate, outboxId]);

        logAuditEvent({
            userId: user?.id,
            role: user?.roleName || 'STAFF',
            action: 'RESEND',
            resource: 'NOTIFICATION_OUTBOX',
            resourceId: String(outboxId),
            reason: `Operator requested immediate resend for outbox ${item.outbox_uuid} (${item.channel})`
        });

        // Trigger immediate processing for this item
        return await this.processOutboxBatch(1);
    }

    /**
     * Outbox Queue Telemetry & Communication Delivery Rates (PRD Section 7.13 / Control Tower)
     */
    async getNotificationStats() {
        const totalRow = await dbAdapter.get('SELECT count(*) as count FROM notification_outbox');
        const pendingRow = await dbAdapter.get("SELECT count(*) as count FROM notification_outbox WHERE status = 'PENDING'");
        const sentRow = await dbAdapter.get("SELECT count(*) as count FROM notification_outbox WHERE status = 'SENT'");
        const failedRow = await dbAdapter.get("SELECT count(*) as count FROM notification_outbox WHERE status = 'FAILED' AND retry_count >= max_retries");

        const total = Number(totalRow?.count || 0);
        const pending = Number(pendingRow?.count || 0);
        const sent = Number(sentRow?.count || 0);
        const failed = Number(failedRow?.count || 0);

        const channels = await dbAdapter.all(`
            SELECT channel,
                   count(*) as total,
                   sum(case when status = 'SENT' then 1 else 0 end) as sent,
                   sum(case when status = 'FAILED' AND retry_count >= max_retries then 1 else 0 end) as failed
            FROM notification_outbox
            GROUP BY channel
        `);

        const recentLogs = await dbAdapter.all(`
            SELECT l.*, o.outbox_uuid, o.event_type, o.template_code
            FROM notification_logs l
            JOIN notification_outbox o ON l.outbox_id = o.id
            ORDER BY l.id DESC
            LIMIT 15
        `);

        const deliveryRatePct = (sent + failed) > 0 ? Math.round((sent / (sent + failed)) * 100) : 100;

        return {
            total_notifications: total,
            pending_count: pending,
            sent_count: sent,
            failed_count: failed,
            delivery_rate_pct: deliveryRatePct,
            channels: channels.map(c => {
                const cSent = Number(c.sent || 0);
                const cFailed = Number(c.failed || 0);
                return {
                    channel: c.channel,
                    total: Number(c.total || 0),
                    sent: cSent,
                    failed: cFailed,
                    rate_pct: (cSent + cFailed) > 0 ? Math.round((cSent / (cSent + cFailed)) * 100) : 100
                };
            }),
            recent_logs: recentLogs
        };
    }

    /**
     * Query outbox items with filters and pagination
     */
    async getOutbox(query = {}) {
        let sql = `
            SELECT o.*, s.tracking_number, s.status as shipment_status
            FROM notification_outbox o
            LEFT JOIN shipments s ON o.shipment_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (query.status) {
            sql += ' AND o.status = ?';
            params.push(query.status);
        }
        if (query.channel) {
            sql += ' AND o.channel = ?';
            params.push(query.channel);
        }
        if (query.event_type) {
            sql += ' AND o.event_type = ?';
            params.push(query.event_type);
        }
        if (query.shipment_id) {
            sql += ' AND o.shipment_id = ?';
            params.push(query.shipment_id);
        }
        if (query.search) {
            sql += ` AND (o.recipient_name LIKE ? OR o.recipient_phone LIKE ? OR o.recipient_email LIKE ? OR o.outbox_uuid LIKE ? OR s.tracking_number LIKE ?)`;
            const q = `%${query.search}%`;
            params.push(q, q, q, q, q);
        }

        sql += ' ORDER BY o.id DESC LIMIT ? OFFSET ?';
        params.push(Number(query.limit || 50));
        params.push(Number(query.offset || 0));

        return await dbAdapter.all(sql, params);
    }
}

module.exports = new NotificationService();
