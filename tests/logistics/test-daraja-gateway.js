// tests/logistics/test-daraja-gateway.js
// SwiftTrack Kenya: Track 4.1 Safaricom Daraja 2.0 Live Payment Gateway & Settlement Reconciliation Test
const assert = require('assert');
const darajaService = require('../../server/services/darajaService.js');

console.log('============================================================');
console.log('  SWIFTTRACK KENYA: DARAJA 2.0 GATEWAY & RECONCILIATION TEST');
console.log('============================================================\n');

async function runTests() {
    // TEST 1: Environment & Base URL Switching
    console.log('> TEST 1: Daraja Gateway Environment & URL Configuration...');
    const originalEnv = darajaService.env;
    darajaService.env = 'production';
    assert.strictEqual(darajaService.getBaseUrl(), 'https://api.safaricom.co.ke', 'Must resolve to Safaricom production API host');
    darajaService.env = 'sandbox';
    assert.strictEqual(darajaService.getBaseUrl(), 'https://sandbox.safaricom.co.ke', 'Must resolve to Safaricom sandbox API host');
    darajaService.env = originalEnv;
    console.log('  [PASS] Live & Sandbox URL configuration verified');

    // TEST 2: Safaricom Callback Source IP Whitelist Filter
    console.log('> TEST 2: Safaricom Callback IP Whitelist Validation...');
    const originalBypass = process.env.DARAJA_BYPASS_IP_CHECK;
    const testService = new (darajaService.constructor)();
    testService.env = 'production';
    delete process.env.DARAJA_BYPASS_IP_CHECK;

    // Safaricom public CIDRs
    assert.ok(testService.isSafaricomCallbackIp('196.201.214.15'), 'Safaricom 196.201.214.x must be allowed');
    assert.ok(testService.isSafaricomCallbackIp('196.201.213.200'), 'Safaricom 196.201.213.x must be allowed');
    assert.ok(testService.isSafaricomCallbackIp('196.201.212.1'), 'Safaricom 196.201.212.x must be allowed');
    assert.ok(testService.isSafaricomCallbackIp('196.13.107.5'), 'Safaricom 196.13.107.x must be allowed');
    assert.ok(testService.isSafaricomCallbackIp('127.0.0.1'), 'Localhost loopback must be allowed');
    assert.ok(testService.isSafaricomCallbackIp('::1'), 'IPv6 localhost must be allowed');
    assert.strictEqual(testService.isSafaricomCallbackIp('8.8.8.8'), false, 'Arbitrary foreign IP must be rejected');
    assert.strictEqual(testService.isSafaricomCallbackIp('102.134.20.10'), false, 'Untrusted ISP IP must be rejected');

    if (originalBypass !== undefined) process.env.DARAJA_BYPASS_IP_CHECK = originalBypass;
    console.log('  [PASS] Safaricom IP whitelist and mutual security validation verified');

    // TEST 3: STK Push Dispatch & Phone Normalization
    console.log('> TEST 3: STK Push Dispatch & Kenyan Phone Normalization...');
    assert.strictEqual(darajaService.formatPhone('0712345678'), '254712345678');
    assert.strictEqual(darajaService.formatPhone('+254722000000'), '254722000000');
    assert.strictEqual(darajaService.formatPhone('733111222'), '254733111222');
    assert.strictEqual(darajaService.formatPhone('0110123456'), '254110123456');

    const pushResult = await darajaService.initiateStkPush({
        phone: '0712345678',
        amount: 2500,
        reference: 'ORD-9001',
        description: 'Logistics Courier'
    });
    assert.ok(pushResult.success, 'STK Push initiate must return success');
    assert.ok(pushResult.checkout_request_id, 'Must return checkout_request_id');
    assert.strictEqual(pushResult.phone, '254712345678');
    assert.strictEqual(pushResult.amount, 2500);
    console.log('  [PASS] STK push generation and MSISDN format compliance verified');

    // TEST 4: Daraja Callback Ingestion & Parsing
    console.log('> TEST 4: Safaricom Callback Parsing...');
    const simulatedCb = darajaService.createSimulatedCallback('ws_CO_TEST_001', {
        resultCode: 0,
        amount: 3500,
        phone: '0722334455',
        receiptNumber: 'RKB8921KL9'
    });
    const parsed = darajaService.parseCallback(simulatedCb);
    assert.strictEqual(parsed.checkout_request_id, 'ws_CO_TEST_001');
    assert.strictEqual(parsed.is_success, true);
    assert.strictEqual(parsed.amount, 3500);
    assert.strictEqual(parsed.mpesa_receipt_number, 'RKB8921KL9');
    assert.strictEqual(parsed.phone_number, '254722334455');
    console.log('  [PASS] Callback schema parsing and receipt metadata extraction verified');

    // TEST 5: Automated Daily Settlement Reconciliation Worker
    console.log('> TEST 5: Automated Daily Settlement Reconciliation...');
    const mockDb = {
        async get(sql, params) {
            const queryStr = String(sql);
            const receipt = params[0];
            if (receipt && receipt.includes('RC_MATCH_100')) {
                return {
                    id: 10,
                    payment_intent_id: 101,
                    intent_amount: 1500,
                    raw_payload: JSON.stringify(darajaService.createSimulatedCallback('ws_CO_1', {
                        resultCode: 0,
                        amount: 1500,
                        receiptNumber: 'RC_MATCH_100'
                    }))
                };
            }
            if (receipt && receipt.includes('RC_VAR_200')) {
                return {
                    id: 11,
                    payment_intent_id: 102,
                    intent_amount: 2000,
                    raw_payload: JSON.stringify(darajaService.createSimulatedCallback('ws_CO_2', {
                        resultCode: 0,
                        amount: 2000,
                        receiptNumber: 'RC_VAR_200'
                    }))
                };
            }
            return null;
        }
    };

    const statementData = [
        { mpesa_receipt_number: 'RC_MATCH_100', amount: 1500, phone: '254711111111' }, // Exact match
        { mpesa_receipt_number: 'RC_VAR_200', amount: 1800, phone: '254722222222' },   // Variance (1800 stmt vs 2000 db)
        { mpesa_receipt_number: 'RC_MISSING_300', amount: 750, phone: '254733333333' }  // Missing from internal DB
    ];

    const reconReport = await darajaService.reconcileSettlementStatement(statementData, mockDb);
    assert.ok(reconReport.reconciliation_id.startsWith('REC-'), 'Report must have reconciliation ID');
    assert.strictEqual(reconReport.total_records, 3, 'Total records count must be 3');
    assert.strictEqual(reconReport.matched_count, 1, 'Matched count must be 1');
    assert.strictEqual(reconReport.discrepancy_count, 2, 'Discrepancy count must be 2');
    assert.strictEqual(reconReport.total_statement_amount, 4050, 'Total statement amount must be 4050');
    assert.strictEqual(reconReport.total_matched_amount, 1500, 'Total matched amount must be 1500');
    assert.strictEqual(reconReport.variance_amount, 2550, 'Variance amount must be 2550');

    const varDiscrepancy = reconReport.discrepancies.find(d => d.type === 'AMOUNT_VARIANCE');
    assert.ok(varDiscrepancy, 'Must flag amount variance discrepancy');
    assert.strictEqual(varDiscrepancy.receipt, 'RC_VAR_200');

    const missingDiscrepancy = reconReport.discrepancies.find(d => d.type === 'MISSING_INTERNAL');
    assert.ok(missingDiscrepancy, 'Must flag missing internal discrepancy');
    assert.strictEqual(missingDiscrepancy.receipt, 'RC_MISSING_300');
    console.log('  [PASS] Reconciliation worker: matched, variance & missing detection verified');

    console.log('\n============================================================');
    console.log('[SUCCESS] ALL 5 DARAJA 2.0 GATEWAY & RECONCILIATION TESTS PASSED!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('\n[FAIL] Test suite failed:', err);
    process.exit(1);
});
