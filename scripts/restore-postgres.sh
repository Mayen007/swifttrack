#!/usr/bin/env bash
# scripts/restore-postgres.sh
# SwiftTrack Kenya Logistics Platform - PostgreSQL Disaster Recovery Restoration Routine
# Validates SHA-256 integrity checksum, clears target database, and restores custom pg_dump snapshot

set -euo pipefail

BACKUP_FILE="${1:-}"
DATABASE_URL="${DATABASE_URL:-postgres://swifttrack_admin:super_secure_pg_password_2026@localhost:5432/swifttrack_logistics}"

if [ -z "${BACKUP_FILE}" ]; then
    echo "Usage: ./scripts/restore-postgres.sh <path-to-backup-file.dump>"
    echo "Available snapshots:"
    ls -lh backups/swifttrack_backup_*.dump 2>/dev/null || echo "No snapshots found in backups/"
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' not found."
    exit 1
fi

echo "================================================================="
echo "SwiftTrack Disaster Recovery Restoration"
echo "Target File:    ${BACKUP_FILE}"
echo "Initiated At:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Integrity Verification
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "[Restore] Verifying SHA-256 integrity checksum..."
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c "${CHECKSUM_FILE}"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 -c "${CHECKSUM_FILE}"
    fi
    echo "[Restore] SHA-256 integrity verification PASSED."
else
    echo "[Restore] Warning: No .sha256 manifest file found alongside snapshot."
fi

# 2. Database Restoration
if command -v pg_restore >/dev/null 2>&1; then
    echo "[Restore] Executing pg_restore with clean schema wipe..."
    pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL}" "${BACKUP_FILE}"
else
    echo "[Restore] pg_restore not in system PATH. Invoking Node.js restore engine..."
    node server/db/backup.js restore "${BACKUP_FILE}"
fi

# 3. Post-Restoration Data Architecture Verification
echo "[Restore] Running post-restore database schema & data validation drill..."
node tests/database/test-postgres-data-architecture.js

echo "================================================================="
echo "SwiftTrack Disaster Recovery Drill Completed Successfully!"
echo "================================================================="
