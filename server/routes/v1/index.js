// server/routes/v1/index.js
// Master API Version 1 Router: Aggregates all resource modules under /api/v1
const express = require('express');
const router = express.Router();
const dbAdapter = require('../../db/dbAdapter.js');
const { queryParser } = require('../../middleware/query.js');

// Global query parser for all v1 endpoints (pagination, sorting, filtering)
router.use(queryParser());

// Mount Documentation routes
router.use('/docs', require('../docs.js'));
router.use('/', require('../docs.js')); // Serves /openapi.json

// 1. Two-Stage Liveness Probe (Kubernetes / Docker container ping)
router.get(['/health/live', '/live'], (req, res) => {
    res.json({
        status: 'alive',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 2. Two-Stage Readiness Probe (Verifies PostgreSQL pool, migrations & runtime state)
router.get(['/health/ready', '/ready'], async (req, res) => {
    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    let dbStatus = 'disconnected';
    let poolMetrics = null;
    let latencyMs = 0;
    let isHealthy = false;

    try {
        const start = Date.now();
        if (isPostgres) {
            const pool = require('../../db/postgres/pool.js');
            const check = await pool.poolHealthCheck();
            latencyMs = check.latencyMs || (Date.now() - start);
            isHealthy = check.connected && check.status === 'healthy';
            dbStatus = check.status;
            poolMetrics = check.pool;
        } else {
            const row = await dbAdapter.get('SELECT 1 as ok');
            latencyMs = Date.now() - start;
            isHealthy = Number(row?.ok) === 1;
            dbStatus = isHealthy ? 'healthy' : 'unhealthy';
        }
    } catch (err) {
        dbStatus = 'error: ' + err.message;
        isHealthy = false;
    }

    const payload = {
        status: isHealthy ? 'ready' : 'unready',
        database: dbStatus,
        latencyMs,
        pool: poolMetrics,
        engine: isPostgres ? 'PostgreSQL 16+' : 'SQLite Dev',
        timestamp: new Date().toISOString()
    };

    if (!isHealthy) {
        return res.status(503).json(payload);
    }
    return res.json(payload);
});

// 3. Composite Health Check (Backward compatibility)
router.get('/health', async (req, res) => {
    let dbConnected = false;
    try {
        const row = await dbAdapter.get('SELECT 1 as ok');
        dbConnected = Number(row?.ok) === 1;
    } catch {}

    const healthData = {
        status: dbConnected ? 'online' : 'degraded',
        database: dbConnected ? 'connected' : 'error',
        engine: process.env.DB_CLIENT || 'postgres',
        apiVersion: 'v1.4.0',
        system: 'SwiftTrack Kenya Multi-Branch Logistics + POS',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    };

    if (typeof res.apiSuccess === 'function') {
        return res.apiSuccess(healthData);
    }
    res.json(healthData);
});

// Mount All Resource Modules
router.use('/auth', require('../auth.js'));
router.use('/company', require('../company.js'));
router.use('/branches', require('../branches.js'));
router.use('/warehouses', require('../warehouses.js'));
router.use('/users', require('../users.js'));
router.use('/products', require('../products.js'));
router.use('/inventory', require('../inventory.js'));
router.use('/pos', require('../pos.js'));
router.use('/orders', require('../orders.js'));
router.use('/dispatch', require('../dispatch.js'));
router.use('/deliveries', require('../deliveries.js'));
router.use('/refunds', require('../refunds.js'));
router.use('/expenses', require('../expenses.js'));
router.use('/reports', require('../reports.js'));
router.use('/notifications', require('../notifications.js'));
router.use('/audit', require('../audit.js'));
router.use('/kenya', require('../kenya.js'));
router.use('/brands', require('../brands.js'));
router.use('/suppliers', require('../suppliers.js'));
router.use('/promotions', require('../promotions.js'));
router.use('/customers', require('../customers.js'));
router.use('/payments', require('../payments.js'));
router.use('/procurement', require('../procurement.js'));
router.use('/drivers', require('../drivers.js'));
router.use('/vehicles', require('../vehicles.js'));
router.use('/shipments', require('../shipments.js'));
router.use('/tracking', require('../tracking.js'));
router.use('/transport', require('../transport.js'));
router.use('/custody', require('../custody.js'));
router.use('/delivery-tasks', require('../deliveryTasks.js'));
router.use('/cod', require('../cod.js'));
router.use('/control-tower', require('../controlTower.js'));
router.use('/notifications-engine', require('../notificationsLogistics.js'));
router.use('/e2e', require('../e2eAcceptance.js'));
router.use('/offline', require('../offline.js'));
router.use('/metrics', require('../metrics.js'));

module.exports = router;
