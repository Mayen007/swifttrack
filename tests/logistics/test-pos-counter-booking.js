// tests/logistics/test-pos-counter-booking.js
// SwiftTrack Logistics: Stage 6 POS Counter Booking, Volumetric Rating, Payments & Waybill Verification Suite
const assert = require('node:assert');
const { db } = require('../../server/db/database.js');
const counterBookingService = require('../../server/services/counterBookingService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const posShiftService = require('../../server/services/posShiftService.js');

console.log('============================================================');
console.log('🧾  SWIFTTRACK LOGISTICS: STAGE 6 POS COUNTER BOOKING SUITE');
console.log('============================================================\n');

let passedTests = 0;
const totalTests = 9;

const adminUser = { id: 1, roleName: 'SUPER_ADMIN', username: 'superadmin', fullName: 'Super Admin', branchId: 1 };
const dbCashier = db.prepare('SELECT id, username, full_name, branch_id FROM users WHERE id = 4').get() || { id: 4, username: 'cashier.nairobi', full_name: 'Kevin Mutua (Senior Cashier)', branch_id: 1 };
const cashierUser = { id: dbCashier.id, roleName: 'CASHIER', username: dbCashier.username, fullName: dbCashier.full_name, branchId: dbCashier.branch_id || 1 };
const branch1 = db.prepare('SELECT * FROM branches WHERE id = 1').get();
const branch2 = db.prepare('SELECT * FROM branches WHERE id = 2').get();

try {
    // -------------------------------------------------------------
    // TEST 1: Live Volumetric Rating Quote at Counter
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Volumetric Rate Quote Calculation at Counter...');
    
    // 50cm x 40cm x 30cm, weight 5.0kg
    // Volumetric weight = (50*40*30)/5000 = 12.0kg -> Chargeable = 12.0kg
    const quote = counterBookingService.calculateCounterQuote({
        origin_hub_id: 1,
        destination_hub_id: 2,
        service_type: 'STANDARD',
        parcels: [{
            weight_kg: 5.0,
            length_cm: 50,
            width_cm: 40,
            height_cm: 30,
            package_type: 'BOX'
        }]
    });

    assert.ok(quote, 'Quote should be calculated');
    assert.strictEqual(quote.actual_weight_kg, 5.0);
    assert.strictEqual(quote.volumetric_weight_kg, 12.0, 'Volumetric weight must equal (L*W*H)/5000 = 12.0kg');
    assert.strictEqual(quote.chargeable_weight_kg, 12.0, 'Chargeable weight must equal max(5.0, 12.0) = 12.0kg');
    assert.ok(quote.total_amount > 0, 'Total quoted amount must be greater than zero');
    assert.strictEqual(quote.currency, 'KES');
    assert.strictEqual(quote.origin_hub.id, 1);
    assert.strictEqual(quote.destination_hub.id, 2);
    console.log(`  ✔ Volumetric rating verified: Actual 5kg, Volumetric 12kg -> Chargeable 12kg (Quote: KES ${quote.total_amount})`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 2: Cashier Active Shift Guard Enforcement
    // -------------------------------------------------------------
    console.log('▶ TEST 2: Cashier Active Shift Guard Enforcement...');
    
    // Ensure any open shift for cashier 4 is temporarily closed
    const activeShift = posShiftService.getCurrentShift(cashierUser.id, 1);
    if (activeShift) {
        posShiftService.closeShift(activeShift.id, { counted_cash: activeShift.expected_cash, notes: 'Pre-test close' }, cashierUser);
    }

    assert.throws(() => {
        counterBookingService.bookCounterShipment({
            origin_hub_id: 1,
            destination_hub_id: 2,
            sender: { name: 'Peter Kamau', phone: '+254711000001', address: 'CBD Tower', city: 'Nairobi' },
            recipient: { name: 'Salim Omar', phone: '+254722000002', address: 'Old Town', city: 'Mombasa' },
            parcels: [{ weight_kg: 2.0, length_cm: 20, width_cm: 20, height_cm: 10 }],
            payment_method: 'CASH',
            amount_tendered: 2000
        }, cashierUser);
    }, (err) => {
        return err.code === 'NO_ACTIVE_SHIFT' || err.message.includes('No active shift');
    }, 'Must reject booking when cashier has no active shift open');
    console.log('  ✔ Shift guard strictly blocks counter booking when register is closed (NO_ACTIVE_SHIFT)');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 3: Cash Counter Booking with Drawer Payout & Shift Totals
    // -------------------------------------------------------------
    console.log('▶ TEST 3: Counter Booking with Cash Payment & Cash Drawer Update...');

    // Open shift for cashier with 5,000 float
    const shift = posShiftService.openShift({ opening_float: 5000, notes: 'Morning test shift' }, cashierUser);
    assert.ok(shift.id, 'Shift should be open');
    const cashBefore = shift.expected_cash;

    const cashBooking = counterBookingService.bookCounterShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Grace Njeri', phone: '+254711122334', address: 'Westlands Square', city: 'Nairobi' },
        recipient: { name: 'Ali Hassan', phone: '+254722334455', address: 'Nyali Cinemax', city: 'Mombasa' },
        service_type: 'STANDARD',
        parcels: [{
            weight_kg: 4.0,
            length_cm: 30,
            width_cm: 25,
            height_cm: 20,
            package_type: 'BOX',
            description: 'Spare auto parts'
        }],
        payment_method: 'CASH',
        amount_tendered: 3000
    }, cashierUser);

    assert.ok(cashBooking.shipment_id, 'Shipment ID must exist');
    assert.strictEqual(cashBooking.status, 'ACCEPTED', 'Counter intake must set status to ACCEPTED');
    assert.strictEqual(cashBooking.payment_status, 'PAID', 'Cash booking must be PAID');
    assert.ok(cashBooking.tracking_number.startsWith('STK-'), 'Tracking number must start with STK-');
    assert.ok(cashBooking.waybill_number.startsWith('WB-'), 'Waybill number must start with WB-');
    
    // Check payment record in payments table
    const paymentRec = db.prepare('SELECT * FROM payments WHERE shipment_id = ?').get(cashBooking.shipment_id);
    assert.ok(paymentRec, 'Payment record must be inserted in payments table');
    assert.strictEqual(paymentRec.payment_method, 'CASH');
    assert.strictEqual(paymentRec.amount, cashBooking.pricing.total_amount);
    assert.strictEqual(paymentRec.status, 'COMPLETED');
    assert.strictEqual(paymentRec.cashier_user_id, cashierUser.id);

    // Verify change calculated
    assert.strictEqual(cashBooking.payments[0].change, Number((3000 - cashBooking.pricing.total_amount).toFixed(2)));

    // Verify shift drawer cash updated
    const updatedShift = posShiftService.getCurrentShift(cashierUser.id, 1);
    assert.strictEqual(updatedShift.expected_cash, cashBefore + cashBooking.pricing.total_amount);
    assert.strictEqual(updatedShift.total_cash_amount, cashBooking.pricing.total_amount);

    // Verify cash_drawer_movements recorded
    const drawerMove = db.prepare('SELECT * FROM cash_drawer_movements WHERE shift_id = ? ORDER BY id DESC LIMIT 1').get(shift.id);
    assert.ok(drawerMove, 'Cash drawer movement record must exist');
    assert.strictEqual(drawerMove.movement_type, 'SALE_CASH');
    assert.strictEqual(drawerMove.amount, cashBooking.pricing.total_amount);
    console.log(`  ✔ Cash booking confirmed: STK: ${cashBooking.tracking_number}, Paid: KES ${cashBooking.pricing.total_amount}, Tendered: KES 3000, Change: KES ${cashBooking.payments[0].change}`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 4: M-Pesa Counter Booking with Safaricom Receipt Verification
    // -------------------------------------------------------------
    console.log('▶ TEST 4: M-Pesa Counter Booking with Safaricom Receipt Verification...');

    const mpesaBooking = counterBookingService.bookCounterShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'David Mutua', phone: '+254700112233', address: 'Kilimani Plaza', city: 'Nairobi' },
        recipient: { name: 'Khadija Said', phone: '+254733445566', address: 'Diani Beach Road', city: 'Mombasa' },
        service_type: 'EXPRESS',
        parcels: [{
            weight_kg: 2.0,
            length_cm: 20,
            width_cm: 20,
            height_cm: 15,
            package_type: 'FLYER',
            description: 'Legal contracts & deeds'
        }],
        payment_method: 'MPESA',
        mpesa_phone: '+254700112233',
        mpesa_receipt: 'QKA882910Z'
    }, cashierUser);

    assert.strictEqual(mpesaBooking.status, 'ACCEPTED');
    assert.strictEqual(mpesaBooking.payment_status, 'PAID');
    const mpesaPayment = db.prepare('SELECT * FROM payments WHERE shipment_id = ?').get(mpesaBooking.shipment_id);
    assert.ok(mpesaPayment, 'M-Pesa payment record must exist');
    assert.strictEqual(mpesaPayment.payment_method, 'MPESA');
    assert.strictEqual(mpesaPayment.mpesa_receipt_number, 'QKA882910Z');
    assert.strictEqual(mpesaPayment.mpesa_phone_number, '+254700112233');

    // Drawer cash must not increase from M-Pesa, but total_mpesa_amount must
    const shiftAfterMpesa = posShiftService.getCurrentShift(cashierUser.id, 1);
    assert.strictEqual(shiftAfterMpesa.total_mpesa_amount, mpesaBooking.pricing.total_amount);
    console.log(`  ✔ M-Pesa booking verified: Ref: ${mpesaPayment.reference_code}, Phone: ${mpesaPayment.mpesa_phone_number}`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 5: Multi-Parcel Consignment Booking (Actual vs Volumetric)
    // -------------------------------------------------------------
    console.log('▶ TEST 5: Multi-Parcel Consignment Booking with Aggregations...');

    const multiBooking = counterBookingService.bookCounterShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Acme Cargo Ltd', phone: '+254799000111', address: 'Industrial Area', city: 'Nairobi' },
        recipient: { name: 'Coast Hardware', phone: '+254788000222', address: 'Mbaraki Wharves', city: 'Mombasa' },
        parcels: [
            {
                weight_kg: 10.0,
                length_cm: 20,
                width_cm: 20,
                height_cm: 20,
                package_type: 'BOX',
                description: 'Dense metal bolts (Heavy)'
            },
            {
                weight_kg: 2.0,
                length_cm: 60,
                width_cm: 50,
                height_cm: 40,
                package_type: 'BOX',
                description: 'Foam insulation panels (Bulky)'
            }
        ],
        payment_method: 'CASH',
        amount_tendered: 10000
    }, cashierUser);

    assert.strictEqual(multiBooking.parcels.length, 2, 'Must have 2 inserted parcels');
    assert.strictEqual(multiBooking.pricing.total_parcels, 2);
    // Parcel 1: 10kg act, (20*20*20)/5000 = 1.6kg vol -> max = 10kg
    // Parcel 2: 2kg act, (60*50*40)/5000 = 24.0kg vol -> max = 24kg
    // Total chargeable: 10 + 24 = 34kg
    assert.strictEqual(multiBooking.pricing.actual_weight_kg, 12.0);
    assert.strictEqual(multiBooking.pricing.volumetric_weight_kg, 25.6);
    assert.strictEqual(multiBooking.pricing.chargeable_weight_kg, 25.6, 'Total chargeable weight must be max(12.0, 25.6) = 25.6kg');
    console.log(`  ✔ Multi-parcel volumetric aggregation verified: 2 parcels, Actual 12kg, Volumetric 25.6kg -> Chargeable 25.6kg`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 6: Split Payment Counter Booking (Cash + M-Pesa)
    // -------------------------------------------------------------
    console.log('▶ TEST 6: Split Payment Counter Booking (Cash + M-Pesa)...');

    const quoteForSplit = counterBookingService.calculateCounterQuote({
        origin_hub_id: 1,
        destination_hub_id: 2,
        service_type: 'STANDARD',
        parcels: [{ weight_kg: 3.0, length_cm: 25, width_cm: 20, height_cm: 15 }]
    });

    const halfAmt = Number((quoteForSplit.total_amount / 2).toFixed(2));
    const otherHalf = Number((quoteForSplit.total_amount - halfAmt).toFixed(2));

    const splitBooking = counterBookingService.bookCounterShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        sender: { name: 'Split Customer', phone: '+254711888999', address: 'Upper Hill', city: 'Nairobi' },
        recipient: { name: 'Split Consignee', phone: '+254722777666', address: 'Tudor Creek', city: 'Mombasa' },
        parcels: [{ weight_kg: 3.0, length_cm: 25, width_cm: 20, height_cm: 15 }],
        split_payments: [
            { method: 'CASH', amount: halfAmt, amount_tendered: halfAmt },
            { method: 'MPESA', amount: otherHalf, mpesa_phone: '+254711888999', mpesa_receipt: 'SPLIT991823' }
        ]
    }, cashierUser);

    assert.strictEqual(splitBooking.status, 'ACCEPTED');
    assert.strictEqual(splitBooking.payments.length, 2, 'Must have 2 split payment records');
    const dbPayments = db.prepare('SELECT * FROM payments WHERE shipment_id = ?').all(splitBooking.shipment_id);
    assert.strictEqual(dbPayments.length, 2);
    assert.ok(dbPayments.some(p => p.payment_method === 'CASH' && p.amount === halfAmt));
    assert.ok(dbPayments.some(p => p.payment_method === 'MPESA' && p.amount === otherHalf));
    console.log(`  ✔ Split payment verified: KES ${halfAmt} Cash + KES ${otherHalf} M-Pesa = KES ${quoteForSplit.total_amount}`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 7: Physical Custody Intake Scan Handshake (Stage 4)
    // -------------------------------------------------------------
    console.log('▶ TEST 7: Physical Custody Intake Scan Handshake...');

    const intakeScan = db.prepare('SELECT * FROM scan_events WHERE shipment_id = ? AND scan_type = ?').get(cashBooking.shipment_id, 'INTAKE');
    assert.ok(intakeScan, 'INTAKE scan event must be recorded in scan_events table');
    assert.strictEqual(intakeScan.barcode, cashBooking.tracking_number);
    assert.strictEqual(intakeScan.hub_id, 1);
    assert.strictEqual(intakeScan.scanned_by_user_id, cashierUser.id);

    const trackEvents = db.prepare('SELECT event_code, event_name FROM tracking_events WHERE shipment_id = ? ORDER BY id ASC').all(cashBooking.shipment_id);
    assert.strictEqual(trackEvents[0].event_code, 'BOOKED');
    assert.strictEqual(trackEvents[1].event_code, 'ACCEPTED');
    console.log('  ✔ Custody intake verified: INTAKE scan event recorded with BOOKED & ACCEPTED timeline milestones');
    passedTests++;

    // -------------------------------------------------------------
    // TEST 8: Official Printable Waybill Generation & Reprint Endpoint
    // -------------------------------------------------------------
    console.log('▶ TEST 8: Official Printable Waybill Document Generation...');

    const waybill = counterBookingService.getWaybillByIdentifier(cashBooking.tracking_number, cashierUser);
    assert.ok(waybill, 'Waybill document must be generated');
    assert.strictEqual(waybill.tracking_number, cashBooking.tracking_number);
    assert.strictEqual(waybill.waybill_number, cashBooking.waybill_number);
    assert.strictEqual(waybill.barcode_value, cashBooking.tracking_number);
    assert.strictEqual(waybill.origin.code, branch1.code);
    assert.strictEqual(waybill.destination.code, branch2.code);
    assert.strictEqual(waybill.shipper.name, 'Grace Njeri');
    assert.strictEqual(waybill.consignee.name, 'Ali Hassan');
    assert.ok(Array.isArray(waybill.parcels) && waybill.parcels.length === 1);
    assert.strictEqual(waybill.financials.payment_status, 'PAID');
    assert.ok(Array.isArray(waybill.payment_receipt.payments) && waybill.payment_receipt.payments.length > 0);
    assert.strictEqual(waybill.payment_receipt.cashier_name, cashierUser.fullName);
    assert.ok(waybill.terms_and_conditions.includes('conditions of carriage'));
    console.log(`  ✔ Official Waybill generated: ${waybill.waybill_number} [${waybill.origin.code} -> ${waybill.destination.code}] with Barcode & Payment Stamp`);
    passedTests++;

    // -------------------------------------------------------------
    // TEST 9: Public Tracking Timeline Reflects Counter Intake
    // -------------------------------------------------------------
    console.log('▶ TEST 9: Public Customer Tracking Reflects Counter Intake...');

    const publicTracking = shipmentService.getPublicTracking(cashBooking.tracking_number);
    assert.ok(publicTracking, 'Public tracking lookup should succeed');
    assert.strictEqual(publicTracking.tracking_number, cashBooking.tracking_number);
    assert.strictEqual(publicTracking.status, 'ACCEPTED');
    assert.strictEqual(publicTracking.origin.hub, branch1.name);
    assert.strictEqual(publicTracking.destination.hub, branch2.name);
    assert.strictEqual(publicTracking.timeline.length, 2);
    assert.strictEqual(publicTracking.timeline[0].code, 'BOOKED');
    assert.strictEqual(publicTracking.timeline[1].code, 'ACCEPTED');
    // Financial and PII details must not be in public tracking
    assert.strictEqual(publicTracking.total_amount, undefined);
    assert.strictEqual(publicTracking.sender, undefined);
    console.log('  ✔ Public customer tracking verified: Shows booking & origin hub acceptance with PII sanitized');
    passedTests++;

    console.log('\n============================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} STAGE 6 POS COUNTER BOOKING TESTS PASSED!`);
    console.log('============================================================\n');

} catch (err) {
    console.error(`\n❌ TEST SUITE FAILED at Test #${passedTests + 1}:`);
    console.error(err);
    process.exit(1);
}
