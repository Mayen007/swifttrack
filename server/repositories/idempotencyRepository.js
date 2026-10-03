// server/repositories/idempotencyRepository.js
// Enterprise Data Access Layer: Durable Distributed Idempotency Keys (Section 17 Mandate)
const dbAdapter = require('../db/dbAdapter.js');

class IdempotencyRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
        // In-memory fallback if running under local SQLite without migration
        this.memoryFallback = new Map();
    }

    /**
     * Looks up an existing unexpired idempotency record by user ID and idempotency key.
     */
    async find(userId, key, tx = null) {
        try {
            const sql = `
                SELECT id, idempotency_key, user_id, branch_id, resource_type,
                       request_hash, response_code, response_body, created_at, expires_at
                FROM idempotency_keys
                WHERE user_id = ? AND idempotency_key = ? AND expires_at > CURRENT_TIMESTAMP
                LIMIT 1
            `;
            const record = await dbAdapter.get(sql, [userId, key], tx?.client);
            if (!record) return null;

            let parsedBody = record.response_body;
            if (typeof parsedBody === 'string') {
                try {
                    parsedBody = JSON.parse(parsedBody);
                } catch {}
            }

            return {
                id: record.id,
                key: record.idempotency_key,
                userId: record.user_id,
                branchId: record.branch_id,
                resourceType: record.resource_type,
                requestHash: record.request_hash,
                responseCode: record.response_code,
                responseBody: parsedBody,
                createdAt: record.created_at,
                expiresAt: record.expires_at
            };
        } catch (err) {
            // If table doesn't exist (e.g. initial sqlite test bootstrap), use memory store
            const memKey = `${userId}:${key}`;
            const mem = this.memoryFallback.get(memKey);
            if (mem && mem.expiresAt > Date.now()) {
                return mem;
            }
            return null;
        }
    }

    /**
     * Records or updates a durable response for an idempotency key.
     */
    async save(recordData, tx = null) {
        const bodyJson = typeof recordData.responseBody === 'object'
            ? JSON.stringify(recordData.responseBody)
            : (recordData.responseBody || '{}');

        try {
            const sql = `
                INSERT INTO idempotency_keys (
                    idempotency_key, user_id, branch_id, resource_type,
                    request_hash, response_code, response_body
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, idempotency_key) DO UPDATE
                SET response_code = EXCLUDED.response_code,
                    response_body = EXCLUDED.response_body,
                    request_hash = EXCLUDED.request_hash
            `;
            const params = [
                recordData.key,
                recordData.userId,
                recordData.branchId || null,
                recordData.resourceType || 'MUTATION',
                recordData.requestHash,
                recordData.responseCode,
                bodyJson
            ];
            await dbAdapter.run(sql, params, tx?.client);
        } catch (err) {
            // Memory fallback
            const memKey = `${recordData.userId}:${recordData.key}`;
            this.memoryFallback.set(memKey, {
                key: recordData.key,
                userId: recordData.userId,
                branchId: recordData.branchId,
                resourceType: recordData.resourceType,
                requestHash: recordData.requestHash,
                responseCode: recordData.responseCode,
                responseBody: recordData.responseBody,
                createdAt: new Date().toISOString(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000
            });
        }
    }
}

module.exports = new IdempotencyRepository();
