// tests/verify-db-postgres.js
// Automated verification suite for Phase 1: 1.3 Database (PostgreSQL Production Architecture & Migration System)
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

console.log('\n============================================================');
console.log('SWIFTTRACK KENYA: VERIFICATION SUITE — 1.3 DATABASE (POSTGRESQL)');
console.log('============================================================\n');

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

// -----------------------------------------------------------------------------
// 1. PostgreSQL Schema & DDL Verification
// -----------------------------------------------------------------------------
runTest('1.1: Schema file exists and contains all 36 required tables', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    assert(fs.existsSync(schemaPath), 'schema.sql must exist');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const expectedTables = [
        'company_settings', 'branches', 'warehouses', 'roles', 'permissions',
        'role_permissions', 'users', 'categories', 'products', 'inventory',
        'inventory_movements', 'stock_adjustments', 'stock_transfers',
        'stock_transfer_items', 'customers', 'orders', 'order_items', 'sales',
        'sale_items', 'held_sales', 'payments', 'refund_requests', 'refunds',
        'expenses', 'vehicles', 'drivers', 'deliveries', 'delivery_items',
        'delivery_status_history', 'proof_of_delivery', 'notifications',
        'audit_logs', 'user_sessions', 'revoked_tokens', 'password_reset_tokens',
        'login_history', 'schema_migrations'
    ];

    for (const tbl of expectedTables) {
        assert(sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`) || sql.includes(`CREATE TABLE ${tbl}`),
            `Table '${tbl}' must be defined in schema.sql`);
    }
});

runTest('1.2: Monetary fields use NUMERIC(12, 2) instead of floating-point REAL', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Key financial tables must use NUMERIC(12, 2)
    assert(sql.includes('cost_price NUMERIC(12, 2)'), 'products.cost_price must be NUMERIC(12, 2)');
    assert(sql.includes('selling_price NUMERIC(12, 2)'), 'products.selling_price must be NUMERIC(12, 2)');
    assert(sql.includes('subtotal NUMERIC(12, 2)'), 'sales/orders subtotal must be NUMERIC(12, 2)');
    assert(sql.includes('total_amount NUMERIC(12, 2)'), 'sales/orders total_amount must be NUMERIC(12, 2)');
    assert(sql.includes('tax_amount NUMERIC(12, 2)'), 'tax_amount must be NUMERIC(12, 2)');
    assert(!sql.includes('cost_price REAL'), 'REAL floating point must not be used for cost_price');
    assert(!sql.includes('selling_price REAL'), 'REAL floating point must not be used for selling_price');
});

runTest('1.3: Timestamps use TIMESTAMPTZ with DEFAULT CURRENT_TIMESTAMP', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    assert(sql.includes('TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP'), 'Should use TIMESTAMPTZ');
    assert(!sql.includes('DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'), 'SQLite DATETIME should not be present in PostgreSQL schema');
});

runTest('1.4: JSON payloads use JSONB with GIN indexing', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    assert(sql.includes('cart_data_json JSONB'), 'held_sales.cart_data_json must be JSONB');
    assert(sql.includes('previous_value JSONB'), 'audit_logs.previous_value must be JSONB');
    assert(sql.includes('new_value JSONB'), 'audit_logs.new_value must be JSONB');
    assert(sql.includes('GIN (new_value)'), 'audit_logs GIN index must exist');
    assert(sql.includes('GIN (cart_data_json)'), 'held_sales GIN index must exist');
});

runTest('1.5: Audit log immutability triggers and functions are defined', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    assert(sql.includes('CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()'), 'Immutability function must be defined');
    assert(sql.includes('BEFORE UPDATE ON audit_logs'), 'BEFORE UPDATE trigger must exist');
    assert(sql.includes('BEFORE DELETE ON audit_logs'), 'BEFORE DELETE trigger must exist');
    assert(sql.includes('RAISE EXCEPTION'), 'Must raise exception on attempted update or delete');
});

runTest('1.6: Soft deletion columns exist on all master/catalog entities', () => {
    const schemaPath = path.resolve(__dirname, '../server/db/postgres/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const masterTables = ['users', 'branches', 'warehouses', 'categories', 'products', 'customers', 'vehicles'];

    for (const tbl of masterTables) {
        const tableMatch = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tbl}\\s*\\(([\\s\\S]*?)\\);`));
        assert(tableMatch, `Table definition for ${tbl} found`);
        const tableDef = tableMatch[1];
        assert(tableDef.includes('deleted_at TIMESTAMPTZ'), `${tbl} must have deleted_at TIMESTAMPTZ column`);
        assert(tableDef.includes('deleted_by_user_id INTEGER'), `${tbl} must have deleted_by_user_id INTEGER column`);
    }
});

