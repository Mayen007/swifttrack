# SwiftTrack — System Completion Backlog & Production Launch Plan

**Document Version:** 1.0.0  
**Target Completion:** 100% Production Launch Ready  
**Scope:** Backend, Frontend, External Gateways, Security Hardening, CI/CD, and Disaster Recovery  

---

## Executive Overview

SwiftTrack is currently at **~92% production readiness**. The core logistics state engine, 23 PostgreSQL migrations, multi-state inventory, POS shifts, role-based access control, and 16 regression test suites are fully implemented and verified against PostgreSQL 16.

To bring the platform to **100% launch readiness**, the remaining tasks are organized into **6 prioritized tracks**:

```mermaid
flowchart LR
    T1[Track 1: Security & Seed Hardening] --> T3[Track 3: CI & Test Completeness]
    T2[Track 2: Frontend Optimization] --> T4[Track 4: Offline PWA & Edge]
    T3 --> T5[Track 5: Real External Integrations]
    T4 --> T6[Track 6: Ops Tooling & Disaster Recovery]
    T5 --> LAUNCH([100% Production Launch])
    T6 --> LAUNCH
```

---

## Track 1: Security Hardening & Production Seed Lockdown (Priority: CRITICAL) [COMPLETED]

### Objective
Permanently eliminate all fallback secrets, isolate demo data from production database initialization, and mandate zero-knowledge administrative credential enrollment.

