// scripts/migrate-sqlite-to-postgres.js
// Enterprise Production Data Migration ETL Pipeline: SQLite -> PostgreSQL
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { getPool, closePool } = require('../server/db/postgres/pool.js');
const { withTransaction } = require('../server/db/postgres/transactions.js');
const { resetSequence } = require('../server/db/postgres/seed.js');

const DB_PATH = path.resolve(__dirname, '../data/logistics_platform.db');

// Strict topological dependency order (parents before children)
const TABLE_PIPELINE = [
    { name: 'company_settings', pk: 'id' },
    { name: 'branches', pk: 'id', boolCols: ['is_active'] },
    { name: 'warehouses', pk: 'id', boolCols: ['is_active'] },
    { name: 'roles', pk: 'id', boolCols: ['is_system'] },
    { name: 'permissions', pk: 'id' },
    { name: 'role_permissions', pk: null },
    { name: 'users', pk: 'id', boolCols: ['is_active', 'must_change_password', 'two_factor_enabled'] },
    { name: 'categories', pk: 'id', boolCols: ['is_active'] },
    { name: 'products', pk: 'id', boolCols: ['is_active'] },
    { name: 'inventory', pk: 'id' },
    { name: 'customers', pk: 'id' },
    { name: 'vehicles', pk: 'id', boolCols: ['is_active'] },
    { name: 'drivers', pk: 'id' },
    { name: 'orders', pk: 'id', boolCols: ['delivery_required'] },
    { name: 'order_items', pk: 'id' },
    { name: 'sales', pk: 'id' },
    { name: 'sale_items', pk: 'id' },
    { name: 'held_sales', pk: 'id', jsonCols: ['cart_data_json'] },
    { name: 'payments', pk: 'id' },
    { name: 'refund_requests', pk: 'id' },
    { name: 'refunds', pk: 'id' },
    { name: 'expenses', pk: 'id' },
    { name: 'stock_adjustments', pk: 'id' },
    { name: 'stock_transfers', pk: 'id' },
    { name: 'stock_transfer_items', pk: 'id' },
    { name: 'deliveries', pk: 'id' },
    { name: 'delivery_items', pk: 'id' },
    { name: 'delivery_status_history', pk: 'id' },
    { name: 'proof_of_delivery', pk: 'id', boolCols: ['otp_verified'] },
    { name: 'inventory_movements', pk: 'id' },
    { name: 'notifications', pk: 'id', boolCols: ['is_read'] },
    { name: 'audit_logs', pk: 'id', jsonCols: ['previous_value', 'new_value'] },
    { name: 'user_sessions', pk: 'id', boolCols: ['is_active'], jsonCols: ['device_info'] },
    { name: 'revoked_tokens', pk: 'id' },
    { name: 'password_reset_tokens', pk: 'id' },
    { name: 'login_history', pk: 'id' }
];

/**
 * Transforms a SQLite row into a clean PostgreSQL-compatible row.
 */
function transformRow(row, config) {
    const transformed = { ...row };

    // Convert booleans (0/1 -> false/true)
    if (config.boolCols) {
        for (const col of config.boolCols) {
            if (col in transformed && transformed[col] !== null) {
                transformed[col] = transformed[col] === 1 || transformed[col] === true || transformed[col] === '1';
            }
        }
    }

    // Convert JSON/JSONB fields
    if (config.jsonCols) {
        for (const col of config.jsonCols) {
            if (col in transformed && transformed[col] !== null) {
                if (typeof transformed[col] === 'string') {
                    try {
                        transformed[col] = JSON.parse(transformed[col]);
                    } catch {
                        // Keep as string if not valid JSON
                    }
                }
            }
        }
    }

    return transformed;
}

/**
 * Executes the complete SQLite -> PostgreSQL ETL migration.
 */
