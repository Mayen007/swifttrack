// server/db/postgres/migrator.js
// Enterprise idempotent PostgreSQL migration runner with checksum verification & transaction safety
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getPool, closePool } = require('./pool.js');
const { withTransaction } = require('./transactions.js');

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

/**
 * Calculates SHA256 checksum of a string or buffer.
 */
function calculateChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Ensures the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER NOT NULL DEFAULT 0
        );
    `);
}

/**
 * Discovers and parses all available migration files in alphabetical/version order.
 */
function getAvailableMigrations() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
        .sort();

    return files.map(filename => {
        const fullPath = path.join(MIGRATIONS_DIR, filename);
        const content = fs.readFileSync(fullPath, 'utf8');
        const version = filename.split('_')[0];
        const name = filename.replace(/\.sql$/, '');
        const checksum = calculateChecksum(content);
        return { filename, fullPath, version, name, content, checksum };
    });
}

/**
 * Retrieves list of already-applied migrations from PostgreSQL database.
 */
async function getAppliedMigrations(client) {
    await ensureMigrationsTable(client);
    const res = await client.query(`
        SELECT version, name, checksum, applied_at, execution_time_ms
        FROM schema_migrations
        ORDER BY version ASC;
    `);
    return res.rows;
}

/**
 * Displays migration status.
 */
async function migrationStatus() {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await ensureMigrationsTable(client);
        const applied = await getAppliedMigrations(client);
        const available = getAvailableMigrations();

        const appliedMap = new Map(applied.map(a => [a.version, a]));

        console.log('\n=== PostgreSQL Schema Migration Status ===');
        console.table(available.map(m => {
            const app = appliedMap.get(m.version);
            let status = 'PENDING';
            let checksumMatch = 'N/A';

            if (app) {
                status = 'APPLIED';
                checksumMatch = app.checksum === m.checksum ? 'MATCH' : 'DRIFT_DETECTED';
            }

            return {
                Version: m.version,
                Name: m.name,
                Status: status,
                AppliedAt: app ? new Date(app.applied_at).toISOString() : '-',
                TimeMs: app ? `${app.execution_time_ms}ms` : '-',
                Integrity: checksumMatch
            };
        }));

        return { applied, available };
    } finally {
        client.release();
    }
}

/**
 * Applies all pending migrations in order within dedicated transactions.
 */
async function migrateUp() {
    const pool = getPool();
    const client = await pool.connect();
    const appliedResults = [];

    try {
        await ensureMigrationsTable(client);
        const applied = await getAppliedMigrations(client);
        const available = getAvailableMigrations();
        const appliedMap = new Map(applied.map(a => [a.version, a]));

        // 1. Verify integrity of existing applied migrations
        for (const m of available) {
            const app = appliedMap.get(m.version);
            if (app && app.checksum !== m.checksum) {
                console.warn(`[Migration Warning] Checksum drift detected in applied migration ${m.filename}!`);
            }
        }

        // 2. Identify pending migrations
        const pending = available.filter(m => !appliedMap.has(m.version));

        if (pending.length === 0) {
            console.log('[PostgreSQL Migrator] Database schema is completely up-to-date. No pending migrations.');
            return appliedResults;
        }

        console.log(`[PostgreSQL Migrator] Applying ${pending.length} pending migration(s)...`);

        for (const migration of pending) {
            console.log(`[PostgreSQL Migrator] Executing ${migration.filename}...`);
            const start = Date.now();

            await withTransaction(async (txClient) => {
                // Execute migration SQL
                await txClient.query(migration.content);

                const duration = Date.now() - start;

                // Record migration in tracking table
                await txClient.query(`
                    INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
                    VALUES ($1, $2, $3, $4)
                `, [migration.version, migration.name, migration.checksum, duration]);

                appliedResults.push({
                    version: migration.version,
                    name: migration.name,
                    executionTimeMs: duration
                });
            }, client);

            console.log(`[PostgreSQL Migrator] ✓ Applied ${migration.filename} in ${Date.now() - start}ms`);
        }

        console.log(`[PostgreSQL Migrator] All ${pending.length} migration(s) applied successfully.`);
        return appliedResults;
    } finally {
        client.release();
    }
}

/**
 * Rolls back the latest applied migration if a corresponding .down.sql exists.
 */
async function migrateRollback() {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await ensureMigrationsTable(client);
        const applied = await getAppliedMigrations(client);

        if (applied.length === 0) {
            console.log('[PostgreSQL Migrator] No migrations have been applied to rollback.');
            return null;
        }

        const latest = applied[applied.length - 1];
        const downFilename = `${latest.name}.down.sql`;
        const downPath = path.join(MIGRATIONS_DIR, downFilename);

        if (!fs.existsSync(downPath)) {
            throw new Error(`Cannot rollback ${latest.name}: counterpart down script '${downFilename}' was not found.`);
        }

        const downContent = fs.readFileSync(downPath, 'utf8');
        console.log(`[PostgreSQL Migrator] Rolling back ${latest.name}...`);

        await withTransaction(async (txClient) => {
            await txClient.query(downContent);
            await txClient.query('DELETE FROM schema_migrations WHERE version = $1', [latest.version]);
        }, client);

        console.log(`[PostgreSQL Migrator] ✓ Rolled back ${latest.name}`);
        return latest;
    } finally {
        client.release();
    }
}

// CLI handler
if (require.main === module) {
    const action = (process.argv[2] || 'up').toLowerCase();

    (async () => {
        try {
            if (action === 'up') {
                await migrateUp();
            } else if (action === 'status') {
                await migrationStatus();
            } else if (action === 'rollback') {
                await migrateRollback();
            } else {
                console.error(`Unknown migration action: ${action}. Use 'up', 'status', or 'rollback'.`);
                process.exit(1);
            }
        } catch (err) {
            console.error('[PostgreSQL Migrator Error]', err.message);
            process.exit(1);
        } finally {
            await closePool();
        }
    })();
}

module.exports = {
    migrateUp,
    migrationStatus,
    migrateRollback,
    getAvailableMigrations,
    ensureMigrationsTable,
    calculateChecksum
};
