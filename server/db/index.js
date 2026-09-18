// server/db/index.js
// Dual-Engine Database Facade: Automatic routing between SQLite (dev/demo/test) & PostgreSQL (production)

const isPostgres = process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');

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
        getPool: pool.getPool,
        query: pool.query,
        getClient: pool.getClient,
        poolHealthCheck: pool.poolHealthCheck,
        closePool: pool.closePool,
        withTransaction: transactions.withTransaction,
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
        db: sqlite.db,
        initSchema: sqlite.initSchema,
        DB_PATH: sqlite.DB_PATH
    };
}
