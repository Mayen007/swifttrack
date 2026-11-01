// server/middleware/idempotency.js
// Durable, principal-bound idempotency key middleware.
//
// Ordering guarantees:
//  - Only authenticated, mutating requests participate. The middleware resolves the
//    Bearer principal itself (then hands it to route-level auth via req.user), so it
//    can never fall back to an anonymous/`user_id = 1` namespace.
//  - Authentication failures are never cached or replayed: invalid credentials pass
//    straight through so the route's auth middleware produces the final 401/403.
//  - Only 2xx responses are persisted. Terminal client errors (401/403/422/...) are
//    released so a corrected retry can execute.
//  - A short-lived PROCESSING claim prevents concurrent duplicate execution. Claims
//    left behind by a crashed worker are taken over after `inFlightTtlMs`.
const crypto = require('node:crypto');

// Lazy defaults keep this module loadable in isolation (tests inject their own
// repository/resolver) without opening a database connection at require time.
let cachedRepository = null;
let cachedResolver = null;

function getDefaultRepository() {
    if (!cachedRepository) {
        cachedRepository = require('../repositories/idempotencyRepository.js');
    }
    return cachedRepository;
}

function getDefaultResolver() {
    if (!cachedResolver) {
        cachedResolver = require('./auth.js').resolveAuthenticatedUser;
    }
    return cachedResolver;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// NEVER replay authentication endpoints: caching a login/refresh response would
// hand the same token to whichever caller presents the key next.
const AUTH_PATH_PREFIXES = ['/api/v1/auth', '/api/auth'];

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_IN_FLIGHT_TTL_MS = 60 * 1000;

const KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Calculates a SHA-256 signature of the request context to detect payload tampering.
 * The principal and the full URL (including query string) are part of the signature,
 * so keys can never collide across users or across different query scopes.
 */
function computeFingerprint(req, principal = req.user) {
    const userId = principal ? String(principal.id) : 'anonymous';
    const url = req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`;
    const bodyStr = JSON.stringify(req.body ?? {});
    const target = `${req.method}:${url}:${userId}:${bodyStr}`;
    return crypto.createHash('sha256').update(target).digest('hex');
}

function isAuthRoute(req) {
    const url = req.originalUrl || '';
    return AUTH_PATH_PREFIXES.some(prefix =>
        url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)
    );
}

function isReplayableStatus(statusCode) {
    const code = Number(statusCode);
    return code >= 200 && code < 300;
}

function toMillis(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // SQLite returns 'YYYY-MM-DD HH:MM:SS' (UTC); normalise before parsing.
        const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
        const parsed = Date.parse(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

/**
 * Attempts to obtain the key for this request.
 * @returns {Promise<{type: 'claimed'|'replay'|'in_flight'|'mismatch', record?: object}>}
 */
async function acquireKey(repository, ctx) {
    const { userId, key, branchId, resourceType, requestHash, expiresAt, inFlightTtlMs } = ctx;

    const existing = await repository.find(userId, key);

    if (existing) {
        if (existing.requestHash !== requestHash) {
            return { type: 'mismatch' };
        }

        if (existing.completed) {
            if (isReplayableStatus(existing.responseCode)) {
                return { type: 'replay', record: existing };
            }
            // Legacy/non-2xx record (e.g. a cached 401 from an older build):
            // discard it so the corrected request can run.
            await repository.remove(userId, key);
        } else {
            const ageMs = Date.now() - toMillis(existing.createdAt);
            if (ageMs <= inFlightTtlMs) {
                return { type: 'in_flight' };
            }
            const takenOver = await repository.takeover({
                userId,
                key,
                branchId,
                resourceType,
                requestHash,
                expiresAt,
                staleBefore: repository.sqlTimestamp(-inFlightTtlMs)
            });
            return takenOver ? { type: 'claimed' } : { type: 'in_flight' };
        }
    }

    const claimed = await repository.claim({ userId, key, branchId, resourceType, requestHash, expiresAt });
    if (claimed) {
        return { type: 'claimed' };
    }

    // Lost a race against another process between find() and claim().
    const raced = await repository.find(userId, key);
    if (raced && raced.requestHash !== requestHash) {
        return { type: 'mismatch' };
    }
    if (raced && raced.completed && isReplayableStatus(raced.responseCode)) {
        return { type: 'replay', record: raced };
    }
    return { type: 'in_flight' };
}

/**
 * @param {Object} [options]
 * @param {Object} [options.repository] - Override the persistence layer (tests).
 * @param {Function} [options.resolveUser] - Override the principal resolver (tests).
 * @param {number} [options.ttlMs] - Replay record lifetime.
 * @param {number} [options.inFlightTtlMs] - Age after which a stuck claim is retaken.
 */
function createIdempotencyMiddleware(options = {}) {
    const repository = options.repository || getDefaultRepository();
    const resolveUser = options.resolveUser || getDefaultResolver();
    const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    const inFlightTtlMs = options.inFlightTtlMs || DEFAULT_IN_FLIGHT_TTL_MS;

    return async function idempotency(req, res, next) {
        // 1. Only mutating requests are idempotent; GET/HEAD must stay live.
        if (!MUTATING_METHODS.has(req.method)) {
            return next();
        }

        const rawKey = req.headers['idempotency-key'];
        if (!rawKey) {
            return next();
        }

        if (isAuthRoute(req)) {
            return next();
        }

        // 2. Never key on an anonymous principal. Public endpoints simply bypass
        //    idempotency; the route's own auth middleware still enforces access.
        if (!req.user && !req.headers['authorization']) {
            return next();
        }

        let principal = req.user;
        if (!principal) {
            try {
                principal = await resolveUser(req);
                // Reuse this resolution in route-level authenticateToken().
                req.user = principal;
            } catch {
                // Invalid/expired/revoked credentials: let route auth respond.
                // Nothing is looked up, cached, or replayed on this path.
                return next();
            }
        }

        // 3. Validate key format.
        const key = String(rawKey).trim();
        if (key.length < 8 || key.length > 128 || !KEY_PATTERN.test(key)) {
            const message = 'Invalid Idempotency-Key header. Must be 8-128 alphanumeric characters (hyphens and underscores allowed).';
            if (typeof res.apiError === 'function') {
                return res.apiError(message, 400, 'INVALID_IDEMPOTENCY_KEY');
            }
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_IDEMPOTENCY_KEY', message },
                code: 'INVALID_IDEMPOTENCY_KEY',
                message
            });
        }

        const requestHash = computeFingerprint(req, principal);
        const userId = principal.id;
        const branchId = principal.branchId ?? null;
        const resourceType = `${req.method} ${req.baseUrl || ''}${req.path || ''}`.slice(0, 50);
        const expiresAt = repository.sqlTimestamp(ttlMs);

        let decision;
        try {
            decision = await acquireKey(repository, {
                userId,
                key,
                branchId,
                resourceType,
                requestHash,
                expiresAt,
                inFlightTtlMs
            });
        } catch (err) {
            // Fail open, but loudly: a broken idempotency store must not take the
            // API down, and it must never silently pretend to be durable.
            console.error('[Idempotency] Store unavailable; proceeding without replay protection:', err.message);
            return next();
        }

        if (decision.type === 'mismatch') {
            const message = 'Idempotency key was previously used with a different request payload or endpoint.';
            if (typeof res.apiError === 'function') {
                return res.apiError(message, 422, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
            }
            return res.status(422).json({
                success: false,
                error: { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH', message },
                code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
                message
            });
        }

        if (decision.type === 'in_flight') {
            res.setHeader('Retry-After', '1');
            const message = 'An identical request is already being processed. Retry shortly.';
            if (typeof res.apiError === 'function') {
                return res.apiError(message, 409, 'IDEMPOTENCY_IN_PROGRESS');
            }
            return res.status(409).json({
                success: false,
                error: { code: 'IDEMPOTENCY_IN_PROGRESS', message },
                code: 'IDEMPOTENCY_IN_PROGRESS',
                message
            });
        }

        if (decision.type === 'replay') {
            const record = decision.record;
            res.setHeader('Idempotent-Replay', 'true');
            res.setHeader('X-Idempotency-Key', key);
            if (record.createdAt) {
                res.setHeader('X-Original-Timestamp', record.createdAt instanceof Date
                    ? record.createdAt.toISOString()
                    : String(record.createdAt));
            }
            return res.status(record.responseCode).json(record.responseBody);
        }

        // 4. Claim acquired. Persist the outcome (2xx only) or release the claim.
        let settled = false;

        const releaseClaim = async () => {
            if (settled) return;
            settled = true;
            try {
                await repository.release(userId, key);
            } catch (err) {
                console.error('[Idempotency] Failed to release in-flight key:', err.message);
            }
        };

        const originalJson = res.json.bind(res);
        res.json = async (body) => {
            const success = isReplayableStatus(res.statusCode);
            if (success) {
                // Capture the body before completing so the record is durable
                // before the client can observe the response.
                try {
                    await repository.complete({
                        key,
                        userId,
                        branchId,
                        resourceType,
                        requestHash,
                        responseCode: res.statusCode,
                        responseBody: body,
                        expiresAt
                    });
                    settled = true;
                } catch (err) {
                    console.error('[Idempotency] Failed to persist response:', err.message);
                    try { await repository.release(userId, key); } catch {}
                    settled = true;
                }
            } else {
                await releaseClaim();
            }

            res.setHeader('X-Idempotency-Key', key);
            return originalJson(body);
        };

        // Routes that end without res.json() (204, streaming, aborts) must not
        // leave an in-flight claim behind.
        const releaseIfUnsettled = () => {
            if (!settled) {
                settled = true;
                repository.release(userId, key).catch(() => {});
            }
        };
        res.once('finish', releaseIfUnsettled);
        res.once('close', releaseIfUnsettled);

        return next();
    };
}

const idempotencyMiddleware = (options) => createIdempotencyMiddleware(options);

module.exports = {
    idempotencyMiddleware,
    createIdempotencyMiddleware,
    computeFingerprint
};
