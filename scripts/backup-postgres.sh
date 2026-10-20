#!/usr/bin/env bash
# scripts/backup-postgres.sh
# SwiftTrack Kenya Logistics Platform - PostgreSQL Automated Backup Routine
# Generates compressed pg_dump snapshot with SHA-256 integrity checksum & 30-day retention pruning

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATABASE_URL="${DATABASE_URL:-postgres://swifttrack_admin:super_secure_pg_password_2026@localhost:5432/swifttrack_logistics}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="swifttrack_backup_pg_${TIMESTAMP}.dump"
DESTINATION="${BACKUP_DIR}/${BACKUP_FILENAME}"
CHECKSUM_FILE="${DESTINATION}.sha256"

echo "================================================================="
echo "SwiftTrack Automated PostgreSQL Backup"
echo "Timestamp:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Destination:  ${DESTINATION}"
echo "Retention:    ${RETENTION_DAYS} days"
echo "================================================================="

if command -v pg_dump >/dev/null 2>&1; then
    echo "[Backup] Executing pg_dump with custom compression (-Fc)..."
    pg_dump --format=c --file="${DESTINATION}" "${DATABASE_URL}"
else
    echo "[Backup] pg_dump not found in system PATH. Invoking Node.js portable backup engine..."
    node server/db/backup.js create
    exit 0
fi

# Generate SHA-256 Checksum
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${DESTINATION}" > "${CHECKSUM_FILE}"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${DESTINATION}" > "${CHECKSUM_FILE}"
fi

FILE_SIZE=$(du -h "${DESTINATION}" | cut -f1)
echo "[Backup] Snapshot successfully generated (${FILE_SIZE})."
echo "[Backup] Checksum manifest written to ${CHECKSUM_FILE}."

# 30-day retention pruning
echo "[Backup] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "swifttrack_backup_pg_*.dump*" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "[Backup] Completed successfully."
