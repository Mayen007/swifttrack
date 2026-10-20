// tests/system/test-metrics-endpoint.js
// SwiftTrack Logistics Platform - Track 6: Prometheus Metrics & Telemetry Test Suite
const assert = require('node:assert');
const metricsService = require('../../server/services/metricsService.js');
const metricsRouter = require('../../server/routes/metrics.js');

let passedTests = 0;
let totalTests = 0;

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

async function main() {
    console.log('\n=================================================================');
    console.log('SwiftTrack Test Suite: Prometheus Metrics & System Telemetry (Track 6)');
    console.log('=================================================================\n');

    // Test 1: Metric data collection schema
    await runAsyncTest('collectMetrics collects system, database, outbox, and control tower metrics', async () => {
        const data = await metricsService.collectMetrics();

        assert.ok(data.timestamp, 'Must include timestamp');
        assert.ok(data.system, 'Must include system metrics');
        assert.ok(typeof data.system.processUptimeSeconds === 'number', 'Uptime must be a number');
        assert.ok(typeof data.system.memoryRssBytes === 'number', 'RSS memory must be a number');

        assert.ok(data.database, 'Must include database metrics');
        assert.ok(typeof data.database.totalConnections === 'number', 'Database totalConnections must be numeric');
        assert.ok(typeof data.database.saturationRatio === 'number', 'Database saturationRatio must be numeric');

        assert.ok(data.notificationOutbox, 'Must include notification outbox metrics');
        assert.ok(typeof data.notificationOutbox.queueDepth === 'number', 'Outbox queue depth must be numeric');
        assert.ok(typeof data.notificationOutbox.retryTotalCount === 'number', 'Outbox retry count must be numeric');

        assert.ok(data.controlTower, 'Must include control tower metrics');
        assert.ok(typeof data.controlTower.activeExceptionsTotal === 'number', 'Active exceptions must be numeric');
        assert.ok(typeof data.controlTower.criticalCount === 'number', 'Critical count must be numeric');
    });

    // Test 2: Prometheus exposition text generation
    await runAsyncTest('getPrometheusText generates valid Prometheus text exposition syntax', async () => {
        const text = await metricsService.getPrometheusText();

        assert.ok(typeof text === 'string' && text.length > 0, 'Prometheus exposition output must be non-empty string');
        assert.ok(text.includes('# HELP swifttrack_process_uptime_seconds'), 'Must document uptime metric');
        assert.ok(text.includes('# TYPE swifttrack_process_uptime_seconds gauge'), 'Must specify metric type');
        assert.ok(text.includes('swifttrack_pg_pool_total_connections'), 'Must include pg pool total metric');
        assert.ok(text.includes('swifttrack_pg_pool_idle_connections'), 'Must include pg pool idle metric');
        assert.ok(text.includes('swifttrack_pg_pool_waiting_requests'), 'Must include pg pool waiting metric');
        assert.ok(text.includes('swifttrack_outbox_queue_depth'), 'Must include outbox queue depth metric');
        assert.ok(text.includes('swifttrack_control_tower_active_exceptions'), 'Must include control tower exceptions metric');
    });

    // Test 3: Metrics router handler for Prometheus text
    await runAsyncTest('metrics router returns Prometheus text/plain when requested', async () => {
        let sentData = null;
        let setHeaderKey = null;
        let setHeaderVal = null;

        const req = {
            query: {},
            accepts: (types) => 'text/plain'
        };
        const res = {
            setHeader: (k, v) => { setHeaderKey = k; setHeaderVal = v; },
            send: (data) => { sentData = data; }
        };

        // Find the GET / handler on the router stack
        const routeLayer = metricsRouter.stack.find(l => l.route && l.route.methods.get);
        assert.ok(routeLayer, 'Must have a GET route mounted');

        await routeLayer.route.stack[0].handle(req, res, (err) => {
            if (err) throw err;
        });

        assert.ok(sentData && typeof sentData === 'string', 'Router must send text output');
        assert.ok(setHeaderVal.includes('text/plain'), 'Content-Type must be text/plain');
        assert.ok(sentData.includes('swifttrack_pg_pool_total_connections'), 'Payload must include metrics');
    });

    // Test 4: Metrics router handler for JSON format
    await runAsyncTest('metrics router returns structured JSON when format=json is queried', async () => {
        let jsonPayload = null;

        const req = {
            query: { format: 'json' },
            accepts: () => 'application/json'
        };
        const res = {
            json: (payload) => { jsonPayload = payload; }
        };

        const routeLayer = metricsRouter.stack.find(l => l.route && l.route.methods.get);
        await routeLayer.route.stack[0].handle(req, res, (err) => {
            if (err) throw err;
        });

        assert.ok(jsonPayload && typeof jsonPayload === 'object', 'Router must return object');
        assert.ok(jsonPayload.system && jsonPayload.database && jsonPayload.notificationOutbox, 'JSON must contain metric sections');
    });

    console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);
    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

main();
