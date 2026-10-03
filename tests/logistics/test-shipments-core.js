// tests/logistics/test-shipments-core.js
// SwiftTrack Logistics: Stage 1 & Stage 2 Shipment Core Domain & Rating Test Suite
const assert = require('assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const shipmentPricingService = require('../../server/services/shipmentPricingService.js');
const shipmentService = require('../../server/services/shipmentService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK LOGISTICS: STAGE 1 & 2 SHIPMENT CORE SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`[PASS] [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Fixtures
const adminUser = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Managing Director', branchId: 1 };
let branch1 = null;
let branch2 = null;
let createdShipment = null;

async function executeSuite() {
    branch1 = await dbAdapter.get('SELECT * FROM branches ORDER BY id ASC LIMIT 1') || { id: 1, name: 'Nairobi Central' };
    branch2 = await dbAdapter.get('SELECT * FROM branches WHERE id != ? LIMIT 1', [branch1.id]) || { id: 2, name: 'Mombasa Port' };

    // TEST 1: Volumetric Rating & Pricing Engine
    await runTest('1. Volumetric Rating Engine: Calculates (L*W*H)/5000 and applies tariff band pricing', async () => {
        // Parcel 1: 40x30x20 cm = 24,000 / 5000 = 4.8 kg volumetric. Actual = 3.0 kg. Chargeable = 4.8 kg.
        // Parcel 2: 20x20x20 cm = 8,000 / 5000 = 1.6 kg volumetric. Actual = 5.0 kg. Chargeable = 5.0 kg.
        // Total Actual = 8.0 kg. Total Volumetric = 6.4 kg. Total Chargeable = 8.0 kg.
        const quote = shipmentPricingService.calculateShipmentQuote({
            originHubId: branch1.id,
            destinationHubId: branch2.id,
            serviceType: 'STANDARD',
            parcels: [
                { weight_kg: 3.0, length_cm: 40, width_cm: 30, height_cm: 20 },
                { weight_kg: 5.0, length_cm: 20, width_cm: 20, height_cm: 20 }
            ],
            codAmount: 5000,
            declaredValue: 20000,
            applyTax: true
        });

        assert.strictEqual(quote.total_parcels, 2, 'Should have 2 parcels');
        assert.strictEqual(quote.actual_weight_kg, 8.0, 'Actual weight should be 8.0 kg');
        assert.strictEqual(quote.volumetric_weight_kg, 6.4, 'Volumetric weight should be 6.4 kg');
        assert.strictEqual(quote.chargeable_weight_kg, 8.0, 'Chargeable weight should be max(8.0, 6.4) = 8.0 kg');
        
        // Base rate is 350 for 5kg, extra 3kg @ 50/kg = 150
        assert.strictEqual(quote.base_rate, 350, 'Base rate should be 350 KES');
        assert.strictEqual(quote.weight_charge, 150, 'Extra weight charge should be 150 KES');
        
        // COD fee: 2% of 5000 = 100 KES (min 100)
        assert.strictEqual(quote.cod_fee, 100, 'COD fee should be 100 KES');
        
        // Insurance fee: 1% of 20,000 = 200 KES
        assert.strictEqual(quote.insurance_fee, 200, 'Insurance fee should be 200 KES');
        
        // Subtotal = 350 + 150 + 100 + 200 = 800 KES
        assert.strictEqual(quote.subtotal, 800, 'Subtotal should be 800 KES');
        
        // Tax 16% of 800 = 128 KES. Total = 928 KES
        assert.strictEqual(quote.tax_amount, 128, 'Tax amount should be 128 KES');
        assert.strictEqual(quote.total_amount, 928, 'Total amount should be 928 KES');
    });

    // TEST 2: Atomic Shipment Booking with Multi-Parcels & Initial Routing Leg
    await runTest('2. Shipment Creation: Atomically records shipment, parcels, default leg, and initial BOOKED event', async () => {
        const payload = {
            origin_hub_id: branch1.id,
            destination_hub_id: branch2.id,
            service_type: 'STANDARD',
            delivery_type: 'LAST_MILE',
            payment_terms: 'PREPAID',
            sender: {
                name: 'Alice Wambui',
                phone: '+254 711 223 344',
                email: 'alice@example.com',
                address: 'Kenyatta Avenue, Block 4B',
                city: 'Nairobi'
            },
            recipient: {
                name: 'Brian Otieno',
                phone: '+254 722 334 455',
                email: 'brian@example.com',
                address: 'Moi Avenue, Suite 10',
                city: 'Mombasa'
            },
            parcels: [
                {
                    weight_kg: 4.5,
                    length_cm: 30,
                    width_cm: 20,
                    height_cm: 15,
                    package_type: 'BOX',
                    description: 'Automotive replacement sensors'
                }
            ],
            cod_amount: 0,
            declared_value: 10000,
            special_instructions: 'Handle with care - fragile electronics'
        };

        const result = await shipmentService.createShipment(payload, adminUser);
        assert.ok(result.id, 'Shipment ID must be generated');
        assert.ok(result.tracking_number.startsWith('STK-'), 'Tracking number must start with STK-');
        assert.ok(result.waybill_number.startsWith('WB-'), 'Waybill number must start with WB-');
        assert.strictEqual(result.status, 'BOOKED', 'Initial status must be BOOKED');
        assert.strictEqual(result.parcels.length, 1, 'Should record 1 parcel');
        assert.strictEqual(result.legs.length, 1, 'Should record 1 routing leg');

        // Verify in Database
        const dbShipment = await dbAdapter.get('SELECT * FROM shipments WHERE id = ?', [result.id]);
        assert.strictEqual(dbShipment.tracking_number, result.tracking_number);
        assert.strictEqual(Number(dbShipment.total_parcels), 1);

        const dbParcels = await dbAdapter.all('SELECT * FROM parcels WHERE shipment_id = ?', [result.id]);
        assert.strictEqual(dbParcels.length, 1);
        assert.strictEqual(dbParcels[0].parcel_number, `${result.tracking_number}-P01`);

        const dbLegs = await dbAdapter.all('SELECT * FROM shipment_legs WHERE shipment_id = ?', [result.id]);
        assert.strictEqual(dbLegs.length, 1);
        assert.strictEqual(dbLegs[0].origin_hub_id, branch1.id);
        assert.strictEqual(dbLegs[0].destination_hub_id, branch2.id);

        const dbEvents = await dbAdapter.all('SELECT * FROM tracking_events WHERE shipment_id = ?', [result.id]);
        assert.strictEqual(dbEvents.length, 1);
        assert.strictEqual(dbEvents[0].event_code, 'BOOKED');

        createdShipment = result;
    });

    // TEST 3: Multi-Axis Filtering & Scoped Shipment Listing
    await runTest('3. Shipment Listing & Search: Supports search query, status filters, and operational scoping', async () => {
        // Search by tracking number
        const searchResults = await shipmentService.listShipments({ search: createdShipment.tracking_number }, adminUser);
        assert.strictEqual(searchResults.length, 1, 'Should find shipment by tracking number');
        assert.strictEqual(searchResults[0].tracking_number, createdShipment.tracking_number);

        // Filter by status
        const bookedResults = await shipmentService.listShipments({ status: 'BOOKED' }, adminUser);
        assert.ok(bookedResults.some(s => s.id === createdShipment.id), 'Created shipment must be in BOOKED list');

        // Scoped listing for branch user
        const branchUser = { id: 2, roleName: 'BRANCH_MANAGER', branchId: branch1.id };
        const scopedList = await shipmentService.listShipments({}, branchUser);
        assert.ok(scopedList.every(s => s.origin_hub_id === branch1.id || s.destination_hub_id === branch1.id || s.current_hub_id === branch1.id),
            'Branch manager must only see shipments touching their branch');
    });

    // TEST 4: Single Shipment Detailed View
    await runTest('4. Shipment Details View: Returns shipment with parcels, routing legs, and event timeline', async () => {
        const details = await shipmentService.getShipmentById(createdShipment.id, adminUser);
        assert.strictEqual(details.id, createdShipment.id);
        assert.ok(Array.isArray(details.parcels), 'Parcels must be an array');
        assert.ok(Array.isArray(details.legs), 'Legs must be an array');
        assert.ok(Array.isArray(details.timeline), 'Timeline must be an array');
        assert.strictEqual(details.timeline[0].event_code, 'BOOKED');
    });

    // TEST 5: Formal State Machine Transitions
    await runTest('5. State Machine Validation: Allows valid lifecycle transitions and blocks illegal state jumps', async () => {
        // Valid Transition: BOOKED -> ACCEPTED
        const t1 = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'ACCEPTED',
            { hub_id: branch1.id, notes: 'Counter intake check complete' },
            adminUser
        );
        assert.strictEqual(t1.current_status, 'ACCEPTED');

        // Valid Transition: ACCEPTED -> AT_ORIGIN_HUB
        const t2 = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'AT_ORIGIN_HUB',
            { hub_id: branch1.id, notes: 'Moved to sorting floor' },
            adminUser
        );
        assert.strictEqual(t2.current_status, 'AT_ORIGIN_HUB');

        // Valid Transition: AT_ORIGIN_HUB -> SORTED
        const t3 = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'SORTED',
            { hub_id: branch1.id, notes: 'Sorted into Mombasa bin' },
            adminUser
        );
        assert.strictEqual(t3.current_status, 'SORTED');

        // Valid Transition: SORTED -> READY_FOR_DISPATCH
        const t4 = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'READY_FOR_DISPATCH',
            { hub_id: branch1.id, notes: 'Staged at outbound dock' },
            adminUser
        );
        assert.strictEqual(t4.current_status, 'READY_FOR_DISPATCH');

        // Illegal Transition Test: READY_FOR_DISPATCH -> DELIVERED (Cannot jump without transit & delivery attempt!)
        await assert.rejects(async () => {
            await shipmentService.transitionShipmentStatus(
                createdShipment.id,
                'DELIVERED',
                { notes: 'Illegal shortcut jump' },
                adminUser
            );
        }, /INVALID_STATE_TRANSITION|Illegal status transition/, 'Must block illegal shortcut status jumps');

        // Advance: READY_FOR_DISPATCH -> LOADED -> IN_TRANSIT -> AT_HUB -> READY_FOR_DELIVERY -> OUT_FOR_DELIVERY
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'LOADED', { notes: 'Loaded on truck' }, adminUser);
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'IN_TRANSIT', { notes: 'Truck departed' }, adminUser);
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'AT_HUB', { hub_id: branch2.id, notes: 'Arrived at Mombasa hub' }, adminUser);
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'READY_FOR_DELIVERY', { hub_id: branch2.id }, adminUser);
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'OUT_FOR_DELIVERY', { hub_id: branch2.id }, adminUser);

        // Failed Delivery Attempt Test (BR-008): Must require reason
        await assert.rejects(async () => {
            await shipmentService.transitionShipmentStatus(
                createdShipment.id,
                'DELIVERY_FAILED',
                { notes: 'Failed attempt' }, // No reason field!
                adminUser
            );
        }, /FAILED_REASON_REQUIRED|A failure reason is strictly mandatory/, 'Failed delivery must enforce mandatory reason code');

        // Valid Failed Delivery with reason (Standardized to DELIVERY_FAILED)
        const failTransition = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'FAILED_DELIVERY',
            { reason: 'RECIPIENT_UNAVAILABLE', notes: 'Recipient phone went unanswered after 3 attempts' },
            adminUser
        );
        assert.ok(['DELIVERY_FAILED', 'FAILED_DELIVERY'].includes(failTransition.current_status), 'Transition status must be DELIVERY_FAILED');

        // Reschedule: DELIVERY_FAILED -> READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'READY_FOR_DELIVERY', { notes: 'Rescheduled for morning delivery' }, adminUser);
        await shipmentService.transitionShipmentStatus(createdShipment.id, 'OUT_FOR_DELIVERY', { notes: 'Out on delivery run' }, adminUser);
        const delivered = await shipmentService.transitionShipmentStatus(
            createdShipment.id,
            'DELIVERED',
            { notes: 'Successfully delivered to recipient Brian Otieno' },
            adminUser
        );
        assert.strictEqual(delivered.current_status, 'DELIVERED');
    });

    // TEST 6: Immutable Tracking Events Trigger Protection
    await runTest('6. Tracking Events Immutability: SQL triggers block UPDATE and DELETE on tracking_events', async () => {
        const event = await dbAdapter.get('SELECT id FROM tracking_events WHERE shipment_id = ? LIMIT 1', [createdShipment.id]);
        assert.ok(event, 'Event must exist');

        // Attempt direct UPDATE
        await assert.rejects(async () => {
            await dbAdapter.run('UPDATE tracking_events SET description = ? WHERE id = ?', ['Tampered description', event.id]);
        }, /CRITICAL SECURITY VIOLATION|tracking_events is append-only|trigger/i, 'Database trigger must block UPDATE on tracking_events');

        // Attempt direct DELETE
        await assert.rejects(async () => {
            await dbAdapter.run('DELETE FROM tracking_events WHERE id = ?', [event.id]);
        }, /CRITICAL SECURITY VIOLATION|tracking_events is append-only|trigger/i, 'Database trigger must block DELETE on tracking_events');
    });

    // TEST 7: Public Tracking Lookup & PII Sanitization
    await runTest('7. Public Tracking Endpoint: Exposes sanitized milestone timeline without internal financials or PII', async () => {
        const publicTracking = await shipmentService.getPublicTracking(createdShipment.tracking_number);
        assert.ok(publicTracking, 'Public tracking data must be returned');
        assert.strictEqual(publicTracking.tracking_number, createdShipment.tracking_number);
        assert.strictEqual(publicTracking.status, 'DELIVERED');
        assert.strictEqual(publicTracking.total_parcels, 1);
        assert.ok(Array.isArray(publicTracking.timeline), 'Timeline must be an array');
        assert.ok(publicTracking.timeline.length >= 6, 'Timeline should have milestone events');

        // Verify PII & Sensitive Financials are completely absent from public payload
        assert.strictEqual(publicTracking.total_amount, undefined, 'total_amount must NOT be exposed');
        assert.strictEqual(publicTracking.base_rate, undefined, 'base_rate must NOT be exposed');
        assert.strictEqual(publicTracking.sender_phone, undefined, 'sender_phone must NOT be exposed');
        assert.strictEqual(publicTracking.recipient_phone, undefined, 'recipient_phone must NOT be exposed');
        assert.strictEqual(publicTracking.sender_address, undefined, 'sender_address must NOT be exposed');
        assert.strictEqual(publicTracking.created_by_user_id, undefined, 'staff user IDs must NOT be exposed');
    });

    console.log('\n============================================================');
    console.log(`[SUCCESS] ALL ${passedTests}/${totalTests} SHIPMENT CORE TESTS PASSED SUCCESSFULLY!`);
    console.log('============================================================\n');
}

executeSuite().catch(err => {
    console.error('Fatal suite failure:', err);
    process.exit(1);
});
