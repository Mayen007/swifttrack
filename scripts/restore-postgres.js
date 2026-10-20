#!/usr/bin/env node
// scripts/restore-postgres.js
// Cross-platform CLI runner for PostgreSQL / SQLite disaster recovery restore
const path = require('node:path');
const { restoreBackup, listBackups, verifyBackupIntegrity } = require('../server/db/backup.js');

async function main() {
    const backupFile = process.argv[2];
    if (!backupFile) {
        console.log('--- SwiftTrack Disaster Recovery Restore Runner ---');
        console.log('Usage: node scripts/restore-postgres.js <path-to-backup-file>');
        const backups = listBackups();
        if (backups.length > 0) {
            console.log('\nAvailable snapshots in backups directory:');
            backups.slice(0, 5).forEach(b => console.log(` - ${b.filename} (${b.sizeKb} KB, created ${b.createdAt})`));
        } else {
            console.log('No snapshots currently found in backups directory.');
        }
        process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), backupFile);
    try {
        console.log(`--- Initiating Disaster Recovery Restore from: ${backupFile} ---`);
        const result = await restoreBackup(resolvedPath);
        console.log(`\nRestore completed successfully!`);
        console.log(`Engine: ${result.engine} | File: ${result.backupFile} | Status: ${result.status}`);
    } catch (err) {
        console.error('Disaster recovery restoration failed:', err.message);
        process.exit(1);
    }
}

main();
