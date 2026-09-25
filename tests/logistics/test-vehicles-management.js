// tests/logistics/test-vehicles-management.js
// SwiftTrack Kenya: Phase 9 Logistics & Fleet — Vehicle Management Integration Suite (9.2)
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const vehicleService = require('../../server/services/vehicleService.js');
const driverService = require('../../server/services/driverService.js');

console.log('\n============================================================');
console.log('🚛  SWIFTTRACK KENYA: PHASE 9 FLEET VEHICLES SUITE (9.2)');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Setup fixtures
const adminUser = db.prepare(`
  SELECT u.*, r.name as roleName
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE r.name = 'SUPER_ADMIN'
  LIMIT 1
`).get() || { id: 1, roleName: 'SUPER_ADMIN', branch_id: 1 };

const branch1 = db.prepare('SELECT * FROM branches ORDER BY id ASC LIMIT 1').get() || { id: 1, name: 'Nairobi Central' };
const branch2 = db.prepare('SELECT * FROM branches WHERE id != ? LIMIT 1').get(branch1.id) || { id: 2, name: 'Mombasa Port' };

let createdVehicle1 = null;
let createdVehicle2 = null;
let testDriver = null;

async function executeSuite() {
  // TEST 1: Vehicle Registry Creation
  await runTest('1. Vehicle Registry Creation: Registration plate, type, capacity (kg/m3), specs, odometer', async () => {
    const uniqueSuffix = Date.now().toString().slice(-3);
    const payload = {
      registration_number: `KDX 1${uniqueSuffix}Z`,
      vehicle_type: 'VAN',
      make: 'Toyota',
      model: 'HiAce Commuter',
      year_of_manufacture: 2023,
      chassis_number: `JT11V${Date.now()}89`,
      engine_number: `2KD-${Date.now().toString().slice(-6)}`,
      color: 'Pure White',
      fuel_type: 'DIESEL',
      fuel_tank_capacity_liters: 70,
      ownership_type: 'COMPANY_OWNED',
      capacity_kg: 1400,
      cargo_volume_cbm: 7.2,
      initial_odometer_km: 18000,
      current_odometer_km: 18000,
      next_service_odometer_km: 23000,
      next_service_date: '2026-12-01',
      branch_id: branch1.id,
      notes: 'Westlands and Kilimani express delivery van'
    };

    createdVehicle1 = vehicleService.createVehicle(payload, adminUser.id);
    assert(createdVehicle1, 'Vehicle should be created and returned');
    assert(createdVehicle1.id, 'Vehicle must have an ID');
    assert.strictEqual(createdVehicle1.registration_number, payload.registration_number);
    assert.strictEqual(createdVehicle1.vehicle_type, 'VAN');
    assert.strictEqual(createdVehicle1.capacity_kg, 1400);
    assert.strictEqual(createdVehicle1.cargo_volume_cbm, 7.2);
    assert.strictEqual(createdVehicle1.current_odometer_km, 18000);
    assert.strictEqual(createdVehicle1.status, 'AVAILABLE');
    assert.strictEqual(createdVehicle1.branch_id, branch1.id);
  });

  // TEST 2: Registration Plate Validation & Uniqueness
  await runTest('2. Registration Plate Validation & Uniqueness: Rejects duplicates & malformed plates', async () => {
    // Duplicate plate rejection
    assert.throws(() => {
      vehicleService.createVehicle({
        registration_number: createdVehicle1.registration_number,
        vehicle_type: 'VAN',
        make: 'Toyota',
        model: 'HiAce',
        capacity_kg: 1200,
        branch_id: branch1.id
      }, adminUser.id);
    }, /already registered|UNIQUE constraint/i);

    // Invalid plate format rejection
    assert.throws(() => {
      vehicleService.createVehicle({
        registration_number: 'INVALID_PLATE_12345',
        vehicle_type: 'VAN',
        make: 'Toyota',
        model: 'HiAce',
        capacity_kg: 1200,
        branch_id: branch1.id
      }, adminUser.id);
    }, /Invalid Kenya vehicle registration number format/i);
  });

  // TEST 3: Vehicle Specifications Update
  await runTest('3. Vehicle Specifications Update: Make, model, payload, and color modification', async () => {
    const updated = vehicleService.updateVehicle(createdVehicle1.id, {
      make: 'Toyota Kenya',
      model: 'HiAce Super GL High-Roof',
      capacity_kg: 1550,
      cargo_volume_cbm: 8.0,
      color: 'Metallic Silver',
      notes: 'Upgraded with heavy duty rear suspension'
    }, adminUser.id);

    assert.strictEqual(updated.make, 'Toyota Kenya');
    assert.strictEqual(updated.model, 'HiAce Super GL High-Roof');
    assert.strictEqual(updated.capacity_kg, 1550);
    assert.strictEqual(updated.cargo_volume_cbm, 8.0);
    assert.strictEqual(updated.color, 'Metallic Silver');
    assert.strictEqual(updated.notes, 'Upgraded with heavy duty rear suspension');
  });

  // TEST 4: Operational Status Lifecycle & Audit Trail
  await runTest('4. Operational Status Lifecycle: Transitions with reason and historical audit records', async () => {
    // Transition to IN_TRANSIT
    const trans1 = vehicleService.updateVehicleStatus(
      createdVehicle1.id,
      'IN_TRANSIT',
      'Assigned to Route 4: Industrial Area & Nairobi CBD deliveries',
      adminUser.id
    );
    assert.strictEqual(trans1.status, 'IN_TRANSIT');
    assert.strictEqual(trans1.status_reason, 'Assigned to Route 4: Industrial Area & Nairobi CBD deliveries');

    // Transition to UNDER_MAINTENANCE
    const trans2 = vehicleService.updateVehicleStatus(
      createdVehicle1.id,
      'UNDER_MAINTENANCE',
      'Scheduled 20,000km workshop service at DT Dobie',
      adminUser.id
    );
    assert.strictEqual(trans2.status, 'UNDER_MAINTENANCE');

    // Verify history audit records exist
    const historyRows = db.prepare(`
      SELECT * FROM vehicle_status_history 
      WHERE vehicle_id = ? 
      ORDER BY id DESC
    `).all(createdVehicle1.id);

    assert(historyRows.length >= 2, 'Should have at least 2 historical status changes');
    assert.strictEqual(historyRows[0].to_status, 'UNDER_MAINTENANCE');
    assert.strictEqual(historyRows[0].from_status, 'IN_TRANSIT');
    assert.strictEqual(historyRows[1].to_status, 'IN_TRANSIT');
    assert.strictEqual(historyRows[1].from_status, 'AVAILABLE');

    // Return to AVAILABLE
    vehicleService.updateVehicleStatus(createdVehicle1.id, 'AVAILABLE', 'Ready for dispatch', adminUser.id);
  });

  // TEST 5: Driver Pairing & Bidirectional Synchronization
  await runTest('5. Driver Pairing: Assigns compatible driver and updates bidirectional link', async () => {
    // Find or create test driver
    testDriver = db.prepare('SELECT * FROM drivers WHERE branch_id = ? LIMIT 1').get(branch1.id);
    if (!testDriver) {
      testDriver = driverService.createDriver({
        full_name: 'Juma Hassan',
        email: `juma.${Date.now()}@swifttrack.co.ke`,
        phone: `+254 744 ${Date.now().toString().slice(-6)}`,
        branch_id: branch1.id,
        national_id: `ID-${Date.now().toString().slice(-8)}`,
        kra_pin: `A00${Date.now().toString().slice(-6)}X`,
        license_number: `DL-MSA-${Date.now().toString().slice(-5)}`,
        license_classes: 'B, C1',
        license_expiry_date: '2028-01-01',
        employment_type: 'FULL_TIME'
      }, adminUser.id);
    }

    // Assign driver to vehicle
    const pairedVeh = vehicleService.updateVehicle(createdVehicle1.id, {
      assigned_driver_id: testDriver.id
    }, adminUser.id);
    assert.strictEqual(pairedVeh.assigned_driver_id, testDriver.id);

    // Verify driver's vehicle_id is updated
    const driverInDb = db.prepare('SELECT vehicle_id FROM drivers WHERE id = ?').get(testDriver.id);
    assert.strictEqual(driverInDb.vehicle_id, createdVehicle1.id);
  });

  // TEST 6: Fuel Logging & Consumption Economy (km/L)
  await runTest('6. Fuel Records & Economy: Refuel logs, KES spend, and automatic km/L calculation', async () => {
    const vId = createdVehicle1.id;

    // First full tank refuel at 18,000 km
    const fuel1 = vehicleService.recordFuelLog(vId, {
      fuel_date: '2026-09-01',
      quantity_liters: 60.0,
      cost_per_liter: 195.50,
      total_cost: 11730.0,
      odometer_km: 18000,
      gas_station_vendor: 'TotalEnergies Mombasa Road',
      fuel_type: 'DIESEL',
      is_full_tank: 1,
      voucher_number: 'VCH-00192',
      notes: 'Initial full tank fill'
    }, adminUser.id);

    assert(fuel1.id, 'Fuel log 1 should be created');
    assert.strictEqual(fuel1.calculated_consumption_kml, null, 'First full fill cannot compute km/L yet');

    // Second full tank refuel at 18,540 km (540 km driven / 60 liters = 9.0 km/L)
    const fuel2 = vehicleService.recordFuelLog(vId, {
      fuel_date: '2026-09-08',
      quantity_liters: 60.0,
      cost_per_liter: 196.00,
      total_cost: 11760.0,
      odometer_km: 18540,
      gas_station_vendor: 'Shell Westlands',
      fuel_type: 'DIESEL',
      is_full_tank: 1,
      voucher_number: 'VCH-00248',
      notes: 'Full fill after 540km route'
    }, adminUser.id);

    assert(fuel2.id, 'Fuel log 2 should be created');
    assert.strictEqual(fuel2.calculated_consumption_kml, 9.0, 'Consumption should be 540km / 60L = 9.0 km/L');

    // Verify vehicle odometer was advanced to 18,540 km
    const veh = vehicleService.getVehicleById(vId);
    assert.strictEqual(veh.current_odometer_km, 18540, 'Vehicle odometer must advance to refuel reading');

    // Retrieve fuel logs history
    const logsRes = vehicleService.getVehicleFuelLogs(vId);
    assert(logsRes.fuel_logs.length >= 2, 'Should return both fuel logs');
    assert.strictEqual(logsRes.summary.total_liters, 120.0);
    assert.strictEqual(logsRes.summary.total_spend, 23490.0);
    assert.strictEqual(logsRes.summary.average_consumption_kml, 9.0);
  });

  // TEST 7: Maintenance Records & Service Lifecycle
  await runTest('7. Maintenance Lifecycle: Service scheduling, SRV number, status sync & odometer targets', async () => {
    const vId = createdVehicle1.id;

    // Schedule maintenance in progress
    const maintRecord = vehicleService.recordMaintenance(vId, {
      service_type: 'PREVENTIVE_SCHEDULED',
      service_date: '2026-09-12',
      service_provider: 'DT Dobie Authorized Workshop Nairobi',
      service_odometer_km: 18600,
      total_cost: 24500.0,
      labor_cost: 7500.0,
      parts_cost: 17000.0,
      description: 'Major 20k service: engine oil, transmission fluid, brake pads',
      parts_replaced: 'Oil filter, fuel filter, genuine front brake pads',
      next_service_target_km: 23600,
      next_service_target_date: '2027-01-15',
      status: 'IN_PROGRESS'
    }, adminUser.id);

    assert(maintRecord.id, 'Maintenance record must be created');
    assert(maintRecord.service_number.startsWith('SRV-'), `Service number must start with SRV-, got ${maintRecord.service_number}`);
    assert.strictEqual(maintRecord.status, 'IN_PROGRESS');

    // Vehicle status should automatically transition to UNDER_MAINTENANCE
    let veh = vehicleService.getVehicleById(vId);
    assert.strictEqual(veh.status, 'UNDER_MAINTENANCE', 'Vehicle status should automatically become UNDER_MAINTENANCE');

    // Update maintenance job to COMPLETED
    const completedRecord = vehicleService.updateMaintenanceStatus(maintRecord.id, 'COMPLETED', {
      total_cost: 25000.0,
      parts_cost: 17500.0,
      actual_completion_date: '2026-09-13',
      notes: 'Completed ahead of schedule, road tested OK'
    }, adminUser.id);

    assert.strictEqual(completedRecord.status, 'COMPLETED');
    assert.strictEqual(completedRecord.total_cost, 25000.0);

    // Vehicle status should automatically transition back to AVAILABLE
    veh = vehicleService.getVehicleById(vId);
    assert.strictEqual(veh.status, 'AVAILABLE', 'Vehicle status should automatically return to AVAILABLE');
    assert.strictEqual(veh.last_service_odometer_km, 18600);
    assert.strictEqual(veh.next_service_odometer_km, 23600);
  });

  // TEST 8: Trip & Mileage Tracking
  await runTest('8. Mileage & Trip Tracking: Distance logging and cumulative odometer advance', async () => {
    const vId = createdVehicle1.id;
    const startKm = 18600;
    const endKm = 18685;
    const distance = endKm - startKm; // 85 km

    const tripLog = vehicleService.recordMileageLog(vId, {
      log_date: '2026-09-14',
      trip_type: 'DELIVERY_RUN',
      start_odometer_km: startKm,
      end_odometer_km: endKm,
      distance_km: distance,
      origin: 'Nairobi Central Depot',
      destination: 'Westlands Commercial Hubs',
      driver_id: testDriver.id,
      notes: 'Afternoon bulk dispatch route'
    }, adminUser.id);

    assert(tripLog.id, 'Trip log should be created');
    assert.strictEqual(tripLog.distance_km, 85);
    assert.strictEqual(tripLog.trip_type, 'DELIVERY_RUN');

    // Vehicle odometer should advance to 18,685 km
    const veh = vehicleService.getVehicleById(vId);
    assert.strictEqual(veh.current_odometer_km, 18685, 'Vehicle current odometer should advance to trip end km');

    // Query trip logs
    const trips = vehicleService.getVehicleMileageLogs(vId);
    assert(trips.mileage_logs.length >= 1, 'Should contain logged trip');
    assert(trips.summary.total_logged_distance_km >= 85);
  });

  // TEST 9: Service Countdown & Preventive Proximity Alerting
  await runTest('9. Service Due Proximity: Computes km_until_service and triggers alert when <= 500 km', async () => {
    // Register vehicle that is close to service target
    createdVehicle2 = vehicleService.createVehicle({
      registration_number: `KCA 99${Date.now().toString().slice(-2)}Q`,
      vehicle_type: 'MOTORCYCLE',
      make: 'Bajaj',
      model: 'Boxer BM150',
      capacity_kg: 80,
      initial_odometer_km: 9800,
      current_odometer_km: 9800,
      next_service_odometer_km: 10000, // 200 km remaining (<= 500 km)
      branch_id: branch1.id
    }, adminUser.id);

    const list = vehicleService.listVehicles({ branchId: branch1.id });
    const targetVeh = list.vehicles.find(v => v.id === createdVehicle2.id);

    assert(targetVeh, 'Target vehicle must be in list');
    assert.strictEqual(targetVeh.km_until_service, 200, 'Remaining km should be 10000 - 9800 = 200 km');
    assert.strictEqual(targetVeh.is_service_due, true, 'is_service_due must be TRUE when <= 500 km');
  });

  // TEST 10: Vehicle Telemetry & Operating Cost per Kilometer
  await runTest('10. Vehicle Telemetry & Operating Cost / km: Fuel spend, service spend, and KES/km', async () => {
    const tel = vehicleService.getVehicleTelemetry(createdVehicle1.id);
    assert(tel, 'Telemetry object must be returned');
    assert(tel.total_distance_km >= 685, `Total distance should be >= 685 km, got ${tel.total_distance_km}`);
    assert.strictEqual(tel.total_fuel_spend, 23490.0, 'Total fuel spend must match logged vouchers');
    assert.strictEqual(tel.total_maintenance_spend, 25000.0, 'Total maintenance spend must match service records');
    assert(Number(tel.operating_cost_per_km) > 0, `Operating cost per km must be positive, got ${tel.operating_cost_per_km}`);

    // Fleet-wide aggregate telemetry
    const fleetTel = vehicleService.getFleetVehiclesTelemetry(branch1.id);
    assert(fleetTel, 'Fleet telemetry must be returned');
    assert(fleetTel.total_vehicles >= 2, 'Fleet should have at least 2 vehicles');
    assert(fleetTel.total_payload_capacity_kg >= 1480, 'Total payload capacity must be aggregated');
    assert(fleetTel.monthly_fuel_spend >= 23490.0, 'Fleet fuel spend should be aggregated');
  });

  console.log('\n============================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} Tests Passed successfully.`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

executeSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
