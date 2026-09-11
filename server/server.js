// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, initSchema } = require('./db/database.js');
const { runSeed, ensureRichChartTelemetry } = require('./db/seed.js');

const app = express();
const PORT = process.env.PORT || 4000;

// Security & Body parsing middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Mount API routes
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        system: 'SwiftTrack Kenya Multi-Branch Logistics + POS',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend static assets (serves compiled Vite React + Tailwind bundle)
const fs = require('node:fs');
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
    if (company.count === 0) {
        console.log('Seeding initial system data...');
        runSeed();
    } else {
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
}

module.exports = app;
