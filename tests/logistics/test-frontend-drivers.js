// tests/logistics/test-frontend-drivers.js
// SwiftTrack Kenya: Phase 9 Fleet Drivers Management Frontend Component Integrity Test
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('🚚  SWIFTTRACK KENYA: PHASE 9 FRONTEND DRIVERS TEST');
console.log('============================================================\n');

const driversViewPath = path.join(__dirname, '../../client/src/views/DriversView.jsx');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(driversViewPath), 'DriversView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const driversContent = fs.readFileSync(driversViewPath, 'utf8');
const appContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

console.log('▶ TEST 1: Operational Statuses & Compliance Configurations...');
const expectedStatuses = ['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY', 'ON_LEAVE', 'SUSPENDED'];
for (const s of expectedStatuses) {
  assert.ok(driversContent.includes(`'${s}'`), `DriversView must define status: ${s}`);
}
const expectedCompliance = ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'UNVERIFIED'];
for (const c of expectedCompliance) {
  assert.ok(driversContent.includes(`'${c}'`), `DriversView must define compliance status: ${c}`);
}
console.log('  ✔ All operational status options and license compliance levels verified');

console.log('▶ TEST 2: Executive Telemetry & Fleet KPI Instrumentation...');
assert.ok(driversContent.includes('telemetry'), 'DriversView must track telemetry state');
assert.ok(driversContent.includes('on_delivery_drivers'), 'DriversView must display active on road drivers');
assert.ok(driversContent.includes('available_drivers'), 'DriversView must display available drivers in yard');
assert.ok(driversContent.includes('off_duty_drivers'), 'DriversView must display off-duty and leave drivers');
assert.ok(driversContent.includes('expiring_licenses_count'), 'DriversView must display license expiry alerts');
assert.ok(driversContent.includes('fleet_on_time_rate_pct'), 'DriversView must display fleet on-time rate');
assert.ok(driversContent.includes('fleet_avg_rating'), 'DriversView must display fleet average driver rating');
console.log('  ✔ Fleet KPI telemetry instrumentation verified');

console.log('▶ TEST 3: Driver Onboarding Modal & Multi-Section Form...');
assert.ok(driversContent.includes('Onboard Fleet Driver'), 'DriversView must have Onboard Driver dialog');
assert.ok(driversContent.includes('national_id'), 'Form must capture Kenyan National ID');
assert.ok(driversContent.includes('kra_pin'), 'Form must capture KRA PIN');
assert.ok(driversContent.includes('nssf_number'), 'Form must capture NSSF number');
assert.ok(driversContent.includes('nhif_number'), 'Form must capture NHIF/SHA number');
assert.ok(driversContent.includes('license_number'), 'Form must capture driving license number');
assert.ok(driversContent.includes('license_classes'), 'Form must capture authorized license classes');
assert.ok(driversContent.includes('license_expiry_date'), 'Form must capture license expiry date');
assert.ok(driversContent.includes('emergency_contact_name'), 'Form must capture emergency contact');
console.log('  ✔ Driver onboarding modal and identity/license inputs verified');

console.log('▶ TEST 4: 4-Tab Deep-Dive Scorecard Drawer...');
const expectedTabs = ['overview', 'scorecard', 'deliveries', 'incidents'];
for (const t of expectedTabs) {
  assert.ok(driversContent.includes(`'${t}'`), `Scorecard drawer must support tab: ${t}`);
}
assert.ok(driversContent.includes('success_rate_pct'), 'Scorecard must display success delivery rate %');
assert.ok(driversContent.includes('on_time_rate_pct'), 'Scorecard must display on-time delivery rate %');
assert.ok(driversContent.includes('avg_turnaround_minutes'), 'Scorecard must display avg turnaround time');
console.log('  ✔ 4-tab scorecard drawer and performance metrics verified');

console.log('▶ TEST 5: Operational Duty Status Transitions & Quick Actions...');
assert.ok(driversContent.includes('Update Driver Status'), 'DriversView must have update status dialog');
assert.ok(driversContent.includes('/status'), 'DriversView must invoke status PATCH endpoint');
assert.ok(driversContent.includes('Assign Fleet Vehicle'), 'DriversView must have vehicle assignment modal');
assert.ok(driversContent.includes('Log Safety / Traffic Incident'), 'DriversView must have safety incident modal');
console.log('  ✔ Operational status changer, vehicle pairing, and safety incident modals verified');

console.log('▶ TEST 6: Application Router & Sidebar Navigation Integration...');
assert.ok(sidebarContent.includes("'drivers'"), 'Sidebar.jsx must contain drivers route ID');
assert.ok(sidebarContent.includes('Fleet Drivers'), 'Sidebar.jsx must display Fleet Drivers label');
assert.ok(appContent.includes("import { DriversView } from './views/DriversView.jsx';"), 'App.jsx must import DriversView');
assert.ok(appContent.includes("case 'drivers':"), 'App.jsx must route drivers case');
assert.ok(appContent.includes('<DriversView />'), 'App.jsx must render <DriversView /> component');
console.log('  ✔ Sidebar and App.jsx routing integration verified');

console.log('\n============================================================');
console.log('🎉  ALL 6 FRONTEND DRIVERS TESTS PASSED!');
console.log('============================================================\n');
