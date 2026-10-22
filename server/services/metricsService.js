// server/services/metricsService.js
// SwiftTrack Logistics Platform - Production Telemetry & Prometheus Metrics Service
const dbAdapter = require('../db/dbAdapter.js');

/**
 * Collects system, database pool, notification outbox, and control tower telemetry.
 */
async function collectMetrics() {
    const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');

    // 1. System Runtime Metrics
    const memory = process.memoryUsage();
    const systemMetrics = {
        processUptimeSeconds: Math.floor(process.uptime()),
        memoryRssBytes: memory.rss,
        memoryHeapTotalBytes: memory.heapTotal,
        memoryHeapUsedBytes: memory.heapUsed,
        memoryExternalBytes: memory.external || 0,
        nodeVersion: process.version,
        platform: process.platform
    };

    // 2. Database Connection Pool Metrics
    let poolMetrics = {
        engine: isPostgres ? 'postgres' : 'sqlite',
        totalConnections: 1,
        idleConnections: 1,
        waitingRequests: 0,
        saturationRatio: 0.0
    };

    if (isPostgres) {
        try {
            const pool = require('../db/postgres/pool.js').getPool();
            const total = pool.totalCount || 0;
            const idle = pool.idleCount || 0;
            const waiting = pool.waitingCount || 0;
            const max = parseInt(process.env.PGPOOL_MAX || '20', 10);
            const active = total - idle;
            const saturation = max > 0 ? Number((active / max).toFixed(3)) : 0.0;

            poolMetrics = {
                engine: 'postgres',
                totalConnections: total,
                idleConnections: idle,
                activeConnections: active,
                waitingRequests: waiting,
                maxConnections: max,
                saturationRatio: saturation
            };
        } catch (err) {
            poolMetrics.error = err.message;
        }
    }

    // 3. Notification Outbox Queue Telemetry
    let outboxMetrics = {
        queueDepth: 0,
        sentCount: 0,
        failedCount: 0,
        retryTotalCount: 0
    };

    try {
        const outboxStats = await dbAdapter.get(`
            SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent_count,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
                COALESCE(SUM(retry_count), 0) as retry_total
            FROM notification_outbox
        `);

        if (outboxStats) {
            outboxMetrics = {
                queueDepth: Number(outboxStats.pending_count || 0),
                sentCount: Number(outboxStats.sent_count || 0),
                failedCount: Number(outboxStats.failed_count || 0),
                retryTotalCount: Number(outboxStats.retry_total || 0),
                totalProcessed: Number(outboxStats.total_count || 0)
            };
        }
    } catch {
        // Table may be empty or not yet migrated in lightweight test environments
    }

    // 4. Control Tower & Operational Exceptions Telemetry
    let exceptionMetrics = {
        activeExceptionsTotal: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
    };

    try {
        const discStats = await dbAdapter.get(`
            SELECT 
                COUNT(*) as active_count,
                COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
                COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_count,
                COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_count,
                COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_count
            FROM discrepancies
            WHERE status IN ('OPEN', 'INVESTIGATING')
        `);

        if (discStats) {
            exceptionMetrics = {
                activeExceptionsTotal: Number(discStats.active_count || 0),
                criticalCount: Number(discStats.critical_count || 0),
                highCount: Number(discStats.high_count || 0),
                mediumCount: Number(discStats.medium_count || 0),
                lowCount: Number(discStats.low_count || 0)
            };
        }
    } catch {
        // Discrepancies table fallback
    }

    // 5. Active Transport Pipeline Telemetry
    let operationalMetrics = {
        activeShipments: 0,
        activeTransportRuns: 0,
        activeDeliveries: 0
    };

    try {
        const shp = await dbAdapter.get(`
            SELECT COUNT(*) as active_count 
            FROM shipments 
            WHERE is_archived = FALSE
              AND status NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED')
        `);
        const run = await dbAdapter.get(`
            SELECT COUNT(*) as active_count 
            FROM transport_runs 
            WHERE status IN ('IN_TRANSIT', 'DISPATCHED')
        `);
        const dlv = await dbAdapter.get(`
            SELECT COUNT(*) as active_count 
            FROM deliveries 
            WHERE status IN ('ASSIGNED', 'IN_TRANSIT')
        `);

        operationalMetrics = {
            activeShipments: Number(shp?.active_count || 0),
            activeTransportRuns: Number(run?.active_count || 0),
            activeDeliveries: Number(dlv?.active_count || 0)
        };
    } catch {
        // Graceful fallback
    }

    return {
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        database: poolMetrics,
        notificationOutbox: outboxMetrics,
        controlTower: exceptionMetrics,
        operations: operationalMetrics
    };
}

