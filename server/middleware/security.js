// server/middleware/security.js
// Production Security Middleware: Rate Limiting, Strict CSP, HTTP Security Headers & Origin Validation
const crypto = require('node:crypto');

/**
 * Creates an in-memory sliding-window rate limiter per client IP
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 mins)
 * @param {number} options.max - Maximum requests allowed per window (default: 15)
 * @param {string} options.message - Error message when limit is exceeded
 */
function createRateLimiter(options = {}) {
    const windowMs = options.windowMs || (15 * 60 * 1000);
    const max = options.max || 15;
    const message = options.message || 'Too many attempts from this IP address. Please wait before trying again.';

    // Map: IP -> Array of timestamps
    const ipHits = new Map();

    // Auto cleanup sweep every 5 minutes
    const sweepInterval = setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of ipHits.entries()) {
            const active = timestamps.filter(t => now - t < windowMs);
            if (active.length === 0) {
                ipHits.delete(ip);
            } else {
                ipHits.set(ip, active);
            }
        }
    }, 5 * 60 * 1000);

    if (sweepInterval.unref) sweepInterval.unref();

    return (req, res, next) => {
        // Skip rate limiting for unit tests or internal loopback if disabled
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            return next();
        }

        const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
        const now = Date.now();

        const timestamps = (ipHits.get(ip) || []).filter(t => now - t < windowMs);

        if (timestamps.length >= max) {
            const earliest = timestamps[0];
            const retryAfterSec = Math.ceil((earliest + windowMs - now) / 1000);
            res.setHeader('Retry-After', Math.max(1, retryAfterSec));
            return res.status(429).json({
                error: message,
                retryAfterSeconds: Math.max(1, retryAfterSec)
            });
        }

        timestamps.push(now);
        ipHits.set(ip, timestamps);
        next();
    };
}

/**
 * Enterprise HTTP Security Headers
 * Enforces Strict CSP Level 3 (NO unsafe-eval, NO unsafe-inline script-src via cryptographic nonces)
 */
function securityHeaders(req, res, next) {
    // Generate unique per-request cryptographic nonce
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;
    req.cspNonce = nonce;

    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Guard against clickjacking (frame-ancestors handles modern browsers, X-Frame-Options handles legacy)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Legacy XSS filter protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HSTS (enforced in production or HTTPS)
    if (process.env.NODE_ENV === 'production' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Modern Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=(self)');

    // Strict Content Security Policy (Level 3)
    const isProd = process.env.NODE_ENV === 'production';
    const connectSrc = isProd
        ? "'self'"
        : "'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*";

    const cspDirectives = [
        "default-src 'self'",
        // Strictly allow scripts from 'self' and scripts matching the per-request cryptographic nonce.
        // Unsafe-eval and unsafe-inline are strictly eliminated.
        `script-src 'self' 'nonce-${nonce}'`,
        // Styles allow 'self', Google Fonts, and unsafe-inline for dynamic CSS variables/Tailwind runtime
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        `connect-src ${connectSrc}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        isProd ? "upgrade-insecure-requests" : ""
    ].filter(Boolean).join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);

    next();
}

/**
 * Configures CORS headers with strict production boundaries
 * Rejects wildcards, non-HTTPS schemes, and localhost when in production.
 */
function configureCors() {
    const cors = require('cors');
    const isProd = process.env.NODE_ENV === 'production';

    const rawAllowed = (process.env.CORS_ORIGINS || (isProd ? 'https://app.swifttrack.co.ke,https://swifttrack.co.ke' : 'http://localhost:5173,http://localhost:5174,http://localhost:4000'))
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    // In production, strictly reject wildcard '*' or insecure http localhost
    const allowed = rawAllowed.filter(origin => {
        if (!isProd) return true;
        if (origin === '*') {
            console.error('❌ SECURITY WARNING: Wildcard CORS origin (*) is rejected in production!');
            return false;
        }
        if (/^http:\/\/(localhost|127\.0\.0\.1)/i.test(origin)) {
            console.error(`❌ SECURITY WARNING: Localhost origin (${origin}) is rejected in production mode!`);
            return false;
        }
        return true;
    });

    return cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile applications, curl, native apps, server-to-server)
            if (!origin) return callback(null, true);

            // In production, reject wildcard origin attempts outright
            if (isProd) {
                if (allowed.includes(origin)) {
                    return callback(null, true);
                }
                const err = new Error(`CORS blocked: Origin '${origin}' is not authorized in production.`);
                err.status = 403;
                err.statusCode = 403;
                err.code = 'CORS_FORBIDDEN';
                return callback(err);
            }

            // Development / Test mode: allow listed or wildcard or localhost
            if (allowed.includes(origin) || allowed.includes('*')) {
                return callback(null, true);
            }

            const hasLocalhostAllowed = allowed.some(o => o.includes('localhost') || o.includes('127.0.0.1'));
            const isLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (hasLocalhostAllowed && isLocalhostOrigin) {
                return callback(null, true);
            }

            // Reject unapproved origin
            const err = new Error(`CORS blocked: Origin '${origin}' is not authorized.`);
            err.status = 403;
            err.statusCode = 403;
            err.code = 'CORS_FORBIDDEN';
            callback(err);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-Request-ID',
            'Idempotency-Key',
            'X-CSRF-Protection'
        ],
        exposedHeaders: [
            'X-Request-ID',
            'Idempotency-Key',
            'Idempotent-Replay',
            'RateLimit-Limit',
            'RateLimit-Remaining',
            'RateLimit-Reset',
            'Retry-After'
        ]
    });
}

module.exports = {
    createRateLimiter,
    securityHeaders,
    configureCors
};
