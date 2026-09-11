// server/db/backup.js
// Enterprise Point-in-Time SQLite Database Backup Utility
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.resolve(__dirname, '../../data/logistics_platform.db');
const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const MAX_BACKUP_RETENTION = 10;

function createBackup(options = {}) {
    const backupDir = options.backupDir || BACKUP_DIR;
    const dbPath = options.dbPath || DB_PATH;

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Source database not found at: ${dbPath}`);
    }

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    // Format timestamp: YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupFilename = `swifttrack_backup_${timestamp}.db`;
    const destinationPath = path.join(backupDir, backupFilename);

    console.log(`[Backup] Initiating point-in-time snapshot of ${path.basename(dbPath)}...`);

    // Copy DB file atomically
    fs.copyFileSync(dbPath, destinationPath);

    // Compute SHA-256 checksum for verification and audit integrity
    const fileBuffer = fs.readFileSync(destinationPath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = fs.statSync(destinationPath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    console.log(`[Backup] Snapshot created successfully:`);
    console.log(`         File:     ${backupFilename}`);
    console.log(`         Location: ${destinationPath}`);
    console.log(`         Size:     ${sizeKb} KB (${stats.size} bytes)`);
    console.log(`         SHA-256:  ${hash}`);

    // Manage retention
    pruneOldBackups(backupDir, MAX_BACKUP_RETENTION);

    return {
        filename: backupFilename,
        path: destinationPath,
        size: stats.size,
        sha256: hash,
        timestamp: now.toISOString()
    };
}

function pruneOldBackups(backupDir, maxRetention) {
    try {
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('swifttrack_backup_') && f.endsWith('.db'))
            .map(f => ({
                name: f,
                fullPath: path.join(backupDir, f),
                time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length > maxRetention) {
            const toDelete = files.slice(maxRetention);
            for (const file of toDelete) {
                fs.unlinkSync(file.fullPath);
                console.log(`[Backup] Pruned older backup: ${file.name}`);
            }
        }
    } catch (err) {
        console.warn(`[Backup] Could not prune old backups:`, err.message);
    }
}

if (require.main === module) {
    try {
        createBackup();
    } catch (err) {
        console.error('[Backup] Error performing database backup:', err.message);
        process.exit(1);
    }
}

module.exports = { createBackup, DB_PATH, BACKUP_DIR };
