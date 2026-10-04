// tests/logistics/test-e2e-acceptance.js
// SwiftTrack Kenya Logistics: Stage 10 Multi-Leg End-to-End Acceptance Test Suite (PRD Section 30)
const assert = require('node:assert');
const dbAdapter = require('../../server/db/dbAdapter.js');
const e2eAcceptanceService = require('../../server/services/e2eAcceptanceService.js');
const shipmentService = require('../../server/services/shipmentService.js');

async function runTests() {
    console.log('\n============================================================');
    console.log('  SWIFTTRACK LOGISTICS: STAGE 10 E2E ACCEPTANCE SUITE (PRD 30)');
    console.log('============================================================');

    const adminUser = {
        id: 1,
        roleName: 'SUPER_ADMIN',
        role: 'SUPER_ADMIN',
        fullName: 'Global Logistics Administrator',
        branchId: 1
    };

    const nakuruBranch = await dbAdapter.get("SELECT id FROM branches WHERE code = 'NAK-01' OR code = 'NAK1' OR city = 'Nakuru' LIMIT 1");
    const intermediateHubId = nakuruBranch ? nakuruBranch.id : 4;

    // TEST 1: Execute Complete 23-Step Multi-Leg Acceptance Scenario
    console.log('\n> TEST 1: Executing 23-Step Multi-Leg Acceptance Scenario (PRD Section 30)...');
    const result = await e2eAcceptanceService.executeFullAcceptanceScenario({
        originHubId: 1,         // Nairobi Central Hub
        intermediateHubId,      // Nakuru Transfer Station
        destinationHubId: 2,     // Mombasa Port & Coastal Branch
        codAmount: 7500
    }, adminUser);

    assert.strictEqual(result.success, true, 'Scenario execution must succeed');
    assert.strictEqual(result.total_steps_executed, 23, 'Must execute all 23 PRD Section 30 steps');
    assert.strictEqual(result.steps.length, 23, 'Steps array must contain 23 verified records');
    console.log(`  [PASS] Successfully executed all 23/23 acceptance steps in ${result.duration_ms}ms`);

    // TEST 2: Multi-Leg Routing Structure & Legs Progression
    console.log('\n> TEST 2: Multi-Leg Routing Legs Verification (Leg 1 & Leg 2)...');
    const shipmentId = result.summary.shipment.id;
    const legs = await dbAdapter.all('SELECT * FROM shipment_legs WHERE shipment_id = ? ORDER BY leg_sequence ASC', [shipmentId]);

    assert.strictEqual(legs.length, 2, 'Shipment must have exactly 2 routing legs');
    assert.strictEqual(legs[0].leg_sequence, 1, 'Leg 1 must be sequence 1');
    assert.strictEqual(legs[0].origin_hub_id, 1, 'Leg 1 origin must be Nairobi (1)');
    assert.strictEqual(legs[0].destination_hub_id, intermediateHubId, `Leg 1 destination must be Nakuru (${intermediateHubId})`);
    assert.strictEqual(legs[0].status, 'COMPLETED', 'Leg 1 must be marked COMPLETED');
    assert(legs[0].actual_departure !== null, 'Leg 1 actual departure must be recorded');
    assert(legs[0].actual_arrival !== null, 'Leg 1 actual arrival must be recorded');

    assert.strictEqual(legs[1].leg_sequence, 2, 'Leg 2 must be sequence 2');
    assert.strictEqual(legs[1].origin_hub_id, intermediateHubId, `Leg 2 origin must be Nakuru (${intermediateHubId})`);
    assert.strictEqual(legs[1].destination_hub_id, 2, 'Leg 2 destination must be Mombasa (2)');
    assert.strictEqual(legs[1].status, 'COMPLETED', 'Leg 2 must be marked COMPLETED');
    console.log('  [PASS] Routing legs verified: Nairobi -> Nakuru (COMPLETED), Nakuru -> Mombasa (COMPLETED)');

    // TEST 3: Physical Custody Scans & Timeline Integrity
    console.log('\n> TEST 3: Physical Custody Scans & Milestone Timeline Audit...');
    const scans = await dbAdapter.all('SELECT * FROM scan_events WHERE barcode = ?', [result.summary.shipment.tracking_number]);
    assert(scans.length >= 1, 'Physical custody scans must be recorded');
    assert.strictEqual(scans[0].scan_type, 'INTAKE', 'Origin scan must be INTAKE');

    const trackingEvents = await dbAdapter.all('SELECT event_code FROM tracking_events WHERE shipment_id = ? ORDER BY id ASC', [shipmentId]);
    const eventCodes = trackingEvents.map(e => e.event_code);
    assert(eventCodes.includes('BOOKED'), 'Timeline must include BOOKED');
    assert(eventCodes.includes('ACCEPTED'), 'Timeline must include ACCEPTED');
    assert(eventCodes.includes('LOADED'), 'Timeline must include LOADED');
    assert(eventCodes.includes('IN_TRANSIT'), 'Timeline must include IN_TRANSIT');
    assert(eventCodes.includes('IN_TRANSIT_CHECKPOINT'), 'Timeline must include waypoint checkpoint');
    assert(eventCodes.includes('ARRIVED_AT_HUB'), 'Timeline must include hub arrival');
    assert(eventCodes.includes('OUT_FOR_DELIVERY'), 'Timeline must include OUT_FOR_DELIVERY');
    assert(eventCodes.includes('DELIVERED'), 'Timeline must include DELIVERED');
    console.log(`  [PASS] Timeline verified with ${eventCodes.length} milestone events from BOOKED to DELIVERED`);

    // TEST 4: Secure Delivery OTP & POD Evidence Immutability (Rule POD-005)
    console.log('\n> TEST 4: Dynamic Delivery OTP & POD Evidence Immutability (Rule POD-005)...');
    const deliveryTask = await dbAdapter.get('SELECT * FROM deliveries WHERE shipment_id = ?', [shipmentId]);
    assert.strictEqual(deliveryTask.status, 'DELIVERED', 'Delivery task must be DELIVERED');
    assert(deliveryTask.pod_otp && deliveryTask.pod_otp.length === 6, '6-digit POD OTP must be recorded');
    assert.ok(deliveryTask.recipient_name, 'Recipient name must be recorded');

    const pod = await dbAdapter.get('SELECT * FROM proof_of_delivery WHERE delivery_id = ?', [deliveryTask.id]);
    assert.ok(pod, 'Proof of delivery evidence must exist');
    assert.strictEqual(Boolean(pod.otp_verified), true, 'OTP must be marked verified');
    assert(pod.signature_data !== null, 'Recipient digital signature must exist');
    assert(pod.latitude !== null && pod.longitude !== null, 'GPS coordinates must be captured');

    // Verify SQL trigger blocks mutation on POD
    let triggerBlocked = false;
    try {
        await dbAdapter.run("UPDATE proof_of_delivery SET signature_data = 'TAMPERED' WHERE id = ?", [pod.id]);
    } catch (err) {
        triggerBlocked = /Audit Violation|cannot be modified|trigger/i.test(err.message);
    }
    assert.strictEqual(triggerBlocked, true, 'Database trigger must strictly block updating proof of delivery');
    console.log('  [PASS] Proof of Delivery verified with 6-digit OTP, signature, GPS, and immutable trigger guard');

    // TEST 5: COD Settlement & Financial Reconciliation Lifecycle
    console.log('\n> TEST 5: COD Collection, Remittance & Financial Reconciliation...');
    const cod = await dbAdapter.get('SELECT * FROM cod_settlements WHERE shipment_id = ?', [shipmentId]);
    assert.ok(cod, 'COD settlement must be initialized');
    assert.strictEqual(cod.status, 'RECONCILED', 'COD settlement must be RECONCILED');
    assert.strictEqual(Number(cod.expected_amount), 7500, 'Expected amount must be 7500');
    assert.strictEqual(Number(cod.collected_amount), 7500, 'Collected amount must be 7500');
    assert.strictEqual(Number(cod.remitted_amount), 7500, 'Remitted amount must be 7500');
    assert.strictEqual(Number(cod.variance_amount), 0.0, 'Variance amount must be zero');
    assert(cod.reconciled_at !== null, 'Reconciliation timestamp must be populated');
    console.log(`  [PASS] COD settlement ${cod.settlement_number} verified: KES 7,500 collected, remitted, and reconciled`);

    // TEST 6: Automated Outbox Milestone Notifications (SMS / WhatsApp / Email)
    console.log('\n> TEST 6: Automated Milestone Notifications Outbox & Delivery Logs...');
    const outboxItems = await dbAdapter.all('SELECT * FROM notification_outbox WHERE shipment_id = ?', [shipmentId]);
    assert(outboxItems.length >= 3, 'Outbox must contain notifications for BOOKED, DISPATCHED, OUT_FOR_DELIVERY, etc.');

    // Verify OUT_FOR_DELIVERY notification contains the dynamic OTP PIN
    const outForDelNotif = outboxItems.find(i => i.event_type === 'OUT_FOR_DELIVERY');
    assert.ok(outForDelNotif, 'OUT_FOR_DELIVERY outbox item must exist');
    assert(outForDelNotif.rendered_content.includes(deliveryTask.pod_otp), 'Notification message must contain the delivery OTP PIN');

    // Verify all items transitioned to SENT
    for (const item of outboxItems) {
        assert.strictEqual(item.status, 'SENT', `Outbox item #${item.id} (${item.event_type}) must be marked SENT`);
    }
    console.log(`  [PASS] ${outboxItems.length} milestone notifications verified with SENT status and dynamic OTP embedding`);

    // TEST 7: Public Customer Tracking Lookup (PII & Financials Sanitized)
    console.log('\n> TEST 7: Public Tracking Endpoint Reflection & PII Sanitization...');
    const publicTracking = await shipmentService.getPublicTracking(result.summary.shipment.tracking_number);
    assert.ok(publicTracking, 'Public tracking lookup must succeed');
    assert.strictEqual(publicTracking.tracking_number, result.summary.shipment.tracking_number);
    assert.strictEqual(publicTracking.status, 'DELIVERED');
    assert.strictEqual(publicTracking.cod_amount, undefined, 'Internal financials must NOT be exposed');
    assert.strictEqual(publicTracking.sender_phone, undefined, 'Customer phone must NOT be exposed');
    const timeline = publicTracking.timeline || publicTracking.milestones || [];
    assert(timeline.length >= 5, 'Public milestones timeline must contain key journey steps');
    console.log(`  [PASS] Public tracking verified: ${timeline.length} milestones, PII sanitized`);

    // TEST 8: Audit Governance Compliance
    console.log('\n> TEST 8: Audit Governance Trail Verification...');
    const auditLogs = await dbAdapter.all("SELECT * FROM audit_logs WHERE resource = 'SHIPMENT' AND resource_id = ?", [String(shipmentId)]);
    assert(auditLogs.length >= 1, 'Audit log entries must exist for shipment operations');
    console.log(`  [PASS] Audit governance verified with ${auditLogs.length} logged state transitions`);

    console.log('\n============================================================');
    console.log('[OK]  ALL 8/8 STAGE 10 E2E ACCEPTANCE TESTS PASSED!');
    console.log('============================================================\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('\n[FAIL] E2E ACCEPTANCE TEST SUITE FAILED:', err);
    process.exit(1);
});
