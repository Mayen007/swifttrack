// tests/frontend/test-ui-contracts.js
// SwiftTrack Logistics Platform - Frontend Architecture & UI Contract Verification Suite
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

console.log('\n=================================================================');
console.log('SwiftTrack Test Suite: Frontend Architecture & UI Contract Verification');
console.log('=================================================================\n');

const clientSrc = path.resolve(__dirname, '../../client/src');
const appJsx = fs.readFileSync(path.join(clientSrc, 'App.jsx'), 'utf8');
const driversView = fs.readFileSync(path.join(clientSrc, 'views/DriversView.jsx'), 'utf8');
const vehiclesView = fs.readFileSync(path.join(clientSrc, 'views/VehiclesView.jsx'), 'utf8');
const driverDetailModal = fs.readFileSync(path.join(clientSrc, 'components/drivers/DriverDetailModal.jsx'), 'utf8');
const editDriverModal = fs.readFileSync(path.join(clientSrc, 'components/drivers/EditDriverModal.jsx'), 'utf8');
const offlineStatus = fs.readFileSync(path.join(clientSrc, 'components/common/OfflineSyncStatus.jsx'), 'utf8');
const systemTour = fs.readFileSync(path.join(clientSrc, 'components/SystemTour.jsx'), 'utf8');
const navbar = fs.readFileSync(path.join(clientSrc, 'components/Navbar.jsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(clientSrc, 'components/Sidebar.jsx'), 'utf8');
const dashboardView = fs.readFileSync(path.join(clientSrc, 'views/DashboardView.jsx'), 'utf8');
const dashboardHeader = fs.readFileSync(path.join(clientSrc, 'components/dashboard/CommercialBentoHeader.jsx'), 'utf8');
const controlTower = fs.readFileSync(path.join(clientSrc, 'components/dashboard/OperationsControlTower.jsx'), 'utf8');
const hubOperations = fs.readFileSync(path.join(clientSrc, 'views/HubOperationsView.jsx'), 'utf8');
const inboundReceiving = fs.readFileSync(path.join(clientSrc, 'components/hub/InboundReceivingTab.jsx'), 'utf8');
const e2eAcceptanceRoute = fs.readFileSync(path.resolve(__dirname, '../../server/routes/e2eAcceptance.js'), 'utf8');
const shipmentsView = fs.readFileSync(path.join(clientSrc, 'views/ShipmentsView.jsx'), 'utf8');

// Test 1: Route-level code-splitting & lazy chunk loading
runTest('App.jsx implements React.lazy dynamic chunk loading for views', () => {
    assert.ok(appJsx.includes('React.lazy('), 'App.jsx must use React.lazy for code splitting');
    assert.ok(appJsx.includes('Suspense'), 'App.jsx must wrap routes in React.Suspense');
    assert.ok(appJsx.includes('ViewSkeleton'), 'Suspense fallback must render ViewSkeleton');
    assert.ok(appJsx.includes('ErrorBoundary'), 'Routes must be guarded by ErrorBoundary');
});

// Test 2: Dieter Rams / Matte Obsidian Design System Tokens
runTest('App.jsx and main container use Matte Obsidian dark palette', () => {
    assert.ok(appJsx.includes('bg-[#0c0e12]'), 'App root must use Matte Obsidian base background (#0c0e12)');
    assert.ok(appJsx.includes('text-slate-200'), 'App root must use refined slate text');
});

// Test 3: Driver Modal Stacking & Z-Index Hierarchy (Bug Fix Verification)
runTest('EditDriverModal uses z-[60] to prevent being hidden beneath DriverDetailModal', () => {
    assert.ok(editDriverModal.includes('z-[60]'), 'EditDriverModal overlay must specify z-[60]');
});

// Test 4: Driver Date Formatting (Human-Readable display)
runTest('DriverDetailModal formats dates via en-KE locale to prevent raw ISO leakage', () => {
    assert.ok(driverDetailModal.includes('formatDate'), 'DriverDetailModal must implement formatDate utility');
    assert.ok(driverDetailModal.includes("toLocaleDateString('en-KE'"), 'formatDate must format with en-KE locale');
    assert.ok(driverDetailModal.includes('formatDate(selectedDriver.license_expiry_date)'), 'License expiry date must be formatted');
    assert.ok(driverDetailModal.includes('formatDate(selectedDriver.license_issue_date)'), 'License issue date must be formatted');
});

// Test 5: Date Input Timezone-Safe Normalization
runTest('DriversView implements toDateInputVal preventing off-by-one UTC day slip in EAT', () => {
    assert.ok(driversView.includes('toDateInputVal'), 'DriversView must define toDateInputVal helper');
    assert.ok(driversView.includes('getFullYear()'), 'toDateInputVal must use getFullYear()');
    assert.ok(driversView.includes('getDate()'), 'toDateInputVal must use getDate()');
});

// Test 6: Offline Sync Status Indicator Integration
runTest('OfflineSyncStatus component is mounted in App.jsx with auto-sync bindings', () => {
    assert.ok(appJsx.includes('<OfflineSyncStatus />'), 'App.jsx must mount <OfflineSyncStatus />');
    assert.ok(offlineStatus.includes('initAutoSync'), 'OfflineSyncStatus must bind to initAutoSync');
    assert.ok(offlineStatus.includes('Offline Mode'), 'OfflineSyncStatus must render Offline Mode status banner');
    assert.ok(offlineStatus.includes('Sync Now'), 'OfflineSyncStatus must provide manual Sync Now action');
});

// Test 7: Fleet Vehicles Specifications & Telemetry
runTest('VehiclesView displays fleet telemetry and supports Kenya plate registration', () => {
    assert.ok(vehiclesView.includes('total_fleet_distance_km'), 'VehiclesView must track fleet distance');
    assert.ok(vehiclesView.includes('registration_number'), 'VehiclesView must capture registration plate');
    assert.ok(vehiclesView.includes('ownership_type'), 'VehiclesView must support ownership types');
});

// Test 8: First-login onboarding system tour
runTest('System tour opens once per user after required password changes and can be replayed', () => {
    assert.ok(appJsx.includes('swifttrack_system_tour_completed_v1:'), 'Tour completion must be stored per user');
    assert.ok(appJsx.includes('if (!user || mustChangePassword)'), 'Tour must wait until mandatory password change is complete');
    assert.ok(appJsx.includes('<SystemTour'), 'App.jsx must mount the system tour');
    assert.ok(systemTour.includes('aria-modal="true"'), 'Tour must be presented as an accessible modal');
    assert.ok(systemTour.includes('Skip tour'), 'Users must be able to skip onboarding');
    assert.ok(navbar.includes('Take the system tour'), 'Users must be able to replay the tour from their profile menu');
});

runTest('First-login tour ends with a role-specific real task', () => {
    assert.ok(systemTour.includes('FIRST_TASK_BY_ROLE'), 'Tour must provide next steps by role');
    assert.ok(systemTour.includes('actionLabel'), 'Final tour step must name the next action');
    assert.ok(systemTour.includes('onNavigate?.(currentStep.view)'), 'Final tour action must navigate to its destination');
    assert.ok(appJsx.includes('onNavigate={setCurrentView}'), 'App must wire tour navigation to view routing');
});

runTest('Navigation labels explain parcel booking and the operational sequence', () => {
    assert.ok(sidebar.includes('1. Parcel Booking & Tracking'));
    assert.ok(sidebar.includes("label: 'Track & Manage Shipments'"));
    assert.ok(sidebar.includes("label: 'Book a Parcel'"));
    assert.ok(sidebar.includes('2. Hub Processing'));
    assert.ok(sidebar.includes('3. Linehaul & Fleet'));
    assert.ok(sidebar.includes('4. Last-Mile Delivery'));
});

runTest('Hub receiving uses persisted sessions and does not invent session records', () => {
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions?hub_id='));
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions/${activeReceivingSession.id}/scan'));
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions/${activeReceivingSession.id}/complete'));
    assert.ok(!hubOperations.includes('REC-NRB-HQ-001'), 'Hub view must not inject a sample session');
    assert.ok(inboundReceiving.includes('No receiving sessions at this branch yet.'));
    assert.ok(inboundReceiving.includes('Open a receiving session'));
});

runTest('Live dashboard metrics do not substitute fabricated values when data is absent', () => {
    assert.ok(!dashboardView.includes('selectedBranch ? 2 : 6'), 'Fleet totals must come from live data');
    assert.ok(!dashboardView.includes('|| 100'), 'Delivery success must not default to 100%');
    assert.ok(!dashboardHeader.includes('14ms'));
    assert.ok(!dashboardHeader.includes('+14.2%'));
    assert.ok(!dashboardHeader.includes('120,000.00 met'));
    assert.ok(!dashboardHeader.includes('100% UP'));
    assert.ok(!controlTower.includes('delivery_success_rate_pct || 100'));
    assert.ok(!controlTower.includes('first_attempt_success_rate_pct || 100'));
    assert.ok(!controlTower.includes('cod_reconciliation_rate_pct || 100'));
});

runTest('Acceptance simulation is unavailable in production', () => {
    assert.ok(controlTower.includes('import.meta.env.DEV &&'), 'Simulator entry point must be development-only');
    assert.ok(e2eAcceptanceRoute.includes("process.env.NODE_ENV === 'production'"));
    assert.ok(e2eAcceptanceRoute.includes('Acceptance simulation is disabled in production.'));
});

runTest('Shipment details show a role-appropriate next operational step', () => {
    assert.ok(shipmentsView.includes('NEXT_STEP_BY_STATUS'), 'Next-step guidance must follow shipment state');
    assert.ok(shipmentsView.includes('aria-label="Next operational step"'), 'Next step must be clearly labeled');
    assert.ok(shipmentsView.includes('nextStep.roles.includes(user?.role)'), 'Next steps must respect the current role');
    assert.ok(shipmentsView.includes("view: 'hub-operations'"), 'Hub-stage next steps must link to hub operations');
    assert.ok(shipmentsView.includes("view: 'dispatch'"), 'Dispatch-stage next steps must link to dispatch');
    assert.ok(shipmentsView.includes("view: 'control-tower'"), 'Exceptions must link to the control tower');
    assert.ok(shipmentsView.includes("view: 'cod-finance'"), 'COD deliveries must link to reconciliation');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);
if (passedTests !== totalTests) {
    process.exit(1);
}
