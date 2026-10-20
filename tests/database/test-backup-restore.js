// tests/database/test-backup-restore.js
// SwiftTrack Logistics Platform - Track 6: Database Backup, Restore & Integrity Verification Test Suite
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
    createBackup,
    restoreBackup,
    verifyBackupIntegrity,
    pruneOldBackups,
    listBackups,
    computeFileSha256
} = require('../../server/db/backup.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

async function main() {
    console.log('\n=================================================================');
    console.log('SwiftTrack Test Suite: Database Backup, Recovery & Integrity (Track 6)');
    console.log('=================================================================\n');

    // Create an isolated temporary test directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swifttrack_test_backup_'));
    const dummyDbPath = path.join(tempDir, 'dummy_test.db');
    fs.writeFileSync(dummyDbPath, 'SWIFTTRACK_INITIAL_DATABASE_DATA_V1', 'utf8');

    try {
        // Test 1: Snapshot generation & SHA-256 checksum creation
        await runAsyncTest('createBackup generates snapshot file and valid companion .sha256 manifest', async () => {
            const backup = await createBackup({
                backupDir: tempDir,
                dbPath: dummyDbPath,
                engine: 'sqlite'
            });

            assert.ok(fs.existsSync(backup.path), 'Backup file must exist on disk');
            assert.ok(fs.existsSync(backup.checksumPath), 'Checksum manifest must exist on disk');
            assert.ok(backup.sha256 && backup.sha256.length === 64, 'SHA-256 must be a 64-char hex string');

            const readHash = fs.readFileSync(backup.checksumPath, 'utf8').trim().split(/\s+/)[0];
            assert.strictEqual(readHash, backup.sha256, 'Written checksum manifest must match calculated SHA-256');
        });

        // Test 2: Integrity verification passes for intact snapshot
        await runAsyncTest('verifyBackupIntegrity validates intact snapshot file against manifest', async () => {
            const list = listBackups(tempDir);
            assert.ok(list.length > 0, 'At least one backup must be listed');

            const target = list[0];
            const check = verifyBackupIntegrity(target.fullPath);
            assert.strictEqual(check.valid, true, 'Integrity check must return valid=true for pristine snapshot');
            assert.strictEqual(check.calculatedHash, target.sha256, 'Calculated hash must match manifest');
        });

        // Test 3: Integrity verification detects tampered snapshot
        await runAsyncTest('verifyBackupIntegrity detects tampered snapshot and reports violation', async () => {
            const tamperedPath = path.join(tempDir, 'swifttrack_backup_sqlite_tampered.db');
            fs.writeFileSync(tamperedPath, 'CORRUPTED_OR_TAMPERED_DATA', 'utf8');
            const tamperedChecksum = path.join(tempDir, 'swifttrack_backup_sqlite_tampered.db.sha256');
            fs.writeFileSync(tamperedChecksum, '0000000000000000000000000000000000000000000000000000000000000000  fake.db\n', 'utf8');

            const check = verifyBackupIntegrity(tamperedPath);
            assert.strictEqual(check.valid, false, 'Tampered snapshot must be detected as invalid');
        });

        // Test 4: Restoration restores data and enforces integrity
        await runAsyncTest('restoreBackup restores snapshot data and fails on corrupt hash', async () => {
            // Modify source dummy db to simulate data loss
            fs.writeFileSync(dummyDbPath, 'DATA_LOST_CORRUPTED_STATE', 'utf8');

            // Find valid backup
            const list = listBackups(tempDir);
            const validBackup = list.find(b => b.filename !== 'swifttrack_backup_sqlite_tampered.db');
            assert.ok(validBackup, 'Must find valid snapshot');

            // Restore from pristine snapshot
            const result = await restoreBackup(validBackup.fullPath, {
                dbPath: dummyDbPath,
                engine: 'sqlite'
            });

            assert.strictEqual(result.status, 'RESTORE_COMPLETED');
            const restoredContent = fs.readFileSync(dummyDbPath, 'utf8');
            assert.strictEqual(restoredContent, 'SWIFTTRACK_INITIAL_DATABASE_DATA_V1', 'Restored data must match original backup');

            // Attempting to restore tampered file must throw
            const tamperedPath = path.join(tempDir, 'swifttrack_backup_sqlite_tampered.db');
            let threw = false;
            try {
                await restoreBackup(tamperedPath, { dbPath: dummyDbPath, engine: 'sqlite' });
            } catch (err) {
                threw = true;
                assert.ok(err.message.includes('Integrity verification failed'));
            }
            assert.strictEqual(threw, true, 'Restoring tampered snapshot must be rejected');
        });

        // Test 5: Retention pruning by count and age
        runTest('pruneOldBackups enforces max retention count correctly', () => {
            // Create 5 dummy backups
            for (let i = 1; i <= 5; i++) {
                const bPath = path.join(tempDir, `swifttrack_backup_sqlite_test_retention_${i}.db`);
                fs.writeFileSync(bPath, `BACKUP_${i}`, 'utf8');
                fs.writeFileSync(`${bPath}.sha256`, `HASH_${i} file.db`, 'utf8');
            }

            // Prune with maxRetentionCount = 3
            const pruned = pruneOldBackups(tempDir, 30, 3);
            assert.ok(pruned.length > 0, 'Pruning should remove excess backups beyond limit');

            const remaining = listBackups(tempDir);
            assert.ok(remaining.length <= 3, 'Remaining backup count must not exceed retention ceiling');
        });

    } finally {
        // Cleanup temporary directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore temp dir cleanup errors
        }
    }

    console.log(`\nResults: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)\n`);
    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

main();
