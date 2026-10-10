# SwiftTrack — Production Operations & Incident Runbook

**Version:** 1.0.0  
**Target Audience:** DevOps Engineers, Site Reliability Engineers (SRE), Platform Operations, Database Administrators (DBA)  
**System Scope:** Express.js API (`app`), PostgreSQL 16 Relational Engine (`postgres`), Asynchronous Notification Worker (`worker`)  

---

## Table of Contents

- [1. Service Architecture & SLA Commitments](#1-service-architecture--sla-commitments)
- [2. Pre-Flight Deployment Checklist](#2-pre-flight-deployment-checklist)
- [3. Database Operations & Migration Management](#3-database-operations--migration-management)
- [4. Backup Execution & Disaster Recovery Drill](#4-backup-execution--disaster-recovery-drill)
- [5. Asynchronous Worker & Outbox Management](#5-asynchronous-worker--outbox-management)
- [6. Incident Response Playbooks](#6-incident-response-playbooks)
  - [Playbook 1: Database Connection Pool Exhaustion](#playbook-1-database-connection-pool-exhaustion)
  - [Playbook 2: External SMS / Telecom Gateway Failure](#playbook-2-external-sms--telecom-gateway-failure)
  - [Playbook 3: Linehaul Corridor Delay / Vehicle Breakdown](#playbook-3-linehaul-corridor-delay--vehicle-breakdown)
  - [Playbook 4: Brute-Force Authentication Flood / Account Lockout](#playbook-4-brute-force-authentication-flood--account-lockout)
  - [Playbook 5: Offline Sync Conflict & Replay Anomalies](#playbook-5-offline-sync-conflict--replay-anomalies)
- [7. Routine Observability & Health Monitoring](#7-routine-observability--health-monitoring)

---

## 1. Service Architecture & SLA Commitments

### 1.1 Service Level Agreements (SLA)
- **Availability Target**: 99.9% uptime (~43.8 minutes unplanned downtime / month).
- **Recovery Point Objective (RPO)**: <= 15 minutes (Maximum tolerable data loss window).
- **Recovery Time Objective (RTO)**: <= 30 minutes (Maximum tolerable time to restore full service).

### 1.2 Core Production Services
| Service Container | Technology | Responsibilities | Health Probe |
| :--- | :--- | :--- | :--- |
| **`swifttrack_api`** | Node.js 22 Alpine / Express 5.2 | REST API, RBAC, static Vite frontend | `GET /api/v1/health` (HTTP 200) |
| **`swifttrack_postgres`** | PostgreSQL 16 Alpine | Authoritative relational state, 23 migrations | `pg_isready -U swifttrack_admin` |
| **`swifttrack_worker`** | Node.js 22 Alpine | Transactional outbox polling, SMS/Email retries | Heartbeat loop & queue depth query |

---

## 2. Pre-Flight Deployment Checklist

Before deploying a new release or promoting to production:
1. **Secret Entropy Validation**: Confirm `JWT_SECRET` is set to a cryptographically secure hex string of at least 64 characters. Reject default development strings.
2. **Database Engine Mode**: Verify `DB_CLIENT=postgres` in the target `.env`.
3. **CORS Origins**: Ensure `CORS_ORIGINS` contains only authorized production domains (e.g., `https://app.swifttrack.co.ke`).
4. **Automated Test Gate**: Confirm all 39 test suites pass:
   ```bash
   npm run test:all
   ```
5. **Client Production Build**: Compile the Vite client and ensure zero bundle errors:
   ```bash
   npm run build
   ```

---

## 3. Database Operations & Migration Management

### 3.1 Inspect Migration Status
To inspect currently applied vs pending PostgreSQL migrations:
```bash
npm run db:migrate:status
```
*Expected Output:*
```text
[MIGRATOR] Migration 001_initial_schema.sql: APPLIED
[MIGRATOR] Migration 002_logistics_core.sql: APPLIED
...
[MIGRATOR] Migration 023_retention_and_archival_policies.sql: APPLIED
All 23 migrations up to date.
```

### 3.2 Execute Pending Migrations
To apply new migrations transactionally:
```bash
npm run db:migrate
```
*Note:* The migrator runs each migration script inside an explicit `BEGIN ... COMMIT` block. If any migration statement fails, the entire transaction is rolled back cleanly.

### 3.3 Rollback Last Migration
In the event of an issue requiring immediate rollback:
```bash
npm run db:migrate:rollback
```

### 3.4 Monthly Partition Maintenance
Migration `022_partitioning_for_high_volume.sql` uses range partitioning for `tracking_events` and `audit_logs`. The automated monthly partition creator runs via cron or can be invoked manually:
```bash
node -e "require('./server/db/postgres/pool.js').query('SELECT create_monthly_partitions();')"
```

---

## 4. Backup Execution & Disaster Recovery Drill

### 4.1 On-Demand Database Snapshot Backup
SwiftTrack includes an automated snapshot backup utility that computes SHA-256 cryptographic integrity checksums:
```bash
npm run db:backup
```
*Artifacts Generated in `backups/`:*
- `backup-2026-09-30T08-00-00.db` (Database snapshot)
- `backup-2026-09-30T08-00-00.db.sha256` (Cryptographic verification hash)

### 4.2 Automated Retention Pruning
The backup engine preserves the latest 10 point-in-time snapshots and automatically prunes older files to prevent disk exhaustion.

### 4.3 Disaster Recovery Restore Drill (Mandatory Quarterly Procedure)
To execute a disaster recovery drill:
1. Verify SHA-256 hash integrity:
   ```bash
   sha256sum -c backups/backup-TARGET.db.sha256
   ```
2. Stop the API container:
   ```bash
   docker compose stop app worker
   ```
3. Restore the database snapshot:
   ```bash
   node server/db/backup.js --restore backups/backup-TARGET.db
   ```
4. Restart containers and verify health:
   ```bash
   docker compose start app worker
   curl -f http://localhost:4000/api/v1/health
   ```

---

## 5. Asynchronous Worker & Outbox Management

The background worker ([server/workers/notificationWorker.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/workers/notificationWorker.js)) continuously drains the `notification_outbox` table.

### 5.1 Inspect Outbox Queue Depth
```sql
SELECT status, COUNT(*) AS total_count 
FROM notification_outbox 
GROUP BY status;
```
*Healthy Status Profile:*
- `PENDING`: < 50 items (transient)
- `PROCESSING`: < 10 items
- `DELIVERED`: Majority of records
- `DEAD_LETTER`: 0 items

### 5.2 Investigate Dead Letters
If notifications fail after 5 exponential retries (`15s`, `30s`, `60s`, `120s`), they enter `DEAD_LETTER` status:
```sql
SELECT id, recipient, channel, retry_count, last_error, created_at 
FROM notification_outbox 
WHERE status = 'DEAD_LETTER' 
ORDER BY created_at DESC 
LIMIT 20;
```

### 5.3 Reset & Requeue Dead Letters
After resolving upstream provider issues:
```sql
UPDATE notification_outbox 
SET status = 'PENDING', retry_count = 0, next_attempt_at = NOW() 
WHERE status = 'DEAD_LETTER';
```

---

## 6. Incident Response Playbooks

### Playbook 1: Database Connection Pool Exhaustion
- **Symptom**: HTTP 500 errors, `/api/v1/health` reports `"database": "error"`, log entries show `Timeout: pool is full`.
- **Immediate Triage**:
  1. Inspect active connections:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```
  2. Identify long-running transactions:
     ```sql
     SELECT pid, now() - query_start AS duration, query 
     FROM pg_stat_activity 
     WHERE state = 'active' AND (now() - query_start) > interval '10 seconds';
     ```
  3. Terminate stuck backend process:
     ```sql
     SELECT pg_terminate_backend(<pid>);
     ```
  4. If load is legitimate, increase `PGPOOL_MAX` in `.env` (default is 25) and restart API.

### Playbook 2: External SMS / Telecom Gateway Failure
- **Symptom**: Notifications queue depth spikes; `last_error` shows `HTTP 502 Bad Gateway` from telecom provider.
- **Immediate Triage**:
  1. Check telecom provider status page (Africa's Talking / Twilio).
  2. Verify API credentials and account balance in `.env`.
  3. The transactional outbox pattern guarantees customer orders and state changes proceed without failure; notifications queue safely in the database.
  4. Once provider recovers, the background worker automatically resumes processing with exponential backoff.

### Playbook 3: Linehaul Corridor Delay / Vehicle Breakdown
- **Symptom**: Transport run overdue; Control Tower triggers `TRANSPORT_DELAY` or `VEHICLE_BREAKDOWN` alert.
- **Immediate Triage**:
  1. Open Operations Control Tower at `http://localhost:5173`.
  2. Locate the impacted transport run in the **Corridor Monitor**.
  3. Reassign cargo:
     - If the vehicle is disabled, update vehicle status to `MAINTENANCE`.
     - Create a replacement transport run with an available vehicle.
     - Move manifested shipments to the replacement manifest via `POST /api/v1/transport/manifests/:id/items`.
  4. Automated outbox triggers notify downstream destination hubs of revised ETAs.

### Playbook 4: Brute-Force Authentication Flood / Account Lockout
- **Symptom**: User receives `HTTP 423 Locked`; logs show rapid failed logins from a specific IP.
- **Immediate Triage**:
  1. Inspect the audit log for authentication anomalies:
     ```sql
     SELECT * FROM audit_logs 
     WHERE action = 'LOGIN_FAILURE' 
     ORDER BY created_at DESC LIMIT 50;
     ```
  2. The automated security middleware locks accounts for 15 minutes after 5 failures.
  3. If a legitimate staff member is locked out, an administrator can unlock the account via `usersRepository`:
     ```sql
     UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = '<username>';
     ```
  4. Block abusive IPs at the firewall or reverse proxy level.

### Playbook 5: Offline Sync Conflict & Replay Anomalies
- **Symptom**: Driver mobile app reports sync failure or cached response mismatch.
- **Immediate Triage**:
  1. Query `offline_sync_queue` for the driver's device ID:
     ```sql
     SELECT * FROM offline_sync_queue WHERE status = 'FAILED' ORDER BY created_at DESC;
     ```
  2. Verify that client-generated UUIDs are unique per operation.
  3. If the server already committed the operation, the server returns the cached response idempotently (`HTTP 200`).

---

## 7. Routine Observability & Health Monitoring

### 7.1 Health Check Endpoint
Query the live system health endpoint:
```bash
curl -s http://localhost:4000/api/v1/health | jq .
```
*Nominal Output:*
```json
{
  "status": "online",
  "database": "connected",
  "apiVersion": "v1.4.0",
  "system": "SwiftTrack Kenya Multi-Branch Logistics + POS",
  "uptimeSeconds": 84210,
  "timestamp": "2026-09-30T08:20:00.000Z"
}
```

### 7.2 Structured Container Logging
All server events output structured JSON or standard system telemetry to `stdout`. To tail live logs with container formatting:
```bash
docker compose logs -f --tail=100 app
```