// -----------------------------------------------------------------------------
// 2. Migration Engine Verification
// -----------------------------------------------------------------------------
runTest('2.1: Migrations directory contains sequential, valid migration scripts', () => {
    const { getAvailableMigrations, calculateChecksum } = require('../server/db/postgres/migrator.js');
    const migrations = getAvailableMigrations();

    assert(migrations.length >= 3, `Expected at least 3 migrations, found ${migrations.length}`);
    assert.strictEqual(migrations[0].version, '001');
    assert.strictEqual(migrations[1].version, '002');
    assert.strictEqual(migrations[2].version, '003');

    for (const m of migrations) {
        assert(m.checksum, `Migration ${m.name} must have a valid checksum`);
        assert.strictEqual(m.checksum.length, 64, 'SHA256 checksum must be 64 characters');
        const computed = calculateChecksum(m.content);
        assert.strictEqual(computed, m.checksum, `Checksum for ${m.name} must match content`);
    }
});

// -----------------------------------------------------------------------------
// 3. Pool Configuration & Factory Verification
// -----------------------------------------------------------------------------
runTest('3.1: buildPoolConfig correctly reads environment overrides', () => {
    const { buildPoolConfig } = require('../server/db/postgres/pool.js');

    // Test defaults
    const config = buildPoolConfig();
    assert.strictEqual(config.max, 20);
    assert.strictEqual(config.min, 2);
    assert.strictEqual(config.idleTimeoutMillis, 30000);
    assert.strictEqual(config.connectionTimeoutMillis, 5000);

    // Test DATABASE_URL with SSL
    process.env.DATABASE_URL = 'postgres://user:pass@ep-cool-db.us-east-2.aws.neon.tech/swifttrack?sslmode=require';
    const sslConfig = buildPoolConfig();
    assert.strictEqual(sslConfig.connectionString, process.env.DATABASE_URL);
    assert(sslConfig.ssl, 'SSL must be enabled for cloud PostgreSQL connection strings');
    assert.strictEqual(sslConfig.ssl.rejectUnauthorized, false);

    delete process.env.DATABASE_URL;
});

// -----------------------------------------------------------------------------
// 4. Transaction Boundaries & Savepoint Coordinator Verification
// -----------------------------------------------------------------------------
runAsyncTest('4.1: withTransaction correctly issues BEGIN, COMMIT and releases client', async () => {
    const { withTransaction } = require('../server/db/postgres/transactions.js');

    const executedQueries = [];
    let released = false;

    const mockClient = {
        query: async (text) => {
            executedQueries.push(text);
            return { rowCount: 1 };
        },
        release: () => {
            released = true;
        }
    };

    const result = await withTransaction(async (client) => {
        await client.query("INSERT INTO test VALUES ('test')");
        return 'SUCCESS_RESULT';
    }, mockClient);

    assert.strictEqual(result, 'SUCCESS_RESULT');
    assert.strictEqual(executedQueries[0], 'BEGIN');
    assert.strictEqual(executedQueries[1], "INSERT INTO test VALUES ('test')");
    assert.strictEqual(executedQueries[2], 'COMMIT');
});

runAsyncTest('4.2: withTransaction issues ROLLBACK on error and rethrows original exception', async () => {
    const { withTransaction } = require('../server/db/postgres/transactions.js');

    const executedQueries = [];

    const mockClient = {
        query: async (text) => {
            executedQueries.push(text);
            return { rowCount: 1 };
        }
    };

    let caughtError = null;
    try {
        await withTransaction(async (client) => {
            await client.query("INSERT INTO test VALUES ('fail')");
            throw new Error('Simulated transaction failure');
        }, mockClient);
    } catch (err) {
        caughtError = err;
    }

    assert(caughtError, 'Error must be thrown');
    assert.strictEqual(caughtError.message, 'Simulated transaction failure');
    assert.strictEqual(executedQueries[0], 'BEGIN');
    assert.strictEqual(executedQueries[1], "INSERT INTO test VALUES ('fail')");
    assert.strictEqual(executedQueries[2], 'ROLLBACK');
});

