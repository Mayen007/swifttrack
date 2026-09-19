// tests/security/test-sql-injection.js
// Automated Penetration Suite: SQL Injection Immunity Verification
const assert = require('node:assert');
const http = require('node:http');
const app = require('../../server/server.js');
const { db } = require('../../server/db/database.js');

console.log('\n============================================================');
console.log('🛡️  SWIFTTRACK PENETRATION SUITE: SQL INJECTION IMMUNITY');
console.log('============================================================\n');

let server;
let baseUrl = '';
let passedTests = 0;
let totalTests = 0;

function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const reqOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
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
        // Record initial user count
        const initialUserCount = db.prepare('SELECT count(*) as c FROM users').get().c;
        const initialProductCount = db.prepare('SELECT count(*) as c FROM products').get().c;

        // TEST 1: Classic Tautology SQLi on Auth Login
        await runTest('1.1: Tautology bypass attempt on /api/v1/auth/login (\' OR \'1\'=\'1)', async () => {
            const res = await makeRequest('/api/v1/auth/login', {
                method: 'POST',
                body: { username: "admin' OR '1'='1", password: "' OR '1'='1" }
            });
            // Must be rejected with 401 Unauthorized or 400 Bad Request
            assert([400, 401].includes(res.status), `Expected 400/401 but received ${res.status}`);
            assert(!res.body.token, 'Security failure: Authentication bypassed via SQL injection!');
        });

        // TEST 2: Comment Dash Injection on Auth Login
        await runTest('1.2: Comment dash bypass attempt (superadmin\' --)', async () => {
            const res = await makeRequest('/api/v1/auth/login', {
                method: 'POST',
                body: { username: "superadmin' --", password: "arbitrary_password" }
            });
            assert([400, 401].includes(res.status), `Expected 400/401 but received ${res.status}`);
            assert(!res.body.token, 'Security failure: Authentication bypassed via comment dash!');
        });

        // TEST 3: Destructive Stacked Query Injection
        await runTest('1.3: Stacked drop table attempt (\'; DROP TABLE users; --)', async () => {
            const res = await makeRequest('/api/v1/auth/login', {
                method: 'POST',
                body: { username: "'; DROP TABLE users; --", password: "Password123!" }
            });
            assert([400, 401].includes(res.status));
            // Verify table still intact
            const postCount = db.prepare('SELECT count(*) as c FROM users').get().c;
            assert.strictEqual(postCount, initialUserCount, 'Security failure: Table was altered by stacked injection!');
        });

        // Obtain admin auth token for testing authenticated resources
        const loginRes = await makeRequest('/api/v1/auth/login', {
            method: 'POST',
            body: { username: 'superadmin', password: 'Password123!' }
        });
        const authToken = loginRes.body?.token || loginRes.body?.data?.token;
        const authHeaders = { 'Authorization': `Bearer ${authToken}` };

        // TEST 4: Union-based Extraction Injection on Search
        await runTest('2.1: Union-based data exfiltration attempt on /api/v1/products?search=', async () => {
            const payload = encodeURIComponent("' UNION SELECT 1, password_hash, username, 'leak', 999, 1, 'category', 1, 1, 1 FROM users --");
            const res = await makeRequest(`/api/v1/products?search=${payload}`, { headers: authHeaders });
            assert.strictEqual(res.status, 200);
            const data = Array.isArray(res.body.data) ? res.body.data : Array.isArray(res.body) ? res.body : [];
            const leaked = data.some(p => p.name?.includes('$scrypt$') || p.name?.includes('argon2') || p.sku === 'leak');
            assert(!leaked, 'Security failure: Data exfiltrated via UNION injection!');
        });

        // TEST 5: SQL Injection in Sort Parameters
        await runTest('2.2: Malicious SQL injection in sort parameter (?sort=)', async () => {
            const res = await makeRequest('/api/v1/products?sort=id; DROP TABLE products;--', { headers: authHeaders });
            // Query parser whitelist should catch or fallback safely
            assert([200, 400].includes(res.status));
            const postProductCount = db.prepare('SELECT count(*) as c FROM products').get().c;
            assert.strictEqual(postProductCount, initialProductCount, 'Security failure: Products table dropped via sort injection!');
        });

        // TEST 6: Parameterized Branch Filter Injection
        await runTest('3.1: Branch ID parameter SQLi (?city= OR 1=1)', async () => {
            const res = await makeRequest('/api/v1/branches?city=\' OR \'1\'=\'1', { headers: authHeaders });
            assert.strictEqual(res.status, 200);
            const list = Array.isArray(res.body.data) ? res.body.data : Array.isArray(res.body) ? res.body : [];
            // Parameterized query treats string as literal city name, which matches 0 rows
            assert.strictEqual(list.length, 0, 'Security failure: Tautology returned all branches!');
        });

        // TEST 7: Boolean Blind Injection in Order Search
        await runTest('3.2: Boolean-based blind injection on order lookup', async () => {
            const res = await makeRequest("/api/v1/orders?search=' AND (SELECT SUBSTR(password_hash,1,1) FROM users WHERE id=1)='a", { headers: authHeaders });
            assert.strictEqual(res.status, 200);
            // No 500 error, treated as literal string
        });

        console.log('\n============================================================');
        console.log(`TOTAL TESTS: ${totalTests}`);
        console.log(`PASSED:      ${passedTests}`);
        console.log(`FAILED:      ${totalTests - passedTests}`);
        console.log('============================================================');

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL SQL INJECTION IMMUNITY TESTS PASSED (100% SECURE)!\n');
        } else {
            console.error('\n❌ SQL INJECTION VULNERABILITIES DETECTED!\n');
            process.exit(1);
        }

    } finally {
        server.close();
    }
})();
