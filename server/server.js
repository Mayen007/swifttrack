// server/server.js
const fs = require('node:fs');
const path = require('node:path');

// 1. Load production or local .env configuration safely
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
        process.loadEnvFile(envPath);
    } catch (e) {
        console.warn('Could not load .env file:', e.message);
    }
}

const { validateStartupEnv } = require('./utils/env.js');

// Validate critical secrets and production safeguards
validateStartupEnv();

const express = require('express');
const { db, initSchema } = require('./db/database.js');
const { runSeed, initProductionBootstrap, ensureRichChartTelemetry } = require('./db/seed.js');
const { securityHeaders, configureCors, createRateLimiter } = require('./middleware/security.js');

const { requestIdMiddleware } = require('./middleware/requestId.js');
const { responseEnhancer, centralErrorHandler, NotFoundError } = require('./utils/response.js');
const { idempotencyMiddleware } = require('./middleware/idempotency.js');
const v1Router = require('./routes/v1/index.js');

const { tieredBodyParser, tieredUrlEncodedParser } = require('./middleware/bodyLimits.js');
const { csrfProtection } = require('./middleware/csrf.js');

const app = express();
const PORT = process.env.PORT || 4000;

// 1. Request ID & correlation tracking (runs first on every request)
app.use(requestIdMiddleware);

// 2. Response envelope enhancer (adds res.apiSuccess and res.apiError)
app.use(responseEnhancer);

// 3. Production Security, CORS & Tiered Body Parsing middleware
app.use(securityHeaders);
app.use(configureCors());
app.use(tieredBodyParser);
app.use(tieredUrlEncodedParser);
app.use(csrfProtection);

// 4. Idempotency Key interceptor for mutating requests
app.use(idempotencyMiddleware());

// 5. Brute-force rate limiter on authentication endpoint
const authRateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000),
    max: parseInt(process.env.RATE_LIMIT_MAX_LOGIN_ATTEMPTS) || 15,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});
app.use(['/api/v1/auth/login', '/api/auth/login'], authRateLimiter);

// 6. Mount API routes: primary versioned /api/v1 and legacy alias /api
app.use('/api/v1', v1Router);
app.use('/api', v1Router);

// Serve frontend static assets (serves compiled Vite React + Tailwind bundle)
const distPath = path.resolve(__dirname, '../client/dist');
const clientPath = fs.existsSync(distPath) ? distPath : path.resolve(__dirname, '../client');
app.use(express.static(clientPath));

// SPA fallback to index.html for non-API GET requests
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(clientPath, 'index.html'));
    }
    next();
});

// Unmatched API routes 404 handler
app.use('/api', (req, res, next) => {
    next(new NotFoundError(`API endpoint '${req.method} ${req.originalUrl}' was not found.`));
});

// Centralized Error Handler
app.use(centralErrorHandler);

// Ensure DB schema & seed are initialized
try {
    initSchema();
    const company = db.prepare('SELECT count(*) as count FROM company_settings').get();
    const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
    if (company.count === 0) {
        if (isDemoMode) {
            console.log('Seeding initial system data with demo simulation...');
            runSeed();
        } else {
            console.log('Initializing clean enterprise production database bootstrap...');
            initProductionBootstrap();
        }
    } else if (isDemoMode) {
        ensureRichChartTelemetry();
    }
} catch (e) {
    console.error('Database startup warning:', e.message);
}

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`========================================================`);
        console.log(`🚀 SwiftTrack Logistics + POS Server Running on Port ${PORT}`);
        console.log(`👉 http://localhost:${PORT}`);
        console.log(`   Mode: ${process.env.DEMO_MODE === 'true' ? 'SANDBOX / EVALUATION' : 'ENTERPRISE PRODUCTION'}`);
        console.log(`========================================================`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use by another process!`);
        } else {
            console.error('❌ Server error:', err);
        }
        process.exit(1);
    });

    // Graceful process termination
    const gracefulShutdown = (signal) => {
        console.log(`\nReceived ${signal}. Shutting down cleanly...`);
        server.close(() => {
            console.log('HTTP connection pool drained.');
            try {
                db.close();
                console.log('Database handle closed.');
            } catch {}
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
