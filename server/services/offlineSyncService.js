// server/services/offlineSyncService.js
// SwiftTrack Logistics: Generalized Durable Offline Operations Gateway (PRD Section 21)
const dbAdapter = require('../db/dbAdapter.js');
const custodyService = require('./custodyService.js');
const deliveryExecutionService = require('./deliveryExecutionService.js');
const { logAuditEvent } = require('../middleware/audit.js');

/**
 * Supported offline operation types
 */
const OFFLINE_OPERATION_TYPES = {
    SCAN: 'SCAN',
    CUSTODY_HANDOFF: 'CUSTODY_HANDOFF',
    HUB_RECEIVE: 'HUB_RECEIVE',
    DELIVERY_ATTEMPT: 'DELIVERY_ATTEMPT',
    DELIVERY_POD: 'DELIVERY_POD',
    DRIVER_LOCATION: 'DRIVER_LOCATION'
};

/**
 * Ingests and safely reconciles a batch of offline field operations with replay deduplication
 * @param {Object} batchData - { device_id, app_version, operations: Array }
 * @param {Object} user - Authenticated operator
 */
async function processOfflineSyncBatch(batchData, user = {}) {
    const { device_id, app_version, operations } = batchData;

    if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error('operations array is required and must contain at least one operation');
    }

    const results = [];
    let processedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const op of operations) {
        const { operation_id, operation_type, payload, client_timestamp } = op;

        if (!operation_id) {
            results.push({
                operation_id: null,
                status: 'REJECTED',
                error: 'operation_id is mandatory for idempotent synchronization'
            });
            errorCount++;
            continue;
        }

        // 1. Check for Replay / Idempotency
        const existing = await dbAdapter.get('SELECT id, status, result_payload FROM offline_sync_logs WHERE client_operation_id = ?', [operation_id]);
        if (existing) {
            duplicateCount++;
            let parsedResult = null;
            try {
                parsedResult = JSON.parse(existing.result_payload || '{}');
            } catch {}
            results.push({
                operation_id,
                status: 'DUPLICATE',
                message: 'Operation already processed (idempotent acknowledgement)',
                server_id: existing.id,
                result: parsedResult
            });
            continue;
        }

        // 2. Execute within isolated safe boundary
        try {
            let opResult = null;
            const normalizedType = String(operation_type || '').toUpperCase();

            switch (normalizedType) {
                case OFFLINE_OPERATION_TYPES.SCAN: {
                    opResult = await custodyService.recordScanEvent({
                        ...payload,
                        device_id: device_id || payload.device_id,
                        app_version: app_version || payload.app_version,
                        client_transaction_key: operation_id,
                        is_offline_sync: true,
                        scanned_at: client_timestamp || payload.scanned_at || new Date().toISOString()
                    }, user);
                    break;
                }

                case OFFLINE_OPERATION_TYPES.CUSTODY_HANDOFF: {
                    opResult = await custodyService.recordHandoff({
                        ...payload,
                        is_offline_sync: true
                    }, user);
                    break;
                }

                case OFFLINE_OPERATION_TYPES.HUB_RECEIVE: {
                    opResult = await custodyService.scanReceivingItem(
                        payload.session_id,
                        {
                            ...payload,
                            is_offline_sync: true
                        },
                        user
                    );
                    break;
                }

                case OFFLINE_OPERATION_TYPES.DELIVERY_ATTEMPT: {
                    opResult = await deliveryExecutionService.recordDeliveryAttempt(
                        payload.delivery_id,
                        {
                            ...payload,
                            is_offline_sync: true,
                            attempted_at: client_timestamp || new Date().toISOString()
                        },
                        user
                    );
                    break;
                }

                case OFFLINE_OPERATION_TYPES.DELIVERY_POD: {
                    opResult = await deliveryExecutionService.completeDeliveryWithPOD(
                        payload.delivery_id,
                        {
                            ...payload,
                            is_offline_sync: true,
                            actual_delivery_at: client_timestamp || new Date().toISOString()
                        },
                        user
                    );
                    break;
                }

                case OFFLINE_OPERATION_TYPES.DRIVER_LOCATION: {
                    if (user.id) {
                        const driver = await dbAdapter.get('SELECT id FROM drivers WHERE user_id = ?', [user.id]);
                        if (driver && payload.latitude !== undefined && payload.longitude !== undefined) {
                            await dbAdapter.run(`
                                UPDATE drivers SET
                                    current_latitude = ?,
                                    current_longitude = ?,
                                    last_ping_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [payload.latitude, payload.longitude, driver.id]);
                            opResult = { driver_id: driver.id, updated: true };
                        }
                    }
                    break;
                }

                default:
                    throw new Error(`Unsupported offline operation type: '${operation_type}'`);
            }

            // Record successful synchronization in log
            await dbAdapter.run(`
                INSERT INTO offline_sync_logs (
                    client_operation_id, operation_type, device_id, app_version,
                    user_id, client_timestamp, status, result_payload, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                operation_id,
                normalizedType,
                device_id || null,
                app_version || null,
                user.id || null,
                client_timestamp || null,
                'PROCESSED',
                JSON.stringify(opResult || {}),
                null
            ]);

            results.push({
                operation_id,
                status: 'ACKNOWLEDGED',
                operation_type: normalizedType,
                result: opResult
            });
            processedCount++;

        } catch (err) {
            console.error(`Offline sync failure for op ${operation_id}:`, err.message);

            // Record failed sync attempt
            try {
                await dbAdapter.run(`
                    INSERT INTO offline_sync_logs (
                        client_operation_id, operation_type, device_id, app_version,
                        user_id, client_timestamp, status, result_payload, error_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    operation_id,
                    operation_type || 'UNKNOWN',
                    device_id || null,
                    app_version || null,
                    user.id || null,
                    client_timestamp || null,
                    'FAILED',
                    null,
                    err.message
                ]);
            } catch {}

            results.push({
                operation_id,
                status: 'FAILED',
                error: err.message
            });
            errorCount++;
        }
    }

    // Log overall sync event
    logAuditEvent({
        userId: user.id || 1,
        role: user.roleName || 'STAFF',
        action: 'SYNC',
        resource: 'OFFLINE_GATEWAY',
        resourceId: device_id || 'UNKNOWN_DEVICE',
        branchId: user.branchId || null,
        newValue: {
            total: operations.length,
            processed: processedCount,
            duplicates: duplicateCount,
            errors: errorCount
        },
        reason: 'Offline durable batch synchronization'
    });

    return {
        device_id,
        total_operations: operations.length,
        processed_count: processedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        synced_at: new Date().toISOString(),
        operations: results
    };
}

/**
 * Returns offline sync statistics for device or platform
 */
async function getOfflineSyncStats(deviceId = null) {
    let sql = `
        SELECT operation_type, status, COUNT(*) as total_count
        FROM offline_sync_logs
    `;
    const params = [];
    if (deviceId) {
        sql += ` WHERE device_id = ?`;
        params.push(deviceId);
    }
    sql += ` GROUP BY operation_type, status`;
    const rows = await dbAdapter.all(sql, params);

    const recentLogs = await dbAdapter.all(`
        SELECT id, client_operation_id, operation_type, device_id, status, error_message, synced_at
        FROM offline_sync_logs
        ORDER BY id DESC
        LIMIT 20
    `);

    return {
        stats: rows.map(r => ({ ...r, total_count: Number(r.total_count) })),
        recent: recentLogs
    };
}

module.exports = {
    OFFLINE_OPERATION_TYPES,
    processOfflineSyncBatch,
    getOfflineSyncStats
};
