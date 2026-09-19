// server/middleware/rateLimiter.js
// Enterprise Tiered API Rate Limiting with RFC 6585 & RFC 7231 Standard Headers

/**
 * Factory for creating a sliding-window rate limiter middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs - Window duration in milliseconds (default: 60,000ms = 1 min)
 * @param {number} options.max - Maximum allowed requests per window
 * @param {string} options.tierName - Label for the rate limiting tier
 * @param {Function} [options.keyGenerator] - Custom key generator (default: IP or req.user.id)
 */
function createTieredRateLimiter(options = {}) {
    const windowMs = options.windowMs || (60 * 1000);
    const max = options.max || 60;
    const tierName = options.tierName || 'standard';
    const message = options.message || `Rate limit exceeded for tier '${tierName}'. Please wait before retrying.`;

    // Map: key -> Array of hit timestamps [ms]
    const hitMap = new Map();

    // Periodic sweep every 2 minutes
    const sweepInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, timestamps] of hitMap.entries()) {
            const active = timestamps.filter(t => now - t < windowMs);
            if (active.length === 0) {
                hitMap.delete(key);
            } else {
                hitMap.set(key, active);
            }
        }
    }, 2 * 60 * 1000);

    if (sweepInterval.unref) sweepInterval.unref();

    return (req, res, next) => {
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            return next();
        }

        // Generate rate limit tracking key
        let key = '';
        if (options.keyGenerator) {
            key = options.keyGenerator(req);
        } else if (req.user && req.user.id) {
            key = `user:${req.user.id}:${tierName}`;
        } else {
            const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
            key = `ip:${ip}:${tierName}`;
        }

        const now = Date.now();
        const timestamps = (hitMap.get(key) || []).filter(t => now - t < windowMs);

        // Standard rate limit calculation
        const remaining = Math.max(0, max - timestamps.length - 1);
        const earliest = timestamps.length > 0 ? timestamps[0] : now;
        const resetSeconds = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));

        // RFC-compliant RateLimit headers
        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetSeconds);

        if (timestamps.length >= max) {
            const retryAfterSec = resetSeconds;
            res.setHeader('Retry-After', retryAfterSec);

            if (typeof res.apiError === 'function') {
                return res.apiError(message, 429, 'RATE_LIMIT_EXCEEDED', [{ retryAfterSeconds: retryAfterSec, tier: tierName }]);
            }

            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message,
                    details: [{ retryAfterSeconds: retryAfterSec, tier: tierName }],
                    requestId: req.id || null,
                    timestamp: new Date().toISOString()
                },
                code: 'RATE_LIMIT_EXCEEDED',
                message,
                retryAfterSeconds: retryAfterSec
            });
        }

        timestamps.push(now);
        hitMap.set(key, timestamps);
        next();
    };
}

// Pre-configured Production Tiers
const publicRateLimiter = createTieredRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    tierName: 'public',
    message: 'Public rate limit exceeded (60 req/min). Please slow down requests.'
});

const authenticatedRateLimiter = createTieredRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    tierName: 'authenticated',
    message: 'Operator API rate limit exceeded (300 req/min).'
});

const mutationRateLimiter = createTieredRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    tierName: 'mutation',
    message: 'Transaction mutation rate limit exceeded (30 req/min). Please pace financial operations.'
});

module.exports = {
    createTieredRateLimiter,
    publicRateLimiter,
    authenticatedRateLimiter,
    mutationRateLimiter
};
