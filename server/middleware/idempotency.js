// server/middleware/idempotency.js
// Enterprise Durable Idempotency Key Middleware (Section 17 Mandate)
const crypto = require('node:crypto');
const idempotencyRepository = require('../repositories/idempotencyRepository.js');

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
 * Express middleware that enforces durable idempotent execution on mutating requests.
 */
function idempotencyMiddleware(options = {}) {
    return async (req, res, next) => {
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
        const userId = req.user ? req.user.id : 1;
        const branchId = req.user ? req.user.branchId : 1;

        try {
            const existingRecord = await idempotencyRepository.find(userId, key);

            if (existingRecord) {
                // 1. Verify payload fingerprint
                if (existingRecord.requestHash !== currentFingerprint) {
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

                // 2. Safe Idempotent Replay
                res.setHeader('Idempotent-Replay', 'true');
                res.setHeader('X-Idempotency-Key', key);
                res.setHeader('X-Original-Timestamp', existingRecord.createdAt);

                return res.status(existingRecord.responseCode).json(existingRecord.responseBody);
            }

            // 3. New key: intercept res.json to capture and durably persist response
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode < 500) {
                    idempotencyRepository.save({
                        key,
                        userId,
                        branchId,
                        resourceType: req.baseUrl || req.path || 'API',
                        requestHash: currentFingerprint,
                        responseCode: res.statusCode,
                        responseBody: body
                    }).catch(err => {
                        console.error('[Idempotency Store Error]', err.message);
                    });
                }

                res.setHeader('X-Idempotency-Key', key);
                return originalJson(body);
            };

            next();
        } catch (err) {
            console.error('[Idempotency Middleware Error]', err);
            next();
        }
    };
}

module.exports = {
    idempotencyMiddleware,
    computeFingerprint
};
