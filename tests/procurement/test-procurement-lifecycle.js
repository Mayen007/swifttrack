// tests/procurement/test-procurement-lifecycle.js
// SwiftTrack Kenya: Phase 8 Suppliers & Procurement Lifecycle Integration Suite
const assert = require('assert');
const { db } = require('../../server/db/database.js');
const procurementService = require('../../server/services/procurementService.js');
const { assertInventoryInvariant, getOrInitInventory } = require('../../server/services/inventoryStateService.js');

console.log('\n============================================================');
console.log('📦  SWIFTTRACK KENYA: PHASE 8 PROCUREMENT LIFECYCLE SUITE');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Setup users and fixtures
const adminUser = db.prepare(`
  SELECT u.*, r.name as roleName
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE r.name = 'SUPER_ADMIN'
  LIMIT 1
`).get() || { id: 1, roleName: 'SUPER_ADMIN', branch_id: 1 };
adminUser.roleName = 'SUPER_ADMIN';
adminUser.branchId = adminUser.branch_id || 1;

const branch = db.prepare('SELECT * FROM branches LIMIT 1').get() || { id: 1 };
const warehouse = db.prepare('SELECT * FROM warehouses WHERE branch_id = ? LIMIT 1').get(branch.id) ||
  db.prepare('SELECT * FROM warehouses LIMIT 1').get();

// Ensure test product exists
let testProduct = db.prepare('SELECT * FROM products WHERE is_active = 1 LIMIT 1').get();
if (!testProduct) {
  const cat = db.prepare('SELECT id FROM categories LIMIT 1').get() || { id: 1 };
  const prodRes = db.prepare(`
    INSERT INTO products (sku, barcode, name, category_id, unit, unit_of_measure, selling_price, cost_price)
    VALUES ('SKU-PROC-TEST', 'BAR-PROC-TEST', 'Procurement Cement 50kg', ?, 'BAG', 'BAG', 850.0, 650.0)
  `).run(cat.id);
  testProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(prodRes.lastInsertRowid);
}

let testSupplierId = null;
let testRequisitionId = null;
let testPurchaseOrderId = null;
let testStockReceiptId = null;
let testInvoiceId = null;

