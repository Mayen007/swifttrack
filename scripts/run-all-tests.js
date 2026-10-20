// scripts/run-all-tests.js
// SwiftTrack Enterprise Unified Test Runner (Section 45 & CI Mandate)
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const process = require('node:process');

const ROOT_DIR = path.resolve(__dirname, '..');

const TEST_SUITES = [
    // 1. Architectural Guardrails & Security
    { file: 'scripts/verify-architecture-rules.js', domain: 'Architecture', name: 'Architecture Rules Lint' },
    { file: 'scripts/audit-secrets.js', domain: 'Security', name: 'Secrets Leak Audit' },
    { file: 'tests/security/test-sql-injection.js', domain: 'Security', name: 'SQL Injection Guards' },
    { file: 'tests/security/test-csrf-cors.js', domain: 'Security', name: 'CSRF & CORS Isolation' },
    { file: 'tests/security/test-xss.js', domain: 'Security', name: 'XSS Sanitization' },

    // 2. Database & Data Architecture
    { file: 'tests/database/test-postgres-data-architecture.js', domain: 'Database', name: 'PostgreSQL Architecture' },

    // 3. Core System & API Documentation Parity
    { file: 'tests/verify-system.js', domain: 'Core System', name: 'System Core Verification' },
    { file: 'tests/docs/test-api-doc-parity.js', domain: 'API Docs', name: 'OpenAPI Documentation Parity' },

    // 4. Inventory & Warehousing
    { file: 'tests/inventory/test-inventory-states.js', domain: 'Inventory', name: 'Multi-State Inventory Engine' },
    { file: 'tests/inventory/test-inventory-operations.js', domain: 'Inventory', name: 'Stock Movement Operations' },
    { file: 'tests/inventory/test-advanced-inventory.js', domain: 'Inventory', name: 'Batch & Expiry Valuation' },

    // 5. Point of Sale (POS)
    { file: 'tests/pos/test-complete-pos-workflow.js', domain: 'POS', name: 'POS Shift & Till Management' },
    { file: 'tests/logistics/test-pos-counter-booking.js', domain: 'POS', name: 'POS Parcel Counter Booking' },

    // 6. Orders Engine
    { file: 'tests/orders/test-orders-engine.js', domain: 'Orders', name: 'Order State Machine & Allocation' },

    // 7. Commercial Catalog & Customers
    { file: 'tests/commerce/test-catalog-variants.js', domain: 'Commerce', name: 'Product Catalog Variants' },
    { file: 'tests/commerce/test-pricing-engine.js', domain: 'Commerce', name: 'Tiered Pricing Engine' },
    { file: 'tests/customers/test-customer-management.js', domain: 'Customers', name: 'Customer Accounts & Credit' },

    // 8. Procurement Lifecycle
    { file: 'tests/procurement/test-procurement-lifecycle.js', domain: 'Procurement', name: 'Procurement & Purchase Orders' },

    // 9. Financial Reporting & Intelligence
    { file: 'tests/reports/test-reports-engine.js', domain: 'Reports', name: 'Reporting & Analytics Engine' },

    // 10. Payments & Billing
    { file: 'tests/payments/test-payments-engine.js', domain: 'Payments', name: 'Payments Ledger & M-Pesa' },
    { file: 'tests/logistics/test-daraja-gateway.js', domain: 'Payments', name: 'Safaricom Daraja 2.0 Gateway' },

    // 11. Logistics & Transport Runs
    { file: 'tests/logistics/test-shipments-core.js', domain: 'Logistics', name: 'Shipments Lifecycle & Waybills' },
    { file: 'tests/logistics/test-transport-runs.js', domain: 'Logistics', name: 'Linehaul Transport Runs' },
    { file: 'tests/logistics/test-physical-custody.js', domain: 'Logistics', name: 'Chain of Custody Handover' },
    { file: 'tests/logistics/test-last-mile-delivery.js', domain: 'Logistics', name: 'Last-Mile Delivery & ePOD' },
    { file: 'tests/logistics/test-cod-settlement.js', domain: 'Logistics', name: 'COD Cash Collection & Escrow' },
    { file: 'tests/logistics/test-control-tower.js', domain: 'Logistics', name: 'Operations Control Tower' },
    { file: 'tests/logistics/test-notifications-engine.js', domain: 'Logistics', name: 'Outbox Notification Dispatcher' },
    { file: 'tests/logistics/test-notifications-gateway.js', domain: 'Logistics', name: 'Africa\'s Talking & Twilio Gateway' },
    { file: 'tests/logistics/test-multi-leg-and-customs.js', domain: 'Logistics', name: 'Cross-Border Multi-Leg Transit' },
    { file: 'tests/logistics/test-customs-manifest.js', domain: 'Logistics', name: 'EAC Customs ASYCUDA Manifest' },
    { file: 'tests/logistics/test-offline-sync.js', domain: 'Logistics', name: 'Offline PWA Sync Engine' },
    { file: 'tests/logistics/test-client-offline-queue.js', domain: 'Logistics', name: 'Client Offline Queue & Auto-Replay' },

    // 12. Fleet Management
    { file: 'tests/logistics/test-vehicles-management.js', domain: 'Fleet', name: 'Fleet Vehicles & Telematic Health' },
    { file: 'tests/logistics/test-drivers-management.js', domain: 'Fleet', name: 'Driver Rostering & Compliance' },

    // 13. Frontend Static Architecture & Navigation Integrity
    { file: 'tests/pos/test-frontend-pos.js', domain: 'Frontend Integrity', name: 'Frontend POS Component Integrity' },
    { file: 'tests/orders/test-frontend-orders.js', domain: 'Frontend Integrity', name: 'Frontend Orders Integrity' },
    { file: 'tests/payments/test-frontend-payments.js', domain: 'Frontend Integrity', name: 'Frontend Payments Integrity' },
    { file: 'tests/procurement/test-frontend-procurement.js', domain: 'Frontend Integrity', name: 'Frontend Procurement Integrity' },
    { file: 'tests/logistics/test-frontend-drivers.js', domain: 'Frontend Integrity', name: 'Frontend Drivers Integrity' },
    { file: 'tests/logistics/test-frontend-vehicles.js', domain: 'Frontend Integrity', name: 'Frontend Vehicles Integrity' },

    // 14. Disaster Recovery & System Observability (Track 6)
    { file: 'tests/database/test-backup-restore.js', domain: 'Disaster Recovery', name: 'Database Backup & Restore Drill' },
    { file: 'tests/system/test-metrics-endpoint.js', domain: 'Telemetry & Observability', name: 'Prometheus Metrics & Health' },

    // 15. Full End-to-End Acceptance Scenario
    { file: 'tests/logistics/test-e2e-acceptance.js', domain: 'E2E Acceptance', name: 'Master End-to-End Workflow' }
];

