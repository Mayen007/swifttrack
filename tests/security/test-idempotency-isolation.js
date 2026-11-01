// tests/security/test-idempotency-isolation.js
// Regression suite for principal-bound idempotency:
//   - keys are scoped to the authenticated user
//   - anonymous/unauthenticated requests are never cached
//   - auth failures and non-2xx responses are never replayed
//   - payload/query changes are detected
//   - concurrent duplicates are rejected with 409 instead of double-executing
const assert = require('node:assert');
const express = require('express');
const {
    createIdempotencyMiddleware
} = require('../../server/middleware/idempotency.js');

console.log('\n============================================================');
console.log('  SWIFTTRACK SECURITY SUITE: IDEMPOTENCY PRINCIPAL ISOLATION');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(`  Error: ${err.message}`);
    }
}

/**
 * Minimal in-memory stand-in for IdempotencyRepository with the same contract.
 * `claim` is synchronous-by-await but atomic for this single-process test.
 */
function createMemoryRepository() {
    const rows = new Map();
    const id = (userId, key) => `${userId}:${key}`;
    const parseTs = (value) => {
        if (!value) return 0;
        if (value instanceof Date) return value.getTime();
        const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
        const parsed = Date.parse(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
    };
    const isExpired = (row) => row.expiresAt && parseTs(row.expiresAt) <= Date.now();

    return {
        rows,
        sqlTimestamp(offsetMs = 0) {
            return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace('T', ' ');
        },
        async find(userId, key) {
            const row = rows.get(id(userId, key));
            if (!row) return null;
            if (isExpired(row)) return null;
            return { ...row, completed: row.responseCode !== 0 };
        },
        async claim(record) {
            const existing = rows.get(id(record.userId, record.key));
            // A live row wins; an expired row is revived atomically, mirroring
            // the repository's ON CONFLICT ... WHERE expires_at <= now.
            if (existing && !isExpired(existing)) return false;
            rows.set(id(record.userId, record.key), {
                key: record.key,
                userId: record.userId,
                branchId: record.branchId ?? null,
                resourceType: record.resourceType,
                requestHash: record.requestHash,
                responseCode: 0,
                responseBody: {},
                expiresAt: record.expiresAt,
                createdAt: new Date()
            });
            return true;
        },
        async complete(record) {
            const existing = rows.get(id(record.userId, record.key));
            rows.set(id(record.userId, record.key), {
                ...existing,
                ...record,
                userId: record.userId,
                createdAt: existing ? existing.createdAt : new Date()
            });
        },
        async release(userId, key) {
            const row = rows.get(id(userId, key));
            if (row && row.responseCode === 0) {
                rows.delete(id(userId, key));
                return true;
            }
            return false;
        },
        async remove(userId, key) {
            return rows.delete(id(userId, key));
        },
        async takeover(record) {
            const row = rows.get(id(record.userId, record.key));
            if (!row || row.responseCode !== 0) return false;
            rows.set(id(record.userId, record.key), {
                ...row,
                requestHash: record.requestHash,
                resourceType: record.resourceType,
                expiresAt: record.expiresAt,
                createdAt: new Date()
            });
            return true;
        }
    };
}

const repository = createMemoryRepository();

// Simulates the real Bearer-token resolver without touching the database.
async function resolveUser(req) {
    if (req.headers['authorization'] !== 'Bearer valid-token') {
        throw new Error('Invalid token');
    }
    const actor = req.headers['x-test-actor'];
    if (!actor) throw new Error('No actor');
    return { id: actor, branchId: actor === 'alice' ? 10 : 20 };
}

const app = express();
app.use(express.json());
app.use(createIdempotencyMiddleware({
    repository,
    resolveUser,
    ttlMs: 60_000,
    inFlightTtlMs: 50
}));

let executions = 0;
let slowGate = null;

app.post('/api/v1/things', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    executions++;
    if (req.headers['x-test-fail'] === '1') {
        return res.status(422).json({ error: 'Validation failed' });
    }
    return res.status(201).json({
        createdBy: req.user.id,
        amount: req.body.amount,
        executions
    });
});

app.post('/api/v1/slow', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    executions++;
    await new Promise((resolve) => { slowGate = resolve; });
    return res.json({ createdBy: req.user.id, executions });
});

let server;
let baseUrl = '';

function makeRequest(path, options = {}) {
    const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
    return fetch(`${baseUrl}${path}`, {
        method: options.method || 'POST',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    }).then(async (res) => ({
        status: res.status,
        replay: res.headers.get('idempotent-replay'),
        key: res.headers.get('x-idempotency-key'),
        body: await res.json().catch(() => null)
    }));
}

function authActor(actor) {
    return { authorization: 'Bearer valid-token', 'x-test-actor': actor };
}