(async () => {
  // TEST 1: Supplier Creation with Tax PIN, Payment Terms & Banking
  await runTest('1. Supplier Directory: Create supplier with KRA PIN, payment terms, and bank details', async () => {
    const code = `SUP-TEST-${Date.now().toString().slice(-4)}`;
    const res = db.prepare(`
      INSERT INTO suppliers (
        code, name, contact_person, email, phone, address, city, country,
        lead_time_days, payment_terms, tax_pin, vat_registered, withholding_tax_rate,
        bank_name, bank_account_no, mpesa_paybill, rating, notes
      ) VALUES (?, 'Bamburi Industrial Cement Ltd', 'John Mutua', 'mutua@bamburi.co.ke', '+254711999888',
        'Commercial St, Industrial Area', 'Nairobi', 'Kenya', 3, 'NET30', 'P051234567Z', 1, 2.0,
        'KCB Bank Kenya', '1100223344', '522522', 4.8, 'Tier-1 contracted cement manufacturer')
    `).run(code);

    testSupplierId = res.lastInsertRowid;
    const sup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(testSupplierId);
    assert.strictEqual(sup.tax_pin, 'P051234567Z');
    assert.strictEqual(sup.payment_terms, 'NET30');
    assert.strictEqual(sup.vat_registered, 1);
    assert.strictEqual(sup.bank_name, 'KCB Bank Kenya');
    assert.strictEqual(sup.rating, 4.8);
  });

  // TEST 2: Supplier Contacts & Contracted Product Pricing
  await runTest('2. Supplier Governance: Assign multiple contacts and contracted product price catalog', async () => {
    // Add primary contact
    db.prepare(`
      INSERT INTO supplier_contacts (supplier_id, name, role, email, phone, is_primary)
      VALUES (?, 'Alice Wambui', 'Key Accounts Director', 'alice@bamburi.co.ke', '+254722112233', 1)
    `).run(testSupplierId);

    // Add secondary contact
    db.prepare(`
      INSERT INTO supplier_contacts (supplier_id, name, role, email, phone, is_primary)
      VALUES (?, 'David Ochieng', 'Logistics Dispatch Lead', 'david@bamburi.co.ke', '+254733445566', 0)
    `).run(testSupplierId);

    const contacts = db.prepare('SELECT * FROM supplier_contacts WHERE supplier_id = ?').all(testSupplierId);
    assert.strictEqual(contacts.length, 2);
    assert.strictEqual(contacts.find(c => c.is_primary === 1).name, 'Alice Wambui');

    // Add contracted product
    db.prepare(`
      INSERT INTO supplier_products (supplier_id, product_id, supplier_sku, agreed_cost, min_order_quantity, lead_time_days, is_preferred)
      VALUES (?, ?, 'BAM-CEM-50', 620.0, 50, 2, 1)
    `).run(testSupplierId, testProduct.id);

    const prod = db.prepare('SELECT * FROM supplier_products WHERE supplier_id = ? AND product_id = ?').get(testSupplierId, testProduct.id);
    assert.strictEqual(prod.agreed_cost, 620.0);
    assert.strictEqual(prod.min_order_quantity, 50);
  });

  // TEST 3: Purchase Requisition Creation & State Progression
  await runTest('3. Purchase Requisition Lifecycle: DRAFT -> SUBMITTED -> APPROVED', async () => {
    const pr = procurementService.createRequisition({
      branchId: branch.id,
      userId: adminUser.id,
      urgency: 'HIGH',
      neededByDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
      items: [
        { product_id: testProduct.id, quantity: 100, unit_cost: 620.0, notes: 'Restock for warehouse depot' }
      ],
      notes: 'Urgent cement restock'
    });

    testRequisitionId = pr.id;
    assert.strictEqual(pr.status, 'DRAFT');
    assert.strictEqual(pr.total_estimated_cost, 62000.0);

    const submitted = procurementService.submitRequisition(pr.id, adminUser.id);
    assert.strictEqual(submitted.status, 'SUBMITTED');

    const approved = procurementService.approveRequisition(pr.id, adminUser.id);
    assert.strictEqual(approved.status, 'APPROVED');
    assert.strictEqual(approved.approved_by_user_id, adminUser.id);
  });

  // TEST 4: Purchase Requisition Rejection Guard
  await runTest('4. Requisition Guard: Verify rejection transitions and reason recording', async () => {
    const prReject = procurementService.createRequisition({
      branchId: branch.id,
      userId: adminUser.id,
      urgency: 'LOW',
      items: [{ product_id: testProduct.id, quantity: 10, unit_cost: 620.0 }]
    });

    procurementService.submitRequisition(prReject.id, adminUser.id);
    const rejected = procurementService.rejectRequisition(prReject.id, adminUser.id, 'Budget exhausted for quarter');
    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejection_reason, 'Budget exhausted for quarter');
  });

  // TEST 5: Purchase Order Generation & Conversion from Approved PR
  await runTest('5. PO Generation: Convert approved PR into Purchase Order with VAT tax calculation', async () => {
    const po = procurementService.createPurchaseOrder({
      purchaseRequisitionId: testRequisitionId,
      supplierId: testSupplierId,
      branchId: branch.id,
      warehouseId: warehouse.id,
      userId: adminUser.id,
      paymentTerms: 'NET30',
      expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      items: [
        { product_id: testProduct.id, ordered_quantity: 100, unit_cost: 620.0, tax_rate: 16.0 }
      ],
      shippingFee: 2000.0,
      notes: 'Deliver to Warehouse Gate 2'
    });

    testPurchaseOrderId = po.id;
    assert.strictEqual(po.status, 'DRAFT');
    assert.strictEqual(po.subtotal, 62000.0);
    assert.strictEqual(po.tax_amount, 9920.0); // 16% of 62,000
    assert.strictEqual(po.shipping_fee, 2000.0);
    assert.strictEqual(po.total_amount, 73920.0);

    // Verify requisition marked as CONVERTED_TO_PO
    const pr = db.prepare('SELECT status FROM purchase_requisitions WHERE id = ?').get(testRequisitionId);
    assert.strictEqual(pr.status, 'CONVERTED_TO_PO');
  });

  // TEST 6: PO Approval & Dispatch to Supplier
  await runTest('6. PO Progression: Transition PO from DRAFT -> APPROVED -> SENT_TO_SUPPLIER', async () => {
    const approved = procurementService.approvePurchaseOrder(testPurchaseOrderId, adminUser.id);
    assert.strictEqual(approved.status, 'APPROVED');
    assert.ok(approved.approved_at);

    const sent = procurementService.sendPurchaseOrder(testPurchaseOrderId, adminUser.id);
    assert.strictEqual(sent.status, 'SENT_TO_SUPPLIER');
    assert.ok(sent.sent_at);
  });

  // TEST 7: Partial Receiving & Stock Increment (GRN 1)
  await runTest('7. Partial Receiving (GRN 1): Receive 40 of 100 units -> PO status PARTIALLY_RECEIVED & stock credits', async () => {
    const initialInv = getOrInitInventory(warehouse.id, testProduct.id, branch.id);
    const initialOnHand = initialInv.quantity_on_hand;
    const initialAvailable = initialInv.quantity_available;

    const po = procurementService.getPurchaseOrderById(testPurchaseOrderId);
    const poItem = po.items[0];

    const result = procurementService.receivePurchaseOrderItems({
      poId: testPurchaseOrderId,
      warehouseId: warehouse.id,
      supplierInvoiceNo: 'SINV-BAM-8812',
      deliveryNoteNo: 'DN-BAM-001',
      items: [
        { po_item_id: poItem.id, quantity: 40, condition: 'GOOD', batch_number: 'BATCH-2026-A' }
      ],
      userId: adminUser.id,
      notes: 'First delivery batch of 40 bags'
    });

    testStockReceiptId = result.receipt.id;
    assert.strictEqual(result.purchase_order.status, 'PARTIALLY_RECEIVED');
    assert.strictEqual(result.purchase_order.items[0].received_quantity, 40);

    // Verify inventory balance
    const updatedInv = db.prepare('SELECT * FROM inventory WHERE id = ?').get(initialInv.id);
    assert.strictEqual(updatedInv.quantity_on_hand, initialOnHand + 40);
    assert.strictEqual(updatedInv.quantity_available, initialAvailable + 40);
    assertInventoryInvariant(updatedInv, 'Partial Receiving Verification');

    // Verify movement ledger entry
    const movement = db.prepare(`
      SELECT * FROM inventory_movements
      WHERE reference_id = ? AND movement_type = 'PURCHASE_RECEIPT'
    `).get(result.receipt.receipt_number);
    assert.ok(movement);
    assert.strictEqual(movement.quantity_change, 40);
  });

  // TEST 8: Full Receiving (GRN 2) & Quality Inspection Split
  await runTest('8. Full Receiving (GRN 2): Receive remaining 60 units (55 GOOD, 5 DAMAGED) -> PO FULLY_RECEIVED', async () => {
    const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, testProduct.id);
    const onHandBefore = invBefore.quantity_on_hand;
    const availableBefore = invBefore.quantity_available;
    const damagedBefore = invBefore.quantity_damaged;

    const po = procurementService.getPurchaseOrderById(testPurchaseOrderId);
    const poItem = po.items[0];

    const result = procurementService.receivePurchaseOrderItems({
      poId: testPurchaseOrderId,
      warehouseId: warehouse.id,
      deliveryNoteNo: 'DN-BAM-002',
      items: [
        { po_item_id: poItem.id, quantity: 55, condition: 'GOOD', batch_number: 'BATCH-2026-B' },
        { po_item_id: poItem.id, quantity: 5, condition: 'DAMAGED', notes: 'Torn packaging during transport' }
      ],
      userId: adminUser.id,
      notes: 'Final delivery batch fulfilling order'
    });

    assert.strictEqual(result.purchase_order.status, 'FULLY_RECEIVED');
    assert.strictEqual(result.purchase_order.items[0].received_quantity, 100);

    // Verify inventory split: +60 on_hand, +55 available, +5 damaged
    const invAfter = db.prepare('SELECT * FROM inventory WHERE id = ?').get(invBefore.id);
    assert.strictEqual(invAfter.quantity_on_hand, onHandBefore + 60);
    assert.strictEqual(invAfter.quantity_available, availableBefore + 55);
    assert.strictEqual(invAfter.quantity_damaged, damagedBefore + 5);
    assertInventoryInvariant(invAfter, 'Full Receiving Inspection Verification');
  });

  // TEST 9: 3-Way Matched Supplier Invoicing
  await runTest('9. Supplier Invoice: Record inward bill matched to PO and GRN with due date calculation', async () => {
    const inv = procurementService.createSupplierInvoice({
      supplierId: testSupplierId,
      purchaseOrderId: testPurchaseOrderId,
      stockReceiptId: testStockReceiptId,
      supplierInvoiceNo: 'INV-BAM-2026-0901',
      branchId: branch.id,
      invoiceDate: '2026-09-22',
      dueDate: '2026-10-22',
      subtotal: 62000.0,
      taxAmount: 9920.0,
      totalAmount: 71920.0,
      notes: '3-way matched against PO and GRN 1 & 2',
      userId: adminUser.id
    });

    testInvoiceId = inv.id;
    assert.strictEqual(inv.status, 'PENDING');
    assert.strictEqual(inv.amount_paid, 0.0);
    assert.strictEqual(inv.total_amount, 71920.0);
  });

  // TEST 10: Supplier Payment Disbursement
  await runTest('10. Payment Disbursement: Pay supplier bill -> status PAID and audit recording', async () => {
    // 1. Partial payment of 30,000
    const partResult = procurementService.recordSupplierPayment({
      supplierInvoiceId: testInvoiceId,
      amount: 30000.0,
      paymentMethod: 'BANK',
      referenceNumber: 'EFT-KCB-994821',
      paymentDate: '2026-09-23',
      notes: 'Partial payment installment 1',
      userId: adminUser.id
    });

    assert.strictEqual(partResult.invoice.status, 'PARTIALLY_PAID');
    assert.strictEqual(partResult.invoice.amount_paid, 30000.0);

    // 2. Settle remaining 41,920
    const fullResult = procurementService.recordSupplierPayment({
      supplierInvoiceId: testInvoiceId,
      amount: 41920.0,
      paymentMethod: 'MPESA',
      referenceNumber: 'QKD99238KL',
      paymentDate: '2026-09-24',
      notes: 'Final settlement via Paybill',
      userId: adminUser.id
    });

    assert.strictEqual(fullResult.invoice.status, 'PAID');
    assert.strictEqual(fullResult.invoice.amount_paid, 71920.0);
  });

  // TEST 11: Supplier Return (Debit Note) & Inventory Deduction
  await runTest('11. Supplier Return (Debit Note): Return 5 damaged bags -> Deduct DAMAGED stock bucket', async () => {
    const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, testProduct.id);
    const onHandBefore = invBefore.quantity_on_hand;
    const damagedBefore = invBefore.quantity_damaged;

    const returnRecord = procurementService.createSupplierReturn({
      supplierId: testSupplierId,
      purchaseOrderId: testPurchaseOrderId,
      warehouseId: warehouse.id,
      branchId: branch.id,
      reason: 'DAMAGED_ON_ARRIVAL',
      items: [
        { product_id: testProduct.id, quantity: 5, unit_cost: 620.0, from_inventory_state: 'DAMAGED', reason: 'Torn packaging' }
      ],
      notes: 'Return of 5 damaged bags received on PO',
      userId: adminUser.id
    });

    assert.strictEqual(returnRecord.status, 'DRAFT');
    assert.strictEqual(returnRecord.total_amount, 3100.0);

    // Approve return and verify inventory decrement
    const approvedReturn = procurementService.approveSupplierReturn(returnRecord.id, adminUser.id);
    assert.strictEqual(approvedReturn.status, 'APPROVED');

    const invAfter = db.prepare('SELECT * FROM inventory WHERE id = ?').get(invBefore.id);
    assert.strictEqual(invAfter.quantity_on_hand, onHandBefore - 5);
    assert.strictEqual(invAfter.quantity_damaged, damagedBefore - 5);
    assertInventoryInvariant(invAfter, 'Supplier Return Deduction Verification');

    // Verify movement ledger for PURCHASE_RETURN
    const returnMovement = db.prepare(`
      SELECT * FROM inventory_movements
      WHERE reference_id = ? AND movement_type = 'PURCHASE_RETURN'
    `).get(returnRecord.return_number);
    assert.ok(returnMovement);
    assert.strictEqual(returnMovement.quantity_change, -5);
  });

  // TEST 12: Supplier Performance Telemetry & Unified Timeline
  await runTest('12. Telemetry & History: Evaluate supplier scorecard and chronological audit trail', async () => {
    const perf = procurementService.getSupplierPerformance(testSupplierId);
    assert.strictEqual(perf.total_orders, 1);
    assert.strictEqual(perf.completed_orders, 1);
    assert.strictEqual(perf.fulfillment_rate, 100);
    assert.ok(perf.quality_pass_rate >= 90); // 95 good out of 100 received = 95%
    assert.strictEqual(perf.total_paid, 71920.0);

    const history = procurementService.getSupplierHistory(testSupplierId);
    assert.ok(history.length >= 4); // PO, GRNs, Invoice, Payment, Return
    assert.ok(history.some(e => e.type === 'PURCHASE_ORDER'));
    assert.ok(history.some(e => e.type === 'GRN'));
    assert.ok(history.some(e => e.type === 'INVOICE'));
    assert.ok(history.some(e => e.type === 'PAYMENT'));
    assert.ok(history.some(e => e.type === 'RETURN'));

    // Check procurement audit trail table
    const auditLogs = db.prepare('SELECT count(*) as c FROM procurement_audit_trail').get();
    assert.ok(auditLogs.c >= 8);
  });

  console.log('\n============================================================');
  console.log(`📊  PROCUREMENT SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
