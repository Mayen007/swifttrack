// server/db/index.js
// Dual-Engine Database Facade: Automatic routing between SQLite (dev/demo/test) & PostgreSQL (production)

const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
const dbAdapter = require('./dbAdapter.js');

if (isPostgres) {
    const pool = require('./postgres/pool.js');
    const transactions = require('./postgres/transactions.js');
    const migrator = require('./postgres/migrator.js');
    const retention = require('./postgres/retention.js');
    const seed = require('./postgres/seed.js');

    module.exports = {
        engine: 'postgres',
        isPostgres: true,
        isSqlite: false,
        // Common unified adapter methods
        query: dbAdapter.query,
        get: dbAdapter.get,
        all: dbAdapter.all,
        run: dbAdapter.run,
        withTransaction: dbAdapter.withTransaction,
        // Direct postgres engine tools
        getPool: pool.getPool,
        rawQuery: pool.query,
        getClient: pool.getClient,
        poolHealthCheck: pool.poolHealthCheck,
        closePool: pool.closePool,
        withSavepoint: transactions.withSavepoint,
        migrateUp: migrator.migrateUp,
        migrationStatus: migrator.migrationStatus,
        migrateRollback: migrator.migrateRollback,
        runDataRetention: retention.runDataRetention,
        seedProductionBaseline: seed.seedProductionBaseline
    };
} else {
    // Default SQLite engine (zero configuration, offline, local dev, existing test suites)
    const sqlite = require('./database.js');

    module.exports = {
        engine: 'sqlite',
        isPostgres: false,
        isSqlite: true,
        // Common unified adapter methods
        query: dbAdapter.query,
        get: dbAdapter.get,
        all: dbAdapter.all,
        run: dbAdapter.run,
        withTransaction: dbAdapter.withTransaction,
        // Direct sqlite engine tools
        db: sqlite.db,
        initSchema: sqlite.initSchema,
        DB_PATH: sqlite.DB_PATH
    };
}
