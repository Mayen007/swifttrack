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

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);
if (passedTests !== totalTests) {
    process.exit(1);
}