runAsyncTest('4.3: withSavepoint correctly manages savepoint name, release, and rollback', async () => {
    const { withSavepoint } = require('../server/db/postgres/transactions.js');

    const executedQueries = [];
    const mockClient = {
        query: async (text) => {
            executedQueries.push(text);
            return { rowCount: 1 };
        }
    };

    // Success flow
    await withSavepoint(mockClient, 'sp_inventory_check', async (client) => {
        await client.query('UPDATE inventory SET quantity = 10');
    });

    assert.strictEqual(executedQueries[0], 'SAVEPOINT sp_inventory_check');
    assert.strictEqual(executedQueries[1], 'UPDATE inventory SET quantity = 10');
    assert.strictEqual(executedQueries[2], 'RELEASE SAVEPOINT sp_inventory_check');

    // Failure flow
    executedQueries.length = 0;
    try {
        await withSavepoint(mockClient, 'sp_bad_transfer', async (client) => {
            throw new Error('Insufficient stock');
        });
    } catch (err) {
        assert.strictEqual(err.message, 'Insufficient stock');
    }

    assert.strictEqual(executedQueries[0], 'SAVEPOINT sp_bad_transfer');
    assert.strictEqual(executedQueries[1], 'ROLLBACK TO SAVEPOINT sp_bad_transfer');
});

// -----------------------------------------------------------------------------
// 5. Data Retention Engine Verification
// -----------------------------------------------------------------------------
runAsyncTest('5.1: runDataRetention executes pruning queries on transient tables while protecting audit_logs', async () => {
    const { runDataRetention } = require('../server/db/postgres/retention.js');

    const executedQueries = [];
    const mockClient = {
        query: async (text) => {
            executedQueries.push(text);
            if (text.includes('SELECT COUNT(*) as total FROM audit_logs')) {
                return { rows: [{ total: '42' }] };
            }
            return { rowCount: 5 };
        }
    };

    const mockPool = {
        connect: async () => mockClient
    };

    const stats = await runDataRetention(mockPool);

    assert.strictEqual(stats.revokedTokensPruned, 5);
    assert.strictEqual(stats.passwordResetTokensPruned, 5);
    assert.strictEqual(stats.sessionsDeactivated, 5);
    assert.strictEqual(stats.sessionsPruned, 5);
    assert.strictEqual(stats.loginHistoryPruned, 5);
    assert.strictEqual(stats.notificationsPruned, 5);
    assert.strictEqual(stats.auditLogsTotalCount, 42);

    // Verify SQL statements
    const fullLog = executedQueries.join('\n');
    assert(fullLog.includes('DELETE FROM revoked_tokens'), 'Must prune revoked_tokens');
    assert(fullLog.includes('DELETE FROM password_reset_tokens'), 'Must prune password_reset_tokens');
    assert(fullLog.includes('UPDATE user_sessions'), 'Must deactivate expired sessions');
    assert(fullLog.includes('DELETE FROM user_sessions'), 'Must prune old user_sessions');
    assert(fullLog.includes('DELETE FROM login_history'), 'Must prune old login_history');
    assert(fullLog.includes('DELETE FROM notifications'), 'Must prune old notifications');
    assert(!fullLog.includes('DELETE FROM audit_logs'), 'audit_logs MUST NEVER BE DELETED!');
});

// -----------------------------------------------------------------------------
// 6. ETL Migration Pipeline & Type Transformer Verification
// -----------------------------------------------------------------------------
runTest('6.1: transformRow converts SQLite 0/1 to boolean and parses JSON strings', () => {
    const { transformRow } = require('../scripts/migrate-sqlite-to-postgres.js');

    const config = {
        boolCols: ['is_active', 'must_change_password'],
        jsonCols: ['cart_data_json']
    };

    const sqliteRow = {
        id: 1,
        username: 'cashier1',
        is_active: 1,
        must_change_password: 0,
        cart_data_json: JSON.stringify([{ sku: 'BEV-001', qty: 2, price: 65.00 }])
    };

    const transformed = transformRow(sqliteRow, config);

    assert.strictEqual(transformed.is_active, true, 'is_active 1 must become boolean true');
    assert.strictEqual(transformed.must_change_password, false, 'must_change_password 0 must become boolean false');
    assert(Array.isArray(transformed.cart_data_json), 'cart_data_json string must be parsed into JSON array');
    assert.strictEqual(transformed.cart_data_json[0].sku, 'BEV-001');
});

