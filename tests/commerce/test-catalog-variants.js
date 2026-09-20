// tests/commerce/test-catalog-variants.js
// Automated Integration Suite: Product Catalog, Variants, Brands, Suppliers & Archiving
const assert = require('node:assert');
const http = require('node:http');
const app = require('../../server/server.js');
const { db } = require('../../server/db/database.js');

console.log('\n============================================================');
console.log('📦  SWIFTTRACK COMMERCE: PRODUCT CATALOG & VARIANTS SUITE');
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
        console.error(`  Error: ${err.message}`);
    }
}

(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    let createdProductId = null;
    let createdVariantId = null;

    try {
        // 1. Authenticate as Super Admin
        const loginRes = await makeRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { username: 'superadmin', password: 'Password123!' }
        });
        authToken = loginRes.body?.token || loginRes.body?.data?.token;
        assert.ok(authToken, 'Superadmin authentication failed');

        const timestamp = Date.now().toString().slice(-6);

        // -------------------------------------------------------------
        // TEST 1: Brands & Suppliers API
        // -------------------------------------------------------------
        await runTest('1.1: GET /api/v1/brands returns active brand list', async () => {
            const res = await makeRequest('/api/v1/brands');
            assert.strictEqual(res.status, 200);
            const brands = Array.isArray(res.body.data) ? res.body.data : res.body;
            assert.ok(brands.length >= 5, 'Expected at least 5 seeded brands');
            assert.ok(brands.some(b => b.name.includes('Bamburi')));
        });

        await runTest('1.2: GET /api/v1/suppliers returns active suppliers', async () => {
            const res = await makeRequest('/api/v1/suppliers');
            assert.strictEqual(res.status, 200);
            const suppliers = Array.isArray(res.body.data) ? res.body.data : res.body;
            assert.ok(suppliers.length >= 3, 'Expected at least 3 suppliers');
            assert.ok(suppliers.some(s => s.code.includes('BAMBURI')));
        });

        // -------------------------------------------------------------
        // TEST 2: Product Master Catalog CRUD
        // -------------------------------------------------------------
        const testSku = `TEST-PROD-${timestamp}`;
        const testBarcode = `890199${timestamp}`;

        await runTest('2.1: POST /api/v1/products creates product with full metadata', async () => {
            const res = await makeRequest('/api/v1/products', {
                method: 'POST',
                body: {
                    category_id: 1,
                    brand_id: 1,
                    supplier_id: 2,
                    sku: testSku,
                    barcode: testBarcode,
                    name: `Heavy Industrial Pallet Wrap ${timestamp}`,
                    description: 'Triple-strength blown polythene stretch film',
                    unit: 'ROLL',
                    cost_price: 1200.0,
                    selling_price: 1850.0,
                    wholesale_price: 1550.0,
                    tax_category: 'STANDARD_16',
                    min_stock_alert: 25,
                    reorder_quantity: 100,
                    images: ['https://example.com/wrap.jpg']
                }
            });

            assert.strictEqual(res.status, 201);
            const created = res.body.data || res.body;
            assert.ok(created.id, 'Missing product ID');
            createdProductId = created.id;
            assert.strictEqual(created.sku, testSku);
            assert.strictEqual(Number(created.selling_price), 1850.0);
            assert.strictEqual(Number(created.wholesale_price), 1550.0);
            assert.strictEqual(created.tax_category, 'STANDARD_16');
        });

        await runTest('2.2: Duplicate SKU or Barcode is rejected with 409 Conflict', async () => {
            const res = await makeRequest('/api/v1/products', {
                method: 'POST',
                body: {
                    category_id: 1,
                    sku: testSku,
                    barcode: `DIFFERENT-${timestamp}`,
                    name: 'Duplicate SKU attempt',
                    selling_price: 500
                }
            });
            assert.strictEqual(res.status, 409);
        });

        await runTest('2.3: GET /api/v1/products/:id retrieves enriched product details', async () => {
            const res = await makeRequest(`/api/v1/products/${createdProductId}`);
            assert.strictEqual(res.status, 200);
            const p = res.body.data || res.body;
            assert.strictEqual(p.id, createdProductId);
            assert.strictEqual(p.brand_name, 'SwiftPack Commercial');
            assert.ok(Array.isArray(p.images));
        });

        // -------------------------------------------------------------
        // TEST 3: Product Variants Architecture
        // -------------------------------------------------------------
        const variantSku = `${testSku}-500M`;
        const variantBarcode = `890299${timestamp}`;

        await runTest('3.1: POST /api/v1/products/:id/variants creates multi-attribute variant', async () => {
            const res = await makeRequest(`/api/v1/products/${createdProductId}/variants`, {
                method: 'POST',
                body: {
                    variant_sku: variantSku,
                    variant_barcode: variantBarcode,
                    variant_name: 'Pallet Wrap 500m Extra Clear',
                    size: '500m x 500mm',
                    color: 'Ultra Clear',
                    model: '23 Micron Blown',
                    cost_price_override: 1400.0,
                    selling_price_override: 2100.0,
                    wholesale_price_override: 1800.0
                }
            });

            assert.strictEqual(res.status, 201);
            const v = res.body.data || res.body;
            assert.ok(v.id);
            createdVariantId = v.id;
            assert.strictEqual(v.variant_sku, variantSku);
            assert.strictEqual(v.variant_barcode, variantBarcode);
            assert.strictEqual(Number(v.selling_price_override), 2100.0);
        });

        await runTest('3.2: GET /api/v1/products/:id/variants returns list with stock allocations', async () => {
            const res = await makeRequest(`/api/v1/products/${createdProductId}/variants`);
            assert.strictEqual(res.status, 200);
            const list = Array.isArray(res.body.data) ? res.body.data : res.body;
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].variant_sku, variantSku);
        });

        await runTest('3.3: GET /api/v1/products/variant-barcode/:barcode directly scans variant for POS', async () => {
            const res = await makeRequest(`/api/v1/products/variant-barcode/${variantBarcode}`);
            assert.strictEqual(res.status, 200);
            const scanned = res.body.data || res.body;
            assert.strictEqual(scanned.variant_barcode, variantBarcode);
            assert.strictEqual(scanned.id, createdVariantId);
            assert.ok(scanned.parent_name);
        });

        // -------------------------------------------------------------
        // TEST 4: Product Lifecycle & Archiving (Soft-Delete)
        // -------------------------------------------------------------
        await runTest('4.1: POST /api/v1/products/:id/archive soft-deletes product', async () => {
            const res = await makeRequest(`/api/v1/products/${createdProductId}/archive`, { method: 'POST' });
            assert.strictEqual(res.status, 200);
            const p = res.body.data || res.body;
            assert.strictEqual(p.is_archived, 1);
            assert.strictEqual(p.is_active, 0);

            // Verify not listed in active catalog by default
            const listRes = await makeRequest(`/api/v1/products?search=${testSku}`);
            const list = Array.isArray(listRes.body.data) ? listRes.body.data : listRes.body;
            assert.ok(!list.some(item => item.id === createdProductId), 'Archived product should not appear in active search');
        });

        await runTest('4.2: POST /api/v1/products/:id/restore restores archived product', async () => {
            const res = await makeRequest(`/api/v1/products/${createdProductId}/restore`, { method: 'POST' });
            assert.strictEqual(res.status, 200);
            const p = res.body.data || res.body;
            assert.strictEqual(p.is_archived, 0);
            assert.strictEqual(p.is_active, 1);

            // Verify restored in active catalog
            const listRes = await makeRequest(`/api/v1/products?search=${testSku}`);
            const list = Array.isArray(listRes.body.data) ? listRes.body.data : listRes.body;
            assert.ok(list.some(item => item.id === createdProductId), 'Restored product must appear in active catalog');
        });

        console.log('\n============================================================');
        console.log(`TOTAL TESTS: ${totalTests}`);
        console.log(`PASSED:      ${passedTests}`);
        console.log(`FAILED:      ${totalTests - passedTests}`);
        console.log('============================================================');

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL PRODUCT CATALOG & VARIANTS TESTS PASSED!\n');
        } else {
            console.error('\n❌ PRODUCT CATALOG TESTS FAILED!\n');
            process.exit(1);
        }

    } finally {
        if (createdProductId) {
            const { db } = require('../../server/db/database.js');
            db.prepare('DELETE FROM variant_inventory WHERE product_id = ?').run(createdProductId);
            db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(createdProductId);
            db.prepare('DELETE FROM inventory WHERE product_id = ?').run(createdProductId);
            db.prepare('DELETE FROM products WHERE id = ?').run(createdProductId);
        }
        server.close();
    }
})();
