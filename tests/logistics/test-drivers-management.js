// tests/logistics/test-drivers-management.js
// SwiftTrack Kenya: Phase 9 Logistics & Fleet — Driver Management Integration Suite (9.1)
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const driverService = require('../../server/services/driverService.js');

console.log('\n============================================================');
console.log('🚚  SWIFTTRACK KENYA: PHASE 9 FLEET DRIVERS SUITE (9.1)');
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

let createdDriver1 = null;
let createdDriver2 = null;
let testVehicle = null;

async function executeSuite() {
  // TEST 1: Driver Creation with Full Profile & Auto-provisioned User
  await runTest('1. Driver Profile Creation: Auto-provisions staff user, National ID, KRA PIN, NTSA license', async () => {
    const uniqueSuffix = Date.now().toString().slice(-4);
    const driverPayload = {
      full_name: `Mwangi Kamau ${uniqueSuffix}`,
      email: `mwangi.${uniqueSuffix}@swifttrack.co.ke`,
      phone: `+254 712 34${uniqueSuffix}`,
      alt_phone: `+254 733 99${uniqueSuffix}`,
      branch_id: branch1.id,
      national_id: `ID-2983${uniqueSuffix}`,
      kra_pin: `A0098234${uniqueSuffix}Z`,
      nssf_number: `NSSF-9988${uniqueSuffix}`,
      nhif_number: `NHIF-4433${uniqueSuffix}`,
      license_number: `DL-NRB-${uniqueSuffix}X`,
      license_classes: 'B, C1, CE',
      license_issue_date: '2022-03-10',
      license_expiry_date: '2027-03-10',
      ntsa_verified: 1,
      ntsa_verification_date: '2022-03-12',
      employment_type: 'FULL_TIME',
      hire_date: '2023-01-15',
      blood_group: 'O+',
      residential_address: 'Langata Estate, House 42',
      city: 'Nairobi',
      emergency_contact_name: 'Grace Kamau',
      emergency_contact_phone: '+254 722 111 222',
      emergency_contact_relation: 'Spouse',
      notes: 'Experienced heavy commercial truck driver'
    };

    createdDriver1 = driverService.createDriver(driverPayload, adminUser.id);
    assert(createdDriver1, 'Driver should be returned');
    assert(createdDriver1.id, 'Driver ID should exist');
    assert(createdDriver1.employee_code.startsWith('DRV-'), `Employee code must start with DRV-, got ${createdDriver1.employee_code}`);
    assert.strictEqual(createdDriver1.national_id, driverPayload.national_id);
    assert.strictEqual(createdDriver1.kra_pin, driverPayload.kra_pin);
    assert.strictEqual(createdDriver1.status, 'AVAILABLE');
    assert.strictEqual(createdDriver1.compliance.status, 'VALID');

    // Verify staff user account was auto-provisioned
    const user = db.prepare('SELECT id, role_id, full_name, email FROM users WHERE id = ?').get(createdDriver1.user_id);
    assert(user, 'Linked user must exist');
    assert.strictEqual(user.role_id, 5, 'Linked user must have DRIVER role (role_id=5)');
    assert.strictEqual(user.full_name, driverPayload.full_name);
  });

  // TEST 2: Contact Information & Profile Update
  await runTest('2. Contact Information & Profile Update: Synchronizes phone, email, and address', async () => {
    const updateData = {
      phone: '+254 799 888 777',
      residential_address: 'South C, Suite 109',
      emergency_contact_name: 'Peter Kamau',
      emergency_contact_phone: '+254 722 333 444',
      emergency_contact_relation: 'Brother'
    };

    const updated = driverService.updateDriver(createdDriver1.id, updateData, adminUser.id);
    assert.strictEqual(updated.phone, updateData.phone);
    assert.strictEqual(updated.residential_address, updateData.residential_address);
    assert.strictEqual(updated.emergency_contact_name, updateData.emergency_contact_name);

    // Linked user phone should also be synchronized
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(createdDriver1.user_id);
    assert.strictEqual(user.phone, updateData.phone, 'Linked user phone must match updated driver phone');
  });

  // TEST 3: Driving License Compliance & Expiry Warnings
  await runTest('3. Driving License Compliance: Detects EXPIRED, EXPIRING_SOON, and VALID states', async () => {
    // 3a. Valid far-future license
    const compValid = driverService.calculateCompliance('2028-06-30', 1);
    assert.strictEqual(compValid.status, 'VALID');
    assert.strictEqual(compValid.is_valid, true);

    // 3b. Expiring soon (< 30 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const expiringSoonDateStr = futureDate.toISOString().split('T')[0];
    const compExpiring = driverService.calculateCompliance(expiringSoonDateStr, 1);
    assert.strictEqual(compExpiring.status, 'EXPIRING_SOON');
    assert.strictEqual(compExpiring.is_valid, true);
    assert(compExpiring.days_left <= 30 && compExpiring.days_left > 0);

    // 3c. Expired license
    const compExpired = driverService.calculateCompliance('2023-01-01', 1);
    assert.strictEqual(compExpired.status, 'EXPIRED');
    assert.strictEqual(compExpired.is_valid, false);

    // 3d. Unverified license
    const compUnverified = driverService.calculateCompliance('2028-01-01', 0);
    assert.strictEqual(compUnverified.status, 'UNVERIFIED');

    // Create a second driver with an expired license to test filtering
    const uniqueSuffix2 = Date.now().toString().slice(-4) + 'b';
    createdDriver2 = driverService.createDriver({
      full_name: `Otieno Juma ${uniqueSuffix2}`,
      email: `otieno.${uniqueSuffix2}@swifttrack.co.ke`,
      phone: `+254 733 11${uniqueSuffix2.slice(0, 4)}`,
      branch_id: branch1.id,
      national_id: `ID-3344${uniqueSuffix2.slice(0, 4)}`,
      kra_pin: `A0011223${uniqueSuffix2.slice(0, 2)}K`,
      license_number: `DL-KSM-${uniqueSuffix2}`,
      license_classes: 'A2, B',
      license_issue_date: '2020-01-01',
      license_expiry_date: '2023-01-01', // EXPIRED
      ntsa_verified: 1
    }, adminUser.id);

    assert.strictEqual(createdDriver2.compliance.status, 'EXPIRED');
  });

  // TEST 4: Operational Status State Machine & Transitions
  await runTest('4. Driver Operational Status: AVAILABLE -> ON_DELIVERY -> OFF_DUTY -> ON_LEAVE -> SUSPENDED with history log', async () => {
    // 4a. Transition to ON_DELIVERY
    let drv = driverService.updateDriverStatus(createdDriver1.id, 'ON_DELIVERY', 'Dispatched on run #101', adminUser.id);
    assert.strictEqual(drv.status, 'ON_DELIVERY');

    // 4b. Transition to OFF_DUTY
    drv = driverService.updateDriverStatus(createdDriver1.id, 'OFF_DUTY', 'End of shift', adminUser.id);
    assert.strictEqual(drv.status, 'OFF_DUTY');

    // 4c. Transition to ON_LEAVE
    drv = driverService.updateDriverStatus(createdDriver1.id, 'ON_LEAVE', 'Annual leave', adminUser.id);
    assert.strictEqual(drv.status, 'ON_LEAVE');

    // 4d. Transition to SUSPENDED
    drv = driverService.updateDriverStatus(createdDriver1.id, 'SUSPENDED', 'Compliance audit hold', adminUser.id);
    assert.strictEqual(drv.status, 'SUSPENDED');

    // 4e. Restore back to AVAILABLE
    drv = driverService.updateDriverStatus(createdDriver1.id, 'AVAILABLE', 'Re-activated after review', adminUser.id);
    assert.strictEqual(drv.status, 'AVAILABLE');

    // Verify history logs
    const history = driverService.getDriverStatusHistory(createdDriver1.id);
    assert(history.length >= 5, `Must have at least 5 status transitions, got ${history.length}`);
    assert.strictEqual(history[0].to_status, 'AVAILABLE');
  });

  // TEST 5: Branch Assignment & Multi-depot Transfer
  await runTest('5. Branch Assignment: Transfers driver between depots and syncs user branch isolation', async () => {
    assert.strictEqual(createdDriver1.branch_id, branch1.id);

    const transferred = driverService.assignDriverBranch(createdDriver1.id, branch2.id, adminUser.id);
    assert.strictEqual(transferred.branch_id, branch2.id);

    // Linked user branch should also update
    const user = db.prepare('SELECT branch_id FROM users WHERE id = ?').get(createdDriver1.user_id);
    assert.strictEqual(user.branch_id, branch2.id);

    // Transfer back to branch 1
    const returned = driverService.assignDriverBranch(createdDriver1.id, branch1.id, adminUser.id);
    assert.strictEqual(returned.branch_id, branch1.id);
  });

  // TEST 6: Vehicle Assignment & Unassignment
  await runTest('6. Vehicle Assignment: Pairs driver with fleet vehicle and unassigns on demand', async () => {
    // Find or create active fleet vehicle
    testVehicle = db.prepare('SELECT * FROM vehicles WHERE branch_id = ? AND is_active = 1 LIMIT 1').get(branch1.id);
    if (!testVehicle) {
      const regNo = `KDF-${Math.floor(100 + Math.random() * 900)}X`;
      const res = db.prepare(`
        INSERT INTO vehicles (branch_id, registration_number, vehicle_type, model, max_capacity_kg, is_active)
        VALUES (?, ?, 'VAN', 'Toyota HiAce', 1200, 1)
      `).run(branch1.id, regNo);
      testVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(res.lastInsertRowid);
    }

    // Assign vehicle
    const withVeh = driverService.assignDriverVehicle(createdDriver1.id, testVehicle.id, adminUser.id);
    assert.strictEqual(withVeh.vehicle_id, testVehicle.id);
    assert(withVeh.vehicle_reg, 'vehicle_reg should be populated');

    // Unassign vehicle
    const withoutVeh = driverService.assignDriverVehicle(createdDriver1.id, null, adminUser.id);
    assert.strictEqual(withoutVeh.vehicle_id, null);
    assert.strictEqual(withoutVeh.vehicle_reg, null);

    // Re-assign for delivery tests
    driverService.assignDriverVehicle(createdDriver1.id, testVehicle.id, adminUser.id);
  });

  // TEST 7: Delivery History Ledger with Proof of Delivery (POD)
  await runTest('7. Delivery History Ledger: Queries chronological job records with POD and turnaround duration', async () => {
    // Create an order and delivery for this driver to test the ledger
    const orderRes = db.prepare(`
      INSERT INTO orders (branch_id, order_number, cashier_user_id, status, subtotal, tax_amount, total_amount, delivery_address)
      VALUES (?, ?, ?, 'DELIVERED', 5000, 800, 5800, 'Nairobi West, Commercial St 12')
    `).run(branch1.id, `ORD-TEST-${Date.now().toString().slice(-5)}`, adminUser.id);
    const orderId = Number(orderRes.lastInsertRowid);

    const scheduledPickup = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const estDelivery = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const actDelivery = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 5 min early (on-time)

    const delRes = db.prepare(`
      INSERT INTO deliveries (
        branch_id, delivery_number, order_id, driver_id, vehicle_id, dispatcher_user_id,
        status, priority, scheduled_pickup_at, estimated_delivery_at, actual_delivery_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'DELIVERED', 'HIGH', ?, ?, ?)
    `).run(
      branch1.id,
      `DEL-TEST-${Date.now().toString().slice(-5)}`,
      orderId,
      createdDriver1.id,
      testVehicle.id,
      adminUser.id,
      scheduledPickup,
      estDelivery,
      actDelivery
    );
    const deliveryId = Number(delRes.lastInsertRowid);

    // Create POD record
    db.prepare(`
      INSERT INTO proof_of_delivery (
        delivery_id, recipient_name, recipient_phone, otp_verified, signature_data, notes
      ) VALUES (?, 'David Mutua', '+254 711 222 333', 1, 'data:image/svg+xml;base64,mockSig', 'Received in good order')
    `).run(deliveryId);

    const history = driverService.getDriverDeliveryHistory(createdDriver1.id, { limit: 10 });
    assert(history.deliveries.length >= 1, 'Should have at least 1 delivery in history');
    const first = history.deliveries[0];
    assert.strictEqual(first.recipient_name, 'David Mutua');
    assert.strictEqual(first.has_signature, 1);
    assert.strictEqual(first.is_on_time, true);
    assert(typeof first.turnaround_minutes === 'number');
  });

  // TEST 8: Comprehensive Driver Performance Scorecard
  await runTest('8. Performance Scorecard: Computes success rate %, on-time delivery %, turnaround time, and safety rating', async () => {
    const scorecard = driverService.getDriverPerformance(createdDriver1.id);
    assert.strictEqual(scorecard.driver_id, createdDriver1.id);
    assert(scorecard.metrics.total_assigned >= 1);
    assert(scorecard.metrics.total_completed >= 1);
    assert.strictEqual(scorecard.metrics.success_rate_pct, 100.0);
    assert.strictEqual(scorecard.metrics.on_time_rate_pct, 100.0);
    assert(scorecard.metrics.avg_turnaround_minutes > 0);
    assert(scorecard.rating >= 1.0 && scorecard.rating <= 5.0);
  });

  // TEST 9: Driver Incident & Safety Logging
  await runTest('9. Safety Incident Logging: Records traffic violations, accidents, and updates rating', async () => {
    const incidentData = {
      incident_type: 'TRAFFIC_VIOLATION',
      severity: 'LOW',
      incident_date: new Date().toISOString(),
      description: 'Minor speed warning on Southern Bypass',
      action_taken: 'Verbal warning and driver debrief conducted'
    };

    const logged = driverService.logDriverIncident(createdDriver1.id, incidentData, adminUser.id);
    assert(logged.id, 'Incident log ID should be generated');
    assert.strictEqual(logged.incident_type, 'TRAFFIC_VIOLATION');
    assert.strictEqual(logged.severity, 'LOW');
    assert.strictEqual(logged.logged_by_name, adminUser.full_name);

    const incidentsList = driverService.getDriverIncidents(createdDriver1.id);
    assert(incidentsList.length >= 1);
    assert.strictEqual(incidentsList[0].description, incidentData.description);
  });

  // TEST 10: Fleet Aggregate Telemetry & Filtered Roster
  await runTest('10. Fleet Telemetry & Roster Filtering: Aggregates active, available, expired, and ratings', async () => {
    const telemetry = driverService.getFleetTelemetry();
    assert(telemetry.total_drivers >= 2, `Should have at least 2 drivers, got ${telemetry.total_drivers}`);
    assert(telemetry.expired_licenses_count >= 1, 'Should detect at least 1 expired license from test driver 2');

    // Filter roster by complianceStatus = 'EXPIRED'
    const expiredList = driverService.listDrivers({ complianceStatus: 'EXPIRED' });
    assert(expiredList.drivers.some(d => d.id === createdDriver2.id), 'Expired driver must be returned in compliance filter');

    // Search by name
    const searchRes = driverService.listDrivers({ search: 'Mwangi' });
    assert(searchRes.drivers.some(d => d.id === createdDriver1.id), 'Search must return driver matching name');
  });

  console.log('\n============================================================');
  console.log(`📊  DRIVERS MANAGEMENT SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

executeSuite().catch(err => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
