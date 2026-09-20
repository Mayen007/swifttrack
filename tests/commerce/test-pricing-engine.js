// tests/commerce/test-pricing-engine.js
// Automated Integration Suite: Multi-Tier Dynamic Pricing Engine & Promotions
const assert = require('node:assert');
const http = require('node:http');
const app = require('../../server/server.js');
const { resolvePrice } = require('../../server/services/pricingService.js');

console.log('\n============================================================');
console.log('💰  SWIFTTRACK COMMERCE: DYNAMIC PRICING ENGINE SUITE');
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

    try {
        // Authenticate
        const loginRes = await makeRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { username: 'superadmin', password: 'Password123!' }
        });
        authToken = loginRes.body?.token || loginRes.body?.data?.token;
        assert.ok(authToken);

        // -------------------------------------------------------------
        // TEST 1: Baseline Retail & Wholesale Resolution
        // -------------------------------------------------------------
        await runTest('1.1: Standard retail unit price calculation (Corrugated Box)', () => {
            // Product 1: Heavy Duty Box (Retail: 180.0, Wholesale: 150.0)
            const result = resolvePrice({ productId: 1, quantity: 1 });
            assert.strictEqual(result.unitPrice, 180.0);
            assert.strictEqual(result.subtotal, 180.0);
            assert.strictEqual(result.taxCategory, 'STANDARD_16');
            // KRA VAT calculation (inclusive): 180 * (16 / 116) = 24.83
            assert.strictEqual(result.taxAmount, 24.83);
            assert.strictEqual(result.netAmount, 155.17);
        });

        await runTest('1.2: Base wholesale pricing request', () => {
            const result = resolvePrice({ productId: 1, quantity: 5, isWholesale: true });
            assert.strictEqual(result.unitPrice, 150.0);
            assert.strictEqual(result.subtotal, 750.0);
        });

        // -------------------------------------------------------------
        // TEST 2: Branch Price Overrides
        // -------------------------------------------------------------
        await runTest('2.1: Mombasa Branch price override applied (Product 6 Cement)', () => {
            // Product 6: Bamburi Cement (Base: 850.0, Mombasa Branch 2 Override: 820.0)
            const nairobiPrice = resolvePrice({ productId: 6, branchId: 1, quantity: 1 });
            assert.strictEqual(nairobiPrice.unitPrice, 850.0);

            const mombasaPrice = resolvePrice({ productId: 6, branchId: 2, quantity: 1 });
            assert.strictEqual(mombasaPrice.unitPrice, 820.0);
            assert.ok(mombasaPrice.appliedRules.some(r => r.type === 'BRANCH_OVERRIDE'));
        });

        // -------------------------------------------------------------
        // TEST 3: Bulk Quantity Break Tiers
        // -------------------------------------------------------------
        await runTest('3.1: Bulk quantity breaks resolve accurately across quantity thresholds', () => {
            // Product 1 Bulk Tiers:
            // 1-19: 180.0
            // 20-49: 165.0
            // 50-99: 150.0
            // 100+: 135.0
            const single = resolvePrice({ productId: 1, quantity: 5 });
            assert.strictEqual(single.unitPrice, 180.0);

            const tier1 = resolvePrice({ productId: 1, quantity: 25 });
            assert.strictEqual(tier1.unitPrice, 165.0);
            assert.strictEqual(tier1.subtotal, 4125.0);

            const tier2 = resolvePrice({ productId: 1, quantity: 60 });
            assert.strictEqual(tier2.unitPrice, 150.0);

            const tier3 = resolvePrice({ productId: 1, quantity: 120 });
            assert.strictEqual(tier3.unitPrice, 135.0);
        });

        // -------------------------------------------------------------
        // TEST 4: Scheduled Promotions & Promo Codes
        // -------------------------------------------------------------
        await runTest('4.1: Scheduled Category Promotion applied (LOGISTICS10 on packaging)', () => {
            // Promo LOGISTICS10: 10% off packaging category (min spend 1000 KES)
            // Product 1: 10 boxes @ 180 = 1800 KES (above min spend 1000)
            // Unit price after 10% off 180 = 162.0 (or bulk tier discount, best rule)
            const result = resolvePrice({ productId: 1, quantity: 10, promoCode: 'LOGISTICS10' });
            assert.strictEqual(result.unitPrice, 162.0);
            assert.ok(result.appliedRules.some(r => r.type === 'PROMOTION' && r.promoCode === 'LOGISTICS10'));
        });

        await runTest('4.2: Zero-Rated Kenyan foodstuff VAT calculation (Spring Water / Rice)', () => {
            // Product 16: Kilima Spring Water (tax_category: ZERO_RATED_0)
            const water = resolvePrice({ productId: 16, quantity: 2 });
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
                    productId: 1,
                    quantity: 25,
                    branchId: 1
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
            assert.ok(promos.length >= 2);
            assert.ok(promos.some(p => p.promo_code === 'LOGISTICS10'));
        });

        console.log('\n============================================================');
        console.log(`TOTAL TESTS: ${totalTests}`);
        console.log(`PASSED:      ${passedTests}`);
        console.log(`FAILED:      ${totalTests - passedTests}`);
        console.log('============================================================');

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL DYNAMIC PRICING ENGINE TESTS PASSED!\n');
        } else {
            console.error('\n❌ PRICING ENGINE TESTS FAILED!\n');
            process.exit(1);
        }

    } finally {
        server.close();
    }
})();
