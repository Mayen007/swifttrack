// server/middleware/security.js
// Production Security Middleware: Rate Limiting, HTTP Security Headers & Origin Validation

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
 * Enterprise HTTP Security Headers (Strict modern protection against XSS, clickjacking, MIME-sniffing)
 */
function securityHeaders(req, res, next) {
    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Guard against clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Legacy XSS filter protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HSTS (enforced in production or HTTPS)
    if (process.env.NODE_ENV === 'production' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

    // Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' http://localhost:* ws://localhost:*;"
    );

    next();
}

/**
 * Configures CORS headers according to environment configuration
 */
function configureCors() {
    const cors = require('cors');
    const allowed = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:4000')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    return cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
            if (!origin) return callback(null, true);

            // Allow if explicitly listed or wildcard
            if (allowed.includes(origin) || allowed.includes('*')) {
                return callback(null, true);
            }

            // Allow any localhost/127.0.0.1 origin when localhost is configured in allowed origins
            const hasLocalhostAllowed = allowed.some(o => o.includes('localhost') || o.includes('127.0.0.1'));
            const isLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (hasLocalhostAllowed && isLocalhostOrigin) {
                return callback(null, true);
            }

            // Deny origin gracefully without throwing an uncaught exception
            callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
}

module.exports = {
    createRateLimiter,
    securityHeaders,
    configureCors
};
