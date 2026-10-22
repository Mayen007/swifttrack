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
const driverDetailModal = fs.readFileSync(path.join(clientSrc, 'components/drivers/DriverDetailModal.jsx'), 'utf8');
const driverTelemetryCards = fs.readFileSync(path.join(clientSrc, 'components/drivers/DriverTelemetryCards.jsx'), 'utf8');
const driverTable = fs.readFileSync(path.join(clientSrc, 'components/drivers/DriverTable.jsx'), 'utf8');
const createDriverModal = fs.readFileSync(path.join(clientSrc, 'components/drivers/CreateDriverModal.jsx'), 'utf8');
const vehiclesView = fs.readFileSync(path.join(clientSrc, 'views/VehiclesView.jsx'), 'utf8');
const branchesView = fs.readFileSync(path.join(clientSrc, 'views/BranchesView.jsx'), 'utf8');
const branchRoutes = fs.readFileSync(path.resolve(__dirname, '../../server/routes/branches.js'), 'utf8');
const initialSetupModal = fs.readFileSync(path.join(clientSrc, 'components/onboarding/InitialSetupModal.jsx'), 'utf8');
const authContext = fs.readFileSync(path.join(clientSrc, 'context/AuthContext.jsx'), 'utf8');
const apiService = fs.readFileSync(path.join(clientSrc, 'services/api.js'), 'utf8');
const passwordModal = fs.readFileSync(path.join(clientSrc, 'components/auth/PasswordChangeModal.jsx'), 'utf8');
const passwordPolicy = fs.readFileSync(path.join(clientSrc, 'services/passwordPolicy.js'), 'utf8');
const createUserModal = fs.readFileSync(path.join(clientSrc, 'components/users/CreateUserModal.jsx'), 'utf8');
const usersView = fs.readFileSync(path.join(clientSrc, 'views/UsersView.jsx'), 'utf8');
const loginView = fs.readFileSync(path.join(clientSrc, 'views/LoginView.jsx'), 'utf8');
const loginDemoPersonas = fs.readFileSync(path.join(clientSrc, 'components/auth/LoginDemoPersonas.jsx'), 'utf8');
const editDriverModal = fs.readFileSync(path.join(clientSrc, 'components/drivers/EditDriverModal.jsx'), 'utf8');
const offlineStatus = fs.readFileSync(path.join(clientSrc, 'components/common/OfflineSyncStatus.jsx'), 'utf8');
const systemTour = fs.readFileSync(path.join(clientSrc, 'components/SystemTour.jsx'), 'utf8');
const dispatchHeader = fs.readFileSync(path.join(clientSrc, 'components/dispatch/DispatchConsoleHeader.jsx'), 'utf8');
const dispatchView = fs.readFileSync(path.join(clientSrc, 'views/DispatchView.jsx'), 'utf8');
const linehaulRuns = fs.readFileSync(path.join(clientSrc, 'components/dispatch/LinehaulRunsTab.jsx'), 'utf8');
const navbar = fs.readFileSync(path.join(clientSrc, 'components/Navbar.jsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(clientSrc, 'components/Sidebar.jsx'), 'utf8');
const dashboardView = fs.readFileSync(path.join(clientSrc, 'views/DashboardView.jsx'), 'utf8');
const dashboardHeader = fs.readFileSync(path.join(clientSrc, 'components/dashboard/CommercialBentoHeader.jsx'), 'utf8');
const controlTower = fs.readFileSync(path.join(clientSrc, 'components/dashboard/OperationsControlTower.jsx'), 'utf8');
const hubOperations = fs.readFileSync(path.join(clientSrc, 'views/HubOperationsView.jsx'), 'utf8');
const sortationTab = fs.readFileSync(path.join(clientSrc, 'components/hub/SortationTab.jsx'), 'utf8');
const linehaulManifests = fs.readFileSync(path.join(clientSrc, 'components/hub/LinehaulManifestsTab.jsx'), 'utf8');
const transshipmentTab = fs.readFileSync(path.join(clientSrc, 'components/hub/TransshipmentTab.jsx'), 'utf8');
const custodyRoutes = fs.readFileSync(path.resolve(__dirname, '../../server/routes/custody.js'), 'utf8');
const custodyService = fs.readFileSync(path.resolve(__dirname, '../../server/services/custodyService.js'), 'utf8');
const shipmentService = fs.readFileSync(path.resolve(__dirname, '../../server/services/shipmentService.js'), 'utf8');
const transportService = fs.readFileSync(path.resolve(__dirname, '../../server/services/transportService.js'), 'utf8');
const dispatchRoutes = fs.readFileSync(path.resolve(__dirname, '../../server/routes/dispatch.js'), 'utf8');
const controlTowerService = fs.readFileSync(path.resolve(__dirname, '../../server/services/controlTowerService.js'), 'utf8');
const metricsService = fs.readFileSync(path.resolve(__dirname, '../../server/services/metricsService.js'), 'utf8');
const discrepanciesTab = fs.readFileSync(path.join(clientSrc, 'components/hub/DiscrepanciesTab.jsx'), 'utf8');
const inboundReceiving = fs.readFileSync(path.join(clientSrc, 'components/hub/InboundReceivingTab.jsx'), 'utf8');
const e2eAcceptanceRoute = fs.readFileSync(path.resolve(__dirname, '../../server/routes/e2eAcceptance.js'), 'utf8');
const shipmentsView = fs.readFileSync(path.join(clientSrc, 'views/ShipmentsView.jsx'), 'utf8');
const multiLegJourney = fs.readFileSync(path.join(clientSrc, 'components/shipments/MultiLegJourney.jsx'), 'utf8');
const parcelCounterBooking = fs.readFileSync(path.join(clientSrc, 'components/pos/ParcelCounterBooking.jsx'), 'utf8');
const displayText = fs.readFileSync(path.join(clientSrc, 'services/displayText.js'), 'utf8');

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

runTest('Driver scorecards and fleet telemetry do not invent performance data', () => {
    assert.ok(driverDetailModal.includes("success_rate_pct == null ? '—'"), 'No-trip delivery success must not display as 100%');
    assert.ok(driverDetailModal.includes("on_time_rate_pct == null ? '—'"), 'No-trip on-time rate must not display as 100%');
    assert.ok(driverDetailModal.includes("avg_turnaround_minutes == null ? '—'"), 'No-trip turnaround must not show a sample duration');
    assert.ok(driverDetailModal.includes("'Not yet rated'"), 'Unrated driver profile must not show a default 5/5');
    assert.ok(driverTable.includes('drv.rating == null'), 'Unrated drivers must be labeled instead of assigned a default rating');
    assert.ok(driverTelemetryCards.includes("fleet_on_time_rate_pct == null ? '—'"), 'Empty fleet on-time metric must be shown as unavailable');
    assert.ok(driverTelemetryCards.includes("fleet_avg_rating == null ? '—'"), 'Empty fleet rating must be shown as unavailable');
});

runTest('Driver onboarding cannot implicitly submit before the final step', () => {
    assert.ok(createDriverModal.includes("event.key === 'Enter' && createTab !== 'depot_vehicle' && event.target.tagName === 'INPUT'"), 'Enter from an input must not submit the form before the final step');
    assert.ok(createDriverModal.includes("if (createTab !== 'depot_vehicle') return;"), 'Early form submits must not advance or submit the wizard');
    assert.ok(createDriverModal.includes('onSubmit(event);'), 'Only the final step should invoke driver creation');
    assert.ok(driversView.includes("if (createTab !== 'depot_vehicle') return;"), 'The create handler must reject submissions before the final step');
});

runTest('Driver onboarding fields remain controlled and vehicle registration sends API branch_id', () => {
    assert.ok(driversView.includes("city: ''"), 'Driver onboarding state must initialize city');
    assert.ok(driversView.includes("notes: ''"), 'Driver onboarding state must initialize notes');
    assert.ok(createDriverModal.includes('value={createForm.city || \'\'}'), 'City input must remain controlled');
    assert.ok(createDriverModal.includes('value={createForm.notes || \'\'}'), 'Notes input must remain controlled');
    assert.ok(vehiclesView.includes('branch_id: Number(registerForm.branch_id) || 1'), 'Vehicle create request must send branch_id expected by the API');
    assert.ok(vehiclesView.includes('branch_id: selectedBranch?.id || 1'), 'Vehicle form must initialize and reset branch_id');
    assert.ok(vehiclesView.includes("params.append('branchId', branchFilter)"), 'Vehicle list filter must use the API branchId query key');
});

runTest('Headquarters are excluded from operational hubs but remain available to administrators', () => {
    assert.ok(branchRoutes.includes("operationalOnly: req.query.include_non_operational !== 'true'"), 'Branch directory should return operational hubs by default');
    assert.ok(branchesView.includes("api.get('/api/branches?include_non_operational=true')"), 'Branch administration must retain access to headquarters records');
    assert.ok(initialSetupModal.includes("setStep(Array.isArray(existingHubs) && existingHubs.length > 0 ? 3 : 2)"), 'Organization setup must reuse existing hubs instead of creating duplicates');
    assert.ok(initialSetupModal.includes("code: 'NBO-01'"), 'First setup hub must not use an HQ branch identifier');
    assert.ok(initialSetupModal.includes('Set up your first parcel hub'), 'Setup must describe a parcel hub, not an operational HQ');
});

runTest('Mandatory password changes suppress blocked background requests', () => {
    assert.ok(authContext.includes('normUser.mustChangePassword ? [] : await loadBranches()'), 'Authentication must not request branches before a required password change');
    assert.ok(appJsx.includes('!api.token || mustChangePassword || user?.mustChangePassword'), 'Notification polling must stop during the required password flow');
    assert.ok(appJsx.includes('<PasswordChangeModal isOpen isMandatory />'), 'A restricted session must render only the password-change experience');
    assert.ok(apiService.includes('import.meta.env.DEV && isUnexpectedFailure'), 'Expected policy denials must not clutter the console');
});

runTest('Password feedback explains account-specific rejection rules before submission', () => {
    assert.ok(passwordPolicy.includes('Does not contain your username'), 'Password policy must explain the username restriction');
    assert.ok(passwordPolicy.includes('Does not contain your email identifier'), 'Password policy must explain the email identifier restriction');
    assert.ok(passwordModal.includes('user?.username'), 'Password change feedback must validate against the signed-in username');
    assert.ok(passwordModal.includes('user?.email'), 'Password change feedback must validate against the signed-in email');
    assert.ok(apiService.includes('err.errors = data?.errors'), 'Password validation errors should retain the server policy details');
    assert.ok(createUserModal.includes('type="password"'), 'Staff initial credentials must be masked');
    assert.ok(usersView.includes('Update the initial password:'), 'Staff provisioning must explain password policy failures inline');
    assert.ok(loginView.includes('If you were given a temporary password'), 'Login errors should explain exact temporary-password entry');
});

runTest('Demo login exposes all seeded test accounts and switches to the selected user', () => {
    const personaList = loginView.match(/const demoPersonas = \[([\s\S]*?)\n  \];/);
    assert.ok(personaList, 'Demo persona list must be defined');
    assert.strictEqual((personaList[1].match(/username:/g) || []).length, 17, 'All 17 seeded demo users should be available');
    assert.ok(loginView.includes('demoMode && (') && loginView.includes('demoPassword="Password123!"'), 'Demo credentials must only render in demo mode');
    assert.ok(loginDemoPersonas.includes('{demoPassword}'), 'The shared seeded password must be visible in the demo switcher');
    assert.ok(loginView.includes('quickSwitch(personaRole, branchId, personaUsername)'), 'Selecting a persona must authenticate as that exact seeded user');
    assert.ok(authContext.includes('{ role: targetRole, branch_id: branchId, username }'), 'Demo switch request must identify the selected account');
});

runTest('Handled API failures stay out of production browser consoles', () => {
    assert.ok(apiService.includes('const isUnexpectedFailure = !err.status || err.status >= 500'), 'Only server and network failures should be considered unexpected');
    assert.ok(apiService.includes('if (import.meta.env.DEV && isUnexpectedFailure)'), 'API diagnostics must be development-only');
    assert.ok(!usersView.includes("console.error('Failed to create staff member:'"), 'Staff validation errors should be shown in the form without duplicate console errors');
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
    assert.ok(systemTour.includes("const { resolvedTheme } = useTheme();"), 'Tour must adapt to the active theme');
    assert.ok(systemTour.includes("isLight ? 'border-slate-300 bg-white text-slate-900'"), 'Light theme tour dialog must use a high-contrast light surface');
    assert.ok(systemTour.includes("isLight ? 'text-slate-700' : 'text-slate-400'"), 'Light theme tour descriptions must use readable foreground colors');
    assert.ok(systemTour.includes("isLight ? 'bg-amber-700 text-white hover:bg-amber-800"), 'Light theme tour primary action must use a high-contrast accent');
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

runTest('Parcel Intake only lists active hubs and renders sanitized hub labels', () => {
    assert.ok(parcelCounterBooking.includes("api.get('/api/branches?is_active=true')"), 'Parcel Intake must request only active hubs');
    assert.ok(parcelCounterBooking.includes('sanitizeDisplay(hub.name)'), 'Hub names must be sanitized before display');
    assert.ok(parcelCounterBooking.includes('sanitizeDisplay(hub.code)'), 'Hub codes must be sanitized before display');
    assert.ok(parcelCounterBooking.includes('sanitizeDisplay(hub.city)'), 'Hub cities must be sanitized before display');
    assert.strictEqual((parcelCounterBooking.match(/\{formatHubLabel\(h\)\}/g) || []).length, 2, 'Both hub selectors must use the safe label formatter');
    assert.ok(displayText.includes('<script\\b'), 'Display sanitization must remove script blocks');
    assert.ok(displayText.includes('<[^>]*>?'), 'Display sanitization must remove remaining tags');
});

runTest('Notification polling waits until auth initialization has completed', () => {
    assert.ok(appJsx.includes('if (loading || !user || !api.token || mustChangePassword || user?.mustChangePassword)'), 'Notification polling must wait for auth initialization and required password changes');
    assert.ok(appJsx.includes('}, [user, loading, mustChangePassword]);'), 'Notification polling must restart when auth state changes');
});

runTest('Hub receiving uses persisted sessions and does not invent session records', () => {
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions?hub_id='));
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions/${activeReceivingSession.id}/scan'));
    assert.ok(hubOperations.includes('/api/custody/receiving-sessions/${activeReceivingSession.id}/complete'));
    assert.ok(!hubOperations.includes('REC-NRB-HQ-001'), 'Hub view must not inject a sample session');
    assert.ok(inboundReceiving.includes('No receiving sessions at this branch yet.'));
    assert.ok(inboundReceiving.includes('Open a receiving session'));
});

runTest('Hub manifests and discrepancies read their named API collections', () => {
    assert.ok(hubOperations.includes("getFeedItems(mRes, 'manifests')"), 'Manifest response must read the manifests collection');
    assert.ok(hubOperations.includes("getFeedItems(dRes, 'discrepancies')"), 'Discrepancy response must read the discrepancies collection');
    assert.ok(hubOperations.includes("getFeedItems(hRes, 'handoffs')"), 'Handoff response must read the handoffs collection');
    assert.ok(hubOperations.includes('Array.isArray(response?.[collectionKey])'), 'Hub feed parser must support named collection responses');
    assert.ok(linehaulManifests.includes('manifests.filter('), 'Manifest ledger must receive a normalized list');
    assert.ok(discrepanciesTab.includes('discrepancies.filter('), 'Discrepancy ledger must receive a normalized list');
});

runTest('Sorted inter-hub parcels can be assigned to runs and viewed in Dispatch', () => {
    assert.ok(transshipmentTab.includes('onAttachToManifest(shp)'), 'Assignment action must carry the selected shipment');
    assert.ok(hubOperations.includes('/api/transport/runs?hub_id=${currentHubId}'), 'Hub operations must load runs for the current station');
    assert.ok(hubOperations.includes("api.post('/api/transport/runs'"), 'Hub operations must create a run for a sorted parcel');
    assert.ok(hubOperations.includes('/manifest/items'), 'Hub operations must attach the parcel to the run manifest');
    assert.ok(dispatchView.includes('/api/transport/runs'), 'Dispatch must load linehaul runs independently from local deliveries');
    assert.ok(dispatchView.includes("activeTab === 'LINEHAUL'"), 'Dispatch must provide a separate linehaul view');
    assert.ok(dispatchHeader.includes('Linehaul'), 'Dispatch header must expose the linehaul view');
    assert.ok(linehaulRuns.includes('No linehaul runs at this station'), 'Empty run state must explain how to create a run');
});

runTest('Discrepancy resolution sends the API field names and preserves failed submissions', () => {
    assert.ok(hubOperations.includes('resolution_action: resolutionAction'), 'Resolution action must use the server field name');
    assert.ok(hubOperations.includes('resolution_notes: resolutionNotes'), 'Resolution notes must use the server field name');
    assert.ok(!hubOperations.includes("api.toast(`Resolution failed: ${err.message}`, 'error');\n      setResolvingModalOpen(false);"), 'Resolution failures must preserve the active form');
    assert.ok(hubOperations.includes('{resolvingModalOpen && (') && hubOperations.includes('setSelectedDiscrepancy(null);'), 'Closing the dialog must unmount it and clear its selection');
    assert.ok(discrepanciesTab.includes("['RESOLVED', 'WRITTEN_OFF'].includes(d.status)"), 'Closed discrepancies must not offer a resolve action');
    assert.ok(discrepanciesTab.includes('{activeDiscrepancyCount} Active'), 'The badge must count only open discrepancies');
});

runTest('Dispatcher can confirm manual sortation without scanner hardware', () => {
    assert.ok(sortationTab.includes('Dispatcher-owned hub sortation'), 'Sortation ownership must be explicit');
    assert.ok(sortationTab.includes('Awaiting sortation'), 'Dispatchers must see consignments waiting to be sorted');
    assert.ok(sortationTab.includes('No scanner is required'), 'The sortation guidance must not require scanner hardware');
    assert.ok(sortationTab.includes('Add it to an outbound linehaul manifest next'), 'Inter-hub sorting must explain that manifesting is the next step');
    assert.ok(hubOperations.includes("onOpenManifests={() => setActiveTab('MANIFESTS')}"), 'Sort confirmation must link to outbound manifests');
    assert.ok(hubOperations.includes("api.post('/api/custody/sortations/manual'"), 'Manual sort must use a dedicated endpoint');
    assert.ok(custodyRoutes.includes("requireRole('DISPATCHER')"), 'Only dispatchers and super admins may manually sort');
    assert.ok(custodyService.includes("confirmation_method: 'MANUAL'"), 'Manual confirmation must be distinguished from a scan');
    assert.ok(custodyService.includes('confirmed_at: event.created_at'), 'Confirmation must return its persisted timestamp');
    assert.ok(sortationTab.includes('sortedItem.confirmedBy'), 'The UI must display who confirmed the sort');
    assert.ok(!hubOperations.includes("api.post('/api/custody/scans'"), 'Manual sort must not fabricate a scanner event');
    assert.ok(transshipmentTab.includes("['SORTED', 'READY_FOR_DISPATCH'].includes(shp.status)"), 'Unsorted shipments must not be offered for manifest attachment');
    assert.ok(transshipmentTab.includes('onManualSort(shp)'), 'Transshipment queue must offer the dispatcher a manual-sort action');
});

runTest('Archived test shipments stay out of active shipment and dispatch queues', () => {
    assert.ok(shipmentService.includes('s.is_archived = FALSE'), 'Shipment listing and outbound queues must hide archived records');
    assert.ok(shipmentService.includes('filters.include_archived'), 'Super admins must be able to include archived shipment history');
    assert.ok(transportService.includes('AND is_archived = FALSE'), 'Archived shipments must not be added to a manifest');
    assert.ok(dispatchRoutes.includes('(s.id IS NULL OR s.is_archived = FALSE)'), 'Dispatch must hide delivery tasks linked to archived shipments');
    assert.ok(controlTowerService.includes('WHERE is_archived = FALSE'), 'Operational hub metrics must ignore archived shipments');
    assert.ok(metricsService.includes('WHERE is_archived = FALSE'), 'Active shipment telemetry must ignore archived shipments');
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

runTest('Dispatch header keeps branch sync status concise and tabs accessible', () => {
    assert.ok(dispatchHeader.includes('<h1 className="text-base font-semibold'), 'Dispatch console should have a concise heading');
    assert.ok(dispatchHeader.includes('Updated {lastSyncTime} EAT'), 'Header should report the actual last update time');
    assert.ok(!dispatchHeader.includes('100% LIVE SYNC'), 'Header must not claim unmeasured live-sync certainty');
    assert.ok(!dispatchHeader.includes('DISPATCH CONSOLE'), 'Remove redundant console label');
    assert.ok(!dispatchHeader.includes('<span>SYNC</span>'), 'Use a compact refresh control instead of a redundant text label');
    assert.ok(dispatchHeader.includes('aria-label="Refresh dispatch board"'), 'Icon-only refresh control must have an accessible name');
    assert.ok(dispatchHeader.includes('aria-pressed={activeTab ==='), 'Tabs must expose selected state to assistive technology');
});

runTest('Shipment routes use readable labels instead of raw math notation', () => {
    assert.ok(shipmentsView.includes('Sender / recipient'), 'Shipment table should use a plain-language party heading');
    assert.ok(shipmentsView.includes('To {s.recipient_name'), 'Recipient should be introduced with readable text');
    assert.ok(multiLegJourney.includes("{legs.length === 1 ? 'segment' : 'segments'}"), 'Route count should be plain language');
    assert.ok(multiLegJourney.includes('From {leg.origin_hub_name'), 'Leg route should use plain-language origin and destination');
    assert.ok(!shipmentsView.includes('$\\to$'), 'Shipment view must not expose raw LaTeX arrows');
    assert.ok(!multiLegJourney.includes('$\\to$'), 'Multi-leg journey must not expose raw LaTeX arrows');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);
if (passedTests !== totalTests) {
    process.exit(1);
}
