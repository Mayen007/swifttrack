// tests/payments/test-frontend-payments.js
// SwiftTrack Kenya: Phase 7 Frontend Payments View & Component Integrity Suite
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('  SWIFTTRACK KENYA: PHASE 7 FRONTEND PAYMENTS TEST');
console.log('============================================================\n');

const paymentsViewPath = path.join(__dirname, '../../client/src/views/PaymentsView.jsx');
const paymentsComponentsDir = path.join(__dirname, '../../client/src/components/payments');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(paymentsViewPath), 'PaymentsView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const paymentsViewContent = fs.readFileSync(paymentsViewPath, 'utf8');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

// Aggregate code-split payments components into combined content
let combinedPaymentsContent = paymentsViewContent;
if (fs.existsSync(paymentsComponentsDir)) {
  const componentFiles = fs.readdirSync(paymentsComponentsDir).filter(f => f.endsWith('.jsx'));
  for (const f of componentFiles) {
    combinedPaymentsContent += '\n' + fs.readFileSync(path.join(paymentsComponentsDir, f), 'utf8');
  }
}

console.log('> TEST 1: Payment State Machine Steps & Alternative States...');
assert.ok(combinedPaymentsContent.includes('PAYMENT_STATUS_STEPS'), 'PaymentsView / constants must define PAYMENT_STATUS_STEPS');
assert.ok(combinedPaymentsContent.includes('ALTERNATIVE_PAYMENT_STATES'), 'PaymentsView / constants must define ALTERNATIVE_PAYMENT_STATES');

const expectedStatuses = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'REFUNDED'];
for (const st of expectedStatuses) {
  assert.ok(combinedPaymentsContent.includes(st), `PaymentsView / components must include state: ${st}`);
}
console.log('  [PASS] State machine progression and alternative states verified');

console.log('> TEST 2: Multi-Channel Gateway Support (M-Pesa, Card, Cash, Bank)...');
const expectedMethods = ['MPESA', 'CARD', 'CASH', 'BANK'];
for (const m of expectedMethods) {
  assert.ok(combinedPaymentsContent.includes(m), `PaymentsView / components must support channel: ${m}`);
}
assert.ok(paymentsViewContent.includes('formMethod') || combinedPaymentsContent.includes('formMethod'), 'PaymentsView must track formMethod state');
console.log('  [PASS] All 4 payment channels verified in UI');

console.log('> TEST 3: Initiate Payment Modal & M-Pesa STK Push Polling...');
assert.ok(paymentsViewContent.includes('initiateModalOpen'), 'PaymentsView must have initiateModalOpen state');
assert.ok(paymentsViewContent.includes('handleInitiatePayment'), 'PaymentsView must implement handleInitiatePayment');
assert.ok(paymentsViewContent.includes('stkPollingIntentId'), 'PaymentsView must implement STK push polling');
console.log('  [PASS] Payment initiation modal & live STK polling verified');

console.log('> TEST 4: Payment Detail Modal & 4-Tab Audit Deep Dive...');
assert.ok(paymentsViewContent.includes('detailModalOpen'), 'PaymentsView must have detailModalOpen state');
assert.ok(paymentsViewContent.includes('detailTab'), 'PaymentsView must have detailTab state');
assert.ok(combinedPaymentsContent.includes("'details'") || combinedPaymentsContent.includes('"details"'), 'PaymentsView must have Settlement Details tab');
assert.ok(combinedPaymentsContent.includes("'callbacks'") || combinedPaymentsContent.includes('"callbacks"'), 'PaymentsView must have Provider Callbacks tab');
assert.ok(combinedPaymentsContent.includes("'timeline'") || combinedPaymentsContent.includes('"timeline"'), 'PaymentsView must have Audit Trail tab');
assert.ok(combinedPaymentsContent.includes("'ledger'") || combinedPaymentsContent.includes('"ledger"'), 'PaymentsView must have Payments Ledger tab');
console.log('  [PASS] 4-tab audit deep-dive modal verified');

console.log('> TEST 5: Automated Reconciliation Engine & Refund Dialogs...');
assert.ok(paymentsViewContent.includes('reconciliationModalOpen'), 'PaymentsView must have reconciliationModalOpen');
assert.ok(paymentsViewContent.includes('handleRunReconciliation'), 'PaymentsView must implement handleRunReconciliation');
assert.ok(paymentsViewContent.includes('refundModalOpen'), 'PaymentsView must have refundModalOpen');
assert.ok(paymentsViewContent.includes('handleExecuteRefund'), 'PaymentsView must implement handleExecuteRefund');
console.log('  [PASS] Reconciliation console and refund dialogs verified');

console.log('> TEST 6: Application Router & Sidebar Navigation Integration...');
assert.ok(appJsxContent.includes('PaymentsView'), 'App.jsx must import PaymentsView');
assert.ok(appJsxContent.includes("case 'payments':"), 'App.jsx must handle case "payments"');
assert.ok(sidebarContent.includes("'payments'"), 'Sidebar.jsx must include payments nav item');
console.log('  [PASS] Navigation and routing integration verified');

console.log('\n============================================================');
console.log('[SUCCESS]  ALL 6 FRONTEND PAYMENTS TESTS PASSED!');
console.log('============================================================\n');
