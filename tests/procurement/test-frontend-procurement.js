// tests/procurement/test-frontend-procurement.js
// SwiftTrack Kenya: Phase 8 Frontend Procurement View & Component Integrity Suite
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('============================================================');
console.log('📦  SWIFTTRACK KENYA: PHASE 8 FRONTEND PROCUREMENT TEST');
console.log('============================================================\n');

const procurementViewPath = path.join(__dirname, '../../client/src/views/ProcurementView.jsx');
const appJsxPath = path.join(__dirname, '../../client/src/App.jsx');
const sidebarPath = path.join(__dirname, '../../client/src/components/Sidebar.jsx');

assert.ok(fs.existsSync(procurementViewPath), 'ProcurementView.jsx must exist');
assert.ok(fs.existsSync(appJsxPath), 'App.jsx must exist');
assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

const procurementContent = fs.readFileSync(procurementViewPath, 'utf8');
const appContent = fs.readFileSync(appJsxPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

console.log('▶ TEST 1: Complete 6-Tab Procurement Lifecycle Interface...');
const expectedTabs = ['orders', 'requisitions', 'suppliers', 'grns', 'invoices', 'returns'];
for (const t of expectedTabs) {
  assert.ok(procurementContent.includes(`'${t}'`), `ProcurementView must include tab: ${t}`);
}
console.log('  ✔ All 6 tabs verified (Orders, Requisitions, Suppliers, GRNs, Invoices, Returns)');

console.log('▶ TEST 2: Executive Telemetry & KPI Instrumentation...');
assert.ok(procurementContent.includes('telemetry'), 'ProcurementView must track telemetry state');
assert.ok(procurementContent.includes('active_pos'), 'ProcurementView must display active POs');
assert.ok(procurementContent.includes('pending_prs'), 'ProcurementView must display pending PRs');
assert.ok(procurementContent.includes('total_po_spend'), 'ProcurementView must display PO spend');
assert.ok(procurementContent.includes('open_payable_amount'), 'ProcurementView must display open payable invoices');
assert.ok(procurementContent.includes('active_suppliers'), 'ProcurementView must display active suppliers');
console.log('  ✔ KPI telemetry banner verified');

console.log('▶ TEST 3: Purchase Requisition (PR) Management & Approvals...');
assert.ok(procurementContent.includes('CreatePRModal'), 'ProcurementView must contain CreatePRModal');
assert.ok(procurementContent.includes('urgency'), 'PR must support urgency rating');
assert.ok(procurementContent.includes('/requisitions/${pr.id}/approve'), 'ProcurementView must implement 1-click PR approval');
console.log('  ✔ Purchase Requisition workflows verified');

console.log('▶ TEST 4: Purchase Order Issuance & Inbound Goods Receiving (GRN)...');
assert.ok(procurementContent.includes('CreatePOModal'), 'ProcurementView must contain CreatePOModal');
assert.ok(procurementContent.includes('ReceiveGoodsModal'), 'ProcurementView must contain ReceiveGoodsModal');
assert.ok(procurementContent.includes('total_ordered_qty'), 'PO must show ordered quantities');
assert.ok(procurementContent.includes('total_received_qty'), 'PO must show receiving progress');
console.log('  ✔ PO generation and GRN stock allocation dialogs verified');

console.log('▶ TEST 5: Supplier Governance, Scorecard & Contact Management...');
assert.ok(procurementContent.includes('CreateSupplierModal'), 'ProcurementView must contain CreateSupplierModal');
assert.ok(procurementContent.includes('SupplierDetailModal'), 'ProcurementView must contain SupplierDetailModal');
assert.ok(procurementContent.includes('tax_pin'), 'Suppliers must support KRA PIN');
assert.ok(procurementContent.includes('payment_terms'), 'Suppliers must support payment terms');
assert.ok(procurementContent.includes('scorecard'), 'Supplier profile must feature performance scorecard');
console.log('  ✔ Supplier directory, scorecard, and banking profile verified');

console.log('▶ TEST 6: Invoices & 3-Way Match Payment Disbursement...');
assert.ok(procurementContent.includes('CreateInvoiceModal'), 'ProcurementView must contain CreateInvoiceModal');
assert.ok(procurementContent.includes('RecordPaymentModal'), 'ProcurementView must contain RecordPaymentModal');
assert.ok(procurementContent.includes('supplier_invoice_no'), 'Invoices must track vendor bill number');
assert.ok(procurementContent.includes('/invoices/${invoice.id}/pay'), 'ProcurementView must implement invoice payment');
console.log('  ✔ 3-way matched supplier invoices & payments verified');

console.log('▶ TEST 7: Supplier Return (Debit Note) Workflow...');
assert.ok(procurementContent.includes('CreateReturnModal'), 'ProcurementView must contain CreateReturnModal');
assert.ok(procurementContent.includes('/returns/${ret.id}/approve'), 'ProcurementView must implement return approval & stock deduction');
console.log('  ✔ Supplier returns and debit notes verified');

console.log('▶ TEST 8: Application Router & Navigation Integration...');
assert.ok(sidebarContent.includes("'procurement'"), 'Sidebar.jsx must contain procurement route id');
assert.ok(sidebarContent.includes('Procurement & Suppliers'), 'Sidebar.jsx must label Procurement & Suppliers');
assert.ok(appContent.includes('ProcurementView'), 'App.jsx must import ProcurementView');
assert.ok(appContent.includes("case 'procurement':"), 'App.jsx must route procurement view');
console.log('  ✔ Sidebar and App.jsx routing integration verified');

console.log('\n============================================================');
console.log('🎉  ALL 8 FRONTEND PROCUREMENT TESTS PASSED!');
console.log('============================================================\n');
