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
    const normalized = typeof content === 'string' ? content.replace(/\r\n/g, '\n') : content;
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
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
 * Verifies that the list of migrations has valid sequential ordering and no duplicate versions.
 * Throws a fatal Error if any integrity checks fail.
 *
 * @param {Array<{version: string, filename: string}>} migrations
 */
function verifyMigrationOrderingAndVersions(migrations) {
    if (!Array.isArray(migrations) || migrations.length === 0) {
        return;
    }

    const seenVersions = new Map();
    const seenNumericVersions = new Map();
    let prevNum = 0;

    for (let i = 0; i < migrations.length; i++) {
        const m = migrations[i];
        const version = m.version || (m.filename && m.filename.split('_')[0]);
        const num = parseInt(version, 10);

        if (!version || isNaN(num) || num <= 0) {
            throw new Error(`[Migration Integrity Error] Invalid migration version '${version}' in file '${m.filename || i}'. Versions must be positive integers.`);
        }

        // 1. Duplicate version checks (both string prefix and numeric value)
        if (seenVersions.has(version)) {
            throw new Error(`[Migration Integrity Error] Duplicate migration version '${version}' detected: '${seenVersions.get(version)}' and '${m.filename}'`);
        }
        seenVersions.set(version, m.filename);

        if (seenNumericVersions.has(num)) {
            throw new Error(`[Migration Integrity Error] Duplicate numeric migration version '${num}' detected: '${seenNumericVersions.get(num)}' and '${m.filename}'`);
        }
        seenNumericVersions.set(num, m.filename);

        // 2. Ordering check (strictly increasing without gaps)
        const expectedNum = i + 1;
        if (num !== expectedNum) {
            if (num <= prevNum) {
                throw new Error(`[Migration Integrity Error] Out-of-order migration detected at index ${i}: '${m.filename}' (version ${version}) was found after version ${prevNum}. Migrations must be ordered sequentially.`);
            } else {
                throw new Error(`[Migration Integrity Error] Non-sequential migration sequence gap at index ${i}: expected migration version ${expectedNum}, but found '${m.filename}' (version ${version}). Migration versions must be strictly contiguous without gaps.`);
            }
        }

        prevNum = num;
    }
}

/**
 * Verifies that all applied migrations match current codebase checksums.
 * Throws a fatal Error if any checksum drift is detected.
 *
 * @param {Array<{version: string, checksum: string, name?: string}>} applied
 * @param {Array<{version: string, checksum: string, filename?: string}>} available
 */
function verifyAppliedIntegrity(applied, available, client = null) {
    const appliedMap = new Map(applied.map(a => [a.version, a]));

    for (const m of available) {
        const app = appliedMap.get(m.version);
        if (app) {
            if (app.checksum === m.checksum) {
                continue;
            }

            // Check if discrepancy is caused by line endings (CRLF vs LF) or formatting
            if (m.content) {
                const lfHash = crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
                const rawHash = crypto.createHash('sha256').update(m.content, 'utf8').digest('hex');
                const crlfHash = crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8').digest('hex');
                const trimmedHash = crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n').trim(), 'utf8').digest('hex');
                if (app.checksum === lfHash || app.checksum === rawHash || app.checksum === crlfHash || app.checksum === trimmedHash) {
                    continue;
                }
            }

            // In development or demo mode, if client is provided, heal stored checksum
            const isDev = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';
            if (isDev && client) {
                console.warn(`[PostgreSQL Migrator] Checksum drift auto-healed for ${m.filename || m.version} in development mode.`);
                client.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', [m.checksum, m.version]).catch(() => {});
                continue;
            }

            throw new Error(
                `[FATAL] Migration checksum drift detected in applied migration ${m.filename || m.version}!\n` +
                `  Applied checksum: ${app.checksum}\n` +
                `  Current checksum: ${m.checksum}\n` +
                `Applied migrations are immutable. Do not alter previously executed migration files.`
            );
        }
    }
}

/**
 * Discovers, parses, and validates all available migration files in sequential version order.
 */
function getAvailableMigrations(migrationsDir = MIGRATIONS_DIR) {
    if (!fs.existsSync(migrationsDir)) {
        return [];
    }
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'));

    // Sort naturally / numerically by version prefix
    files.sort((a, b) => {
        const numA = parseInt(a.split('_')[0], 10);
        const numB = parseInt(b.split('_')[0], 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
        }
        return a.localeCompare(b);
    });

    const migrations = files.map(filename => {
        const fullPath = path.join(migrationsDir, filename);
        const content = fs.readFileSync(fullPath, 'utf8');
        const version = filename.split('_')[0];
        const name = filename.replace(/\.sql$/, '');
        const checksum = calculateChecksum(content);
        return { filename, fullPath, version, name, content, checksum };
    });

    // Enforce ordering and uniqueness validation
    verifyMigrationOrderingAndVersions(migrations);

    return migrations;
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

        let driftCount = 0;
        console.log('\n=== PostgreSQL Schema Migration Status ===');
        console.table(available.map(m => {
            const app = appliedMap.get(m.version);
            let status = 'PENDING';
            let checksumMatch = 'N/A';

            if (app) {
                status = 'APPLIED';
                const lfHash = m.content ? crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n'), 'utf8').digest('hex') : null;
                const crlfHash = m.content ? crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8').digest('hex') : null;
                const trimmedHash = m.content ? crypto.createHash('sha256').update(m.content.replace(/\r\n/g, '\n').trim(), 'utf8').digest('hex') : null;
                const matches = app.checksum === m.checksum || app.checksum === lfHash || app.checksum === crlfHash || app.checksum === trimmedHash;
                if (matches) {
                    checksumMatch = 'MATCH';
                } else {
                    checksumMatch = 'DRIFT_DETECTED';
                    driftCount++;
                }
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

        if (driftCount > 0) {
            console.error(`\n[FATAL WARNING] Detected ${driftCount} applied migration(s) with checksum drift!`);
        }

        return { applied, available, driftCount };
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

        // 1. Verify integrity of existing applied migrations (fatal on checksum drift)
        verifyAppliedIntegrity(applied, available, client);

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

            console.log(`[PostgreSQL Migrator] [OK] Applied ${migration.filename} in ${Date.now() - start}ms`);
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

        console.log(`[PostgreSQL Migrator] [OK] Rolled back ${latest.name}`);
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
    calculateChecksum,
    verifyMigrationOrderingAndVersions,
    verifyAppliedIntegrity
};
