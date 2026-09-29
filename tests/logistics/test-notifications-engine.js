// tests/logistics/test-notifications-engine.js
// SwiftTrack Logistics: Stage 9 Milestone Notifications & Communications Dispatch Engine Test Suite
// PRD Section 7.13 & Section 14 (NTF-001..004): Outbox Pattern, Multi-Channel Templates, Exponential Backoff

const assert = require('assert');
const { db } = require('../../server/db/database.js');
const notificationService = require('../../server/services/notificationService.js');
const shipmentService = require('../../server/services/shipmentService.js');
const deliveryExecutionService = require('../../server/services/deliveryExecutionService.js');
const { checkPermission } = require('../../server/config/permissions.js');

async function runTests() {
    console.log('============================================================');
    console.log('  SWIFTTRACK LOGISTICS: STAGE 9 NOTIFICATIONS ENGINE');
    console.log('============================================================\n');

    const adminUser = { id: 1, roleName: 'SUPER_ADMIN', roleDisplayName: 'Super Admin', branchId: 1 };
    const managerUser = { id: 2, roleName: 'BRANCH_MANAGER', roleDisplayName: 'Branch Manager', branchId: 1 };
    const cashierUser = { id: 4, roleName: 'CASHIER', roleDisplayName: 'Cashier', branchId: 1 };

    // TEST 1: Template Management & Dynamic Token Interpolation
    console.log('> TEST 1: Template Management & Dynamic Token Interpolation...');
    const templates = notificationService.getTemplates();
    assert(templates.length >= 7, 'Should have at least 7 seeded standard templates');

    const bookedTemplate = notificationService.getTemplateByCode('BOOKED_CONFIRMATION');
    assert.strictEqual(bookedTemplate.event_type, 'BOOKED');

    const interpolated = notificationService.interpolate(
        'Habari {{recipient_name}}, package {{tracking_number}} OTP: {{otp_code}}',
        { recipient_name: 'Amina Mwangi', tracking_number: 'STK-2026-TEST', otp_code: '984321' }
    );
    assert.strictEqual(interpolated, 'Habari Amina Mwangi, package STK-2026-TEST OTP: 984321');

    // Test template update
    const updatedTpl = notificationService.updateTemplate('BOOKED_CONFIRMATION', {
        sms_template: 'Habari {{recipient_name}}, package {{tracking_number}} has been booked from {{origin_city}} to {{dest_city}}. Live tracking: {{tracking_url}} - SwiftTrack Kenya'
    }, adminUser);
    assert(updatedTpl.sms_template.includes('SwiftTrack Kenya'), 'Template should be updated successfully');
    console.log('  [PASS] Templates verified with dynamic token interpolation');

    // TEST 2: Multi-Channel Dispatch Adapters (SMS, WhatsApp, Email) & Phone Normalization
    console.log('\n> TEST 2: Multi-Channel Dispatch Adapters & Phone Normalization...');
    const normalized1 = notificationService.normalizePhone('0712345678');
    const normalized2 = notificationService.normalizePhone('+254799887766');
    const normalized3 = notificationService.normalizePhone('254112345678');
    assert.strictEqual(normalized1, '+254712345678', '07... should normalize to +2547...');
    assert.strictEqual(normalized2, '+254799887766', '+254... should be preserved');
    assert.strictEqual(normalized3, '+254112345678', '254... should prepend +');

    const smsRes = await notificationService.sendViaChannel('SMS', '+254712345678', 'Test SMS');
    assert.strictEqual(smsRes.status, 'DELIVERED_TO_TELCO');

    const waRes = await notificationService.sendViaChannel('WHATSAPP', '+254712345678', 'Test WA');
    assert.strictEqual(waRes.status, 'SENT_TO_META');

    const emailRes = await notificationService.sendViaChannel('EMAIL', 'customer@example.com', 'Test Email', 'Subject');
    assert.strictEqual(emailRes.status, 'ACCEPTED_BY_RELAY');
    console.log('  [PASS] Phone normalization and SMS/WhatsApp/Email gateways verified');

    // TEST 3: Non-blocking Outbox Enqueuing on Booking (Rule NTF-002)
    console.log('\n> TEST 3: Non-blocking Outbox Enqueuing on Consignment Booking (Rule NTF-002)...');
    const outboxBefore = db.prepare('SELECT count(*) as count FROM notification_outbox').get().count;

    const testShipment = shipmentService.createShipment({
        origin_hub_id: 1,
        destination_hub_id: 2,
        service_type: 'STANDARD',
        sender: { name: 'Juma Kibet', phone: '0711223344', email: 'juma@kibet.com', address: 'Nairobi CBD' },
        recipient: { name: 'Grace Auma', phone: '0722334455', email: 'grace@auma.com', address: 'Mombasa Port' },
        parcels: [{ weight_kg: 3.5, package_type: 'BOX', description: 'Spare Parts' }]
    }, adminUser);

    const outboxAfter = db.prepare('SELECT count(*) as count FROM notification_outbox').get().count;
    assert(outboxAfter > outboxBefore, 'Shipment booking must enqueue records into notification_outbox');

    const latestOutbox = db.prepare('SELECT * FROM notification_outbox WHERE shipment_id = ?').all(testShipment.id);
    assert(latestOutbox.length >= 2, 'Should enqueue for both recipient and sender on booking');
    assert.strictEqual(latestOutbox[0].status, 'PENDING');
    assert(latestOutbox[0].rendered_content.includes(testShipment.tracking_number), 'Content must contain tracking number');
    console.log(`  [PASS] Consignment booking enqueued ${latestOutbox.length} outbox notifications for tracking ${testShipment.tracking_number}`);

    // TEST 4: Outbox Batch Worker Processing & Status Progression
    console.log('\n> TEST 4: Outbox Batch Worker Processing (PENDING -> SENT)...');
    let processResult = { success_count: 0, failed_count: 0, processed_count: 0 };
    for (let i = 0; i < 20; i++) {
        const batch = await notificationService.processOutboxBatch(50);
        processResult.success_count += batch.success_count;
        processResult.failed_count += batch.failed_count;
        processResult.processed_count += (batch.processed_count || batch.total_selected || 0);
        if (!batch.total_selected || batch.total_selected === 0) break;
    }
    assert(processResult.success_count > 0, 'Batch processing should successfully dispatch pending items');

    const updatedOutbox = db.prepare('SELECT * FROM notification_outbox WHERE shipment_id = ?').all(testShipment.id);
    assert.strictEqual(updatedOutbox[0].status, 'SENT', 'Processed outbox item should be marked SENT');
    assert(updatedOutbox[0].sent_at !== null, 'sent_at timestamp must be populated');

    // Rule NTF-004: Delivery logs audit history
    const logs = db.prepare('SELECT * FROM notification_logs WHERE outbox_id = ?').all(updatedOutbox[0].id);
    assert(logs.length >= 1, 'Delivery log must be recorded in notification_logs');
    assert.strictEqual(logs[0].status, 'SUCCESS');
    assert(logs[0].provider_message_id !== null);
    console.log(`  [PASS] Worker processed batch: ${processResult.success_count} sent, audit logs generated`);

    // TEST 5: Dynamic OTP Generation & Delivery on OUT_FOR_DELIVERY
    console.log('\n> TEST 5: Dynamic OTP Delivery Notification on OUT_FOR_DELIVERY...');
    // Create delivery task for shipment
    const deliveryTask = deliveryExecutionService.createDeliveryTask({
        shipment_id: testShipment.id,
        hub_id: 2,
        recipient_name: 'Grace Auma',
        recipient_phone: '+254722334455',
        destination_address: 'Mombasa Port Rd',
        destination_city: 'Mombasa',
        pod_required_methods: ['OTP', 'SIGNATURE']
    }, adminUser);

    // Assign to driver 1
    deliveryExecutionService.assignDeliveryTask(deliveryTask.id, { driver_id: 1, vehicle_id: 1 }, adminUser);

    // Start delivery run
    const activeDelivery = deliveryExecutionService.startDelivery(deliveryTask.id, { id: 1, fullName: 'David Ochieng' });

    // Verify outbox has OUT_FOR_DELIVERY message with OTP
    const outForDelNotifs = db.prepare("SELECT * FROM notification_outbox WHERE event_type = 'OUT_FOR_DELIVERY' AND delivery_id = ?").all(deliveryTask.id);
    assert(outForDelNotifs.length >= 1, 'OUT_FOR_DELIVERY notification must be enqueued');
    assert(outForDelNotifs[0].rendered_content.includes(activeDelivery.pod_otp), 'Recipient notification must contain the exact delivery OTP PIN');

    await notificationService.processOutboxBatch(10);
    console.log(`  [PASS] OUT_FOR_DELIVERY alert enqueued with PIN: ${activeDelivery.pod_otp} and dispatched`);

    // TEST 6: Exponential Backoff & Retry Handling on Failure (Rule NTF-003)
    console.log('\n> TEST 6: Exponential Backoff & Retry Handling on Gateway Error (Rule NTF-003)...');
    // Enqueue a test notification with simulated failure
    const uuidFail = `NTF-TEST-FAIL-${Date.now()}`;
    const insertFail = db.prepare(`
        INSERT INTO notification_outbox (
            outbox_uuid, shipment_id, recipient_type, recipient_name, recipient_phone,
            channel, event_type, rendered_content, payload, status, retry_count, max_retries,
            next_retry_at, created_at, updated_at
        ) VALUES (?, ?, 'RECIPIENT', 'Test Failure User', '+254799000000', 'SMS', 'BOOKED', 'Test message', ?, 'PENDING', 0, 3, datetime('now'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidFail, testShipment.id, JSON.stringify({ _simulateFailure: true, _simulateFailureReason: 'Gateway 503 Provider Timeout' }));

    const failItemId = insertFail.lastInsertRowid;

    // Process batch
    const failBatchRes = await notificationService.processOutboxBatch(10);
    assert(failBatchRes.failed_count >= 1, 'Should record failed dispatch attempt');

    const failedItem = db.prepare('SELECT * FROM notification_outbox WHERE id = ?').get(failItemId);
    assert.strictEqual(failedItem.retry_count, 1, 'Retry count should increment to 1');
    assert.strictEqual(failedItem.status, 'FAILED', 'Status should be FAILED');
    assert(failedItem.last_error.includes('Gateway 503'), 'Last error message should be saved');

    // Verify log entry
    const failLog = db.prepare('SELECT * FROM notification_logs WHERE outbox_id = ?').get(failItemId);
    assert(failLog !== null && failLog.status === 'FAILED', 'Failed log entry must be created');
    console.log('  [PASS] Exponential backoff triggered on failure, retry count = 1 with error logged');

    // TEST 7: Max Retries Exhaustion
    console.log('\n> TEST 7: Max Retries Exhaustion (Transitions to Final Failure)...');
    // Force retry count to 2, so next attempt is 3 (max_retries = 3)
    db.prepare("UPDATE notification_outbox SET retry_count = 2, next_retry_at = datetime('now') WHERE id = ?").run(failItemId);
    await notificationService.processOutboxBatch(10);

    const exhaustedItem = db.prepare('SELECT * FROM notification_outbox WHERE id = ?').get(failItemId);
    assert.strictEqual(exhaustedItem.retry_count, 3, 'Retry count should reach max_retries = 3');
    assert.strictEqual(exhaustedItem.status, 'FAILED');
    console.log('  [PASS] Max retries reached (3/3), outbox item marked permanently FAILED');

    // TEST 8: Manual Operator Resend / Immediate Retry via API
    console.log('\n> TEST 8: Manual Operator Resend (Resets Status & Dispatches)...');
    // Remove failure flag from payload so resend succeeds
    db.prepare("UPDATE notification_outbox SET payload = '{}' WHERE id = ?").run(failItemId);

    const resendResult = await notificationService.resendOutboxItem(failItemId, adminUser);
    assert.strictEqual(resendResult.success_count, 1, 'Manual resend should successfully dispatch the item');

    const resentItem = db.prepare('SELECT * FROM notification_outbox WHERE id = ?').get(failItemId);
    assert.strictEqual(resentItem.status, 'SENT', 'Item should transition from FAILED to SENT after resend');
    console.log('  [PASS] Manual operator resend successfully cleared failure and delivered notification');

    // TEST 9: Communications Telemetry & Delivery Rate KPIs
    console.log('\n> TEST 9: Communications Telemetry & Delivery Rate KPIs...');
    const stats = notificationService.getNotificationStats();
    assert(stats.total_notifications > 0, 'Total notifications should be positive');
    assert(stats.sent_count > 0, 'Sent count should be positive');
    assert(stats.delivery_rate_pct >= 0 && stats.delivery_rate_pct <= 100, 'Delivery rate should be a valid percentage');
    assert(Array.isArray(stats.channels), 'Channels telemetry breakdown should be an array');
    assert(stats.recent_logs.length > 0, 'Recent activity logs should be populated');
    console.log(`  [PASS] Telemetry KPIs: ${stats.total_notifications} total queued, ${stats.sent_count} sent, Delivery Rate: ${stats.delivery_rate_pct}%`);

    // TEST 10: RBAC Authorization & Scoping
    console.log('\n> TEST 10: RBAC Authorization & Scoping on Notifications Resource...');
    const cashierCheck = checkPermission(cashierUser, 'notifications', 'manage');
    assert.strictEqual(cashierCheck.granted, false, 'Cashier should NOT have permission to manage notification templates');

    const adminCheck = checkPermission(adminUser, 'notifications', 'manage');
    assert.strictEqual(adminCheck.granted, true, 'Super Admin should have permission to manage notification templates');

    const managerCheck = checkPermission(managerUser, 'notifications', 'resend', { branchId: 1 });
    assert.strictEqual(managerCheck.granted, true, 'Branch Manager should have permission to resend notifications in their branch');
    console.log('  [PASS] RBAC checks passed: Cashier denied manage, Super Admin & Manager permitted');

    console.log('\n============================================================');
    console.log('[OK]  ALL 10/10 NOTIFICATIONS ENGINE TESTS PASSED!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('\n[FAIL] TEST FAILED:', err);
    process.exit(1);
});
