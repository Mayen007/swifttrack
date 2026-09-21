// tests/inventory/test-advanced-inventory.js
// SwiftTrack Kenya: Phase 3.3 Advanced Inventory Engine Test Suite & Acceptance Test
const assert = require('node:assert');
const http = require('node:http');
const app = require('../../server/server.js');
const { db } = require('../../server/db/database.js');
const {
  createBatch,
  getBatches,
  evaluateBatchExpiries,
  getExpiringBatches,
  registerSerials,
  getSerials,
  updateMovingAverageCost,
  depleteBatchFIFO,
  calculateCOGS,
  getInventoryValuation,
  getReorderAlerts
} = require('../../server/services/advancedInventoryService.js');
const { receiveStock } = require('../../server/services/inventoryOperationsService.js');
const { getOrInitInventory, assertInventoryInvariant } = require('../../server/services/inventoryStateService.js');

console.log('\n============================================================');
console.log('🧪  SWIFTTRACK 3.3 ADVANCED INVENTORY & CONCURRENCY SUITE');
console.log('============================================================\n');

let server;
let baseUrl = '';
let passedTests = 0;
let totalTests = 0;
let authToken = '';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: body
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}\n  Stack: ${err.stack}`);
  }
}

(async () => {
  // Bind ephemeral server
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const createdProductIds = [];
  const createdSaleNumbers = [];

  try {
    // 0. Authenticate
    const loginRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'superadmin', password: 'Password123!' }
    });
    authToken = loginRes.body?.token || loginRes.body?.data?.token;
    assert.ok(authToken, 'Superadmin authentication failed');

    const branch = db.prepare('SELECT id FROM branches WHERE id = 1').get() || { id: 1 };
    const warehouse = db.prepare('SELECT id FROM warehouses WHERE branch_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1').get(branch.id) || { id: 1 };
    const category = db.prepare('SELECT id FROM categories LIMIT 1').get() || { id: 1 };

    // Helper to create test product
    function createTestProduct({ sku, name, costPrice = 100, sellingPrice = 150, costingMethod = 'FIFO', isSerialized = 0, reorderThreshold = 10, reorderQuantity = 50 }) {
      const pRes = db.prepare(`
        INSERT INTO products (
          category_id, sku, barcode, name, unit, cost_price, selling_price,
          wholesale_price, tax_category, min_stock_alert, max_stock_alert,
          reorder_threshold, reorder_quantity, costing_method, is_serialized,
          images, is_active
        ) VALUES (?, ?, ?, ?, 'PCS', ?, ?, ?, 'STANDARD_16', 5, 500, ?, ?, ?, ?, '[]', 1)
      `).run(category.id, sku, `BAR-${sku}`, name, costPrice, sellingPrice, costPrice * 1.2, reorderThreshold, reorderQuantity, costingMethod, isSerialized);

      const pId = pRes.lastInsertRowid;
      createdProductIds.push(pId);
      return pId;
    }

    const ts = Date.now().toString().slice(-6);

    // -------------------------------------------------------------
    // TEST 1: Batch / Lot Tracking
    // -------------------------------------------------------------
    await runTest('1.1: Batch lot creation and query via API', async () => {
      const pId = createTestProduct({ sku: `SKU-BATCH-${ts}`, name: 'Batch Test Product' });
      const batchNo = `LOT-${ts}-01`;

      const batch = createBatch({
        branchId: branch.id,
        warehouseId: warehouse.id,
        productId: pId,
        batchNumber: batchNo,
        initialQuantity: 50,
        unitCost: 120.50,
        expiryDate: '2027-12-31',
        manufacturingDate: '2026-01-01'
      });

      assert.strictEqual(batch.batch_number, batchNo);
      assert.strictEqual(batch.quantity_available, 50);
      assert.strictEqual(batch.status, 'ACTIVE');

      const res = await makeRequest(`/api/v1/inventory/batches?product_id=${pId}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.strictEqual(res.body.length, 1);
      assert.strictEqual(res.body[0].batch_number, batchNo);
    });

    // -------------------------------------------------------------
    // TEST 2: Expiry Date Intelligence & Automated Segregation
    // -------------------------------------------------------------
    await runTest('2.1: Automated evaluation of expired batches segregrates stock to EXPIRED', async () => {
      const pId = createTestProduct({ sku: `SKU-EXP-${ts}`, name: 'Perishable Milk' });
      const batchNo = `LOT-EXP-${ts}`;

      // Inbound receipt with batch that expired yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      receiveStock({
        branchId: branch.id,
        warehouseId: warehouse.id,
        userId: 1,
        items: [{
          productId: pId,
          quantity: 20,
          unitCost: 80,
          batchNumber: batchNo,
          expiryDate: yesterday,
          condition: 'GOOD'
        }]
      });

      // Before evaluation: 20 units AVAILABLE
      const invBefore = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(invBefore.quantity_available, 20);
      assert.strictEqual(invBefore.quantity_expired, 0);

      // Trigger automated evaluation via API
      const evalRes = await makeRequest('/api/v1/inventory/batches/evaluate-expiries', {
        method: 'POST',
        body: { warehouse_id: warehouse.id, branch_id: branch.id }
      });
      assert.strictEqual(evalRes.status, 200);
      assert.ok(evalRes.body.result.expiredBatchesCount >= 1);

      // After evaluation: 20 units transitioned to EXPIRED, AVAILABLE = 0, ON_HAND = 20
      const invAfter = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(invAfter.quantity_available, 0);
      assert.strictEqual(invAfter.quantity_expired, 20);
      assert.strictEqual(invAfter.quantity_on_hand, 20);
      assertInventoryInvariant(invAfter, 'test-expiry-segregation');

      // Batch status updated to EXPIRED
      const updatedBatch = db.prepare('SELECT * FROM inventory_batches WHERE batch_number = ?').get(batchNo);
      assert.strictEqual(updatedBatch.status, 'EXPIRED');
      assert.strictEqual(updatedBatch.quantity_available, 0);
    });

    // -------------------------------------------------------------
    // TEST 3: Serial Numbers Tracking
    // -------------------------------------------------------------
    await runTest('3.1: Serial numbers registration, uniqueness, and API listing', async () => {
      const pId = createTestProduct({ sku: `SKU-SER-${ts}`, name: 'Serialized Laptop', isSerialized: 1 });
      const sn1 = `SN-${ts}-001`;
      const sn2 = `SN-${ts}-002`;

      const regRes = await makeRequest('/api/v1/inventory/serials', {
        method: 'POST',
        body: {
          product_id: pId,
          warehouse_id: warehouse.id,
          branch_id: branch.id,
          serial_numbers: [sn1, sn2],
          unit_cost: 45000
        }
      });
      assert.strictEqual(regRes.status, 201);
      assert.strictEqual(regRes.body.registeredCount, 2);

      // Duplicate registration rejected
      const dupRes = await makeRequest('/api/v1/inventory/serials', {
        method: 'POST',
        body: {
          product_id: pId,
          warehouse_id: warehouse.id,
          branch_id: branch.id,
          serial_numbers: [sn1]
        }
      });
      assert.strictEqual(dupRes.status, 400);

      // Query serials
      const listRes = await makeRequest(`/api/v1/inventory/serials?product_id=${pId}`);
      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.length, 2);
      assert.ok(listRes.body.every(s => s.status === 'AVAILABLE'));
    });

    // -------------------------------------------------------------
    // TEST 4: Moving Weighted-Average Cost Strategy
    // -------------------------------------------------------------
    await runTest('4.1: Weighted-average cost calculation on receipt: (10@100 + 10@120)/20 = 110', async () => {
      const pId = createTestProduct({ sku: `SKU-WAVG-${ts}`, name: 'Bulk Screws', costingMethod: 'WEIGHTED_AVERAGE', costPrice: 0 });

      // First receipt: 10 units at 100.00
      getOrInitInventory(warehouse.id, pId, branch.id);
      updateMovingAverageCost({ warehouseId: warehouse.id, productId: pId, receivedQty: 10, unitCost: 100 });
      db.prepare('UPDATE inventory SET quantity_available = 10, quantity_on_hand = 10 WHERE warehouse_id = ? AND product_id = ?').run(warehouse.id, pId);

      const inv1 = db.prepare('SELECT average_cost FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(Number(inv1.average_cost), 100);

      // Second receipt: 10 units at 120.00 -> New average should be (10*100 + 10*120)/20 = 110.00
      const newAvg = updateMovingAverageCost({ warehouseId: warehouse.id, productId: pId, receivedQty: 10, unitCost: 120 });
      assert.strictEqual(Number(newAvg), 110);

      const inv2 = db.prepare('SELECT average_cost FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(Number(inv2.average_cost), 110);
    });

    // -------------------------------------------------------------
    // TEST 5: Strict FIFO Depletion Strategy
    // -------------------------------------------------------------
    await runTest('5.1: FIFO depletion consumes oldest batch first and sums layer costs', async () => {
      const pId = createTestProduct({ sku: `SKU-FIFO-${ts}`, name: 'FIFO Cement', costingMethod: 'FIFO' });

      // Batch 1 (older): 5 units @ 80.00
      const b1 = createBatch({
        branchId: branch.id,
        warehouseId: warehouse.id,
        productId: pId,
        batchNumber: `B1-${ts}`,
        initialQuantity: 5,
        unitCost: 80.00,
        expiryDate: '2027-01-01'
      });

      // Batch 2 (newer): 10 units @ 120.00
      const b2 = createBatch({
        branchId: branch.id,
        warehouseId: warehouse.id,
        productId: pId,
        batchNumber: `B2-${ts}`,
        initialQuantity: 10,
        unitCost: 120.00,
        expiryDate: '2027-06-01'
      });

      // Deplete 7 units via FIFO:
      // Should take 5 units @ 80 (= 400) + 2 units @ 120 (= 240) = 640 total COGS
      const result = depleteBatchFIFO({ warehouseId: warehouse.id, productId: pId, quantity: 7 });

      assert.strictEqual(result.totalDepleted, 7);
      assert.strictEqual(result.totalCogs, 640.00);
      assert.strictEqual(result.allocations.length, 2);
      assert.strictEqual(result.allocations[0].batchId, b1.id);
      assert.strictEqual(result.allocations[0].quantity, 5);
      assert.strictEqual(result.allocations[1].batchId, b2.id);
      assert.strictEqual(result.allocations[1].quantity, 2);

      // Verify B1 is DEPLETED and B2 has 8 left
      const b1After = db.prepare('SELECT quantity_available, status FROM inventory_batches WHERE id = ?').get(b1.id);
      assert.strictEqual(b1After.quantity_available, 0);
      assert.strictEqual(b1After.status, 'DEPLETED');

      const b2After = db.prepare('SELECT quantity_available, status FROM inventory_batches WHERE id = ?').get(b2.id);
      assert.strictEqual(b2After.quantity_available, 8);
      assert.strictEqual(b2After.status, 'ACTIVE');
    });

    // -------------------------------------------------------------
    // TEST 6: COGS & Margin Tracking on Sale Checkout
    // -------------------------------------------------------------
    await runTest('6.1: POS checkout calculates COGS, gross profit, and margin %', async () => {
      const pId = createTestProduct({ sku: `SKU-POS-${ts}`, name: 'Paint Can', costPrice: 200, sellingPrice: 300 });
      getOrInitInventory(warehouse.id, pId, branch.id);
      db.prepare('UPDATE inventory SET quantity_on_hand = 10, quantity_available = 10 WHERE warehouse_id = ? AND product_id = ?').run(warehouse.id, pId);

      const res = await makeRequest('/api/pos/checkout', {
        method: 'POST',
        body: {
          branch_id: branch.id,
          items: [{ product_id: pId, quantity: 2, unit_price: 300 }],
          payment_method: 'CASH',
          amount_tendered: 1000
        }
      });

      assert.strictEqual(res.status, 201);
      const sale = res.body.sale;
      assert.ok(sale);
      createdSaleNumbers.push(sale.sale_number);

      // 2 units * cost 200 = 400 COGS. Selling price 300 * 2 = 600.
      assert.strictEqual(sale.total_cogs, 400);
      assert.strictEqual(sale.gross_profit, 200);
      assert.strictEqual(Number(sale.gross_margin_pct.toFixed(1)), 33.3);

      const dbSale = db.prepare('SELECT total_cogs, gross_profit, gross_margin_pct FROM sales WHERE id = ?').get(sale.id);
      assert.strictEqual(dbSale.total_cogs, 400);
      assert.strictEqual(dbSale.gross_profit, 200);
    });

    // -------------------------------------------------------------
    // TEST 7: Reorder Alerts Engine
    // -------------------------------------------------------------
    await runTest('7.1: Reorder alert triggers when available <= threshold and computes deficit', async () => {
      const pId = createTestProduct({
        sku: `SKU-ALERT-${ts}`,
        name: 'Hammer 500g',
        costPrice: 500,
        reorderThreshold: 15,
        reorderQuantity: 40
      });
      getOrInitInventory(warehouse.id, pId, branch.id);
      // Set available to 5 (threshold is 15 -> deficit is 10)
      db.prepare('UPDATE inventory SET quantity_on_hand = 5, quantity_available = 5 WHERE warehouse_id = ? AND product_id = ?').run(warehouse.id, pId);

      const alertsRes = await makeRequest(`/api/v1/inventory/reorder-alerts?warehouse_id=${warehouse.id}`);
      assert.strictEqual(alertsRes.status, 200);

      const itemAlert = alertsRes.body.alerts.find(a => a.productId === pId);
      assert.ok(itemAlert, 'Alert should be generated for product below threshold');
      assert.strictEqual(itemAlert.urgency, 'LOW_STOCK');
      assert.strictEqual(itemAlert.deficit, 10);
      assert.strictEqual(itemAlert.suggestedReorderQty, 50); // deficit (10) + reorderQty (40)
    });

    // -------------------------------------------------------------
    // TEST 8: ACCEPTANCE TEST (Strict Race Condition / Concurrency Guard)
    // "Two simultaneous sales attempt to purchase the final unit:
    //  Stock = 1
    //  Sale A -> succeeds
    //  Sale B -> rejected
    //  Stock = 0
    //  No negative inventory."
    // -------------------------------------------------------------
    await runTest('8.1: ACCEPTANCE TEST - Simultaneous sales competing for final unit (Stock = 1)', async () => {
      const pId = createTestProduct({
        sku: `SKU-FINAL-${ts}`,
        name: 'Exclusive Final Item',
        costPrice: 1000,
        sellingPrice: 1500
      });

      // EXACT STARTING CONDITION: Stock = 1
      getOrInitInventory(warehouse.id, pId, branch.id);
      db.prepare(`
        UPDATE inventory
        SET quantity_on_hand = 1,
            quantity_available = 1,
            quantity_reserved = 0,
            quantity_in_transit = 0,
            quantity_damaged = 0,
            quantity_expired = 0
        WHERE warehouse_id = ? AND product_id = ?
      `).run(warehouse.id, pId);

      const initialInv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(initialInv.quantity_on_hand, 1, 'Initial ON_HAND must be exactly 1');
      assert.strictEqual(initialInv.quantity_available, 1, 'Initial AVAILABLE must be exactly 1');
      assertInventoryInvariant(initialInv, 'pre-concurrency');

      // Prepare two simultaneous sale checkouts
      const checkoutPayload = {
        branch_id: branch.id,
        items: [{ product_id: pId, quantity: 1, unit_price: 1500 }],
        payment_method: 'CASH',
        amount_tendered: 1500,
        notes: 'Concurrency test checkout'
      };

      // FIRE SIMULTANEOUS REQUESTS
      const [resA, resB] = await Promise.all([
        makeRequest('/api/pos/checkout', { method: 'POST', body: checkoutPayload }),
        makeRequest('/api/pos/checkout', { method: 'POST', body: checkoutPayload })
      ]);

      const statuses = [resA.status, resB.status];
      const responses = [resA, resB];

      // Track successful sales for cleanup
      for (const r of responses) {
        if (r.status === 201 && r.body?.sale?.sale_number) {
          createdSaleNumbers.push(r.body.sale.sale_number);
        }
      }

      // 1. One sale MUST succeed (HTTP 201)
      assert.ok(statuses.includes(201), `Expected one sale to succeed (201), got: ${JSON.stringify(statuses)}`);

      // 2. The other sale MUST be rejected (HTTP 409 Conflict)
      assert.ok(statuses.includes(409), `Expected second sale to be rejected with 409 Conflict, got: ${JSON.stringify(statuses)}`);

      // Identify success and conflict
      const successRes = responses.find(r => r.status === 201);
      const conflictRes = responses.find(r => r.status === 409);

      assert.ok(successRes, 'Success response must exist');
      assert.ok(conflictRes, 'Conflict response must exist');
      assert.strictEqual(conflictRes.body.code, 'STOCK_CONFLICT');

      // 3. Final Stock MUST BE EXACTLY 0
      const finalInv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse.id, pId);
      assert.strictEqual(finalInv.quantity_on_hand, 0, 'Final ON_HAND must be exactly 0');
      assert.strictEqual(finalInv.quantity_available, 0, 'Final AVAILABLE must be exactly 0');

      // 4. NO NEGATIVE INVENTORY: All buckets >= 0
      assert.ok(finalInv.quantity_on_hand >= 0, 'quantity_on_hand must not be negative');
      assert.ok(finalInv.quantity_available >= 0, 'quantity_available must not be negative');
      assert.ok(finalInv.quantity_reserved >= 0, 'quantity_reserved must not be negative');
      assert.ok(finalInv.quantity_damaged >= 0, 'quantity_damaged must not be negative');
      assert.ok(finalInv.quantity_expired >= 0, 'quantity_expired must not be negative');
      assert.ok(finalInv.quantity_in_transit >= 0, 'quantity_in_transit must not be negative');

      // Mathematical invariant holds: ON_HAND == AVAILABLE + RESERVED + DAMAGED + EXPIRED == 0
      assertInventoryInvariant(finalInv, 'post-concurrency');

      console.log('  → Sale A: HTTP 201 Created (Stock acquired)');
      console.log('  → Sale B: HTTP 409 Conflict (Stock rejected)');
      console.log('  → Final Stock: On-Hand = 0, Available = 0, No Negative Inventory');
    });

    console.log('\n============================================================');
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`PASSED:      ${passedTests}`);
    console.log(`FAILED:      ${totalTests - passedTests}`);
    console.log('============================================================');

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL ADVANCED INVENTORY & CONCURRENCY TESTS PASSED!\n');
    } else {
      console.error('\n❌ SOME ADVANCED INVENTORY TESTS FAILED!\n');
      process.exitCode = 1;
    }

  } finally {
    // CLEANUP: Purge all created test records
    try {
      for (const saleNumber of createdSaleNumbers) {
        const sale = db.prepare('SELECT id, order_id FROM sales WHERE sale_number = ?').get(saleNumber);
        if (sale) {
          db.prepare('DELETE FROM payments WHERE sale_id = ?').run(sale.id);
          db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sale.id);
          db.prepare('DELETE FROM sales WHERE id = ?').run(sale.id);
          if (sale.order_id) {
            db.prepare('DELETE FROM order_items WHERE order_id = ?').run(sale.order_id);
            db.prepare('DELETE FROM orders WHERE id = ?').run(sale.order_id);
          }
        }
      }

      for (const pId of createdProductIds) {
        db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pId);
        db.prepare('DELETE FROM stock_receipt_items WHERE product_id = ?').run(pId);
        db.prepare('DELETE FROM inventory_serials WHERE product_id = ?').run(pId);
        db.prepare('DELETE FROM inventory_batches WHERE product_id = ?').run(pId);
        db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pId);
        db.prepare('DELETE FROM products WHERE id = ?').run(pId);
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup notice:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }
  }
})();
