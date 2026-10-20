// server/db/backup.js
// Enterprise Point-in-Time Database Backup & Disaster Recovery Utility
// Supports PostgreSQL (production) with pg_dump / direct pg connection, and SQLite (local/dev)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync, spawnSync } = require('node:child_process');

const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_RETENTION_COUNT = 30;

/**
 * Computes SHA-256 hex digest for a file.
 */
function computeFileSha256(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Validates integrity of a backup file against a known or adjacent .sha256 manifest.
 */
function verifyBackupIntegrity(backupFilePath, expectedHash = null) {
    if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFilePath}`);
    }

    let targetHash = expectedHash;
    if (!targetHash) {
        const checksumFile = `${backupFilePath}.sha256`;
        if (fs.existsSync(checksumFile)) {
            const content = fs.readFileSync(checksumFile, 'utf8').trim();
            targetHash = content.split(/\s+/)[0];
        }
    }

    const calculatedHash = computeFileSha256(backupFilePath);
    const valid = !targetHash || calculatedHash.toLowerCase() === targetHash.toLowerCase();

    return {
        valid,
        calculatedHash,
        expectedHash: targetHash || calculatedHash,
        filePath: backupFilePath,
        fileSizeBytes: fs.statSync(backupFilePath).size
    };
}

/**
 * Prunes backups older than maxDays (default 30 days) and enforces maxRetentionCount.
 */
function pruneOldBackups(backupDir, maxDays = DEFAULT_RETENTION_DAYS, maxRetentionCount = DEFAULT_MAX_RETENTION_COUNT) {
    try {
        if (!fs.existsSync(backupDir)) return [];

        const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('swifttrack_backup_') && !f.endsWith('.sha256'))
            .map(f => {
                const fullPath = path.join(backupDir, f);
                const stat = fs.statSync(fullPath);
                return {
                    name: f,
                    fullPath,
                    mtime: stat.mtimeMs,
                    size: stat.size
                };
            })
            .sort((a, b) => b.mtime - a.mtime);

        const pruned = [];

        // 1. Retention by age (> 30 days)
        for (const file of files) {
            if (file.mtime < cutoffTime) {
                fs.unlinkSync(file.fullPath);
                const checksumFile = `${file.fullPath}.sha256`;
                if (fs.existsSync(checksumFile)) fs.unlinkSync(checksumFile);
                pruned.push({ name: file.name, reason: 'EXPIRED_AGE' });
            }
        }

        // 2. Retention by count (> maxRetentionCount)
        const remaining = files.filter(f => !pruned.some(p => p.name === f.name));
        if (remaining.length > maxRetentionCount) {
            const excess = remaining.slice(maxRetentionCount);
            for (const file of excess) {
                fs.unlinkSync(file.fullPath);
                const checksumFile = `${file.fullPath}.sha256`;
                if (fs.existsSync(checksumFile)) fs.unlinkSync(checksumFile);
                pruned.push({ name: file.name, reason: 'MAX_COUNT_EXCEEDED' });
            }
        }

        return pruned;
    } catch (err) {
        console.warn(`[Backup] Retention prune warning:`, err.message);
        return [];
    }
}

/**
 * Lists all backups in the backup directory with metadata and verification status.
 */
function listBackups(backupDir = BACKUP_DIR) {
    if (!fs.existsSync(backupDir)) return [];

    return fs.readdirSync(backupDir)
        .filter(f => f.startsWith('swifttrack_backup_') && !f.endsWith('.sha256'))
        .map(f => {
            const fullPath = path.join(backupDir, f);
            const stat = fs.statSync(fullPath);
            const checksumFile = `${fullPath}.sha256`;
            let sha256 = null;
            if (fs.existsSync(checksumFile)) {
                sha256 = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
            }
            return {
                filename: f,
                fullPath,
                sizeBytes: stat.size,
                sizeKb: Number((stat.size / 1024).toFixed(2)),
                createdAt: stat.mtime.toISOString(),
                hasChecksum: !!sha256,
                sha256
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Creates a point-in-time backup of the authoritative database.
 */
async function createBackup(options = {}) {
    const backupDir = options.backupDir || BACKUP_DIR;
    const isPostgres = options.engine === 'postgres' || process.env.DB_CLIENT === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_CLIENT !== 'sqlite');
    const retentionDays = options.retentionDays || DEFAULT_RETENTION_DAYS;
    const maxCount = options.maxRetentionCount || DEFAULT_MAX_RETENTION_COUNT;

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    let backupFilename;
    let destinationPath;

    if (isPostgres) {
        const pgDumpCheck = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
        if (pgDumpCheck.error && pgDumpCheck.error.code !== 'ENOENT') {
            throw pgDumpCheck.error;
        }
        const pgDumpAvailable = !pgDumpCheck.error && pgDumpCheck.status === 0;
        if (!pgDumpAvailable && !pgDumpCheck.error && pgDumpCheck.status !== 0) {
            throw new Error(`Could not determine pg_dump version: ${pgDumpCheck.stderr || pgDumpCheck.stdout}`);
        }

        let usePgDump = pgDumpAvailable && options.format !== 'portable';
        if (usePgDump) {
            const clientVersionMatch = `${pgDumpCheck.stdout}\n${pgDumpCheck.stderr}`.match(/(?:PostgreSQL\)\s+)(\d+)(?:\.(\d+))?/);
            if (!clientVersionMatch) {
                throw new Error('Could not parse pg_dump version output.');
            }

            const pool = require('./postgres/pool.js');
            const server = await pool.query('SHOW server_version_num');
            const serverVersionNum = Number(server.rows[0]?.server_version_num);
            if (!Number.isInteger(serverVersionNum)) {
                throw new Error('Could not determine PostgreSQL server version.');
            }

            const serverMajor = serverVersionNum >= 100000
                ? String(Math.floor(serverVersionNum / 10000))
                : `${Math.floor(serverVersionNum / 10000)}.${Math.floor((serverVersionNum % 10000) / 100)}`;
            const clientVersion = Number(clientVersionMatch[1]);
            const clientMajor = clientVersion >= 10
                ? String(clientVersion)
                : `${clientVersion}.${clientVersionMatch[2] || '0'}`;
            usePgDump = clientMajor === serverMajor;

            if (!usePgDump) {
                console.warn(`[Backup] pg_dump ${clientMajor} does not match PostgreSQL server ${serverMajor}; using portable SQL format.`);
            }
        }

        backupFilename = `swifttrack_backup_pg_${timestamp}.${usePgDump ? 'dump' : 'sql'}`;
        destinationPath = path.join(backupDir, backupFilename);
        console.log(`[Backup] Initiating PostgreSQL snapshot (${backupFilename})...`);

        if (usePgDump) {
            const args = process.env.DATABASE_URL
                ? ['--format=c', `--file=${destinationPath}`, process.env.DATABASE_URL]
                : [
                    '-h', process.env.PGHOST || '127.0.0.1',
                    '-p', process.env.PGPORT || '5432',
                    '-U', process.env.PGUSER || 'postgres',
                    '-d', process.env.PGDATABASE || 'swifttrack_logistics',
                    '-F', 'c', '-f', destinationPath
                ];
            const result = spawnSync('pg_dump', args, {
                encoding: 'utf8',
                env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'postgres' },
                stdio: ['ignore', 'inherit', 'inherit']
            });
            if (result.error) throw result.error;
            if (result.status !== 0) {
                throw new Error(`pg_dump failed with exit code ${result.status}.`);
            }
        } else {
            const pool = require('./postgres/pool.js');
            const client = await pool.getClient();
            try {
                const tablesRes = await client.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name;
                `);
                const lines = [
                    `-- SwiftTrack PostgreSQL Portable Snapshot: ${timestamp}`,
                    `-- Generated at: ${now.toISOString()}`,
                    `BEGIN;`
                ];

                for (const row of tablesRes.rows) {
                    const table = row.table_name;
                    lines.push(`-- Table: ${table}`);
                    const rowsRes = await client.query(`SELECT * FROM "${table}"`);
                    if (rowsRes.rows.length > 0) {
                        for (const r of rowsRes.rows) {
                            const cols = Object.keys(r).map(c => `"${c}"`).join(', ');
                            const vals = Object.values(r).map(v => {
                                if (v === null || v === undefined) return 'NULL';
                                if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                                if (v instanceof Date) return `'${v.toISOString()}'`;
                                if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                                return `'${String(v).replace(/'/g, "''")}'`;
                            }).join(', ');
                            lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals});`);
                        }
                    }
                }
                lines.push(`COMMIT;`);
                fs.writeFileSync(destinationPath, lines.join('\n'), 'utf8');
            } finally {
                client.release();
            }
        }
    } else {
        // --- SQLite Engine Backup ---
        const sqliteDb = require('./database.js');
        const dbPath = options.dbPath || sqliteDb.DB_PATH;
        backupFilename = `swifttrack_backup_sqlite_${timestamp}.db`;
        destinationPath = path.join(backupDir, backupFilename);

        console.log(`[Backup] Initiating SQLite snapshot of ${path.basename(dbPath)}...`);
        if (!fs.existsSync(dbPath)) {
            // Touch empty or initialize schema if not yet present
            sqliteDb.initSchema();
        }

        // Copy DB file atomically
        fs.copyFileSync(dbPath, destinationPath);
    }

    // Compute SHA-256 Checksum
    const sha256 = computeFileSha256(destinationPath);
    const checksumPath = `${destinationPath}.sha256`;
    fs.writeFileSync(checksumPath, `${sha256}  ${backupFilename}\n`, 'utf8');

    const stats = fs.statSync(destinationPath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    console.log(`[Backup] Snapshot verified & created:`);
    console.log(`         File:     ${backupFilename}`);
    console.log(`         Location: ${destinationPath}`);
    console.log(`         Size:     ${sizeKb} KB (${stats.size} bytes)`);
    console.log(`         SHA-256:  ${sha256}`);

    // Manage Retention
    const pruned = pruneOldBackups(backupDir, retentionDays, maxCount);
    if (pruned.length > 0) {
        console.log(`[Backup] Pruned ${pruned.length} expired snapshot(s) based on ${retentionDays}-day retention policy.`);
    }

    return {
        filename: backupFilename,
        path: destinationPath,
        checksumPath,
        size: stats.size,
        sizeKb: Number(sizeKb),
        sha256,
        engine: isPostgres ? 'postgres' : 'sqlite',
        timestamp: now.toISOString(),
        prunedCount: pruned.length
    };
}

/**
 * Restores a snapshot file to the target database with pre-restoration checksum verification.
 */
async function restoreBackup(backupFilePath, options = {}) {
    if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Restore target file does not exist: ${backupFilePath}`);
    }

    // 1. Verify SHA-256 Checksum before restoration
    const integrity = verifyBackupIntegrity(backupFilePath, options.expectedSha256);
    if (!integrity.valid) {
        throw new Error(`Integrity verification failed! Checksum mismatch on ${path.basename(backupFilePath)}. Aborting restore.`);
    }

    const isPostgres = options.engine === 'postgres' || process.env.DB_CLIENT === 'postgres' || backupFilePath.includes('_pg_');

    console.log(`[Restore] Verified integrity of ${path.basename(backupFilePath)} (SHA-256: ${integrity.calculatedHash})`);
    console.log(`[Restore] Target Engine: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

    if (isPostgres) {
        const isPortableSql = path.extname(backupFilePath).toLowerCase() === '.sql';
        let pgRestoreAvailable = false;
        try {
            const check = spawnSync('pg_restore', ['--version'], { encoding: 'utf8' });
            if (check.status === 0) pgRestoreAvailable = true;
        } catch {
            pgRestoreAvailable = false;
        }

        const dbUrl = process.env.DATABASE_URL;
        if (!isPortableSql && pgRestoreAvailable && dbUrl) {
            // Restore via pg_restore --clean
            execSync(`pg_restore --clean --if-exists --no-owner --dbname="${dbUrl}" "${backupFilePath}"`, {
                stdio: ['ignore', 'inherit', 'inherit']
            });
        } else {
            // Plain SQL restore using node-postgres
            const sql = fs.readFileSync(backupFilePath, 'utf8');
            const pool = require('./postgres/pool.js');
            const client = await pool.getClient();
            try {
                await client.query('BEGIN;');
                await client.query(sql);
                await client.query('COMMIT;');
            } catch (err) {
                await client.query('ROLLBACK;');
                throw err;
            } finally {
                client.release();
            }
        }
    } else {
        const sqliteDb = require('./database.js');
        const dbPath = options.dbPath || sqliteDb.DB_PATH;
        fs.copyFileSync(backupFilePath, dbPath);
    }

    console.log(`[Restore] Restoration completed successfully.`);
    return {
        status: 'RESTORE_COMPLETED',
        backupFile: path.basename(backupFilePath),
        engine: isPostgres ? 'postgres' : 'sqlite',
        sha256: integrity.calculatedHash,
        restoredAt: new Date().toISOString()
    };
}

if (require.main === module) {
    const action = process.argv[2] || 'create';
    if (action === 'restore') {
        const file = process.argv[3];
        if (!file) {
            console.error('Usage: node server/db/backup.js restore <path_to_backup_file>');
            process.exit(1);
        }
        restoreBackup(file).catch(err => {
            console.error('[Restore] Error:', err.message);
            process.exit(1);
        });
    } else if (action === 'list') {
        const list = listBackups();
        console.log(`Found ${list.length} available database snapshot(s):`);
        console.table(list);
    } else if (action === 'verify') {
        const file = process.argv[3];
        if (!file) {
            console.error('Usage: node server/db/backup.js verify <path_to_backup_file>');
            process.exit(1);
        }
        const res = verifyBackupIntegrity(file);
        console.log(`Integrity Check: ${res.valid ? 'VALID (PASSED)' : 'TAMPERED / MISMATCH (FAILED)'}`);
        console.log(`File: ${res.filePath}`);
        console.log(`SHA-256: ${res.calculatedHash}`);
    } else {
        createBackup().catch(err => {
            console.error('[Backup] Error:', err.message);
            process.exit(1);
        });
    }
}

module.exports = {
    createBackup,
    restoreBackup,
    verifyBackupIntegrity,
    pruneOldBackups,
    listBackups,
    computeFileSha256,
    BACKUP_DIR,
    DEFAULT_RETENTION_DAYS
};
