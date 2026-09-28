// tests/logistics/test-e2e-acceptance.js
// SwiftTrack Kenya Logistics: Stage 10 Multi-Leg End-to-End Acceptance Test Suite (PRD Section 30)
const assert = require('node:assert');
const { db } = require('../../server/db/database.js');
const e2eAcceptanceService = require('../../server/services/e2eAcceptanceService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const notificationService = require('../../server/services/notificationService.js');

async function runTests() {
    console.log('\n============================================================');
    console.log('🌐  SWIFTTRACK LOGISTICS: STAGE 10 E2E ACCEPTANCE SUITE (PRD 30)');
    console.log('============================================================');

    const adminUser = {
        id: 1,
        roleName: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        fullName: 'Global Logistics Administrator',
        branchId: 1
    };

    // TEST 1: Execute Complete 23-Step Multi-Leg Acceptance Scenario
    console.log('\n▶ TEST 1: Executing 23-Step Multi-Leg Acceptance Scenario (PRD Section 30)...');
    const result = await e2eAcceptanceService.executeFullAcceptanceScenario({
        originHubId: 1,         // Nairobi Central Hub
        intermediateHubId: 4,    // Nakuru Transfer Station
        destinationHubId: 2,     // Mombasa Port & Coastal Branch
        codAmount: 7500
    }, adminUser);

    assert.strictEqual(result.success, true, 'Scenario execution must succeed');
    assert.strictEqual(result.total_steps_executed, 23, 'Must execute all 23 PRD Section 30 steps');
    assert.strictEqual(result.steps.length, 23, 'Steps array must contain 23 verified records');
    console.log(`  ✔ Successfully executed all 23/23 acceptance steps in ${result.duration_ms}ms`);

    // TEST 2: Multi-Leg Routing Structure & Legs Progression
    console.log('\n▶ TEST 2: Multi-Leg Routing Legs Verification (Leg 1 & Leg 2)...');
    const shipmentId = result.summary.shipment.id;
    const legs = db.prepare('SELECT * FROM shipment_legs WHERE shipment_id = ? ORDER BY leg_sequence ASC').all(shipmentId);

    assert.strictEqual(legs.length, 2, 'Shipment must have exactly 2 routing legs');
    assert.strictEqual(legs[0].leg_sequence, 1, 'Leg 1 must be sequence 1');
    assert.strictEqual(legs[0].origin_hub_id, 1, 'Leg 1 origin must be Nairobi (1)');
    assert.strictEqual(legs[0].destination_hub_id, 4, 'Leg 1 destination must be Nakuru (4)');
    assert.strictEqual(legs[0].status, 'COMPLETED', 'Leg 1 must be marked COMPLETED');
    assert(legs[0].actual_departure !== null, 'Leg 1 actual departure must be recorded');
    assert(legs[0].actual_arrival !== null, 'Leg 1 actual arrival must be recorded');

    assert.strictEqual(legs[1].leg_sequence, 2, 'Leg 2 must be sequence 2');
    assert.strictEqual(legs[1].origin_hub_id, 4, 'Leg 2 origin must be Nakuru (4)');
    assert.strictEqual(legs[1].destination_hub_id, 2, 'Leg 2 destination must be Mombasa (2)');
    assert.strictEqual(legs[1].status, 'COMPLETED', 'Leg 2 must be marked COMPLETED');
    console.log('  ✔ Routing legs verified: Nairobi -> Nakuru (COMPLETED), Nakuru -> Mombasa (COMPLETED)');

    // TEST 3: Physical Custody Scans & Timeline Integrity
    console.log('\n▶ TEST 3: Physical Custody Scans & Milestone Timeline Audit...');
    const scans = db.prepare('SELECT * FROM scan_events WHERE barcode = ?').all(result.summary.shipment.tracking_number);
    assert(scans.length >= 1, 'Physical custody scans must be recorded');
    assert.strictEqual(scans[0].scan_type, 'INTAKE', 'Origin scan must be INTAKE');

    const trackingEvents = db.prepare('SELECT event_code FROM tracking_events WHERE shipment_id = ? ORDER BY id ASC').all(shipmentId);
    const eventCodes = trackingEvents.map(e => e.event_code);
    assert(eventCodes.includes('BOOKED'), 'Timeline must include BOOKED');
    assert(eventCodes.includes('ACCEPTED'), 'Timeline must include ACCEPTED');
    assert(eventCodes.includes('LOADED'), 'Timeline must include LOADED');
    assert(eventCodes.includes('IN_TRANSIT'), 'Timeline must include IN_TRANSIT');
    assert(eventCodes.includes('IN_TRANSIT_CHECKPOINT'), 'Timeline must include waypoint checkpoint');
    assert(eventCodes.includes('ARRIVED_AT_HUB'), 'Timeline must include hub arrival');
    assert(eventCodes.includes('OUT_FOR_DELIVERY'), 'Timeline must include OUT_FOR_DELIVERY');
    assert(eventCodes.includes('DELIVERED'), 'Timeline must include DELIVERED');
    console.log(`  ✔ Timeline verified with ${eventCodes.length} milestone events from BOOKED to DELIVERED`);

    // TEST 4: Secure Delivery OTP & POD Evidence Immutability (Rule POD-005)
    console.log('\n▶ TEST 4: Dynamic Delivery OTP & POD Evidence Immutability (Rule POD-005)...');
    const deliveryTask = db.prepare('SELECT * FROM deliveries WHERE shipment_id = ?').get(shipmentId);
    assert.strictEqual(deliveryTask.status, 'DELIVERED', 'Delivery task must be DELIVERED');
    assert(deliveryTask.pod_otp && deliveryTask.pod_otp.length === 6, '6-digit POD OTP must be recorded');
    assert.strictEqual(deliveryTask.actual_recipient_name, 'Grace Auma');

    const pod = db.prepare('SELECT * FROM proof_of_delivery WHERE delivery_id = ?').get(deliveryTask.id);
    assert.ok(pod, 'Proof of delivery evidence must exist');
    assert.strictEqual(pod.otp_verified, 1, 'OTP must be marked verified');
    assert(pod.recipient_signature !== null, 'Recipient digital signature must exist');
    assert(pod.latitude !== null && pod.longitude !== null, 'GPS coordinates must be captured');

    // Verify SQL trigger blocks mutation on POD
    assert.throws(() => {
        db.prepare("UPDATE proof_of_delivery SET recipient_signature = 'TAMPERED' WHERE id = ?").run(pod.id);
    }, /IMMUTABLE|trigger|abort/i, 'Database trigger must strictly block updating proof of delivery');
    console.log('  ✔ Proof of Delivery verified with 6-digit OTP, signature, GPS, and immutable trigger guard');

    // TEST 5: COD Settlement & Financial Reconciliation Lifecycle
    console.log('\n▶ TEST 5: COD Collection, Remittance & Financial Reconciliation...');
    const cod = db.prepare('SELECT * FROM cod_settlements WHERE shipment_id = ?').get(shipmentId);
    assert.ok(cod, 'COD settlement must be initialized');
    assert.strictEqual(cod.status, 'RECONCILED', 'COD settlement must be RECONCILED');
    assert.strictEqual(cod.expected_amount, 7500, 'Expected amount must be 7500');
    assert.strictEqual(cod.collected_amount, 7500, 'Collected amount must be 7500');
    assert.strictEqual(cod.remitted_amount, 7500, 'Remitted amount must be 7500');
    assert.strictEqual(cod.variance_amount, 0.0, 'Variance amount must be zero');
    assert(cod.reconciled_at !== null, 'Reconciliation timestamp must be populated');
    console.log(`  ✔ COD settlement ${cod.settlement_number} verified: KES 7,500 collected, remitted, and reconciled`);

    // TEST 6: Automated Outbox Milestone Notifications (SMS / WhatsApp / Email)
    console.log('\n▶ TEST 6: Automated Milestone Notifications Outbox & Delivery Logs...');
    const outboxItems = db.prepare('SELECT * FROM notification_outbox WHERE shipment_id = ?').all(shipmentId);
    assert(outboxItems.length >= 3, 'Outbox must contain notifications for BOOKED, DISPATCHED, OUT_FOR_DELIVERY, etc.');

    // Verify OUT_FOR_DELIVERY notification contains the dynamic OTP PIN
    const outForDelNotif = outboxItems.find(i => i.event_type === 'OUT_FOR_DELIVERY');
    assert.ok(outForDelNotif, 'OUT_FOR_DELIVERY outbox item must exist');
    assert(outForDelNotif.rendered_content.includes(deliveryTask.pod_otp), 'Notification message must contain the delivery OTP PIN');

    // Verify all items transitioned to SENT
    for (const item of outboxItems) {
        assert.strictEqual(item.status, 'SENT', `Outbox item #${item.id} (${item.event_type}) must be marked SENT`);
    }
    console.log(`  ✔ ${outboxItems.length} milestone notifications verified with SENT status and dynamic OTP embedding`);

    // TEST 7: Public Customer Tracking Lookup (PII & Financials Sanitized)
    console.log('\n▶ TEST 7: Public Tracking Endpoint Reflection & PII Sanitization...');
    const publicTracking = shipmentService.getPublicTracking(result.summary.shipment.tracking_number);
    assert.ok(publicTracking, 'Public tracking lookup must succeed');
    assert.strictEqual(publicTracking.tracking_number, result.summary.shipment.tracking_number);
    assert.strictEqual(publicTracking.status, 'DELIVERED');
    assert.strictEqual(publicTracking.cod_amount, undefined, 'Internal financials must NOT be exposed');
    assert.strictEqual(publicTracking.sender_phone, undefined, 'Customer phone must NOT be exposed');
    assert.strictEqual(publicTracking.recipient_phone, undefined, 'Recipient phone must NOT be exposed');
    assert(publicTracking.milestones.length >= 5, 'Public milestones timeline must contain key journey steps');
    console.log(`  ✔ Public tracking verified: ${publicTracking.milestones.length} milestones, PII sanitized`);

    // TEST 8: Audit Governance Compliance
    console.log('\n▶ TEST 8: Audit Governance Trail Verification...');
    const auditLogs = db.prepare("SELECT * FROM audit_logs WHERE resource = 'SHIPMENT' AND resource_id = ?").all(String(shipmentId));
    assert(auditLogs.length >= 1, 'Audit log entries must exist for shipment operations');
    console.log(`  ✔ Audit governance verified with ${auditLogs.length} logged state transitions`);

    console.log('\n============================================================');
    console.log('✅  ALL 8/8 STAGE 10 E2E ACCEPTANCE TESTS PASSED!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('\n❌ E2E ACCEPTANCE TEST SUITE FAILED:', err);
    process.exit(1);
});