/**
 * Formats collected metrics into standard Prometheus exposition format (text/plain).
 */
async function getPrometheusText() {
    const data = await collectMetrics();
    const lines = [];

    // Helper to format Prometheus metrics
    const pushMetric = (name, type, help, value, labels = '') => {
        lines.push(`# HELP ${name} ${help}`);
        lines.push(`# TYPE ${name} ${type}`);
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${name}${labelStr} ${value}`);
    };

    // System Metrics
    pushMetric('swifttrack_process_uptime_seconds', 'gauge', 'Total uptime of the application process in seconds', data.system.processUptimeSeconds);
    pushMetric('swifttrack_memory_rss_bytes', 'gauge', 'Resident set size memory allocated to the Node.js process', data.system.memoryRssBytes);
    pushMetric('swifttrack_memory_heap_used_bytes', 'gauge', 'Heap memory used by the application', data.system.memoryHeapUsedBytes);
    pushMetric('swifttrack_memory_heap_total_bytes', 'gauge', 'Total heap memory allocated by V8', data.system.memoryHeapTotalBytes);

    // Database Connection Pool
    const engineLabel = `engine="${data.database.engine}"`;
    pushMetric('swifttrack_pg_pool_total_connections', 'gauge', 'Total PostgreSQL connection pool connections established', data.database.totalConnections, engineLabel);
    pushMetric('swifttrack_pg_pool_idle_connections', 'gauge', 'Idle PostgreSQL connections in the pool', data.database.idleConnections, engineLabel);
    pushMetric('swifttrack_pg_pool_waiting_requests', 'gauge', 'Requests currently waiting for a database connection', data.database.waitingRequests, engineLabel);
    pushMetric('swifttrack_pg_pool_saturation_ratio', 'gauge', 'Ratio of active connections to maximum pool limit', data.database.saturationRatio, engineLabel);

    // Notification Outbox Queue
    pushMetric('swifttrack_outbox_queue_depth', 'gauge', 'Number of pending notification outbox items awaiting dispatch', data.notificationOutbox.queueDepth);
    pushMetric('swifttrack_outbox_failed_count', 'counter', 'Total number of notification outbox messages that permanently failed', data.notificationOutbox.failedCount);
    pushMetric('swifttrack_outbox_retry_total', 'counter', 'Total retry attempts executed across all notification dispatches', data.notificationOutbox.retryTotalCount);

    // Control Tower Exceptions
    pushMetric('swifttrack_control_tower_active_exceptions', 'gauge', 'Total open and investigating discrepancies across the logistics network', data.controlTower.activeExceptionsTotal);
    pushMetric('swifttrack_control_tower_critical_exceptions', 'gauge', 'Critical severity bottleneck exceptions requiring immediate intervention', data.controlTower.criticalCount);
    pushMetric('swifttrack_control_tower_high_exceptions', 'gauge', 'High severity bottleneck exceptions', data.controlTower.highCount);

    // Operational Pipeline Volume
    pushMetric('swifttrack_active_shipments', 'gauge', 'Count of active shipments currently in the transit pipeline', data.operations.activeShipments);
    pushMetric('swifttrack_active_transport_runs', 'gauge', 'Count of active linehaul vehicles currently on the road', data.operations.activeTransportRuns);
    pushMetric('swifttrack_active_deliveries', 'gauge', 'Count of last-mile deliveries currently out with couriers', data.operations.activeDeliveries);

    return lines.join('\n') + '\n';
}

module.exports = {
    collectMetrics,
    getPrometheusText
};
