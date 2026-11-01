// server/repositories/idempotencyRepository.js
// Data access for durable, principal-bound idempotency keys.
//
// Records are keyed by (user_id, idempotency_key) as defined by migration 015.
// A record is either:
//   - in flight  -> response_code = 0 (a PROCESSING claim)
//   - completed  -> response_code = 2xx (replayable response)
// There is deliberately no in-memory fallback: silently degrading to per-process
// storage would break replay protection across replicas without any signal.
const dbAdapter = require('../db/dbAdapter.js');

const PROCESSING_CODE = 0;

// On PostgreSQL the columns are TIMESTAMP WITH TIME ZONE, so an explicit UTC
// offset prevents the server session timezone from shifting expiry comparisons.
const TIMESTAMP_SUFFIX = dbAdapter.isPostgres ? '+00' : '';

/**
 * Formats a JS timestamp in the 'YYYY-MM-DD HH:MM:SS' (UTC) shape that both
 * PostgreSQL and SQLite compare correctly against CURRENT_TIMESTAMP.
 */
function sqlTimestamp(offsetMs = 0) {
    return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace('T', ' ') + TIMESTAMP_SUFFIX;
}

function mapRecord(record) {
    if (!record) return null;

    let parsedBody = record.response_body;
    if (typeof parsedBody === 'string') {
        try {
            parsedBody = JSON.parse(parsedBody);
        } catch {}
    }

    const responseCode = Number(record.response_code);

    return {
        id: record.id,
        key: record.idempotency_key,
        userId: record.user_id,
        branchId: record.branch_id,
        resourceType: record.resource_type,
        requestHash: record.request_hash,
        responseCode,
        responseBody: parsedBody,
        completed: responseCode !== PROCESSING_CODE,
        createdAt: record.created_at,
        expiresAt: record.expires_at
    };
}

/**
 * Normalises a route's JSON body into valid JSON text. `res.json(value)` sends
 * `JSON.stringify(value)`, so a primitive body (e.g. a bare string) must be
 * stringified too; otherwise PostgreSQL rejects it for the JSONB column.
 * Already-serialized JSON supplied by direct repository callers is preserved.
 */
function serializeBody(body) {
    if (typeof body === 'string') {
        try {
            JSON.parse(body);
            return body;
        } catch {}
    }
    return JSON.stringify(body ?? null);
}

class IdempotencyRepository {
    constructor() {
        this.dbAdapter = dbAdapter;
    }

    /**
     * Looks up an existing unexpired idempotency record by principal and key.
     */
    async find(userId, key, tx = null) {
        const sql = `
            SELECT id, idempotency_key, user_id, branch_id, resource_type,
                   request_hash, response_code, response_body, created_at, expires_at
            FROM idempotency_keys
            WHERE user_id = ? AND idempotency_key = ? AND expires_at > ?
            LIMIT 1
        `;
        const record = await dbAdapter.get(sql, [userId, key, sqlTimestamp(0)], tx?.client);
        return mapRecord(record);
    }

    /**
     * Atomically reserves a key for this request.
     *
     * An expired record does not permanently poison the key: the upsert revives
     * it only when the existing row has already expired. A live row (completed
     * or in flight) is left untouched, so this doubles as the concurrency guard.
     *
     * @returns {Promise<boolean>} true when this caller owns the claim.
     */
    async claim(recordData, tx = null) {
        const sql = `
            INSERT INTO idempotency_keys (
                idempotency_key, user_id, branch_id, resource_type,
                request_hash, response_code, response_body, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, idempotency_key) DO UPDATE
            SET branch_id = EXCLUDED.branch_id,
                resource_type = EXCLUDED.resource_type,
                request_hash = EXCLUDED.request_hash,
                response_code = EXCLUDED.response_code,
                response_body = EXCLUDED.response_body,
                created_at = CURRENT_TIMESTAMP,
                expires_at = EXCLUDED.expires_at
            WHERE idempotency_keys.expires_at <= CURRENT_TIMESTAMP
        `;
        const result = await dbAdapter.run(sql, [
            recordData.key,
            recordData.userId,
            recordData.branchId ?? null,
            recordData.resourceType || 'MUTATION',
            recordData.requestHash,
            PROCESSING_CODE,
            '{}',
            recordData.expiresAt || sqlTimestamp(24 * 60 * 60 * 1000)
        ], tx?.client);

        return Number(result.rowCount || 0) > 0;
    }

    /**
     * Persists the final (replayable) response for a claimed key.
     */
    async complete(recordData, tx = null) {
        const bodyJson = serializeBody(recordData.responseBody);

        const sql = `
            INSERT INTO idempotency_keys (
                idempotency_key, user_id, branch_id, resource_type,
                request_hash, response_code, response_body, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, idempotency_key) DO UPDATE
            SET response_code = EXCLUDED.response_code,
                response_body = EXCLUDED.response_body,
                request_hash = EXCLUDED.request_hash,
                expires_at = EXCLUDED.expires_at
        `;
        await dbAdapter.run(sql, [
            recordData.key,
            recordData.userId,
            recordData.branchId ?? null,
            recordData.resourceType || 'MUTATION',
            recordData.requestHash,
            recordData.responseCode,
            bodyJson,
            recordData.expiresAt || sqlTimestamp(24 * 60 * 60 * 1000)
        ], tx?.client);
    }

    /**
     * Backwards-compatible alias for callers that persisted responses directly.
     */
    async save(recordData, tx = null) {
        return this.complete(recordData, tx);
    }

    /**
     * Releases an in-flight claim so a retry can execute. Never touches completed rows.
     */
    async release(userId, key, tx = null) {
        const sql = `
            DELETE FROM idempotency_keys
            WHERE user_id = ? AND idempotency_key = ? AND response_code = ?
        `;
        const result = await dbAdapter.run(sql, [userId, key, PROCESSING_CODE], tx?.client);
        return Number(result.rowCount || 0) > 0;
    }

    /**
     * Unconditionally removes a record (e.g. a legacy cached non-2xx response).
     */
    async remove(userId, key, tx = null) {
        const sql = `DELETE FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?`;
        const result = await dbAdapter.run(sql, [userId, key], tx?.client);
        return Number(result.rowCount || 0) > 0;
    }

    /**
     * Reclaims a stale in-flight record left behind by a crashed process.
     * The update rewrites created_at, so a second contender re-evaluating the
     * `created_at <= cutoff` predicate after the first commit matches 0 rows.
     */
    async takeover(recordData, tx = null) {
        const sql = `
            UPDATE idempotency_keys
            SET branch_id = ?, resource_type = ?, request_hash = ?,
                created_at = CURRENT_TIMESTAMP, expires_at = ?
            WHERE user_id = ? AND idempotency_key = ?
              AND response_code = ? AND created_at <= ?
        `;
        const result = await dbAdapter.run(sql, [
            recordData.branchId ?? null,
            recordData.resourceType || 'MUTATION',
            recordData.requestHash,
            recordData.expiresAt || sqlTimestamp(24 * 60 * 60 * 1000),
            recordData.userId,
            recordData.key,
            PROCESSING_CODE,
            recordData.staleBefore
        ], tx?.client);

        return Number(result.rowCount || 0) > 0;
    }
}

module.exports = new IdempotencyRepository();
module.exports.IdempotencyRepository = IdempotencyRepository;
module.exports.sqlTimestamp = sqlTimestamp;
module.exports.PROCESSING_CODE = PROCESSING_CODE;
