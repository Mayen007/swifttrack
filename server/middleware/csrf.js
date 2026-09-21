// server/middleware/csrf.js
// Cross-Site Request Forgery (CSRF) Defense Strategy
const { ForbiddenError } = require('../utils/response.js');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Webhook endpoints that receive external server-to-server callbacks
const EXEMPT_WEBHOOK_PATHS = [
    '/api/v1/kenya/mpesa/callback',
    '/api/kenya/mpesa/callback',
    '/api/v1/payments/callbacks/mpesa',
    '/api/payments/callbacks/mpesa'
];

/**
 * Enterprise CSRF Guard Middleware
 * Protects state-changing operations (POST, PUT, PATCH, DELETE) against cross-site request forgery.
 */
function csrfProtection(req, res, next) {
    // 1. Safe idempotent methods are exempt
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    // 2. Exempt explicit external webhook endpoints
    if (EXEMPT_WEBHOOK_PATHS.some(path => req.path.startsWith(path))) {
        return next();
    }

    // 3. Custom Header / Bearer Authorization Verification
    // Cross-origin HTML forms cannot set custom headers or Authorization: Bearer
    const authHeader = req.headers['authorization'];
    const hasBearerToken = authHeader && authHeader.startsWith('Bearer ');
    const hasCustomHeader = Boolean(
        req.headers['x-requested-with'] ||
        req.headers['x-csrf-protection'] ||
        req.headers['x-request-id'] ||
        req.headers['idempotency-key']
    );

    // 4. Origin / Referer validation when present in browser requests
    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    const host = req.headers['host'];

    if (origin) {
        try {
            const originUrl = new URL(origin);
            const isSameHost = originUrl.host === host;
            const isLocalhost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(originUrl.host);
            const isDev = process.env.NODE_ENV !== 'production';

            if (!isSameHost && !(isDev && isLocalhost)) {
                // If origin is external, ensure custom header or bearer auth is strictly provided
                if (!hasBearerToken && !hasCustomHeader) {
                    return next(new ForbiddenError('CSRF blocked: Cross-origin state mutation requires custom header or Bearer authorization.'));
                }
            }
        } catch {
            return next(new ForbiddenError('CSRF blocked: Malformed Origin header.'));
        }
    }

    // In production, reject mutating browser requests lacking both Bearer token and custom header
    if (process.env.NODE_ENV === 'production') {
        const isBrowserClient = Boolean(req.headers['user-agent'] && (origin || referer));
        if (isBrowserClient && !hasBearerToken && !hasCustomHeader) {
            return next(new ForbiddenError('CSRF Protection: Mutating requests from browser clients must include Authorization or custom X-Requested-With header.'));
        }
    }

    next();
}

module.exports = {
    csrfProtection
};
