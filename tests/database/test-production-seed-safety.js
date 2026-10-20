const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swifttrack-production-seed-'));
process.env.DATABASE_PATH = path.join(tempDir, 'production.sqlite');

const { db } = require('../../server/db/database.js');
const { initProductionBootstrap } = require('../../server/db/seed.js');

async function run() {
    try {
        initProductionBootstrap();

        for (const table of [
            'company_settings',
            'branches',
            'warehouses',
            'users',
            'customers',
            'suppliers',
            'brands',
            'categories',
            'products',
            'inventory',
            'vehicles',
            'drivers',
            'logistics_pricing_tariffs',
            'orders',
            'sales',
            'shipments',
            'parcels',
            'shipment_legs',
            'tracking_events',
            'scan_events',
            'deliveries',
            'notification_outbox',
            'expenses',
            'payments',
            'audit_logs'
        ]) {
            const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
            assert.equal(count, 0, `Production bootstrap must not seed ${table}`);
        }

        assert.equal(db.prepare('SELECT COUNT(*) AS count FROM roles').get().count, 5);
        assert.ok(db.prepare('SELECT COUNT(*) AS count FROM permissions').get().count > 0);
        assert.ok(db.prepare('SELECT COUNT(*) AS count FROM role_permissions').get().count > 0);

        const hadNodeEnv = Object.hasOwn(process.env, 'NODE_ENV');
        const previousEnvironment = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        assert.doesNotThrow(() => initProductionBootstrap());
        assert.throws(
            () => initProductionBootstrap({ includeDemoFixtures: true }),
            /Demo fixtures are disabled in production/
        );
        const postgresSeed = require('../../server/db/postgres/seed.js');
        await assert.rejects(
            postgresSeed.seedProductionFoundation(null, { clean: true }),
            /Refusing to clean a production database/
        );
        await assert.rejects(
            postgresSeed.seedCleanEnterpriseData(),
            /Demo seed data is disabled in production/
        );
        if (hadNodeEnv) {
            process.env.NODE_ENV = previousEnvironment;
        } else {
            delete process.env.NODE_ENV;
        }

        console.log('[PASS] Production bootstrap seeds schema/RBAC only and rejects demo fixtures.');
    } finally {
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

run().catch(err => {
    console.error('[FAIL] Production seed safety test:', err);
    process.exitCode = 1;
});
