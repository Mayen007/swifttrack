#!/usr/bin/env node
// scripts/backup-postgres.js
// Cross-platform CLI runner for PostgreSQL / SQLite database backup
const { createBackup, listBackups } = require('../server/db/backup.js');

async function main() {
    try {
        console.log('--- SwiftTrack Database Backup Runner ---');
        const result = await createBackup();
        console.log(`\nBackup completed successfully: ${result.filename}`);
        console.log(`Engine: ${result.engine} | Size: ${result.sizeKb} KB | SHA-256: ${result.sha256}`);
    } catch (err) {
        console.error('Database backup failed:', err.message);
        process.exit(1);
    }
}

main();
