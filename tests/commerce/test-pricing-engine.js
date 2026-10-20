// tests/commerce/test-pricing-engine.js
// Automated Integration Suite: Multi-Tier Dynamic Pricing Engine & Promotions
const assert = require('node:assert');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const app = require('../../server/server.js');
const dbAdapter = require('../../server/db/dbAdapter.js');
const { resolvePrice } = require('../../server/services/pricingService.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK COMMERCE: DYNAMIC PRICING ENGINE SUITE');
console.log('============================================================\n');

let server;
let baseUrl = '';
let passedTests = 0;
let totalTests = 0;
let authToken = '';
const fixtureProductIds = [];
const fixturePromoCodes = [];

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
        console.log(`[PASS] [PASS] ${name}`);
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

    try {
        // Authenticate
        const loginRes = await makeRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { username: 'superadmin', password: 'Password123!' }
        });
        authToken = loginRes.body?.token || loginRes.body?.data?.token;
        assert.ok(authToken);

        const categories = await dbAdapter.all(
            'SELECT id FROM categories WHERE is_active = true ORDER BY id LIMIT 1'
        );
        const branches = await dbAdapter.all('SELECT id FROM branches ORDER BY id LIMIT 2');
        assert.ok(categories.length, 'Pricing tests require an active product category');
        assert.strictEqual(branches.length, 2, 'Pricing tests require two seeded branches');

        const fixtureSuffix = randomUUID().toUpperCase();
        const createProduct = async ({ name, sellingPrice, wholesalePrice, taxCategory }) => {
            const result = await dbAdapter.run(`
                INSERT INTO products (
                    category_id, sku, barcode, name, unit, cost_price, selling_price,
                    wholesale_price, tax_category, min_stock_alert, reorder_quantity,
                    is_active, is_archived
                ) VALUES (?, ?, ?, ?, 'PCS', 0, ?, ?, ?, 1, 1, true, false)
            `, [
                categories[0].id,
                `TEST-PRICE-${fixtureSuffix}-${fixtureProductIds.length + 1}`,
                `TESTBAR-${fixtureSuffix}-${fixtureProductIds.length + 1}`,
                name,
                sellingPrice,
                wholesalePrice,
                taxCategory
            ]);
            fixtureProductIds.push(result.insertId);
            return result.insertId;
        };

        const pricingProductId = await createProduct({
            name: 'Commerce Pricing Test Product',
            sellingPrice: 180,
            wholesalePrice: 150,
            taxCategory: 'STANDARD_16'
        });
        const branchProductId = await createProduct({
            name: 'Commerce Branch Override Test Product',
            sellingPrice: 850,
            wholesalePrice: 780,
            taxCategory: 'STANDARD_16'
        });
        const waterProductId = await createProduct({
            name: 'Commerce Zero-Rated Test Product',
            sellingPrice: 720,
            wholesalePrice: 600,
            taxCategory: 'ZERO_RATED_0'
        });

        for (const [minQuantity, maxQuantity, unitPrice] of [
            [20, 49, 165],
            [50, 99, 150],
            [100, null, 135]
        ]) {
            await dbAdapter.run(`
                INSERT INTO product_bulk_pricing (product_id, min_quantity, max_quantity, unit_price)
                VALUES (?, ?, ?, ?)
            `, [pricingProductId, minQuantity, maxQuantity, unitPrice]);
        }

        await dbAdapter.run(`
            INSERT INTO branch_product_prices (branch_id, product_id, selling_price)
            VALUES (?, ?, ?)
        `, [branches[1].id, branchProductId, 820]);

        const promoCode = `LOGISTICS10-${fixtureSuffix.slice(0, 8)}`;
        fixturePromoCodes.push(promoCode);
        fixturePromoCodes.push(`TEST-PROMO-${fixtureSuffix.slice(0, 8)}`);
        for (const [code, name] of [
            [fixturePromoCodes[0], 'Commerce Pricing Test Promotion'],
            [fixturePromoCodes[1], 'Commerce Scheduled Test Promotion']
        ]) {
            await dbAdapter.run(`
                INSERT INTO promotions (
                    promo_code, name, discount_type, discount_value, scope, target_id,
                    min_spend, min_quantity, start_date, end_date, is_active
                ) VALUES (?, ?, 'PERCENTAGE', 10, 'PRODUCT', ?, 1000, 1, ?, ?, true)
            `, [
                code,
                name,
                pricingProductId,
                new Date(Date.now() - 86400000).toISOString(),
                new Date(Date.now() + 86400000).toISOString()
            ]);
        }

        // -------------------------------------------------------------
        // TEST 1: Baseline Retail & Wholesale Resolution
        // -------------------------------------------------------------
        await runTest('1.1: Standard retail unit price calculation (Corrugated Box)', async () => {
            const result = await resolvePrice({ productId: pricingProductId, quantity: 1 });
            assert.strictEqual(result.unitPrice, 180.0);
            assert.strictEqual(result.subtotal, 180.0);
            assert.strictEqual(result.taxCategory, 'STANDARD_16');
            // KRA VAT calculation (inclusive): 180 * (16 / 116) = 24.83
            assert.strictEqual(result.taxAmount, 24.83);
            assert.strictEqual(result.netAmount, 155.17);
        });

        await runTest('1.2: Base wholesale pricing request', async () => {
            const result = await resolvePrice({ productId: pricingProductId, quantity: 5, isWholesale: true });
            assert.strictEqual(result.unitPrice, 150.0);
            assert.strictEqual(result.subtotal, 750.0);
        });

        // -------------------------------------------------------------
        // TEST 2: Branch Price Overrides
        // -------------------------------------------------------------
        await runTest('2.1: Mombasa Branch price override applied (Product 6 Cement)', async () => {
            const nairobiPrice = await resolvePrice({ productId: branchProductId, branchId: branches[0].id, quantity: 1 });
            assert.strictEqual(nairobiPrice.unitPrice, 850.0);

            const mombasaPrice = await resolvePrice({ productId: branchProductId, branchId: branches[1].id, quantity: 1 });
            assert.strictEqual(mombasaPrice.unitPrice, 820.0);
            assert.ok(mombasaPrice.appliedRules.some(r => r.type === 'BRANCH_OVERRIDE'));
        });

        // -------------------------------------------------------------
        // TEST 3: Bulk Quantity Break Tiers
        // -------------------------------------------------------------
        await runTest('3.1: Bulk quantity breaks resolve accurately across quantity thresholds', async () => {
            const single = await resolvePrice({ productId: pricingProductId, quantity: 5 });
            assert.strictEqual(single.unitPrice, 180.0);

            const tier1 = await resolvePrice({ productId: pricingProductId, quantity: 25 });
            assert.strictEqual(tier1.unitPrice, 165.0);
            assert.strictEqual(tier1.subtotal, 4125.0);

            const tier2 = await resolvePrice({ productId: pricingProductId, quantity: 60 });
            assert.strictEqual(tier2.unitPrice, 150.0);

            const tier3 = await resolvePrice({ productId: pricingProductId, quantity: 120 });
            assert.strictEqual(tier3.unitPrice, 135.0);
        });

        // -------------------------------------------------------------
        // TEST 4: Scheduled Promotions & Promo Codes
        // -------------------------------------------------------------
        await runTest('4.1: Scheduled Category Promotion applied (LOGISTICS10 on packaging)', async () => {
            const result = await resolvePrice({ productId: pricingProductId, quantity: 10, promoCode });
            assert.strictEqual(result.unitPrice, 162.0);
            assert.ok(result.appliedRules.some(r => r.type === 'PROMOTION' && r.promoCode === promoCode));
        });

        await runTest('4.2: Zero-Rated Kenyan foodstuff VAT calculation (Spring Water / Rice)', async () => {
            const water = await resolvePrice({ productId: waterProductId, quantity: 2 });
            assert.strictEqual(water.taxCategory, 'ZERO_RATED_0');
            assert.strictEqual(water.taxRate, 0.0);
            assert.strictEqual(water.taxAmount, 0.0);
            assert.strictEqual(water.netAmount, water.subtotal);
        });

        // -------------------------------------------------------------
        // TEST 5: HTTP Dynamic Price Resolver Endpoint
        // -------------------------------------------------------------
        await runTest('5.1: POST /api/v1/products/resolve-price computes price via API', async () => {
            const res = await makeRequest('/api/v1/products/resolve-price', {
                method: 'POST',
                body: {
                    productId: pricingProductId,
                    quantity: 25,
                    branchId: branches[0].id
                }
            });

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.unitPrice, 165.0);
            assert.strictEqual(res.body.subtotal, 4125.0);
            assert.ok(res.body.taxAmount > 0);
        });

        // -------------------------------------------------------------
        // TEST 6: Promotions CRUD Route
        // -------------------------------------------------------------
        await runTest('6.1: GET /api/v1/promotions returns active seeded promotions', async () => {
            const res = await makeRequest('/api/v1/promotions?active_only=true');
            assert.strictEqual(res.status, 200);
            const promos = Array.isArray(res.body.data) ? res.body.data : res.body;
            assert.ok(fixturePromoCodes.every(code => promos.some(p => p.promo_code === code)));
        });

        console.log('\n============================================================');
        console.log(`TOTAL TESTS: ${totalTests}`);
        console.log(`PASSED:      ${passedTests}`);
        console.log(`FAILED:      ${totalTests - passedTests}`);
        console.log('============================================================');

        if (passedTests === totalTests) {
            console.log('\n[SUCCESS] ALL DYNAMIC PRICING ENGINE TESTS PASSED!\n');
            process.exit(0);
        } else {
            console.error('\n[FAIL] PRICING ENGINE TESTS FAILED!\n');
            process.exit(1);
        }

    } finally {
        for (const code of fixturePromoCodes) {
            await dbAdapter.run('DELETE FROM promotions WHERE promo_code = ?', [code]);
        }
        for (const productId of fixtureProductIds) {
            await dbAdapter.run('DELETE FROM product_bulk_pricing WHERE product_id = ?', [productId]);
            await dbAdapter.run('DELETE FROM branch_product_prices WHERE product_id = ?', [productId]);
            await dbAdapter.run('DELETE FROM products WHERE id = ?', [productId]);
        }
        server.close();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
})();
