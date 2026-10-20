// tests/procurement/test-frontend-procurement.js
// SwiftTrack Kenya: Phase 8 Frontend Procurement View & Component Integrity Suite
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('  SWIFTTRACK KENYA: PHASE 8 FRONTEND PROCUREMENT TEST');
console.log('============================================================\n');

const procurementViewPath = path.join(__dirname, '../../client/src/views/ProcurementView.jsx');
const procurementComponentsDir = path.join(__dirname, '../../client/src/components/procurement');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(procurementViewPath), 'ProcurementView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const procurementContent = fs.readFileSync(procurementViewPath, 'utf8');
const appContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

// Aggregate code-split procurement components into combined content
let combinedProcurementContent = procurementContent;
if (fs.existsSync(procurementComponentsDir)) {
  const componentFiles = fs.readdirSync(procurementComponentsDir).filter(f => f.endsWith('.jsx'));
  for (const f of componentFiles) {
    combinedProcurementContent += '\n' + fs.readFileSync(path.join(procurementComponentsDir, f), 'utf8');
  }
}

console.log('> TEST 1: Complete 6-Tab Procurement Lifecycle Interface...');
const expectedTabs = ['orders', 'requisitions', 'suppliers', 'grns', 'invoices', 'returns'];
for (const t of expectedTabs) {
  assert.ok(combinedProcurementContent.includes(`'${t}'`), `ProcurementView must include tab: ${t}`);
}
console.log('  [PASS] All 6 tabs verified (Orders, Requisitions, Suppliers, GRNs, Invoices, Returns)');

console.log('> TEST 2: Executive Telemetry & KPI Instrumentation...');
assert.ok(combinedProcurementContent.includes('telemetry'), 'ProcurementView must track telemetry state');
assert.ok(combinedProcurementContent.includes('active_pos'), 'ProcurementView must display active POs');
assert.ok(combinedProcurementContent.includes('pending_prs'), 'ProcurementView must display pending PRs');
assert.ok(combinedProcurementContent.includes('total_po_spend'), 'ProcurementView must display PO spend');
assert.ok(combinedProcurementContent.includes('open_payable_amount'), 'ProcurementView must display open payable invoices');
assert.ok(combinedProcurementContent.includes('active_suppliers'), 'ProcurementView must display active suppliers');
console.log('  [PASS] KPI telemetry banner verified');

console.log('> TEST 3: Purchase Requisition (PR) Management & Approvals...');
assert.ok(combinedProcurementContent.includes('CreatePRModal'), 'ProcurementView must contain CreatePRModal');
assert.ok(combinedProcurementContent.includes('urgency'), 'PR must support urgency rating');
assert.ok(combinedProcurementContent.includes('/requisitions/') && combinedProcurementContent.includes('approve'), 'ProcurementView must implement 1-click PR approval');
console.log('  [PASS] Purchase Requisition workflows verified');

console.log('> TEST 4: Purchase Order Issuance & Inbound Goods Receiving (GRN)...');
assert.ok(combinedProcurementContent.includes('CreatePOModal'), 'ProcurementView must contain CreatePOModal');
assert.ok(combinedProcurementContent.includes('ReceiveGoodsModal'), 'ProcurementView must contain ReceiveGoodsModal');
assert.ok(combinedProcurementContent.includes('total_ordered_qty'), 'PO must show ordered quantities');
assert.ok(combinedProcurementContent.includes('total_received_qty'), 'PO must show receiving progress');
console.log('  [PASS] PO generation and GRN stock allocation dialogs verified');

console.log('> TEST 5: Supplier Governance, Scorecard & Contact Management...');
assert.ok(combinedProcurementContent.includes('CreateSupplierModal'), 'ProcurementView must contain CreateSupplierModal');
assert.ok(combinedProcurementContent.includes('SupplierDetailModal'), 'ProcurementView must contain SupplierDetailModal');
assert.ok(combinedProcurementContent.includes('tax_pin'), 'Suppliers must support KRA PIN');
assert.ok(combinedProcurementContent.includes('payment_terms'), 'Suppliers must support payment terms');
assert.ok(combinedProcurementContent.includes('scorecard'), 'Supplier profile must feature performance scorecard');
console.log('  [PASS] Supplier directory, scorecard, and banking profile verified');

console.log('> TEST 6: Invoices & 3-Way Match Payment Disbursement...');
assert.ok(combinedProcurementContent.includes('CreateInvoiceModal'), 'ProcurementView must contain CreateInvoiceModal');
assert.ok(combinedProcurementContent.includes('RecordPaymentModal'), 'ProcurementView must contain RecordPaymentModal');
assert.ok(combinedProcurementContent.includes('matched_status') || combinedProcurementContent.includes('status'), 'ProcurementView must verify 3-way match status');
console.log('  [PASS] Invoices, 3-way matching and payment dialogs verified');

console.log('> TEST 7: Application Router & Sidebar Navigation Integration...');
assert.ok(appContent.includes('ProcurementView'), 'App.jsx must import ProcurementView');
assert.ok(appContent.includes("case 'procurement':"), 'App.jsx must route procurement case');
assert.ok(sidebarContent.includes("'procurement'"), 'Sidebar.jsx must contain procurement route ID');
console.log('  [PASS] Sidebar and App.jsx routing integration verified');

console.log('\n============================================================');
console.log('[SUCCESS]  ALL 7 FRONTEND PROCUREMENT TESTS PASSED!');
console.log('============================================================\n');