async function migrateSqliteToPostgres(options = {}) {
    const { dryRun = false, verifyOnly = false, truncateTarget = false } = options;

    if (!fs.existsSync(DB_PATH)) {
        throw new Error(`Source SQLite database not found at: ${DB_PATH}`);
    }

    console.log('\n============================================================');
    console.log('SWIFTTRACK KENYA: PRODUCTION ETL MIGRATION PIPELINE');
    console.log('Source: SQLite (' + DB_PATH + ')');
    console.log('Target: PostgreSQL (' + (process.env.DATABASE_URL || 'Localhost/PGHOST') + ')');
    console.log('Mode:   ' + (verifyOnly ? 'VERIFY ONLY' : dryRun ? 'DRY RUN' : 'LIVE MIGRATION'));
    console.log('============================================================\n');

    const sqliteDb = new DatabaseSync(DB_PATH);
    const pool = getPool();
    let client = null;
    if (!dryRun) {
        client = await pool.connect();
    }

    const report = [];

    try {
        if (verifyOnly) {
            console.log('[ETL] Comparing row counts across all tables...');
            for (const table of TABLE_PIPELINE) {
                let sqliteCount = 0;
                let pgCount = 0;

                try {
                    const sRow = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
                    sqliteCount = sRow?.count || 0;
                } catch {
                    sqliteCount = 'N/A';
                }

                try {
                    const pRow = await client.query(`SELECT COUNT(*) as count FROM ${table.name}`);
                    pgCount = parseInt(pRow.rows[0]?.count || '0', 10);
                } catch {
                    pgCount = 'N/A';
                }

                report.push({
                    Table: table.name,
                    SQLiteCount: sqliteCount,
                    PostgresCount: pgCount,
                    Status: sqliteCount === pgCount ? 'MATCH' : 'DIFFERENCE'
                });
            }
            console.table(report);
            return report;
        }

        // Optional truncate target in reverse topological order
        if (truncateTarget && !dryRun) {
            console.log('[ETL] Truncating target PostgreSQL tables...');
            await withTransaction(async (txClient) => {
                const reversePipeline = [...TABLE_PIPELINE].reverse();
                for (const table of reversePipeline) {
                    try {
                        await txClient.query(`TRUNCATE TABLE ${table.name} CASCADE;`);
                    } catch (e) {
                        // ignore if table doesn't exist
                    }
                }
            }, client);
            console.log('[ETL] Target tables truncated successfully.');
        }

        // Migrate each table in topological order
        for (const table of TABLE_PIPELINE) {
            console.log(`[ETL] Processing table '${table.name}'...`);

            // 1. Fetch all rows from SQLite
            let sqliteRows = [];
            try {
                sqliteRows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all();
            } catch (err) {
                console.warn(`[ETL Warning] Could not read SQLite table '${table.name}':`, err.message);
                report.push({
                    Table: table.name,
                    SQLiteCount: 0,
                    PostgresCount: 0,
                    Status: 'SKIPPED (SOURCE MISSING)'
                });
                continue;
            }

            if (sqliteRows.length === 0) {
                report.push({
                    Table: table.name,
                    SQLiteCount: 0,
                    PostgresCount: 0,
                    Status: 'EMPTY'
                });
                continue;
            }

            // 2. Transform rows
            const transformedRows = sqliteRows.map(r => transformRow(r, table));

            if (dryRun) {
                console.log(`[ETL Dry-Run] Would migrate ${transformedRows.length} row(s) to '${table.name}'`);
                report.push({
                    Table: table.name,
                    SQLiteCount: transformedRows.length,
                    PostgresCount: 0,
                    Status: 'DRY_RUN'
                });
                continue;
            }

            // 3. Batch insert into PostgreSQL
            const columns = Object.keys(transformedRows[0]);
            const BATCH_SIZE = 100;
            let migratedCount = 0;

            await withTransaction(async (txClient) => {
                for (let i = 0; i < transformedRows.length; i += BATCH_SIZE) {
                    const batch = transformedRows.slice(i, i + BATCH_SIZE);

                    const valuePlaceholders = [];
                    const flatValues = [];

                    batch.forEach((row, rowIdx) => {
                        const rowPlaceholders = [];
                        columns.forEach((col, colIdx) => {
                            flatValues.push(row[col]);
                            rowPlaceholders.push(`$${flatValues.length}`);
                        });
                        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
                    });

                    const insertSql = `
                        INSERT INTO ${table.name} (${columns.join(', ')})
                        VALUES ${valuePlaceholders.join(', ')}
                        ON CONFLICT DO NOTHING;
                    `;

                    const res = await txClient.query(insertSql, flatValues);
                    migratedCount += res.rowCount || 0;
                }

                // 4. Resync sequence if table has integer primary key
                if (table.pk) {
                    await resetSequence(txClient, table.name, table.pk);
                }
            }, client);

            console.log(`[ETL] ✓ Migrated ${migratedCount}/${transformedRows.length} rows to '${table.name}'`);

            // Verify final PG count
            const pgCountRes = await client.query(`SELECT COUNT(*) as count FROM ${table.name}`);
            const finalPgCount = parseInt(pgCountRes.rows[0]?.count || '0', 10);

            report.push({
                Table: table.name,
                SQLiteCount: transformedRows.length,
                PostgresCount: finalPgCount,
                Status: transformedRows.length <= finalPgCount ? 'SUCCESS' : 'PARTIAL'
            });
        }

        console.log('\n=== Production Migration Reconciliation Summary ===');
        console.table(report);
        return report;
    } finally {
        if (client) {
            client.release();
        }
    }
}

// CLI handler
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        verifyOnly: args.includes('--verify-only'),
        truncateTarget: args.includes('--truncate-target')
    };

    (async () => {
        try {
            await migrateSqliteToPostgres(options);
            console.log('\n[ETL] Operation finished successfully.');
        } catch (err) {
            console.error('\n[ETL Fatal Error]', err);
            process.exit(1);
        } finally {
            await closePool();
        }
    })();
}

module.exports = {
    migrateSqliteToPostgres,
    transformRow,
    TABLE_PIPELINE
};
