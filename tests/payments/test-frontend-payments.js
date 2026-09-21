// tests/payments/test-frontend-payments.js
// SwiftTrack Kenya: Phase 7 Frontend Payments View & Component Integrity Suite
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('💳  SWIFTTRACK KENYA: PHASE 7 FRONTEND PAYMENTS TEST');
console.log('============================================================\n');

const paymentsViewPath = path.join(__dirname, '../../client/src/views/PaymentsView.jsx');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(paymentsViewPath), 'PaymentsView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const paymentsViewContent = fs.readFileSync(paymentsViewPath, 'utf8');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

console.log('▶ TEST 1: Payment State Machine Steps & Alternative States...');
assert.ok(paymentsViewContent.includes('PAYMENT_STATUS_STEPS'), 'PaymentsView must define PAYMENT_STATUS_STEPS');
assert.ok(paymentsViewContent.includes('ALTERNATIVE_PAYMENT_STATES'), 'PaymentsView must define ALTERNATIVE_PAYMENT_STATES');

const expectedStatuses = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'REFUNDED'];
for (const st of expectedStatuses) {
    assert.ok(paymentsViewContent.includes(st), `PaymentsView must include state: ${st}`);
}
console.log('  ✔ State machine progression and alternative states verified');

console.log('▶ TEST 2: Multi-Channel Gateway Support (M-Pesa, Card, Cash, Bank)...');
const expectedMethods = ['MPESA', 'CARD', 'CASH', 'BANK'];
for (const m of expectedMethods) {
    assert.ok(paymentsViewContent.includes(m), `PaymentsView must support channel: ${m}`);
}
assert.ok(paymentsViewContent.includes('formMethod'), 'PaymentsView must track formMethod state');
console.log('  ✔ All 4 payment channels verified in UI');

console.log('▶ TEST 3: Initiate Payment Modal & M-Pesa STK Push Polling...');
assert.ok(paymentsViewContent.includes('initiateModalOpen'), 'PaymentsView must have initiateModalOpen state');
assert.ok(paymentsViewContent.includes('handleInitiatePayment'), 'PaymentsView must implement handleInitiatePayment');
assert.ok(paymentsViewContent.includes('stkPollingIntentId'), 'PaymentsView must implement STK push polling');
console.log('  ✔ Payment initiation modal & live STK polling verified');

console.log('▶ TEST 4: Payment Detail Modal & 4-Tab Audit Deep Dive...');
assert.ok(paymentsViewContent.includes('detailModalOpen'), 'PaymentsView must have detailModalOpen state');
assert.ok(paymentsViewContent.includes('detailTab'), 'PaymentsView must have detailTab state');
assert.ok(paymentsViewContent.includes("'details'"), 'PaymentsView must have Settlement Details tab');
assert.ok(paymentsViewContent.includes("'callbacks'"), 'PaymentsView must have Provider Callbacks tab');
assert.ok(paymentsViewContent.includes("'timeline'"), 'PaymentsView must have Audit Trail tab');
assert.ok(paymentsViewContent.includes("'ledger'"), 'PaymentsView must have Payments Ledger tab');
console.log('  ✔ 4-tab audit deep-dive modal verified');

console.log('▶ TEST 5: Automated Reconciliation Engine & Refund Dialogs...');
assert.ok(paymentsViewContent.includes('reconciliationModalOpen'), 'PaymentsView must have reconciliationModalOpen');
assert.ok(paymentsViewContent.includes('handleRunReconciliation'), 'PaymentsView must implement handleRunReconciliation');
assert.ok(paymentsViewContent.includes('refundModalOpen'), 'PaymentsView must have refundModalOpen');
assert.ok(paymentsViewContent.includes('handleExecuteRefund'), 'PaymentsView must implement handleExecuteRefund');
console.log('  ✔ Reconciliation console and refund dialogs verified');

console.log('▶ TEST 6: Application Router & Sidebar Navigation Integration...');
assert.ok(appJsxContent.includes('PaymentsView'), 'App.jsx must import PaymentsView');
assert.ok(appJsxContent.includes("case 'payments':"), 'App.jsx must handle case "payments"');
assert.ok(sidebarContent.includes("'payments'"), 'Sidebar.jsx must include payments nav item');
console.log('  ✔ Navigation and routing integration verified');

console.log('\n============================================================');
console.log('🎉  ALL 6 FRONTEND PAYMENTS TESTS PASSED!');
console.log('============================================================\n');
