// server/repositories/notificationRepository.js
// Enterprise Data Access Layer: Notification Outbox, Templates, Logs & Worker Batches

const dbAdapter = require('../db/dbAdapter.js');
const { db: sqliteDb } = require('../db/database.js');

class NotificationRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Finds outbox item by primary ID (Async).
     */
    async findOutboxById(id, tx = null) {
        return await dbAdapter.get('SELECT * FROM notification_outbox WHERE id = ?', [id], tx?.client);
    }

    /**
     * Finds outbox item by UUID (Async).
     */
    async findOutboxByUuid(uuid, tx = null) {
        return await dbAdapter.get('SELECT * FROM notification_outbox WHERE outbox_uuid = ?', [uuid], tx?.client);
    }

    /**
     * Finds template by code and channel (Async).
     */
    async findTemplate(code, channel, tx = null) {
        return await dbAdapter.get(
            'SELECT * FROM notification_templates WHERE code = ? AND channel = ? AND is_active = 1',
            [code, channel],
            tx?.client
        );
    }

    /**
     * Fetches batch of pending/retryable outbox records (Async).
     */
    async fetchPendingBatch(batchSize = 25, tx = null) {
        const sql = `
            SELECT * FROM notification_outbox
            WHERE (status = 'PENDING' OR (status = 'FAILED' AND retry_count < max_retries))
              AND datetime(next_retry_at) <= datetime('now')
            ORDER BY id ASC
            LIMIT ?
        `;
        return await dbAdapter.all(sql, [batchSize], tx?.client);
    }

    /**
     * Marks an outbox record as successfully sent (Async).
     */
    async markSent(id, tx = null) {
        const sql = `
            UPDATE notification_outbox
            SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [id], tx?.client);
    }

    /**
     * Marks an outbox record with retry failure / backoff (Async).
     */
    async markRetryFailure(id, retryCount, errorMsg, backoffSeconds, isFinal = false, tx = null) {
        const status = isFinal ? 'FAILED' : 'RETRYING';
        const sql = `
            UPDATE notification_outbox
            SET status = ?,
                retry_count = ?,
                last_error = ?,
                next_retry_at = datetime('now', '+' || ? || ' seconds'),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return await dbAdapter.run(sql, [status, retryCount, errorMsg, backoffSeconds, id], tx?.client);
    }

    /**
     * Inserts an audit log entry for a notification delivery (Async).
     */
    async logDelivery(logData, tx = null) {
        const sql = `
            INSERT INTO notification_logs (
                outbox_id, shipment_id, channel, provider, provider_message_id,
                recipient_contact, attempt_number, status, response_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const params = [
            logData.outbox_id, logData.shipment_id || null, logData.channel,
            logData.provider || 'GATEWAY', logData.provider_message_id || null,
            logData.recipient_contact, logData.attempt_number || 1,
            logData.status || 'SUCCESS',
            typeof logData.response_payload === 'string' ? logData.response_payload : JSON.stringify(logData.response_payload || {})
        ];
        return await dbAdapter.run(sql, params, tx?.client);
    }
}

module.exports = new NotificationRepository();
