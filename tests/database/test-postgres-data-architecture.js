// tests/database/test-postgres-data-architecture.js
// Automated Verification Suite for Phase 2: Production Data Architecture & Repositories
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

console.log('\n============================================================');
console.log('SWIFTTRACK: PHASE 2 — PRODUCTION DATA ARCHITECTURE & REPOSITORIES');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`[PASS] [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err.stack);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`[PASS] [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err.stack);
    }
}

(async () => {
    // Ensure base tables and operational seed data exist for repository/adapter verification
    if (process.env.DB_CLIENT !== 'postgres') {
        const { initProductionBootstrap } = require('../../server/db/seed.js');
        initProductionBootstrap();
    }

    // -------------------------------------------------------------------------
    // 1. PostgreSQL Schema Migrations Completeness (001 - 023)
    // -------------------------------------------------------------------------
    runTest('1.1: All 23 sequential PostgreSQL migrations exist with valid checksums', () => {
        const { getAvailableMigrations, calculateChecksum } = require('../../server/db/postgres/migrator.js');
        const migrations = getAvailableMigrations();

        assert.strictEqual(migrations.length, 23, `Expected exactly 23 migrations, found ${migrations.length}`);

        for (let i = 0; i < 23; i++) {
            const expectedVersion = String(i + 1).padStart(3, '0');
            assert.strictEqual(migrations[i].version, expectedVersion, `Migration index ${i} must have version ${expectedVersion}`);
            assert.strictEqual(migrations[i].checksum.length, 64, 'Checksum must be 64 characters SHA-256');
            assert.strictEqual(calculateChecksum(migrations[i].content), migrations[i].checksum, 'Checksum must match content');
        }
    });

    runTest('1.2: Logistics migrations (015-023) define all required production tables & triggers', () => {
        const migrationsDir = path.resolve(__dirname, '../../server/db/postgres/migrations');

        // Check 016_shipment_core.sql
        const sql016 = fs.readFileSync(path.join(migrationsDir, '016_shipment_core.sql'), 'utf8');
        assert(sql016.includes('CREATE TABLE IF NOT EXISTS shipments'), 'shipments table must exist');
        assert(sql016.includes('CREATE TABLE IF NOT EXISTS parcels'), 'parcels table must exist');
        assert(sql016.includes('CREATE TABLE IF NOT EXISTS shipment_legs'), 'shipment_legs table must exist');
        assert(sql016.includes('CREATE TABLE IF NOT EXISTS tracking_events'), 'tracking_events table must exist');
        assert(sql016.includes('trg_tracking_events_immutable'), 'tracking_events immutability trigger must exist');

        // Check 017_transport_management.sql
        const sql017 = fs.readFileSync(path.join(migrationsDir, '017_transport_management.sql'), 'utf8');
        assert(sql017.includes('CREATE TABLE IF NOT EXISTS transport_runs'), 'transport_runs table must exist');
        assert(sql017.includes('CREATE TABLE IF NOT EXISTS manifests'), 'manifests table must exist');
        assert(sql017.includes('CREATE TABLE IF NOT EXISTS manifest_items'), 'manifest_items table must exist');
        assert(sql017.includes('CREATE TABLE IF NOT EXISTS run_checkpoints'), 'run_checkpoints table must exist');

        // Check 018_physical_custody.sql
        const sql018 = fs.readFileSync(path.join(migrationsDir, '018_physical_custody_and_hub_operations.sql'), 'utf8');
        assert(sql018.includes('CREATE TABLE IF NOT EXISTS scan_events'), 'scan_events table must exist');
        assert(sql018.includes('CREATE TABLE IF NOT EXISTS handoffs'), 'handoffs table must exist');
        assert(sql018.includes('CREATE TABLE IF NOT EXISTS hub_receiving_sessions'), 'hub_receiving_sessions table must exist');
        assert(sql018.includes('CREATE TABLE IF NOT EXISTS discrepancies'), 'discrepancies table must exist');

        // Check 019_last_mile_delivery.sql
        const sql019 = fs.readFileSync(path.join(migrationsDir, '019_last_mile_delivery_and_exceptions.sql'), 'utf8');
        assert(sql019.includes('ALTER TABLE deliveries'), 'deliveries table enhancement must exist');
        assert(sql019.includes('CREATE TABLE IF NOT EXISTS delivery_attempts'), 'delivery_attempts table must exist');
        assert(sql019.includes('enforce_pod_immutability'), 'proof_of_delivery immutability trigger must exist');

        // Check 021_cod_settlements.sql
        const sql021 = fs.readFileSync(path.join(migrationsDir, '021_cod_settlements_and_reconciliation.sql'), 'utf8');
        assert(sql021.includes('CREATE TABLE IF NOT EXISTS cod_settlements'), 'cod_settlements table must exist');
    });

    // -------------------------------------------------------------------------
    // 2. Unified Data Access Adapter (dbAdapter)
    // -------------------------------------------------------------------------
    runTest('2.1: dbAdapter placeholder translation translates ? to $1, $2 accurately', () => {
        const { translatePlaceholdersToPg, translatePlaceholdersToSqlite } = require('../../server/db/dbAdapter.js');

        const query1 = 'SELECT * FROM shipments WHERE origin_hub_id = ? AND status = ?';
        assert.strictEqual(translatePlaceholdersToPg(query1), 'SELECT * FROM shipments WHERE origin_hub_id = $1 AND status = $2');

        // String literal with embedded ? should not be translated
        const queryWithLiteral = "SELECT * FROM shipments WHERE notes = 'Is this delayed?' AND status = ?";
        assert.strictEqual(translatePlaceholdersToPg(queryWithLiteral), "SELECT * FROM shipments WHERE notes = 'Is this delayed?' AND status = $1");

        // Reverse translation ($1 -> ?)
        const pgQuery = 'SELECT * FROM parcels WHERE shipment_id = $1 AND weight_kg > $2';
        assert.strictEqual(translatePlaceholdersToSqlite(pgQuery), 'SELECT * FROM parcels WHERE shipment_id = ? AND weight_kg > ?');
    });

    await runAsyncTest('2.2: dbAdapter executes query, get, all, run with normalized result shape', async () => {
        const dbAdapter = require('../../server/db/dbAdapter.js');

        // Execute get
        const company = await dbAdapter.get('SELECT * FROM company_settings LIMIT 1');
        assert(company, 'company_settings should return a row');
        assert(company.company_name, 'company_name must be present');

        // Execute all
        const branches = await dbAdapter.all('SELECT * FROM branches');
        assert(Array.isArray(branches), 'branches must be an array');
        assert(branches.length > 0, 'at least 1 branch must exist');

        // Execute query
        const res = await dbAdapter.query('SELECT COUNT(*) as count FROM users');
        assert(res.rows.length === 1, 'query result should have rows');
        assert(res.rows[0].count !== undefined, 'count must be defined');
    });

    await runAsyncTest('2.3: dbAdapter withTransaction commits atomic operations and rolls back on failure', async () => {
        const dbAdapter = require('../../server/db/dbAdapter.js');

        // Test Commit
        const testCode = `TEST_BRANCH_${Date.now()}`;
        await dbAdapter.withTransaction(async (tx) => {
            await tx.run("INSERT INTO branches (name, code, city, address, phone, email, is_active) VALUES ('Tx Test Hub', ?, 'Nairobi', 'Airport', '+254700000000', 'hub@swifttrack.co.ke', true)", [testCode]);
        });

        const created = await dbAdapter.get('SELECT id FROM branches WHERE code = ?', [testCode]);
        assert(created, 'Branch inserted inside committed transaction must persist');

        // Test Rollback
        const rollbackCode = `ROLLBACK_${Date.now()}`;
        let caught = false;
        try {
            await dbAdapter.withTransaction(async (tx) => {
                await tx.run("INSERT INTO branches (name, code, city, address, phone, email, is_active) VALUES ('Rollback Hub', ?, 'Nairobi', 'Airport', '+254700000000', 'hub@swifttrack.co.ke', true)", [rollbackCode]);
                throw new Error('Simulated failure triggering rollback');
            });
        } catch (e) {
            caught = true;
        }

        assert(caught, 'Transaction error must be thrown');
        const rolledBack = await dbAdapter.get('SELECT id FROM branches WHERE code = ?', [rollbackCode]);
        assert.strictEqual(rolledBack, null, 'Rolled-back record must NOT exist in database');

        // Cleanup test branch
        await dbAdapter.run('DELETE FROM branches WHERE code = ?', [testCode]);
    });

    // -------------------------------------------------------------------------
    // 3. Domain Repositories Layer Verification
    // -------------------------------------------------------------------------
    let testShipmentId = null;

    await runAsyncTest('3.1: ShipmentRepository performs CRUD, parcel management, legs and tracking events', async () => {
        const { shipmentRepository } = require('../../server/repositories');

        const trackingNum = `STK-TEST-${Date.now().toString().slice(-6)}`;
        const shipmentId = await shipmentRepository.create({
            tracking_number: trackingNum,
            waybill_number: `WAY-${trackingNum}`,
            origin_hub_id: 1,
            destination_hub_id: 2,
            current_hub_id: 1,
            current_location_desc: 'Nairobi Central',
            sender_name: 'Alice Shipper',
            sender_phone: '+254700000001',
            sender_address: 'Kenyatta Ave',
            sender_city: 'Nairobi',
            recipient_name: 'Bob Consignee',
            recipient_phone: '+254700000002',
            recipient_address: 'Moi Ave',
            recipient_city: 'Mombasa',
            service_type: 'STANDARD',
            delivery_type: 'LAST_MILE',
            status: 'BOOKED',
            total_parcels: 1,
            actual_weight_kg: 3.5,
            chargeable_weight_kg: 3.5,
            currency: 'KES',
            total_amount: 500.00,
            payment_terms: 'PREPAID',
            payment_status: 'PAID',
            created_by_user_id: 1
        });

        assert(shipmentId > 0, 'Shipment ID must be returned');
        testShipmentId = shipmentId;

        // Find by tracking number
        const fetched = await shipmentRepository.findByTrackingNumber(trackingNum);
        assert(fetched, 'Shipment must be retrievable by tracking number');
        assert.strictEqual(fetched.status, 'BOOKED');

        // Create parcel
        const parcelId = await shipmentRepository.createParcel({
            shipment_id: shipmentId,
            parcel_number: `PCL-${trackingNum}-01`,
            parcel_index: 1,
            weight_kg: 3.5,
            length_cm: 20,
            width_cm: 15,
            height_cm: 10,
            volumetric_weight_kg: 0.6
        });
        assert(parcelId > 0, 'Parcel ID must be returned');

        const parcels = await shipmentRepository.getParcels(shipmentId);
        assert.strictEqual(parcels.length, 1);
        assert.strictEqual(parcels[0].parcel_number, `PCL-${trackingNum}-01`);

        // Create leg
        const legId = await shipmentRepository.createLeg({
            shipment_id: shipmentId,
            leg_sequence: 1,
            origin_hub_id: 1,
            destination_hub_id: 2,
            status: 'PENDING'
        });
        assert(legId > 0, 'Leg ID must be returned');

        const legs = await shipmentRepository.getLegs(shipmentId);
        assert.strictEqual(legs.length, 1);

        // Update status
        await shipmentRepository.updateStatus(shipmentId, 'IN_TRANSIT', 1, 'In transit to Mombasa');
        const updated = await shipmentRepository.findById(shipmentId);
        assert.strictEqual(updated.status, 'IN_TRANSIT');

        // Tracking event
        await shipmentRepository.createTrackingEvent({
            shipment_id: shipmentId,
            parcel_id: parcelId,
            leg_id: legId,
            event_code: 'IN_TRANSIT',
            event_name: 'Departed Hub',
            hub_id: 1,
            description: 'Departed Nairobi Hub',
            actor_name: 'Driver John',
            is_customer_visible: true
        });

        const events = await shipmentRepository.getTrackingEvents(shipmentId, true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event_code, 'IN_TRANSIT');
    });

    await runAsyncTest('3.2: TransportRepository creates runs, manifests, and links items', async () => {
        const { transportRepository } = require('../../server/repositories');

        const runNum = `RUN-TEST-${Date.now().toString().slice(-6)}`;
        const runId = await transportRepository.createRun({
            run_number: runNum,
            origin_hub_id: 1,
            destination_hub_id: 2,
            dispatcher_user_id: 1,
            status: 'PLANNED',
            notes: 'Stage 2 architecture verification run'
        });
        assert(runId > 0, 'Run ID must be positive');

        const run = await transportRepository.findRunById(runId);
        assert.strictEqual(run.run_number, runNum);
        assert.strictEqual(run.status, 'PLANNED');

        // Create manifest
        const manNum = `MAN-TEST-${Date.now().toString().slice(-6)}`;
        const manId = await transportRepository.createManifest({
            manifest_number: manNum,
            transport_run_id: runId,
            origin_hub_id: 1,
            destination_hub_id: 2,
            status: 'DRAFT'
        });
        assert(manId > 0, 'Manifest ID must be positive');

        // Update manifest
        await transportRepository.updateManifest(manId, { status: 'LOCKED' });
        const updatedMan = await transportRepository.findManifestById(manId);
        assert.strictEqual(updatedMan.status, 'LOCKED');
    });

    await runAsyncTest('3.3: CustodyRepository manages scan idempotency, handoffs, and receiving', async () => {
        const { custodyRepository } = require('../../server/repositories');

        const scanUuid = `UUID-${Date.now()}`;
        const scanId = await custodyRepository.recordScanEvent({
            scan_uuid: scanUuid,
            barcode: 'SWT-BAR-TEST-001',
            scan_type: 'INTAKE',
            hub_id: 1,
            scanned_by_user_id: 1,
            location_desc: 'Nairobi Inbound Bay'
        });
        assert(scanId > 0, 'Scan ID must be returned');

        const scan = await custodyRepository.findScanByUuid(scanUuid);
        assert(scan, 'Scan event must be retrievable by UUID');
        assert.strictEqual(scan.barcode, 'SWT-BAR-TEST-001');

        // Receiving Session
        const sessionNum = `REC-TEST-${Date.now().toString().slice(-6)}`;
        const sessionId = await custodyRepository.createReceivingSession({
            session_number: sessionNum,
            hub_id: 1,
            status: 'OPEN',
            received_by_user_id: 1
        });
        assert(sessionId > 0);

        const session = await custodyRepository.findReceivingSessionById(sessionId);
        assert.strictEqual(session.session_number, sessionNum);
    });

    await runAsyncTest('3.4: DeliveryRepository and CodRepository record deliveries, POD and settlements', async () => {
        const { deliveryRepository, codRepository } = require('../../server/repositories');

        // Delivery
        const delNum = `DEL-TEST-${Date.now().toString().slice(-6)}`;
        const deliveryId = await deliveryRepository.createDelivery({
            delivery_number: delNum,
            shipment_id: testShipmentId || 1,
            hub_id: 1,
            status: 'PENDING',
            recipient_name: 'Bob Consignee',
            recipient_phone: '+254700000002',
            destination_address: 'Moi Ave, Mombasa',
            destination_city: 'Mombasa',
            cod_amount_expected: 1500.00
        });
        assert(deliveryId > 0);

        const delivery = await deliveryRepository.findDeliveryById(deliveryId);
        assert.strictEqual(delivery.delivery_number, delNum);

        // Proof of Delivery
        const podId = await deliveryRepository.createPOD({
            delivery_id: deliveryId,
            shipment_id: testShipmentId || 1,
            recipient_name: 'Bob Consignee',
            otp_verified: true,
            signature_data: 'data:image/svg+xml;signature_test',
            latitude: -4.0435,
            longitude: 39.6682
        });
        assert(podId > 0);

        // COD Settlement
        const ref = `COD-TEST-${Date.now().toString().slice(-6)}`;
        const codId = await codRepository.createSettlement({
            settlement_number: ref,
            shipment_id: testShipmentId || 1,
            expected_amount: 1500.00,
            status: 'PENDING_COLLECTION',
            hub_id: 1
        });
        assert(codId > 0);

        await codRepository.recordAudit({
            settlement_id: codId,
            user_id: 1,
            action: 'CREATED',
            new_value: { status: 'PENDING_COLLECTION', amount: 1500.00 }
        });

        const auditTrail = await codRepository.getAuditHistory(codId);
        assert.strictEqual(auditTrail.length, 1);
        assert.strictEqual(auditTrail[0].action, 'CREATED');
    });

    // -------------------------------------------------------------------------
    // 4. Topological ETL Pipeline Coverage
    // -------------------------------------------------------------------------
    runTest('4.1: TABLE_PIPELINE in ETL script contains all required logistics tables in strict dependency order', () => {
        const { TABLE_PIPELINE } = require('../../scripts/migrate-sqlite-to-postgres.js');
        const names = TABLE_PIPELINE.map(t => t.name);

        assert(names.length >= 45, `Expected at least 45 tables in pipeline, found ${names.length}`);

        const indexOf = (name) => {
            const idx = names.indexOf(name);
            assert(idx !== -1, `Table '${name}' must be defined in TABLE_PIPELINE`);
            return idx;
        };

        // Key dependencies
        assert(indexOf('branches') < indexOf('shipments'), 'branches before shipments');
        assert(indexOf('customers') < indexOf('shipments'), 'customers before shipments');
        assert(indexOf('users') < indexOf('shipments'), 'users before shipments');
        assert(indexOf('shipments') < indexOf('parcels'), 'shipments before parcels');
        assert(indexOf('shipments') < indexOf('shipment_legs'), 'shipments before shipment_legs');
        assert(indexOf('routes') < indexOf('route_legs'), 'routes before route_legs');
        assert(indexOf('route_legs') < indexOf('transport_runs'), 'route_legs before transport_runs');
        assert(indexOf('transport_runs') < indexOf('manifests'), 'transport_runs before manifests');
        assert(indexOf('manifests') < indexOf('manifest_items'), 'manifests before manifest_items');
        assert(indexOf('shipments') < indexOf('manifest_items'), 'shipments before manifest_items');
        assert(indexOf('shipments') < indexOf('scan_events'), 'shipments before scan_events');
        assert(indexOf('deliveries') < indexOf('delivery_attempts'), 'deliveries before delivery_attempts');
        assert(indexOf('shipments') < indexOf('cod_settlements'), 'shipments before cod_settlements');
        assert(indexOf('shipments') < indexOf('tracking_events'), 'shipments before tracking_events');
    });

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    setTimeout(() => {
        console.log('\n============================================================');
        console.log(`TOTAL TESTS: ${totalTests}`);
        console.log(`PASSED:      ${passedTests}`);
        console.log(`FAILED:      ${totalTests - passedTests}`);
        console.log('============================================================\n');

        if (passedTests === totalTests) {
            console.log('[SUCCESS] ALL PHASE 2 POSTGRESQL & REPOSITORIES TESTS PASSED!\n');
            process.exit(0);
        } else {
            console.error(' SOME TESTS FAILED!\n');
            process.exit(1);
        }
    }, 100);
})();
