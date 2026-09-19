// server/middleware/idempotency.js
// Enterprise Idempotency Key Middleware for financial & critical mutation operations
const crypto = require('node:crypto');

// In-memory idempotency store with 24-hour retention
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup sweep every 15 minutes
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of idempotencyStore.entries()) {
        if (record.expiresAt <= now) {
            idempotencyStore.delete(key);
        }
    }
}, 15 * 60 * 1000);

if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Calculates SHA256 signature of request context to detect payload tampering.
 */
function computeFingerprint(req) {
    const userId = req.user ? String(req.user.id) : 'anonymous';
    const bodyStr = JSON.stringify(req.body || {});
    const target = `${req.method}:${req.baseUrl || ''}${req.path}:${userId}:${bodyStr}`;
    return crypto.createHash('sha256').update(target).digest('hex');
}

/**
 * Express middleware that enforces idempotent execution on mutating requests.
 */
function idempotencyMiddleware(options = {}) {
    return (req, res, next) => {
        const rawKey = req.headers['idempotency-key'];

        // If no idempotency key was supplied, proceed normally
        if (!rawKey) {
            return next();
        }

        const key = String(rawKey).trim();

        // Validate key format (alphanumeric, dash, underscore, 8-128 chars)
        if (key.length < 8 || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
            if (typeof res.apiError === 'function') {
                return res.apiError('Invalid Idempotency-Key header. Must be 8-128 alphanumeric characters (hyphens and underscores allowed).', 400, 'INVALID_IDEMPOTENCY_KEY');
            }
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_IDEMPOTENCY_KEY',
                    message: 'Invalid Idempotency-Key header.'
                },
                code: 'INVALID_IDEMPOTENCY_KEY',
                message: 'Invalid Idempotency-Key header.'
            });
        }

        const currentFingerprint = computeFingerprint(req);
        const existingRecord = idempotencyStore.get(key);

        if (existingRecord) {
            // 1. Concurrent in-flight request
            if (existingRecord.status === 'PROCESSING') {
                const conflictMsg = 'An identical request is currently processing. Please wait for completion before retrying.';
                if (typeof res.apiError === 'function') {
                    return res.apiError(conflictMsg, 409, 'IDEMPOTENCY_CONFLICT');
                }
                return res.status(409).json({
                    success: false,
                    error: { code: 'IDEMPOTENCY_CONFLICT', message: conflictMsg },
                    code: 'IDEMPOTENCY_CONFLICT',
                    message: conflictMsg
                });
            }

            // 2. Completed request: Verify payload fingerprint
            if (existingRecord.fingerprint !== currentFingerprint) {
                const mismatchMsg = 'Idempotency key was previously used with a different request payload or endpoint.';
                if (typeof res.apiError === 'function') {
                    return res.apiError(mismatchMsg, 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
                }
                return res.status(422).json({
                    success: false,
                    error: { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message: mismatchMsg },
                    code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
                    message: mismatchMsg
                });
            }

            // 3. Perfect match: Safe Idempotent Replay
            res.setHeader('Idempotent-Replay', 'true');
            res.setHeader('X-Idempotency-Key', key);
            res.setHeader('X-Original-Timestamp', existingRecord.createdAt);

            return res.status(existingRecord.statusCode).json(existingRecord.body);
        }

        // 4. New key: Mark as PROCESSING and hook into response completion
        const record = {
            key,
            fingerprint: currentFingerprint,
            status: 'PROCESSING',
            createdAt: new Date().toISOString(),
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
            statusCode: null,
            body: null
        };
        idempotencyStore.set(key, record);

        // Intercept res.json to capture response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Only cache successful or non-server-error responses
            if (res.statusCode < 500) {
                record.status = 'COMPLETED';
                record.statusCode = res.statusCode;
                record.body = body;
            } else {
                // Delete failed execution so client can retry with same key
                idempotencyStore.delete(key);
            }

            res.setHeader('X-Idempotency-Key', key);
            return originalJson(body);
        };

        next();
    };
}

module.exports = {
    idempotencyMiddleware,
    idempotencyStore,
    computeFingerprint
};
