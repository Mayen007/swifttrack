# SwiftTrack Kenya Logistics Platform - Disaster Recovery & Operational Runbook

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Target Database Engine:** PostgreSQL 18 (Official `postgres:18-alpine`) / SQLite 3 Local Fallback  
**Operational Classification:** Tier-1 Critical Logistics Core  

---

## 1. Executive Summary & Recovery Objectives

| Metric | Target SLA | Description |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 15 minutes** | Maximum allowable data loss in the event of catastrophic physical or logical hardware failure. Achieved via automated WAL archiving and scheduled compressed snapshots. |
| **RTO (Recovery Time Objective)** | **< 5 minutes** | Maximum allowable time to restore full platform availability following initiation of the disaster recovery procedure. |
| **Backup Integrity Assurance** | **100% SHA-256** | Every snapshot is immutably sealed with a companion `.sha256` manifest. Restores automatically abort upon hash mismatch. |
| **Retention Policy** | **30 Days** | Snapshots older than 30 days or exceeding the 30-snapshot limit are pruned automatically after each backup run. |

---

## 2. Backup Architecture & File Layout

Backups are stored in the root `backups/` volume directory:
```
backups/
├── swifttrack_backup_pg_20261020_090000.dump          # PostgreSQL custom compressed archive (-Fc)
├── swifttrack_backup_pg_20261020_090000.dump.sha256   # Cryptographic SHA-256 manifest
├── swifttrack_backup_sqlite_20261020_080000.db        # SQLite development snapshot (atomic copy)
└── swifttrack_backup_sqlite_20261020_080000.db.sha256 # SQLite cryptographic checksum
```

### 2.1 Generating Backups

#### Via POSIX Bash (Linux / Production Docker Containers)
```bash
./scripts/backup-postgres.sh
```

#### Via Cross-Platform Node Runner (Windows / macOS / CI)
```bash
node scripts/backup-postgres.js
# Or via npm script:
npm run db:backup
```

#### Programmatic Node API
```javascript
const { createBackup, verifyBackupIntegrity } = require('./server/db/backup.js');

const snapshot = await createBackup({
    retentionDays: 30,
    maxRetentionCount: 30
});
console.log(`Created: ${snapshot.filename} (SHA-256: ${snapshot.sha256})`);
```

---

## 3. Disaster Recovery Restoration Runbook

### Phase 1: Pre-Restoration Assessment
1. **Identify Failure Cause**:
   - Database corruption, hardware failure, unrecoverable data migration, or operational error.
2. **Select Snapshot**:
   List available snapshots to choose the most recent healthy point-in-time image:
   ```bash
   node server/db/backup.js list
   ```
3. **Verify Snapshot Cryptographic Integrity**:
   ```bash
   node server/db/backup.js verify backups/swifttrack_backup_pg_20261020_090000.dump
   ```
   > [!IMPORTANT]
   > Do NOT attempt to restore any backup file that reports a SHA-256 checksum mismatch.

---

### Phase 2: Restoring the Database

#### Scenario A: Automated One-Step Recovery (Recommended)
```bash
# Cross-platform runner:
node scripts/restore-postgres.js backups/swifttrack_backup_pg_20261020_090000.dump

# Linux / Docker container script:
./scripts/restore-postgres.sh backups/swifttrack_backup_pg_20261020_090000.dump
```

#### Scenario B: Manual Docker Compose Recovery Drill
If restoring within a dedicated Docker Compose environment:
```bash
# 1. Stop the application services while keeping postgres online
docker compose stop app worker

# 2. Copy the backup snapshot into the postgres container
docker cp backups/swifttrack_backup_pg_20261020_090000.dump swifttrack_postgres:/tmp/restore.dump

# 3. Clean and restore target database using pg_restore
docker compose exec postgres pg_restore \
    -U swifttrack_admin \
    -d swifttrack_logistics \
    --clean \
    --if-exists \
    --no-owner \
    /tmp/restore.dump

# 4. Restart application services
docker compose start app worker
```

---

### Phase 3: Post-Restoration Certification & Health Verification
Execute the automated data architecture certification suite to guarantee 100% relational integrity and zero schema drift:
```bash
node tests/database/test-postgres-data-architecture.js
```
Expected output:
```
All 24 migrations verified.
Relational constraints, foreign keys, and indexes: PASS (0 errors).
```

Verify service readiness probe:
```bash
curl -f http://localhost:4000/api/v1/health/ready
```
Expected response:
```json
{
  "status": "ready",
  "database": "healthy",
  "latencyMs": 3
}
```

---

## 4. Operational Monitoring & Alerting

### Prometheus Metrics Endpoint
Scrape endpoint: `http://localhost:4000/metrics` (or `http://localhost:4000/api/v1/metrics?format=json`)

Key Prometheus metrics to configure alerts against:
```promql
# Alert when database connection pool saturation exceeds 85%
swifttrack_pg_pool_saturation_ratio > 0.85

# Alert when outbox queue depth accumulates past 50 pending notifications
swifttrack_outbox_queue_depth > 50

# Alert when unresolved critical discrepancies exist in the Control Tower
swifttrack_control_tower_critical_exceptions > 0
```
