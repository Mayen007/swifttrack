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
const { securityHeaders, configureCors, createRateLimiter } = require('./middleware/security.js');

const { requestIdMiddleware } = require('./middleware/requestId.js');
const { responseEnhancer, centralErrorHandler, NotFoundError } = require('./utils/response.js');
const { idempotencyMiddleware } = require('./middleware/idempotency.js');
const v1Router = require('./routes/v1/index.js');

const { tieredBodyParser, tieredUrlEncodedParser } = require('./middleware/bodyLimits.js');
const { csrfProtection } = require('./middleware/csrf.js');
const { startNotificationWorker, stopNotificationWorker } = require('./workers/notificationWorker.js');

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

// Unified Database Initialization
async function initializeDatabaseRuntime() {
    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    const isProd = process.env.NODE_ENV === 'production';

    if (isPostgres) {
        console.log('[Startup] Verifying PostgreSQL connection pool...');
        const pool = require('./db/postgres/pool.js');
        const migrator = require('./db/postgres/migrator.js');
        const seed = require('./db/postgres/seed.js');
        const dbAdapter = require('./db/dbAdapter.js');

        // 1. Verify connectivity (Fail-fast)
        const health = await pool.poolHealthCheck();
        if (!health.connected || health.status !== 'healthy') {
            console.error('[Startup Error] FATAL: Could not connect to PostgreSQL database:', health.error);
            process.exit(1);
        }
        console.log(`[Startup] Connected to PostgreSQL (${health.database}) in ${health.latencyMs}ms.`);

        // 2. Verify / run migrations automatically
        console.log('[Startup] Verifying schema migrations...');
        await migrator.migrateUp();

        // 3. Check if company settings exist, seed baseline if empty
        const company = await dbAdapter.get('SELECT COUNT(*) as count FROM company_settings');
        const count = company ? Number(company.count) : 0;
        if (count === 0) {
            console.log('[Startup] Fresh database detected. Seeding baseline foundation data...');
            await seed.seedProductionBaseline();
        }
    } else {
        if (isProd) {
            console.error('[Startup Error] FATAL: SQLite is strictly forbidden in production!');
            process.exit(1);
        }
        console.log('[Startup] Initializing SQLite local development engine...');
        const sqlite = require('./db/database.js');
        const { runSeed, initProductionBootstrap, ensureRichChartTelemetry } = require('./db/seed.js');
        sqlite.initSchema();
        const company = sqlite.db.prepare('SELECT count(*) as count FROM company_settings').get();
        const isDemoMode = process.env.DEMO_MODE === 'true';
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
    }
}

let serverInstance = null;

async function startServer() {
    try {
        await initializeDatabaseRuntime();

        serverInstance = app.listen(PORT, () => {
            console.log(`========================================================`);
            console.log(`[START] SwiftTrack Logistics + POS Server Running on Port ${PORT}`);
            console.log(`[URL] http://localhost:${PORT}`);
            console.log(`   Engine: ${process.env.DB_CLIENT === 'postgres' ? 'PostgreSQL 16+ (Authoritative)' : 'SQLite (Dev/Demo Only)'}`);
            console.log(`   Mode: ${process.env.DEMO_MODE === 'true' ? 'SANDBOX / EVALUATION' : 'ENTERPRISE PRODUCTION'}`);
            console.log(`========================================================`);
            startNotificationWorker();
        });

        serverInstance.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[ERROR] Port ${PORT} is already in use by another process!`);
            } else {
                console.error('[ERROR] Server error:', err);
            }
            process.exit(1);
        });

        // Graceful process termination
        const gracefulShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Shutting down cleanly...`);
            stopNotificationWorker();
            if (serverInstance) {
                serverInstance.close(async () => {
                    console.log('HTTP connection pool drained.');
                    try {
                        const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
                        if (isPostgres) {
                            const pool = require('./db/postgres/pool.js');
                            await pool.closePool();
                            console.log('PostgreSQL connection pool closed.');
                        } else {
                            const sqlite = require('./db/database.js');
                            sqlite.db.close();
                            console.log('SQLite database handle closed.');
                        }
                    } catch {}
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return serverInstance;
    } catch (err) {
        console.error('[FATAL STARTUP ERROR]', err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.initializeDatabaseRuntime = initializeDatabaseRuntime;
