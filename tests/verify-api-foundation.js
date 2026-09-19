// tests/verify-api-foundation.js
// Enterprise Automated Test Suite for Phase 1: 1.4 API Foundation
const assert = require('node:assert');
const http = require('node:http');
const app = require('../server/server.js');
const v1Router = require('../server/routes/v1/index.js');
const { validateField, validateRequest } = require('../server/middleware/validation.js');
const { parsePagination, buildPaginationMeta, parseSorting, parseFilters } = require('../server/middleware/query.js');
const { idempotencyStore, computeFingerprint } = require('../server/middleware/idempotency.js');

console.log('\n============================================================');
console.log('SWIFTTRACK KENYA: VERIFICATION SUITE — 1.4 API FOUNDATION');
console.log('============================================================\n');

let server;
let baseUrl = '';
let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err.stack);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`✓ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`✗ [FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
        console.error(err.stack);
    }
}

/**
 * HTTP request helper using native Node.js http module
 */
function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
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

(async () => {
    // Start temporary test HTTP server on random available port
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    try {
        // -----------------------------------------------------------------------------
        // 1. API Versioning & Route Aliasing (/api/v1 and /api)
        // -----------------------------------------------------------------------------
        await runAsyncTest('1.1: GET /api/v1/health returns online status and apiVersion', async () => {
            const res = await makeRequest('/api/v1/health');
            assert.strictEqual(res.status, 200);
            assert(res.body.success === true || res.body.status === 'online');
            const data = res.body.data || res.body;
            assert.strictEqual(data.status, 'online');
            assert.strictEqual(data.apiVersion, 'v1.4.0');
        });

        await runAsyncTest('1.2: GET /api/health backward-compatible alias returns identical health response', async () => {
            const res = await makeRequest('/api/health');
            assert.strictEqual(res.status, 200);
            const data = res.body.data || res.body;
            assert.strictEqual(data.status, 'online');
            assert.strictEqual(data.apiVersion, 'v1.4.0');
        });

        // -----------------------------------------------------------------------------
        // 2. Request IDs & Correlation Telemetry (X-Request-ID)
        // -----------------------------------------------------------------------------
        await runAsyncTest('2.1: Automatically generates and returns X-Request-ID header', async () => {
            const res = await makeRequest('/api/v1/health');
            assert(res.headers['x-request-id'], 'Response must contain X-Request-ID header');
            assert(res.headers['x-request-id'].startsWith('req_'), 'Generated ID must start with req_');
        });

        await runAsyncTest('2.2: Preserves and echoes client-supplied X-Request-ID', async () => {
            const customId = 'client-trace-id-998822';
            const res = await makeRequest('/api/v1/health', {
                headers: { 'X-Request-ID': customId }
            });
            assert.strictEqual(res.headers['x-request-id'], customId, 'Must echo incoming X-Request-ID');
        });

        // -----------------------------------------------------------------------------
        // 3. Response Schemas & Consistent Error Format
        // -----------------------------------------------------------------------------
        await runAsyncTest('3.1: 404 Route returns consistent error envelope with requestId', async () => {
            const res = await makeRequest('/api/v1/non-existent-route-xyz');
            assert.strictEqual(res.status, 404);
            // Must have structured error format
            assert.strictEqual(res.body.success, false);
            assert(res.body.error, 'Response must contain error object');
            assert.strictEqual(res.body.error.code, 'NOT_FOUND');
            assert(res.body.error.requestId, 'Error must contain requestId');
            assert(res.body.error.timestamp, 'Error must contain ISO timestamp');
            // Backwards compatibility top-level fields
            assert.strictEqual(res.body.code, 'NOT_FOUND');
        });

        // -----------------------------------------------------------------------------
        // 4. Request Validation Engine
        // -----------------------------------------------------------------------------
        runTest('4.1: validateField accurately validates primitives, numbers, integers, and booleans', () => {
            // String check
            assert.strictEqual(validateField(' Nairobi ', { type: 'string', trim: true }).sanitizedValue, 'Nairobi');
            assert.strictEqual(validateField('abc', { type: 'string', minLength: 5 }).valid, false);

            // Number check
            assert.strictEqual(validateField('42.50', { type: 'number', min: 10 }).sanitizedValue, 42.5);
            assert.strictEqual(validateField('-5', { type: 'number', min: 0 }).valid, false);

            // Integer check
            assert.strictEqual(validateField('10', { type: 'integer' }).sanitizedValue, 10);
            assert.strictEqual(validateField('10.5', { type: 'integer' }).valid, false);

            // Boolean check
            assert.strictEqual(validateField('true', { type: 'boolean' }).sanitizedValue, true);
            assert.strictEqual(validateField(0, { type: 'boolean' }).sanitizedValue, false);
        });

        runTest('4.2: validateField enforces Kenyan phone numbers (phoneKE) and emails', () => {
            assert.strictEqual(validateField('+254 711 000 001', { type: 'phoneKE' }).valid, true);
            assert.strictEqual(validateField('0711000001', { type: 'phoneKE' }).valid, true);
            assert.strictEqual(validateField('0111000001', { type: 'phoneKE' }).valid, true);
            assert.strictEqual(validateField('123456', { type: 'phoneKE' }).valid, false);
            assert.strictEqual(validateField('+15551234567', { type: 'phoneKE' }).valid, false);

            assert.strictEqual(validateField('info@swifttrack.co.ke', { type: 'email' }).valid, true);
            assert.strictEqual(validateField('not-an-email', { type: 'email' }).valid, false);
        });

        await runAsyncTest('4.3: validateRequest middleware rejects invalid body with 400 and detailed errors', async () => {
            // Test route with validation on v1Router
            v1Router.post('/test-validation-endpoint', validateRequest({
                body: {
                    amount: { type: 'number', required: true, min: 10 },
                    email: { type: 'email', required: true },
                    phone: { type: 'phoneKE', required: true }
                }
            }), (req, res) => {
                res.apiSuccess({ ok: true, data: req.body });
            });

            // Post invalid data
            const res = await makeRequest('/api/v1/test-validation-endpoint', {
                method: 'POST',
                body: {
                    amount: -5,
                    email: 'invalid-email',
                    phone: '00000'
                }
            });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
            assert(Array.isArray(res.body.error.details), 'details must be an array');
            assert.strictEqual(res.body.error.details.length, 3, 'Must report all 3 invalid fields');
        });

        // -----------------------------------------------------------------------------
        // 5. Pagination, Filtering & Sorting Middleware
        // -----------------------------------------------------------------------------
        runTest('5.1: parsePagination handles page, limit defaults and caps', () => {
            const p1 = parsePagination({ page: '2', limit: '15' });
            assert.strictEqual(p1.page, 2);
            assert.strictEqual(p1.limit, 15);
            assert.strictEqual(p1.offset, 15);

            // Cap at 100 max
            const p2 = parsePagination({ page: '1', limit: '500' }, 20, 100);
            assert.strictEqual(p2.limit, 100);

            // Safe defaults
            const p3 = parsePagination({});
            assert.strictEqual(p3.page, 1);
            assert.strictEqual(p3.limit, 20);
            assert.strictEqual(p3.offset, 0);
        });

        runTest('5.2: buildPaginationMeta calculates pages, hasNextPage, hasPrevPage', () => {
            const meta = buildPaginationMeta(145, 2, 20);
            assert.strictEqual(meta.page, 2);
            assert.strictEqual(meta.limit, 20);
            assert.strictEqual(meta.totalRecords, 145);
            assert.strictEqual(meta.totalPages, 8);
            assert.strictEqual(meta.hasNextPage, true);
            assert.strictEqual(meta.hasPrevPage, true);
        });

        runTest('5.3: parseSorting prevents SQL injection and enforces whitelist', () => {
            const allowed = ['id', 'selling_price', 'created_at', 'name'];

            // Valid sorting
            const s1 = parseSorting({ sort: 'selling_price:desc' }, allowed);
            assert.strictEqual(s1.sortBy, 'selling_price');
            assert.strictEqual(s1.sortOrder, 'DESC');
            assert.strictEqual(s1.orderClause, 'selling_price DESC');

            // SQL Injection attempt (must fallback to default 'id')
            const s2 = parseSorting({ sort: 'name; DROP TABLE users;--' }, allowed);
            assert.strictEqual(s2.sortBy, 'id');
            assert.strictEqual(s2.sortOrder, 'DESC');
        });

        runTest('5.4: parseFilters builds safe parameterized WHERE clauses', () => {
            const query = {
                search: 'milk',
                status: 'COMPLETED',
                date_from: '2026-09-01',
                date_to: '2026-09-18'
            };

            const filters = parseFilters(query, {
                searchFields: ['name', 'sku'],
                exactFields: ['status'],
                dateColumn: 'created_at'
            });

            assert(filters.whereSql.includes('(name LIKE ? OR sku LIKE ?)'));
            assert(filters.whereSql.includes('status = ?'));
            assert(filters.whereSql.includes('created_at >= ?'));
            assert(filters.whereSql.includes('created_at <= ?'));
            assert.strictEqual(filters.params.length, 5);
        });

        // -----------------------------------------------------------------------------
        // 6. Tiered Rate Limiting
        // -----------------------------------------------------------------------------
        await runAsyncTest('6.1: Rate limiter returns RFC-compliant headers (Limit, Remaining, Reset)', async () => {
            const { createTieredRateLimiter } = require('../server/middleware/rateLimiter.js');

            v1Router.get('/test-rate-limit', createTieredRateLimiter({
                windowMs: 60 * 1000,
                max: 5,
                tierName: 'test-tier'
            }), (req, res) => res.json({ ok: true }));

            const res = await makeRequest('/api/v1/test-rate-limit');
            assert.strictEqual(res.status, 200);
            assert(res.headers['ratelimit-limit'], 'Must set RateLimit-Limit header');
            assert(res.headers['ratelimit-remaining'], 'Must set RateLimit-Remaining header');
            assert(res.headers['ratelimit-reset'], 'Must set RateLimit-Reset header');
        });

        await runAsyncTest('6.2: Exceeding rate limit returns HTTP 429 and Retry-After header', async () => {
            const { createTieredRateLimiter } = require('../server/middleware/rateLimiter.js');

            v1Router.get('/test-throttle', createTieredRateLimiter({
                windowMs: 60 * 1000,
                max: 2,
                tierName: 'tight-tier'
            }), (req, res) => res.json({ ok: true }));

            // First 2 requests succeed
            await makeRequest('/api/v1/test-throttle');
            await makeRequest('/api/v1/test-throttle');

            // 3rd request must be throttled
            const res3 = await makeRequest('/api/v1/test-throttle');
            assert.strictEqual(res3.status, 429);
            assert(res3.headers['retry-after'], 'Must provide Retry-After header');
            assert.strictEqual(res3.body.code, 'RATE_LIMIT_EXCEEDED');
        });

        // -----------------------------------------------------------------------------
        // 7. Idempotency Key Middleware
        // -----------------------------------------------------------------------------
        await runAsyncTest('7.1: Replaying request with same Idempotency-Key returns cached response with Idempotent-Replay: true', async () => {
            let executionCount = 0;

            v1Router.post('/test-idempotency', (req, res) => {
                executionCount++;
                res.json({
                    saleId: 9988,
                    amount: req.body.amount,
                    executionCount
                });
            });

            const key = 'test-idemp-key-unique-001';
            const payload = { amount: 450, customer: 'Alice' };

            // 1st request
            const res1 = await makeRequest('/api/v1/test-idempotency', {
                method: 'POST',
                headers: { 'Idempotency-Key': key },
                body: payload
            });

            assert.strictEqual(res1.status, 200);
            assert.strictEqual(res1.body.executionCount, 1);
            assert.strictEqual(res1.headers['x-idempotency-key'], key);

            // 2nd request with same key and body (Idempotent replay)
            const res2 = await makeRequest('/api/v1/test-idempotency', {
                method: 'POST',
                headers: { 'Idempotency-Key': key },
                body: payload
            });

            assert.strictEqual(res2.status, 200);
            assert.strictEqual(res2.headers['idempotent-replay'], 'true');
            assert.strictEqual(res2.body.executionCount, 1, 'Handler must not execute second time!');
            assert.strictEqual(executionCount, 1);
        });

        await runAsyncTest('7.2: Reusing Idempotency-Key with different payload triggers 422 Unprocessable Entity', async () => {
            const key = 'test-idemp-key-tamper-check';

            // First request with payload A
            await makeRequest('/api/v1/test-idempotency', {
                method: 'POST',
                headers: { 'Idempotency-Key': key },
                body: { amount: 100 }
            });

            // Second request with altered payload B using same key
            const resTampered = await makeRequest('/api/v1/test-idempotency', {
                method: 'POST',
                headers: { 'Idempotency-Key': key },
                body: { amount: 500 } // modified amount!
            });

            assert.strictEqual(resTampered.status, 422);
            assert.strictEqual(resTampered.body.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
        });

        // -----------------------------------------------------------------------------
        // 8. OpenAPI 3.1 Specification & Interactive Documentation UI
        // -----------------------------------------------------------------------------
        await runAsyncTest('8.1: GET /api/v1/openapi.json serves valid OpenAPI 3.1 schema', async () => {
            const res = await makeRequest('/api/v1/openapi.json');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.openapi, '3.1.0');
            assert(res.body.info, 'OpenAPI must contain info object');
            assert(res.body.paths['/auth/login'], 'Must document /auth/login');
            assert(res.body.paths['/pos/checkout'], 'Must document /pos/checkout');
            assert(res.body.paths['/inventory'], 'Must document /inventory');
            assert(res.body.components.securitySchemes.BearerAuth, 'Must define BearerAuth scheme');
            assert(res.body.components.securitySchemes.IdempotencyKey, 'Must define IdempotencyKey scheme');
        });

        await runAsyncTest('8.2: GET /api/v1/docs serves interactive Dieter Rams obsidian dark-mode explorer', async () => {
            const res = await makeRequest('/api/v1/docs');
            assert.strictEqual(res.status, 200);
            assert(res.headers['content-type'].includes('text/html'));
            assert(res.raw.includes('SwiftTrack Kenya API'), 'Must include title in rendered HTML');
            assert(res.raw.includes('OpenAPI 3.1.0'), 'Must display OpenAPI 3.1.0 badge');
            assert(res.raw.includes('/api/v1/openapi.json'), 'Must link to raw openapi.json');
        });

    } finally {
        server.close();
    }

    console.log('\n============================================================');
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`PASSED:      ${passedTests}`);
    console.log(`FAILED:      ${totalTests - passedTests}`);
    console.log('============================================================\n');

    if (passedTests === totalTests) {
        console.log('🎉 ALL 1.4 API FOUNDATION TESTS PASSED WITH 100% SUCCESS!\n');
        process.exit(0);
    } else {
        console.error('💥 SOME TESTS FAILED!\n');
        process.exit(1);
    }
})();