### Tasks
- [x] **1.1 Isolate Production Baseline from Demo Data**
  - **File:** [server/server.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/server.js#L140-L155) & [server/db/postgres/seed.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/seed.js#L1150-L1280)
  - **Action:** Refactored `seedProductionBaseline()` so that in `NODE_ENV=production` or `--prod`, it strictly invokes `seedProductionFoundation()` seeding only company profile, 4 regional hubs, 5 hub warehouses, and 5-role/40-permission RBAC matrix.
  - **Status:** Complete. Zero demo accounts, vehicles, drivers, or mock shipments in production.
- [x] **1.2 Mandate Admin CLI Bootstrap for Production Setup**
  - **File:** [scripts/bootstrap-admin.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/scripts/bootstrap-admin.js)
  - **Action:** Production setup requires `npm run admin:bootstrap`, generating secure admin credentials with `must_change_password = true`.
  - **Status:** Complete.
- [x] **1.3 Purge Fallback Secrets from Container Configurations**
  - **File:** [docker-compose.yml](file:///c:/Users/ariic/Documents/Logistics%20Platform/docker-compose.yml#L17-L74) & [server/utils/env.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/utils/env.js#L5-L20)
  - **Action:** Replaced fallback strings with mandatory variable enforcement (`${PGPASSWORD:?...}`, `${JWT_SECRET:?...}`). Added insecure fallback keys to `KNOWN_INSECURE_SECRETS` which terminates production startup if detected.
  - **Status:** Complete.
- [x] **1.4 Implement Two-Stage Liveness & Readiness Probes**
  - **File:** [server/routes/v1/index.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/routes/v1/index.js#L15-L65) & [server/server.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/server.js#L59-L93)
  - **Endpoints:**
    - `GET /health/live` & `GET /live`: Lightweight process ping (`200 OK`).
    - `GET /health/ready` & `GET /ready` & `GET /health`: Deep probe checking PostgreSQL connection pool health and latency. Returns `503` if unready.
  - **Status:** Complete.

---

## Track 2: Frontend Performance & Code-Splitting (Priority: HIGH) [COMPLETED]

### Objective
Eliminate the monolithic 1.54 MB main bundle by introducing asynchronous view-level code splitting with `React.lazy()` and suspense boundaries.

### Tasks
- [x] **2.1 Implement Route-Level Lazy Loading**
  - **File:** [client/src/App.jsx](file:///c:/Users/ariic/Documents/Logistics%20Platform/client/src/App.jsx#L14-L38)
  - **Action:** Converted all 23 static view imports + `LoginView` into dynamic `React.lazy()` named-export imports.
  - **Status:** Complete.
- [x] **2.2 Create Obsidian Loading Skeleton Component**
  - **File:** [client/src/components/common/ViewSkeleton.jsx](file:///c:/Users/ariic/Documents/Logistics%20Platform/client/src/components/common/ViewSkeleton.jsx)
  - **Action:** Created high-fidelity Dieter Rams / Matte Obsidian skeleton loader with pulsing status ping, KPI metric cards, filter row, and 6 animated matrix rows.
  - **Status:** Complete.
- [x] **2.3 Wrap Main View Router with ErrorBoundary & Suspense**
  - **File:** [client/src/App.jsx](file:///c:/Users/ariic/Documents/Logistics%20Platform/client/src/App.jsx#L305-L315) & [client/src/App.jsx](file:///c:/Users/ariic/Documents/Logistics%20Platform/client/src/App.jsx#L418-L425)
  - **Action:** Wrapped both `<LoginView />` and active workspace `{renderView()}` inside `<Suspense fallback={<ViewSkeleton view={currentView} />}>` nested inside the top-level `<ErrorBoundary>`.
  - **Status:** Complete.
- [x] **2.4 Verify Production Vite Build Output**
  - **Target:** All 24 route-level components isolated into on-demand asynchronous chunks, drastically cutting initial load time.
  - **Status:** Complete.

---

## Track 3: CI/CD Pipeline & Test Suite Completeness (Priority: HIGH)

### Objective
Unify all operational domain test suites under the single authoritative test command and enforce automated regression and architecture linting on every pull request.

### Tasks
- [ ] **3.1 Integrate Unlinked Test Suites into `package.json`**
  - **File:** [package.json](file:///c:/Users/ariic/Documents/Logistics%20Platform/package.json#L24)
  - **Action:** Add newly developed test suites to `test:all`:
    - `tests/inventory/test-inventory-states.js`
    - `tests/inventory/test-inventory-operations.js`
    - `tests/inventory/test-advanced-inventory.js`
    - `tests/pos/test-complete-pos-workflow.js`
    - `tests/orders/test-orders-engine.js`
    - `tests/logistics/test-pos-counter-booking.js`
    - `tests/commerce/test-catalog-variants.js`
    - `tests/commerce/test-pricing-engine.js`
    - `tests/customers/test-customer-management.js`
    - `tests/procurement/test-procurement-lifecycle.js`
    - `tests/reports/test-reports-engine.js`
- [ ] **3.2 Add Architecture Linting Gate to GitHub Actions**
  - **File:** [.github/workflows/ci.yml](file:///c:/Users/ariic/Documents/Logistics%20Platform/.github/workflows/ci.yml)
  - **Action:** Add `npm run lint:architecture` before running database tests to immediately catch any direct SQLite driver or query bypasses.
- [ ] **3.3 Configure Automated Test Database Migration Tear-Down**
  - **Action:** Ensure CI runs clean migration up, verification, and automated cleanup between test stages to prevent cross-suite database pollution.

---

## Track 4: Real External Rails & Production Gateways (Priority: MEDIUM / EXTERNAL)

### Objective
Transition payment, notification, and customs submodules from high-fidelity internal simulators to live production gateway adapters.

### Tasks
- [ ] **4.1 Safaricom Daraja 2.0 Live Payment Gateway Activation**
  - **File:** [server/services/darajaService.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/services/darajaService.js)
  - **Deliverables:**
    - Live Daraja OAuth authentication against `https://api.safaricom.co.ke`.
    - Production STK Push endpoint activation with business Paybill / Till shortcode passkey.
    - Webhook SSL mutual handshake and IP whitelist filter for Safaricom callback servers.
    - Automated reconciliation worker reconciling Daraja daily settlement statements against `payment_callbacks`.
- [ ] **4.2 Africa's Talking / Twilio Live SMS & WhatsApp Gateway**
  - **File:** [server/services/notificationService.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/services/notificationService.js#L259-L280)
  - **Deliverables:**
    - Live HTTPS client calling Africa's Talking SMS API (`POST /version1/messaging`).
    - Alphanumeric Sender ID support (`SWIFTTRACK`).
    - Inbound Delivery Report (DLR) webhook route (`POST /api/v1/notifications/dlr`) updating `notification_logs` with final telco carrier delivery status (`DELIVRD`, `UNDELIV`, `REJECTD`).
- [ ] **4.3 East African Community (EAC) Customs Manifest Export**
  - **File:** [server/services/e2eAcceptanceService.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/services/e2eAcceptanceService.js)
  - **Deliverables:**
    - Export standardized cross-border road manifest data matching the Kenya Revenue Authority (KRA) TradeNet / ASYCUDA XML specification for regional transit corridors (Malaba, Busia, Namanga).

---

## Track 5: Field Operations Offline Edge & PWA (Priority: MEDIUM)

### Objective
Ensure courier drivers and hub loading bay operators can perform uninterrupted barcode scans, intake, and POD signatures in areas with poor or intermittent network connectivity.

### Tasks
- [ ] **5.1 Client-Side Offline Queue Persistence (IndexedDB)**
  - **File:** `client/src/services/offlineQueue.js` (New)
  - **Action:** Intercept field operations when `navigator.onLine === false`:
    - `CUSTODY_SCAN`, `HUB_RECEIVE`, `DELIVERY_ATTEMPT`, `DELIVERY_POD`, `DRIVER_LOCATION`.
    - Assign client-generated RFC 4122 v4 UUIDs for idempotent deduplication.
    - Store operations locally in IndexedDB until connectivity is re-established.
- [ ] **5.2 Auto-Replay & Conflict Resolution Sync Worker**
  - **File:** Connect `client/src/services/offlineQueue.js` to [server/services/offlineSyncService.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/services/offlineSyncService.js).
  - **Action:** On network restoration, replay queued actions in FIFO order, handle server conflict responses (e.g., parcel already delivered or reassigned), and update the local UI.

---

## Track 6: Disaster Recovery, Backups & Operational Runbooks (Priority: MEDIUM)

### Objective
Guarantee business continuity with automated point-in-time PostgreSQL backup routines and clear operator incident recovery playbooks.

### Tasks
- [ ] **6.1 Production Point-in-Time Database Backup Automation**
  - **File:** [server/db/backup.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/backup.js) & `scripts/backup-postgres.sh`
  - **Action:** Configure scheduled cron job taking daily compressed `pg_dump` snapshots with SHA-256 integrity checksums and 30-day retention pruning.
- [ ] **6.2 Automated Database Recovery Drill & Verification**
  - **File:** `scripts/restore-postgres.sh` (New)
  - **Action:** Document and script the recovery procedure:
    1. Drop / clean target database.
    2. Restore snapshot with `pg_restore`.
    3. Run `node tests/database/test-postgres-data-architecture.js` to certify zero structural loss.
- [ ] **6.3 System Monitoring & Metrics Endpoint**
  - **File:** [server/server.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/server.js)
  - **Action:** Add Prometheus-compatible metrics endpoint (`GET /metrics` or `/api/v1/metrics`) reporting:
    - Active PostgreSQL connection pool saturation (`pgPool.totalCount`, `pgPool.idleCount`, `pgPool.waitingCount`).
    - Notification outbox queue depth & retry counts.
    - Control Tower active exception counts.

---

## Verification & Completion Roadmap Summary

| Sprint / Phase | Focus Area | Success Metric | Gate Check |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Security & Seed Hardening | Zero default passwords in prod; clean baseline seed | `npm run db:reset:prod` produces no demo users |
| **Sprint 2** | Frontend Code-Splitting | Main bundle < 250 kB; instant route navigation | `cd client && npm run build` chunk analysis |
| **Sprint 3** | CI Pipeline Consolidation | 25+ suites green against PostgreSQL 16 | GitHub Actions CI exit code 0 |
| **Sprint 4** | Real Gateway Connectivity | Live Safaricom STK Push & SMS DLR receipt | Verified test transaction on live telco rail |
| **Sprint 5** | Disaster Recovery Drill | Database dump restored cleanly in < 3 minutes | `restore-postgres.sh` passed data audit |
