// tests/reports/test-reports-engine.js
// SwiftTrack Kenya: Phase 8 Reports & Analytics Engine Integration Suite
const assert = require('assert');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const dbAdapter = require('../../server/db/dbAdapter.js');
const { getJwtSecret } = require('../../server/utils/env.js');
const reportsRouter = require('../../server/routes/reports.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK KENYA: REPORTS & ANALYTICS ENGINE TEST SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err);
        process.exitCode = 1;
    }
}

let server;
let baseUrl;

function createToken(userId, roleName, branchId) {
    const secret = getJwtSecret();
    return jwt.sign({
        id: userId,
        role: roleName,
        roleName: roleName,
        branch_id: branchId,
        branchId: branchId,
        token_version: 0
    }, secret, { expiresIn: '1h' });
}

async function makeRequest(path, user) {
    const token = createToken(user.id, user.roleName, user.branchId);
    const res = await fetch(`${baseUrl}${path}`, {
        headers: {
            authorization: `Bearer ${token}`
        }
    });
    const body = await res.json();
    return { status: res.status, body };
}

async function runSuite() {
    const app = express();
    app.use(express.json());
    app.use('/api/reports', reportsRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    try {
        // TEST 1: Super Admin Dashboard Metrics
        await runTest('1. Super Admin Dashboard Metrics: Aggregates revenue, today sales, inventory values and branch breakdowns', async () => {
            const res = await makeRequest('/api/reports/dashboard', { id: 1, roleName: 'SUPER_ADMIN', role: 'SUPER_ADMIN', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.role, 'SUPER_ADMIN');
            assert.ok(typeof res.body.metrics.total_revenue === 'number');
            assert.ok(typeof res.body.metrics.inventory_cost_value === 'number');
            assert.ok(Array.isArray(res.body.sales_by_branch));
            assert.ok(Array.isArray(res.body.top_products));
        });

        // TEST 2: Branch Manager Dashboard Metrics
        await runTest('2. Branch Manager Dashboard: Scoped strictly to branch with cashier & driver performance', async () => {
            const res = await makeRequest('/api/reports/dashboard', { id: 2, roleName: 'BRANCH_MANAGER', role: 'BRANCH_MANAGER', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.role, 'BRANCH_MANAGER');
            assert.strictEqual(res.body.branch_id, 1);
            assert.ok(typeof res.body.metrics.total_revenue === 'number');
            assert.ok(Array.isArray(res.body.cashier_performance));
            assert.ok(Array.isArray(res.body.driver_performance));
            assert.ok(typeof res.body.pending_approvals.refunds === 'number');
        });

        // TEST 3: Cashier Shift Dashboard
        await runTest('3. Cashier Dashboard: Computes shift totals and cash drawer breakdown', async () => {
            const res = await makeRequest('/api/reports/dashboard', { id: 4, roleName: 'CASHIER', role: 'CASHIER', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.role, 'CASHIER');
            assert.ok(typeof res.body.shift.sales_count === 'number');
            assert.ok(typeof res.body.shift.cash_total === 'number');
            assert.ok(typeof res.body.shift.mpesa_total === 'number');
        });

        // TEST 4: Driver Dashboard
        await runTest('4. Driver Dashboard: Returns active count and delivery milestones', async () => {
            const res = await makeRequest('/api/reports/dashboard', { id: 5, roleName: 'DRIVER', role: 'DRIVER', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.role, 'DRIVER');
            assert.ok(typeof res.body.driver_stats.active_count === 'number');
            assert.ok(typeof res.body.driver_stats.all_time_deliveries === 'number');
        });

        // TEST 5: Comprehensive Dashboard Charts (All 10 Visual Graph Series)
        await runTest('5. Dashboard Visual Charts: Generates 14-day uninterrupted trends, COD stats, and delivery reasons', async () => {
            const res = await makeRequest('/api/reports/dashboard-charts?days=14', { id: 1, roleName: 'SUPER_ADMIN', role: 'SUPER_ADMIN', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.range_days, 14);
            assert.strictEqual(res.body.daily_orders_trend.length, 14);
            assert.strictEqual(res.body.revenue_trend.length, 14);
            assert.ok(Array.isArray(res.body.order_status));
            assert.ok(Array.isArray(res.body.branch_performance));
            assert.ok(Array.isArray(res.body.driver_performance));
            assert.ok(Array.isArray(res.body.delivery_results));
            assert.ok(Array.isArray(res.body.most_shipped_products));
            assert.ok(Array.isArray(res.body.pending_products));
            assert.ok(typeof res.body.cod_summary.totalVolume === 'number');
            assert.ok(Array.isArray(res.body.failed_delivery_reasons));
        });

        // TEST 6: KRA 16% VAT Report
        await runTest('6. KRA 16% VAT Compliance Report: Calculates taxable turnover and output VAT', async () => {
            const res = await makeRequest('/api/reports/vat', { id: 1, roleName: 'SUPER_ADMIN', role: 'SUPER_ADMIN', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.vat_rate_percent, 16.0);
            assert.strictEqual(res.body.currency, 'KES');
            assert.ok(typeof res.body.summary.gross_sales === 'number');
            assert.ok(typeof res.body.summary.vat_collected === 'number');
            assert.ok(Array.isArray(res.body.monthly_trend));
            assert.ok(Array.isArray(res.body.branch_breakdown));
        });

        // TEST 7: Profit & Loss Statement (PnL)
        await runTest('7. Profit & Loss (PnL) Statement: Computes gross profit, COGS, operating expenses, and net margin', async () => {
            const res = await makeRequest('/api/reports/pnl', { id: 1, roleName: 'SUPER_ADMIN', role: 'SUPER_ADMIN', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.currency, 'KES');
            assert.ok(typeof res.body.gross_revenue === 'number');
            assert.ok(typeof res.body.cogs === 'number');
            assert.ok(typeof res.body.gross_profit === 'number');
            assert.ok(typeof res.body.total_operating_expenses === 'number');
            assert.ok(typeof res.body.net_income === 'number');
            assert.ok(Array.isArray(res.body.expense_breakdown));
        });

        // TEST 8: Payment Methods Breakdown
        await runTest('8. Payment Methods Analysis: Groups sales tenders across M-Pesa, Cash, Card', async () => {
            const res = await makeRequest('/api/reports/payments', { id: 1, roleName: 'SUPER_ADMIN', role: 'SUPER_ADMIN', branchId: 1 });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
            if (res.body.length > 0) {
                assert.ok(typeof res.body[0].total_amount === 'number');
                assert.ok(typeof res.body[0].transaction_count === 'number');
            }
        });

        console.log('\n============================================================');
        console.log(`  REPORTS SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
        console.log('============================================================\n');
    } finally {
        server.close();
    }
}

runSuite().catch(err => {
    console.error('Fatal suite failure:', err);
    if (server) server.close();
    process.exit(1);
});
