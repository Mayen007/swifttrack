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

const express = require('express');
const { db, initSchema } = require('./db/database.js');
const { runSeed, initProductionBootstrap, ensureRichChartTelemetry } = require('./db/seed.js');
const { securityHeaders, configureCors, createRateLimiter } = require('./middleware/security.js');

const app = express();
const PORT = process.env.PORT || 4000;

// 2. Production Security & Body parsing middleware
app.use(securityHeaders);
app.use(configureCors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Brute-force rate limiter on authentication endpoint
const authRateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000),
    max: parseInt(process.env.RATE_LIMIT_MAX_LOGIN_ATTEMPTS) || 15,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});
app.use('/api/auth/login', authRateLimiter);

// 4. Mount API routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/branches', require('./routes/branches.js'));
app.use('/api/users', require('./routes/users.js'));
app.use('/api/products', require('./routes/products.js'));
app.use('/api/inventory', require('./routes/inventory.js'));
app.use('/api/pos', require('./routes/pos.js'));
app.use('/api/orders', require('./routes/orders.js'));
app.use('/api/dispatch', require('./routes/dispatch.js'));
app.use('/api/deliveries', require('./routes/deliveries.js'));
app.use('/api/refunds', require('./routes/refunds.js'));
app.use('/api/expenses', require('./routes/expenses.js'));
app.use('/api/reports', require('./routes/reports.js'));
app.use('/api/notifications', require('./routes/notifications.js'));
app.use('/api/audit', require('./routes/audit.js'));
app.use('/api/kenya', require('./routes/kenya.js'));

// 5. Enterprise Health & Readiness check endpoint
app.get('/api/health', (req, res) => {
    let dbConnected = false;
    try {
        const row = db.prepare('SELECT 1 as ok').get();
        dbConnected = row?.ok === 1;
    } catch {}

    res.json({
        status: dbConnected ? 'online' : 'degraded',
        database: dbConnected ? 'connected' : 'error',
        system: 'SwiftTrack Kenya Multi-Branch Logistics + POS',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        demoMode: process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

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

// Centralized Error Handler
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

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