async function main() {
    const args = process.argv.slice(2);
    const domainFilter = args.find(a => a.startsWith('--domain='))?.split('=')[1]?.toLowerCase();
    const suiteFilter = args.find(a => a.startsWith('--filter='))?.split('=')[1]?.toLowerCase();

    let suitesToRun = TEST_SUITES;

    if (domainFilter) {
        suitesToRun = suitesToRun.filter(s => s.domain.toLowerCase().includes(domainFilter));
    }
    if (suiteFilter) {
        suitesToRun = suitesToRun.filter(s => s.file.toLowerCase().includes(suiteFilter) || s.name.toLowerCase().includes(suiteFilter));
    }

    console.log('\n================================================================================');
    console.log('  SWIFTTRACK ENTERPRISE COMPREHENSIVE TEST RUNNER');
    console.log(`  Suites Scheduled: ${suitesToRun.length} of ${TEST_SUITES.length}`);
    console.log('================================================================================\n');

    const results = [];
    const globalStartTime = Date.now();

    for (let i = 0; i < suitesToRun.length; i++) {
        const suite = suitesToRun[i];
        const suitePath = path.resolve(ROOT_DIR, suite.file);
        const progressTag = `[${i + 1}/${suitesToRun.length}]`;

        console.log(`\n>>> ${progressTag} RUNNING: ${suite.name} (${suite.domain})`);
        console.log(`    Target: ${suite.file}`);
        console.log('--------------------------------------------------------------------------------');

        const startTime = Date.now();
        const proc = spawnSync(process.execPath, [suitePath], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || 'test'
            }
        });
        const durationMs = Date.now() - startTime;
        const passed = proc.status === 0;

        results.push({
            name: suite.name,
            file: suite.file,
            domain: suite.domain,
            passed,
            durationMs,
            exitCode: proc.status
        });

        if (passed) {
            console.log(`--- [PASS] ${suite.name} completed successfully (${(durationMs / 1000).toFixed(2)}s) ---`);
        } else {
            console.error(`--- [FAIL] ${suite.name} exited with code ${proc.status} (${(durationMs / 1000).toFixed(2)}s) ---`);
            if (args.includes('--bail')) {
                console.error('\n[BAIL] Terminating runner early due to test failure (--bail flag).');
                break;
            }
        }
    }

    const totalDurationSec = ((Date.now() - globalStartTime) / 1000).toFixed(2);
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    console.log('\n================================================================================');
    console.log('  SWIFTTRACK ENTERPRISE TEST RUNNER: SUMMARY REPORT');
    console.log('================================================================================');
    console.log(
        'Suite'.padEnd(38) +
        'Domain'.padEnd(18) +
        'Status'.padEnd(10) +
        'Duration'
    );
    console.log('-'.repeat(80));

    for (const r of results) {
        const statusStr = r.passed ? 'PASS' : `FAIL (${r.exitCode})`;
        const timeStr = `${(r.durationMs / 1000).toFixed(2)}s`;
        console.log(
            r.name.slice(0, 36).padEnd(38) +
            r.domain.slice(0, 16).padEnd(18) +
            statusStr.padEnd(10) +
            timeStr
        );
    }

    console.log('================================================================================');
    console.log(`TOTAL SUITES: ${results.length}`);
    console.log(`PASSED:       ${passedCount}`);
    console.log(`FAILED:       ${failedCount}`);
    console.log(`TOTAL TIME:   ${totalDurationSec}s`);
    console.log('================================================================================\n');

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main().catch(err => {
    console.error('[Fatal Error in Test Runner]:', err);
    process.exit(1);
});
