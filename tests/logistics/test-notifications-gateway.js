// tests/logistics/test-notifications-gateway.js
// SwiftTrack Kenya: Track 4.2 Africa's Talking & Twilio Live Notifications Gateway & DLR Test
const assert = require('assert');
const notificationService = require('../../server/services/notificationService.js');

console.log('============================================================');
console.log('  SWIFTTRACK KENYA: NOTIFICATIONS GATEWAYS & DLR WEBHOOK TEST');
console.log('============================================================\n');

async function runTests() {
    // TEST 1: Kenyan Phone Number E.164 Normalization
    console.log('> TEST 1: Kenyan Mobile Phone E.164 Normalization...');
    assert.strictEqual(notificationService.normalizePhone('0712345678'), '+254712345678');
    assert.strictEqual(notificationService.normalizePhone('254722000000'), '+254722000000');
    assert.strictEqual(notificationService.normalizePhone('+254733111222'), '+254733111222');
    assert.strictEqual(notificationService.normalizePhone('0110998877'), '+254110998877');
    console.log('  [PASS] E.164 telco carrier phone normalization verified');

    // TEST 2: Africa's Talking SMS Gateway Dispatch & Sender ID
    console.log('> TEST 2: Africa\'s Talking SMS Gateway & Sender ID Configuration...');
    const originalSender = process.env.AT_SENDER_ID;
    process.env.AT_SENDER_ID = 'SWIFTTRACK';

    const smsResult = await notificationService.sendViaChannel(
        'SMS',
        '+254712345678',
        'Habari! Consignment ST-1002 has arrived at Nairobi Central Hub.',
        'Package Arrival'
    );
    assert.strictEqual(smsResult.provider, 'AFRICAS_TALKING_SMS', 'Provider must be AFRICAS_TALKING_SMS');
    assert.ok(smsResult.messageId.startsWith('AT-SMS-'), 'Message ID must follow AT-SMS format');
    assert.strictEqual(smsResult.senderId, 'SWIFTTRACK', 'Sender ID must be SWIFTTRACK');
    assert.ok(smsResult.status, 'Must return status');

    if (originalSender !== undefined) process.env.AT_SENDER_ID = originalSender;
    else delete process.env.AT_SENDER_ID;
    console.log('  [PASS] Africa\'s Talking SMS dispatch & alphanumeric sender ID verified');

    // TEST 3: Twilio / Meta WhatsApp Business Cloud Gateway Dispatch
    console.log('> TEST 3: Twilio / Meta WhatsApp Business Cloud Gateway...');
    const waResult = await notificationService.sendViaChannel(
        'WHATSAPP',
        '+254722112233',
        'Hello! Your driver Peter Kamau is en route with your package.',
        'Delivery Out for Dispatch'
    );
    assert.strictEqual(waResult.provider, 'TWILIO_WHATSAPP', 'Provider must be TWILIO_WHATSAPP');
    assert.ok(waResult.messageId.startsWith('WA-MSG-'), 'Message ID must follow WA-MSG format');
    assert.ok(waResult.meta_conversation_id, 'Must contain Meta conversation reference');
    console.log('  [PASS] Twilio WhatsApp messaging gateway dispatch verified');

    // TEST 4: Email SMTP Relay Validation
    console.log('> TEST 4: Transactional Mailer SMTP Relay...');
    const emailResult = await notificationService.sendViaChannel(
        'EMAIL',
        'customer@logistics.co.ke',
        'Proof of Delivery has been signed and archived.',
        'SwiftTrack POD Confirmation'
    );
    assert.strictEqual(emailResult.provider, 'SWIFTTRACK_SMTP');
    assert.ok(emailResult.messageId.includes('@swifttrack.co.ke'));
    console.log('  [PASS] Email transactional relay verified');

    // TEST 5: Carrier Delivery Report (DLR) Webhook Ingestion
    console.log('> TEST 5: Telco Delivery Report (DLR) Ingestion & Audit State Sync...');
    const mockSuccessDlr = {
        id: 'AT-SMS-A1B2C3D4E5F6',
        status: 'Success',
        phoneNumber: '+254712345678',
        networkCode: '63902' // Safaricom Kenya
    };

    const dlrSuccessReport = await notificationService.handleDeliveryReport(mockSuccessDlr);
    assert.strictEqual(dlrSuccessReport.acknowledged, true, 'DLR must acknowledge receipt');
    assert.strictEqual(dlrSuccessReport.message_id, 'AT-SMS-A1B2C3D4E5F6');
    assert.strictEqual(dlrSuccessReport.internal_status, 'DELIVERED', 'Status must map to DELIVERED');

    const mockFailedDlr = {
        id: 'AT-SMS-F1E2D3C4B5A6',
        status: 'Failed',
        failureReason: 'UserAbsentOrSubscriberUnavailable',
        phoneNumber: '+254700000000'
    };

    const dlrFailedReport = await notificationService.handleDeliveryReport(mockFailedDlr);
    assert.strictEqual(dlrFailedReport.acknowledged, true);
    assert.strictEqual(dlrFailedReport.internal_status, 'FAILED', 'Status must map to FAILED');
    console.log('  [PASS] Carrier DLR ingestion and delivered/failed status mapping verified');

    console.log('\n============================================================');
    console.log('[SUCCESS] ALL 5 NOTIFICATIONS GATEWAY & DLR TESTS PASSED!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('\n[FAIL] Test suite failed:', err);
    process.exit(1);
});
