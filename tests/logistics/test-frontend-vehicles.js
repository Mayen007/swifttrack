// tests/logistics/test-frontend-vehicles.js
// SwiftTrack Kenya: Phase 9 Fleet Vehicles Management Frontend Component Integrity Test (9.2)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('🚛  SWIFTTRACK KENYA: PHASE 9 FRONTEND VEHICLES TEST (9.2)');
console.log('============================================================\n');

const vehiclesViewPath = path.join(__dirname, '../../client/src/views/VehiclesView.jsx');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(vehiclesViewPath), 'VehiclesView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const vehiclesContent = fs.readFileSync(vehiclesViewPath, 'utf8');
const appContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

console.log('▶ TEST 1: Operational Statuses & Vehicle Types Configurations...');
const expectedStatuses = ['AVAILABLE', 'IN_TRANSIT', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'RESERVED'];
for (const s of expectedStatuses) {
  assert.ok(vehiclesContent.includes(`'${s}'`), `VehiclesView must define status: ${s}`);
}
const expectedTypes = ['MOTORCYCLE', 'VAN', 'TRUCK', 'PICKUP', 'TUKTUK', 'LORRY'];
for (const t of expectedTypes) {
  assert.ok(vehiclesContent.includes(`'${t}'`), `VehiclesView must define vehicle type: ${t}`);
}
console.log('  ✔ All operational status options and vehicle types verified');

console.log('▶ TEST 2: Executive Telemetry & Fleet KPI Instrumentation...');
assert.ok(vehiclesContent.includes('telemetry'), 'VehiclesView must track telemetry state');
assert.ok(vehiclesContent.includes('total_vehicles'), 'VehiclesView must display total fleet count');
assert.ok(vehiclesContent.includes('available_vehicles'), 'VehiclesView must display available count in yard');
assert.ok(vehiclesContent.includes('in_transit_vehicles'), 'VehiclesView must display in-transit vehicles');
assert.ok(vehiclesContent.includes('maintenance_vehicles'), 'VehiclesView must display maintenance vehicles');
assert.ok(vehiclesContent.includes('total_fleet_distance_km'), 'VehiclesView must display fleet total odometer');
assert.ok(vehiclesContent.includes('monthly_fuel_spend'), 'VehiclesView must display monthly fuel spend');
console.log('  ✔ Fleet KPI telemetry instrumentation verified');

console.log('▶ TEST 3: Vehicle Registry Modal & Technical Specification Inputs...');
assert.ok(vehiclesContent.includes('Register Fleet Vehicle'), 'VehiclesView must have Register Vehicle dialog');
assert.ok(vehiclesContent.includes('registration_number'), 'Form must capture Kenya plate registration');
assert.ok(vehiclesContent.includes('capacity_kg'), 'Form must capture payload capacity in kg');
assert.ok(vehiclesContent.includes('cargo_volume_cbm'), 'Form must capture cargo volume in m3');
assert.ok(vehiclesContent.includes('fuel_tank_capacity_liters'), 'Form must capture fuel tank capacity');
assert.ok(vehiclesContent.includes('current_odometer_km'), 'Form must capture odometer reading');
assert.ok(vehiclesContent.includes('ownership_type'), 'Form must capture ownership structure');
console.log('  ✔ Vehicle registration modal and technical inputs verified');

console.log('▶ TEST 4: 4-Tab Deep-Dive Vehicle Dossier Drawer...');
const expectedTabs = ['overview', 'fuel', 'maintenance', 'mileage'];
for (const t of expectedTabs) {
  assert.ok(vehiclesContent.includes(`'${t}'`), `Vehicle dossier drawer must support tab: ${t}`);
}
assert.ok(vehiclesContent.includes('total_distance_km'), 'Dossier must display lifetime distance');
assert.ok(vehiclesContent.includes('total_fuel_spend'), 'Dossier must display total fuel spend');
assert.ok(vehiclesContent.includes('total_maintenance_spend'), 'Dossier must display total maintenance spend');
assert.ok(vehiclesContent.includes('operating_cost_per_km'), 'Dossier must display operating cost per km');
console.log('  ✔ 4-tab dossier drawer and lifecycle metrics verified');

console.log('▶ TEST 5: Fuel Logging, Maintenance Scheduling & Trip Modals...');
assert.ok(vehiclesContent.includes('Log Refuel Voucher'), 'VehiclesView must have refuel dialog');
assert.ok(vehiclesContent.includes('calculated_consumption_kml'), 'VehiclesView must display km/L economy');
assert.ok(vehiclesContent.includes('Log Vehicle Service / Maintenance'), 'VehiclesView must have service dialog');
assert.ok(vehiclesContent.includes('Log Trip & Advance Mileage'), 'VehiclesView must have trip mileage modal');
assert.ok(vehiclesContent.includes('Update Vehicle Status'), 'VehiclesView must have status modal');
console.log('  ✔ Quick-action modals (refuel, maintenance, trip log, status) verified');

console.log('▶ TEST 6: Application Router & Sidebar Navigation Integration...');
assert.ok(sidebarContent.includes("'vehicles'"), 'Sidebar.jsx must contain vehicles route ID');
assert.ok(sidebarContent.includes('Fleet Vehicles'), 'Sidebar.jsx must display Fleet Vehicles label');
assert.ok(appContent.includes("import { VehiclesView } from './views/VehiclesView.jsx';"), 'App.jsx must import VehiclesView');
assert.ok(appContent.includes("case 'vehicles':"), 'App.jsx must route vehicles case');
assert.ok(appContent.includes('<VehiclesView />'), 'App.jsx must render <VehiclesView /> component');
console.log('  ✔ Sidebar and App.jsx routing integration verified');

console.log('\n============================================================');
console.log('🎉  ALL 6 FRONTEND VEHICLES TESTS PASSED!');
console.log('============================================================\n');