runTest('6.2: TABLE_PIPELINE defines topological dependency order without circularity', () => {
    const { TABLE_PIPELINE } = require('../scripts/migrate-sqlite-to-postgres.js');

    const names = TABLE_PIPELINE.map(t => t.name);

    // Verify parent tables come before dependent child tables
    const indexOf = (name) => {
        const idx = names.indexOf(name);
        assert(idx !== -1, `Table ${name} not found in pipeline`);
        return idx;
    };

    assert(indexOf('branches') < indexOf('warehouses'), 'branches before warehouses');
    assert(indexOf('branches') < indexOf('users'), 'branches before users');
    assert(indexOf('roles') < indexOf('users'), 'roles before users');
    assert(indexOf('roles') < indexOf('role_permissions'), 'roles before role_permissions');
    assert(indexOf('categories') < indexOf('products'), 'categories before products');
    assert(indexOf('warehouses') < indexOf('inventory'), 'warehouses before inventory');
    assert(indexOf('products') < indexOf('inventory'), 'products before inventory');
    assert(indexOf('customers') < indexOf('orders'), 'customers before orders');
    assert(indexOf('users') < indexOf('orders'), 'users before orders');
    assert(indexOf('orders') < indexOf('order_items'), 'orders before order_items');
    assert(indexOf('orders') < indexOf('sales'), 'orders before sales');
    assert(indexOf('sales') < indexOf('sale_items'), 'sales before sale_items');
    assert(indexOf('sales') < indexOf('payments'), 'sales before payments');
    assert(indexOf('sales') < indexOf('refund_requests'), 'sales before refund_requests');
    assert(indexOf('refund_requests') < indexOf('refunds'), 'refund_requests before refunds');
    assert(indexOf('vehicles') < indexOf('drivers'), 'vehicles before drivers');
    assert(indexOf('drivers') < indexOf('deliveries'), 'drivers before deliveries');
    assert(indexOf('deliveries') < indexOf('delivery_items'), 'deliveries before delivery_items');
    assert(indexOf('deliveries') < indexOf('proof_of_delivery'), 'deliveries before proof_of_delivery');
});

// -----------------------------------------------------------------------------
// 7. Database Facade Dual-Engine Routing
// -----------------------------------------------------------------------------
runTest('7.1: DB facade defaults to SQLite when DB_CLIENT is not postgres', () => {
    delete process.env.DB_CLIENT;
    delete process.env.DATABASE_URL;

    // Clear require cache for facade
    delete require.cache[require.resolve('../server/db/index.js')];
    const facade = require('../server/db/index.js');

    assert.strictEqual(facade.engine, 'sqlite');
    assert.strictEqual(facade.isSqlite, true);
    assert.strictEqual(facade.isPostgres, false);
    assert(facade.db, 'SQLite db instance must be exported');
    assert(typeof facade.initSchema === 'function');
});

runTest('7.2: DB facade routes to PostgreSQL when DB_CLIENT=postgres', () => {
    process.env.DB_CLIENT = 'postgres';

    delete require.cache[require.resolve('../server/db/index.js')];
    const facade = require('../server/db/index.js');

    assert.strictEqual(facade.engine, 'postgres');
    assert.strictEqual(facade.isPostgres, true);
    assert.strictEqual(facade.isSqlite, false);
    assert(typeof facade.getPool === 'function');
    assert(typeof facade.query === 'function');
    assert(typeof facade.withTransaction === 'function');
    assert(typeof facade.migrateUp === 'function');
    assert(typeof facade.runDataRetention === 'function');

    delete process.env.DB_CLIENT;
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
setTimeout(() => {
    console.log('\n============================================================');
    console.log(`TOTAL TESTS: ${totalTests}`);
    console.log(`PASSED:      ${passedTests}`);
    console.log(`FAILED:      ${totalTests - passedTests}`);
    console.log('============================================================\n');

    if (passedTests === totalTests) {
        console.log('🎉 ALL POSTGRESQL ARCHITECTURE & MIGRATION TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.error('💥 SOME TESTS FAILED!\n');
        process.exit(1);
    }
}, 100);