(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });

    try {
        await runTest('1. Unauthenticated requests are never keyed or cached', async () => {
            const first = await makeRequest('/api/v1/things', {
                headers: { 'idempotency-key': 'anon-key-0001' },
                body: { amount: 5 }
            });
            assert.strictEqual(first.status, 401);
            assert.strictEqual(repository.rows.size, 0, 'Anonymous request must not create a key record');

            const retry = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': 'anon-key-0001' },
                body: { amount: 5 }
            });
            assert.strictEqual(retry.status, 201);
            assert.strictEqual(retry.replay, null, 'First authenticated request must execute');
            assert.strictEqual(retry.body.createdBy, 'alice');
        });

        await runTest('2. Keys are isolated per authenticated user', async () => {
            const key = 'shared-key-0001';
            const alice = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 10 }
            });
            assert.strictEqual(alice.status, 201);
            assert.strictEqual(alice.body.createdBy, 'alice');

            const bob = await makeRequest('/api/v1/things', {
                headers: { ...authActor('bob'), 'idempotency-key': key },
                body: { amount: 10 }
            });
            assert.strictEqual(bob.status, 201, 'Bob must execute instead of replaying Alice\'s response');
            assert.strictEqual(bob.replay, null);
            assert.strictEqual(bob.body.createdBy, 'bob', 'Bob must never receive Alice\'s response body');
        });

        await runTest('3. Same principal gets a durable replay', async () => {
            const key = 'shared-key-0001';
            const before = executions;
            const replay = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 10 }
            });
            assert.strictEqual(replay.status, 201);
            assert.strictEqual(replay.replay, 'true');
            assert.strictEqual(replay.body.createdBy, 'alice');
            assert.strictEqual(executions, before, 'Replay must not execute the handler');
        });

        await runTest('4. Authentication failures are not cached', async () => {
            const key = 'bad-token-0001';
            const bad = await makeRequest('/api/v1/things', {
                headers: { authorization: 'Bearer invalid-token', 'x-test-actor': 'alice', 'idempotency-key': key },
                body: { amount: 12 }
            });
            assert.strictEqual(bad.status, 401);
            assert.strictEqual(repository.rows.size > 0 && Array.from(repository.rows.values()).some(r => r.key === key), false);

            const good = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 12 }
            });
            assert.strictEqual(good.status, 201, 'A corrected retry must be allowed to execute');
            assert.strictEqual(good.replay, null);
        });

        await runTest('5. Non-2xx handler responses are released, not replayed', async () => {
            const key = 'fail-key-0001';
            const failed = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key, 'x-test-fail': '1' },
                body: { amount: 7 }
            });
            assert.strictEqual(failed.status, 422);

            const retried = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 7 }
            });
            assert.strictEqual(retried.status, 201);
            assert.strictEqual(retried.replay, null, 'A 422 must not be replayed');
        });

        await runTest('6. Reusing a key with a different payload is rejected', async () => {
            const key = 'mismatch-key-01';
            const first = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 1 }
            });
            assert.strictEqual(first.status, 201);

            const tampered = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 2 }
            });
            assert.strictEqual(tampered.status, 422);
            assert.strictEqual(tampered.body.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
        });

        await runTest('7. Query string participates in the fingerprint', async () => {
            const key = 'query-key-0001';
            const first = await makeRequest('/api/v1/things?branch=1', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 3 }
            });
            assert.strictEqual(first.status, 201);

            const otherScope = await makeRequest('/api/v1/things?branch=2', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 3 }
            });
            assert.strictEqual(otherScope.status, 422);
            assert.strictEqual(otherScope.body.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
        });

        await runTest('8. Concurrent duplicates receive 409 instead of double-executing', async () => {
            const key = 'race-key-0001';
            const firstPromise = makeRequest('/api/v1/slow', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: {}
            });

            for (let i = 0; i < 100 && !slowGate; i++) {
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
            assert.ok(slowGate, 'First request should have started executing');

            const duplicate = await makeRequest('/api/v1/slow', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: {}
            });
            assert.strictEqual(duplicate.status, 409);
            assert.strictEqual(duplicate.body.code, 'IDEMPOTENCY_IN_PROGRESS');

            slowGate();
            const first = await firstPromise;
            assert.strictEqual(first.status, 200);
            assert.strictEqual(first.replay, null);
        });

        await runTest('9. Authentication endpoints bypass idempotency caching', async () => {
            const before = repository.rows.size;
            const res = await makeRequest('/api/v1/auth/login', {
                headers: { 'idempotency-key': 'login-key-0001' },
                body: { username: 'alice', password: 'x' }
            });
            // No such route is mounted here; the middleware must simply not claim the key.
            assert.strictEqual(repository.rows.size, before);
            assert.notStrictEqual(res.status, 201);
        });
        await runTest('10. Expired keys can be reused (expiry does not poison the key)', async () => {
            const key = 'expiring-key-01';
            const first = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 1 }
            });
            assert.strictEqual(first.status, 201);

            // Simulate the durable record reaching its expiry.
            const row = repository.rows.get(`alice:${key}`);
            assert.ok(row, 'Record should exist after the first request');
            row.expiresAt = repository.sqlTimestamp(-1000);

            const before = executions;
            const second = await makeRequest('/api/v1/things', {
                headers: { ...authActor('alice'), 'idempotency-key': key },
                body: { amount: 999 }
            });
            assert.strictEqual(second.status, 201, 'An expired key must be claimable again instead of returning 409');
            assert.strictEqual(second.replay, null);
            assert.strictEqual(second.body.amount, 999, 'The new request must execute with its own payload');
            assert.strictEqual(executions, before + 1);
        });
    } finally {
        console.log(`\n============================================================`);
        console.log(`  RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
        console.log(`============================================================\n`);
        server.close();
        process.exit(passedTests === totalTests ? 0 : 1);
    }
})();
