# SwiftTrack — Production Remediation & Architectural Convergence Roadmap
**Document Status:** Master Implementation & Execution Roadmap  
**Target Architecture:** Express 5.2 · Node 22+ · PostgreSQL 16 (Authoritative) · React 18 / Vite 6 · Docker / GitHub Actions CI  
**Governing Mandate:** `swifttrack-production-remediation-master-prompt.md`

---

## Executive Summary & Guiding Mandate

This roadmap operationalizes the **50 implementation mandates** of the SwiftTrack Production Remediation Master Prompt into a sequenced, deterministic, and verifiable execution plan.

The overarching objective is **architectural and operational convergence**:
> **One authoritative PostgreSQL runtime, one authoritative migration engine, one canonical shipment state machine, one real PostgreSQL CI pipeline, zero universal default credentials, and zero synthetic metrics presented as production reality.**

```mermaid
flowchart TD
    P0[Phase 0: Static Analysis & Guardrails] --> P1[Phase 1: DB & Migration Convergence]
    P1 --> P2[Phase 2: Repository Layer & SQLite Purge]
    P2 --> P3[Phase 3: Security & Session Hardening]
    P3 --> P4[Phase 4: Logistics Domain & State Machine]
    P4 --> P5[Phase 5: Integrations & Telemetry Reality]
    P5 --> P6[Phase 6: Branch Isolation & Offline Sync]
    P6 --> P7[Phase 7: PostgreSQL CI & E2E Test Suite]
    P7 --> P8[Phase 8: Docker, Health Probes & DR]
    P8 --> P9[Phase 9: Docs & Evidence-Based Attestation]
```

---

## Core Convergence Principles

1. **No Silent SQLite Fallbacks in Production**: If `NODE_ENV=production` and `DATABASE_URL` is missing or invalid, the server must fail fast and terminate immediately.
2. **Strict Layer Boundary**: HTTP Routes & Controllers $\to$ Domain Services $\to$ Repositories $\to$ DB Adapter (`pg`) $\to$ PostgreSQL. No direct database queries in routes or services.
3. **No Synthetic Truths**: Real database-driven metrics only. No fake 100% certifications, no mocked E2E passing steps, and no simulated payment callbacks paraded as live transactions.
4. **Deterministic Environments**: Separate schemas and seeds cleanly across Production Bootstrap, Demo Simulation, and Automated Test Fixtures.
5. **Failures as Signals**: Do not loosen test assertions, comment out tests, or skip failing steps. Trace every failure to its underlying root cause.

---

## Phase 0: Baseline Audit, Static Guardrails & Inventory

### Objective
Establish an automated baseline of all architectural violations, direct SQLite calls, insecure credentials, and test failures before modifying production logic.

### Affected Modules & Files
- `server/server.js`
- `server/db/database.js`, `server/db/dbAdapter.js`, `server/db/index.js`
- `server/routes/**/*.js`
- `server/services/**/*.js`
- `tests/**/*.js`
- `scripts/`

### Work Packages

#### 0.1 Architectural Violation & SQLite Static Scanner
- [ ] Create a static linting/analysis script `scripts/verify-architecture-rules.js` that inspects the AST or regex for:
  - Any direct import of `server/db/database.js` outside `server/db/index.js` or `server/db/dbAdapter.js`.
  - Any usage of `better-sqlite3`, `sqliteDb.prepare`, `.run(`, `.get(`, `.all(`.
  - Any direct database calls inside `server/routes/**` or `server/services/**` (bypassing repositories).
- [ ] Add `npm run lint:architecture` to `package.json`.

#### 0.2 Credential & Secret Audit
- [ ] Inventory all instances of `Password123!`, default JWT secrets (`swifttrack_jwt_production_secret...`), and static encryption keys across `server/`, `client/`, and `tests/`.
- [ ] Categorize each into:
  - Runtime production vulnerability (must be replaced with secure bootstrap).
  - Client mock/demo autofill (must be disabled when `NODE_ENV=production`).
  - Test fixture credential (must be isolated strictly to test environments).

#### 0.3 Test Suite Baseline Inventory
- [ ] Run and document current test status across all suites:
  - `npm test`
  - `npm run test:e2e`
  - `npm run test:all`
- [ ] Log exact stack traces of failing tests (e.g., E2E Stage 10 foreign-key / SQLite errors).

### Verification & Exit Criteria
```bash
node scripts/verify-architecture-rules.js
# Produces comprehensive list of 45+ files requiring repository refactoring
```

---

## Phase 1: Authoritative PostgreSQL Database & Migration Engine

### Objective
Make PostgreSQL the sole authoritative runtime database engine. Eliminate the dual-engine ambiguity and ensure deterministic, checksummed migration runs.

### Affected Modules & Files
- `server/server.js`
- `server/utils/env.js`
- `server/db/index.js`
- `server/db/dbAdapter.js`
- `server/db/postgres/migrator.js`
- `server/db/postgres/pool.js`
- `server/db/postgres/migrations/*.sql`
- `docker-compose.yml`

### Work Packages

#### 1.1 Fail-Safe Startup & Explicit Database Selection
- [ ] Update `server/utils/env.js`:
  - When `NODE_ENV === 'production'`, require `DB_CLIENT=postgres` and a valid `DATABASE_URL`.
  - Explicitly reject `DB_CLIENT=sqlite` in production; throw a fatal startup error and exit with code 1.
  - Require cryptographically secure `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `ENCRYPTION_KEY` in production.
- [ ] Refactor `server/server.js` startup sequence:
  1. `validateStartupEnv()`
  2. `pool.getPool()` & verify connectivity (`SELECT 1`)
  3. Run / verify PostgreSQL migrations via `migrator.js`
  4. Run production baseline bootstrap (if empty schema)
  5. Initialize workers (`notificationWorker`)
  6. Listen on `PORT`
  7. Remove legacy `initSchema()` calls from `server.js`.

#### 1.2 Unify Migration Authority
- [ ] In `docker-compose.yml`, remove any automatic execution of SQL files from `/docker-entrypoint-initdb.d` that bypasses migration tracking.
- [ ] Upgrade `server/db/postgres/migrator.js`:
  - Enforce transactional execution (`BEGIN` ... `COMMIT` per migration script).
  - Calculate SHA-256 checksums for each migration file and verify against `schema_migrations` table to detect file tampering.
  - Implement reliable rollback commands for all 23 migrations (`001_initial_schema.sql` through `023_logistics_notifications_engine.sql`).
  - Add schema compatibility verification on app boot (`migrator.verifySchemaCompatibility()`).

#### 1.3 Clean Database Migration & Seed Test Cycle
- [ ] Add scripts in `package.json` for deterministic local PostgreSQL lifecycle:
  - `npm run db:pg:migrate`
  - `npm run db:pg:status`
  - `npm run db:pg:rollback`
  - `npm run db:pg:verify`
- [ ] Ensure migration cycle works identically on an empty PostgreSQL database:
  `empty DB -> migrate -> seed -> verify -> migrate again (idempotent no-op)`.

### Verification & Exit Criteria
```bash
# Verify startup rejection on invalid configuration
NODE_ENV=production DB_CLIENT=sqlite node server/server.js # Must exit with code 1

# Verify migration idempotency on PostgreSQL
npm run db:migrate
npm run db:migrate:status
```

---

## Phase 2: Repository Layer Unification & SQLite Runtime Purge

### Objective
Migrate all business and route persistence from direct SQLite access into async domain repositories backed by `dbAdapter.js` and PostgreSQL.

### Affected Modules & Files
- `server/repositories/*.js` (create missing repositories)
- `server/services/*.js` (24 domain services)
- `server/routes/**/*.js` (40+ route handlers)
- `server/middleware/auth.js`, `server/middleware/audit.js`

### Work Packages

#### 2.1 Complete the Domain Repository Registry
- [ ] Audit `server/repositories/index.js` and ensure all domain entities have dedicated repositories:
  - `shipmentRepository.js`
  - `parcelRepository.js` (extract from shipmentRepository)
  - `transportRepository.js`
  - `manifestRepository.js`
  - `custodyRepository.js`
  - `hubRepository.js`
  - `deliveryRepository.js`
  - `codRepository.js`
  - `driverRepository.js`
  - `vehicleRepository.js`
  - `userRepository.js` *(new)*
  - `sessionRepository.js` *(new)*
  - `branchRepository.js` *(new)*
  - `customerRepository.js` *(new)*
  - `notificationRepository.js`
  - `idempotencyRepository.js` *(new)*
- [ ] Remove synchronous `findByIdSync` / `findByTrackingNumberSync` methods from all repositories. All persistence must be asynchronous (`async/await`) using parameterized SQL compatible with PostgreSQL `$1, $2` and unified via `dbAdapter.js`.

#### 2.2 Refactor Authentication, Sessions & Audit to Repositories
- [ ] Refactor `server/middleware/auth.js`:
  - Replace direct `db.prepare('SELECT * FROM users WHERE id = ?').get(...)` with `userRepository.findById(id)`.
  - Replace session and token lookup with `sessionRepository.findActiveSession(tokenHash)`.
- [ ] Refactor `server/middleware/audit.js`:
  - Route all audit logging asynchronously to `auditRepository.logSecurityEvent(...)`.

#### 2.3 Refactor Logistics Domain Services
- [ ] Audit each service and remove `require('../db/database.js')`:
  - `server/services/shipmentService.js`
  - `server/services/transportService.js`
  - `server/services/custodyService.js`
  - `server/services/deliveryExecutionService.js`
  - `server/services/counterBookingService.js`
  - `server/services/codService.js`
  - `server/services/controlTowerService.js`
  - `server/services/e2eAcceptanceService.js`
- [ ] Ensure all service database interactions pass through domain repositories and accept optional transaction clients (`tx`).

#### 2.4 Refactor HTTP Route Handlers
- [ ] Review all route files in `server/routes/`:
  - Disallow direct database queries in route files.
  - Routes must only validate input, call domain services / repositories, and return standard API responses via `res.apiSuccess` or `res.apiError`.

### Verification & Exit Criteria
```bash
# Architecture rule check must pass with 0 direct SQLite runtime imports
node scripts/verify-architecture-rules.js
# Returns: PASS - Zero unauthorized database imports found in routes or services.
```

---

## Phase 3: Security Hardening, Credential Decoupling & Persistent State

### Objective
Eliminate universal credentials, secure authentication tokens against leakage, replace in-memory security structures with persistent storage, and synchronize security headers.

### Affected Modules & Files
- `server/routes/auth.js`
- `server/middleware/security.js`
- `server/middleware/idempotency.js`
- `server/db/postgres/migrations/024_durable_security_and_idempotency.sql` *(new)*
- `client/src/services/api.js`
- `client/src/views/LoginView.jsx`, `client/src/context/AuthContext.jsx`

### Work Packages

#### 3.1 Secure Production Bootstrap & Eliminate `Password123!`
- [ ] Implement a secure administrative bootstrap command: `node scripts/bootstrap-admin.js`:
  - Generates a cryptographically strong 16+ character password using `crypto.randomBytes`.
  - Or accepts an explicit environment variable `ADMIN_INITIAL_PASSWORD`.
  - Sets `must_change_password = true` in PostgreSQL.
- [ ] In `server/db/seed.js` and `server/routes/auth.js`:
  - Completely remove `const defaultPassword = 'Password123!'` from production code paths.
  - Restrict default demo credentials strictly to `DEMO_MODE=true` and non-production environments.
- [ ] In `client/src/views/LoginView.jsx` and `AuthContext.jsx`:
  - Strip pre-filled `Password123!` in production builds (`import.meta.env.PROD`).

#### 3.2 Remove Authentication Tokens from URLs
- [ ] Inspect `client/src/services/api.js` and all callback endpoints:
  - Remove all query parameter token passing (`?token=...`, `?access_token=...`).
  - Migrate token distribution to HTTP `Authorization: Bearer <token>` headers and `HttpOnly`, `SameSite=Strict`, `Secure` cookies for refresh tokens.
  - Ensure password reset, invitation, and magic link endpoints use short-lived, single-use, hashed verification tokens verified via POST request body.

#### 3.3 Durable PostgreSQL Idempotency & Distributed Rate Limiting
- [ ] Create migration `024_durable_security_and_idempotency.sql`:
  - `idempotency_keys` table (`idempotency_key`, `scope`, `request_hash`, `status`, `response_status`, `response_body`, `expires_at`, `created_at`).
  - `rate_limit_buckets` table for persistent IP / user token buckets.
- [ ] Refactor `server/middleware/idempotency.js`:
  - Replace in-memory `new Map()` with database-backed atomic reservations (`INSERT ... ON CONFLICT`).
  - Handle concurrent duplicate requests with `409 Conflict` or pending polling.
  - Automatically enforce idempotency for booking, shipment creation, payments, refunds, and COD settlements.
- [ ] Refactor `server/middleware/security.js` rate limiting:
  - Support PostgreSQL or Redis storage store so restarts and multiple instances maintain limit state.

#### 3.4 Security Header & CSP Convergence
- [ ] Align `server/middleware/security.js` with documented policy:
  - Reconcile `X-Frame-Options` (`DENY` vs `SAMEORIGIN`) across docs and headers.
  - Enforce Content Security Policy (CSP) with nonces for scripts/styles in production; eliminate undocumented `'unsafe-inline'`.
  - Configure HSTS (`max-age=31536000; includeSubDomains; preload`).

### Verification & Exit Criteria
```bash
# Run security test suite against PostgreSQL
node tests/security/test-sql-injection.js
node tests/security/test-csrf-cors.js
node tests/security/test-xss.js
node tests/security/test-idempotency-durability.js
```

---

## Phase 4: Canonical Logistics State Machine & Transactional Invariants

### Objective
Unify shipment status vocabulary, enforce strict transition rules, guarantee multi-step database transactions, and eliminate race conditions in the physical custody chain.

### Affected Modules & Files
- `server/services/shipmentService.js`
- `server/services/deliveryExecutionService.js`
- `server/services/transportService.js`
- `server/services/custodyService.js`
- `server/services/counterBookingService.js`
- `server/db/postgres/migrations/025_state_machine_and_invariants.sql` *(new)*

### Work Packages

#### 4.1 Canonical Shipment Status Standardization
- [ ] Audit all occurrences of shipment statuses across backend and frontend.
- [ ] Resolve synonyms:
  - Standardize on `DELIVERY_FAILED` as the official terminal/attempt status; deprecate `FAILED_DELIVERY`.
  - Maintain an operational `delivery_attempts` table recording the attempt number, timestamp, driver ID, reason code, and GPS coordinates.
- [ ] Create `server/services/shipmentStateMachine.js`:
  - Formally define the directed acyclic graph (DAG) of valid transitions:
    `BOOKED -> RECEIVED_AT_ORIGIN_HUB -> MANIFESTED -> IN_TRANSIT -> ARRIVED_AT_DESTINATION_HUB -> OUT_FOR_DELIVERY -> DELIVERED (or DELIVERY_FAILED -> RETURN_TO_SENDER)`.
  - Enforce transitions via atomic checks; reject and log any invalid transition attempt (e.g. jumping from `BOOKED` directly to `DELIVERED`).

#### 4.2 Multi-Step Transactional Boundaries
- [ ] Wrap critical multi-entity operations inside PostgreSQL database transactions (`dbAdapter.withTransaction`):
  - **Counter Booking**: Create shipment + parcels + initial leg + tracking event + outbox notification.
  - **Manifest Lock & Loading**: Verify vehicle capacity + assign parcels to manifest + advance legs to `IN_TRANSIT` + log custody transfer.
  - **Hub Intake & Transshipment**: Verify scan barcode + reconcile against manifest + record hub custody + advance routing leg.
  - **Last-Mile Proof of Delivery**: Validate OTP / signature / GPS + mark shipment `DELIVERED` + generate COD collection entry (if applicable) + emit tracking event.
- [ ] Add database check constraints in PostgreSQL for:
  - Positive package weights and dimensions.
  - Valid status enum values.
  - Currency codes (`KES`, `USD`, `EUR`).
  - Consistent hub and branch references.

#### 4.3 Elimination of Hardcoded Entities
- [ ] Search and replace hardcoded IDs (`branch_id = 4`, `hub_id = 1`, `hub_id = 4`, etc.) in business logic.
- [ ] Resolve hubs and branches dynamically from authenticated user context, route templates, or lookup codes.

### Verification & Exit Criteria
```bash
node tests/logistics/test-shipments-core.js
node tests/logistics/test-physical-custody.js
node tests/logistics/test-last-mile-delivery.js
```

---

## Phase 5: External Integrations & Telemetry Reality

### Objective
Clearly delineate SIMULATED, SANDBOX, and PRODUCTION modes for M-Pesa / Daraja and notifications; ensure Control Tower metrics are backed by authoritative SQL data rather than synthetic fabrications.

### Affected Modules & Files
- `server/routes/kenya.js`
- `server/services/paymentService.js`
- `server/services/notificationService.js`
- `server/workers/notificationWorker.js`
- `server/services/controlTowerService.js`

### Work Packages

#### 5.1 M-Pesa / Daraja API Reality
- [ ] Refactor `server/routes/kenya.js` & `server/services/paymentService.js`:
  - Explicitly declare integration mode: `MPESA_MODE = 'SIMULATED' | 'SANDBOX' | 'PRODUCTION'`.
  - When in `SIMULATED` mode, responses and logs must clearly state `[SIMULATED - NON-PRODUCTION]`.
  - Implement full Safaricom Daraja STK Push, Callback verification, and C2B validation with cryptographically verified signatures.
  - Make payment callback handling idempotent using transaction receipt number (`MpesaReceiptNumber`).
  - In `PROD-READINESS.md`, mark M-Pesa as `PARTIAL / SANDBOX` until live commercial production credentials are authenticated.

#### 5.2 Outbox Pattern & Notification Worker
- [ ] Strengthen `server/workers/notificationWorker.js`:
  - Polling transactional `notification_outbox` table in PostgreSQL.
  - Exponential backoff retry with maximum attempts (e.g. 5 retries).
  - Dead-letter queue (`status = 'DEAD_LETTER'`) for permanently failing dispatches.
  - Multi-provider support (SMS via Africa's Talking / Twilio, Email via SendGrid, WhatsApp via Meta Cloud API, or Explicit Simulation).
  - Accurate metrics: Never report 100% delivery KPI if 0 messages were sent. Output `NO_DATA` when sample size is zero.

#### 5.3 Control Tower Telemetry Integrity
- [ ] Audit `server/services/controlTowerService.js`:
  - Replace any mock data generation with live aggregate PostgreSQL queries:
    - Active linehaul transports (`transport_runs WHERE status = 'IN_TRANSIT'`).
    - Delayed runs (actual departure/arrival past scheduled ETA).
    - Hub congestion (parcels currently in custody at hub vs storage capacity).
    - Exception counts (`scan_events WHERE has_discrepancy = true`).
    - Unreconciled COD float balances.
  - Provide distinct indicators for real telemetry vs demo data.

### Verification & Exit Criteria
```bash
node tests/logistics/test-notifications-engine.js
node tests/logistics/test-control-tower.js
node tests/logistics/test-cod-settlement.js
```

---

## Phase 6: Multi-Branch Isolation & Offline Synchronization

### Objective
Guarantee cryptographic and SQL-level tenant isolation across branches; validate offline client sync conflict resolution and replay protection.

### Affected Modules & Files
- `server/middleware/auth.js`
- `server/services/offlineSyncService.js`
- `server/repositories/*.js`
- `client/src/context/AuthContext.jsx`

### Work Packages

#### 6.1 Strict Branch & Tenant Isolation
- [ ] Audit all queries across `server/repositories/`:
  - For non-`SUPER_ADMIN` users, enforce `WHERE branch_id = $n` or `WHERE hub_id IN (authorized_hubs)`.
  - Prevent branch managers or cashiers from reading or mutating other branches' shipments, financial registers, or audit logs.
- [ ] Write integration test `tests/security/test-branch-isolation.js`:
  - Branch A user attempts to fetch Branch B shipment $\to$ `403 Forbidden` or `404 Not Found`.
  - Branch A user attempts to mutate Branch B shipment $\to$ rejected.

#### 6.2 Offline-First Synchronization & Replay Protection
- [ ] Audit `server/services/offlineSyncService.js`:
  - Support operation types: `SCAN`, `CUSTODY_HANDOFF`, `HUB_RECEIVE`, `DELIVERY_ATTEMPT`, `DELIVERY_POD`, `DRIVER_LOCATION`.
  - Store incoming client UUIDs for deduplication. Replays of previously acknowledged sync items must return existing success idempotently.
  - Conflict resolution policy: Server physical custody state takes precedence if timestamp order is violated; record conflict in `sync_conflicts` table.
- [ ] Verify client IndexedDB queue replay resilience upon network reconnection.

### Verification & Exit Criteria
```bash
node tests/security/test-branch-isolation.js
node tests/logistics/test-offline-sync.js
```

---

## Phase 7: PostgreSQL-Native CI/CD Pipeline & E2E Test Suite Stabilization

### Objective
Update GitHub Actions to provision a real PostgreSQL service container, fix the Stage 10 multi-leg E2E acceptance test, and segment the test suite deterministically.

### Affected Modules & Files
- `.github/workflows/ci.yml`
- `package.json`
- `tests/logistics/test-e2e-acceptance.js`
- `server/services/e2eAcceptanceService.js`
- `tests/database/test-postgres-data-architecture.js`

### Work Packages

#### 7.1 Provision PostgreSQL in GitHub Actions
- [ ] Update `.github/workflows/ci.yml`:
  - Add `postgres:16` service container with healthy readiness checks.
  - Set environment:
    ```yaml
    env:
      NODE_ENV: test
      DB_CLIENT: postgres
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/swifttrack_test
    ```
  - Sequence: Checkout $\to$ Node 22 setup $\to$ npm ci $\to$ Postgres wait $\to$ `npm run db:migrate` $\to$ Test suites.
  - Remove `npm run db:seed:prod` (SQLite seed) from the CI pipeline!

#### 7.2 Fix the 23-Step Multi-Leg E2E Acceptance Test
- [ ] Refactor `tests/logistics/test-e2e-acceptance.js`:
  - Remove direct SQLite `const { db } = require('../../server/db/database.js')`.
  - Ensure the test suite connects to PostgreSQL via `dbAdapter.js` and repositories.
  - Fix Foreign Key hierarchy in fixture setup:
    `Company -> Branches (Nairobi, Mombasa, Nakuru) -> Hubs -> Users -> Routes -> Vehicles -> Drivers -> Shipment -> Legs -> Manifests -> Custody Events`.
  - Execute all 23 PRD Section 30 steps cleanly without foreign key violations.

#### 7.3 Clear Test Suite Segmentation in `package.json`
- [ ] Structure test scripts deterministically:
  - `npm run test:unit`: In-memory isolated unit tests.
  - `npm run test:database`: PostgreSQL migrations, pooling, and repository integration.
  - `npm run test:logistics`: Core domain tests (shipments, transport, custody, last-mile, COD).
  - `npm run test:security`: SQL injection, CSRF, XSS, branch isolation, and idempotency.
  - `npm run test:e2e`: Full 23-step multi-leg journey.
  - `npm run test:all`: Executes the complete verification pyramid and outputs a machine-readable summary.

### Verification & Exit Criteria
```bash
# Execute segmented test passes against PostgreSQL
npm run test:database
npm run test:logistics
npm run test:security
npm run test:e2e
npm run test:all
# All suites exit with code 0 under PostgreSQL
```

---

## Phase 8: Production Dockerization, Health Probes & Disaster Recovery

### Objective
Ensure clean-checkout Docker builds, eliminate fallback secrets from docker-compose, implement two-stage health checks, and validate backup/recovery procedures.

### Affected Modules & Files
- `Dockerfile`
- `docker-compose.yml`
- `server/routes/v1/index.js`
- `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` *(new)*

### Work Packages

#### 8.1 Dockerfile Clean-Checkout Reliability
- [ ] Review `Dockerfile`:
  - Ensure multi-stage build cleanly handles client Vite build and server node dependencies.
  - Eliminate any `COPY` references to missing local directories.
  - Run container as non-root user (`USER node`).

#### 8.2 Docker Compose Hardening
- [ ] Review `docker-compose.yml`:
  - Remove hardcoded default passwords like `super_secure_pg_password_2026`.
  - Require environment variables from `.env` or Docker secrets with validation.
  - Add named volumes for PostgreSQL data persistence (`pgdata`).

#### 8.3 Two-Stage Health Checks (`/health/live` & `/health/ready`)
- [ ] Implement endpoints:
  - `GET /health/live`: Returns `200 OK` if the Node HTTP process is listening.
  - `GET /health/ready`: Checks PostgreSQL database connection (`SELECT 1`), pending migration status, and notification worker health. Returns `503 Service Unavailable` if database is down or migrations are pending.

#### 8.4 Disaster Recovery Drill (Backup & Restore)
- [ ] Create and verify `scripts/backup-postgres.sh` and `scripts/restore-postgres.sh`.
- [ ] Execute automated recovery drill:
  1. Take `pg_dump` of populated database.
  2. Drop database and recreate clean database.
  3. Restore dump using `pg_restore`.
  4. Run application verification test to confirm zero data loss.

### Verification & Exit Criteria
```bash
docker compose config # Validates syntax and secret injection
curl -f http://localhost:4000/health/ready # Returns 200 with DB status OK
```

---

## Phase 9: Documentation Convergence & Evidence-Based Attestation

### Objective
Synchronize all documentation with actual code reality, delete obsolete migration references, and replace fictional "100% / 39 of 39" claims with an empirical, reproducible production readiness matrix.

### Affected Modules & Files
- `README.md`
- `PROD-READINESS.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/RUNBOOK.md`
- `tests/production-readiness-certification.json`

### Work Packages

#### 9.1 Documentation Synchronization
- [ ] Update `README.md`:
  - Accurately describe PostgreSQL 16 as the sole production runtime database.
  - Document the unified migration workflow (`npm run db:migrate`).
  - Provide accurate local development and production deployment instructions.
- [ ] Update `docs/ARCHITECTURE.md` & `docs/API.md`:
  - Align diagrams and text to the 4-tier repository pattern.
  - Remove stale SQLite references and obsolete route endpoints.

#### 9.2 Evidence-Based Production Readiness Attestation
- [ ] Rewrite `PROD-READINESS.md`:
  - Replace the static declaration `CERTIFIED PRODUCTION-READY (Phases 1–8 Compliant)` with a dynamic, evidence-backed evaluation.
  - Evaluate all 28 operational domains using the strict rubric:
    `PASS | PARTIAL | FAIL | NOT VERIFIED | NOT APPLICABLE`.
  - Accurately mark M-Pesa and live WhatsApp as `PARTIAL / NOT VERIFIED IN PRODUCTION` until live merchant credentials are authenticated.
  - Include timestamped test output, migration hashes, and environment parameters.

---

## Operational Execution Matrix & Dependencies

| Milestone | Key Deliverable | Prerequisites | Estimated Complexity | Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Static Scanner & Credential Inventory | None | Low | `node scripts/verify-architecture-rules.js` |
| **Phase 1** | PostgreSQL Startup & Checksum Migrator | Phase 0 | Medium | Clean DB migrate & fail-fast startup test |
| **Phase 2** | Repositories & SQLite Runtime Purge | Phase 1 | High | Zero direct SQLite imports in `server/` |
| **Phase 3** | Security State & Admin Bootstrap | Phase 2 | Medium | Persistent idempotency & security suite |
| **Phase 4** | Canonical State Machine & Transactions | Phase 2 | High | Domain logistics suites passing |
| **Phase 5** | Integrations Reality & Telemetry | Phase 4 | Medium | Outbox retry & Control Tower SQL tests |
| **Phase 6** | Branch Isolation & Offline Sync | Phase 4 | Medium | Branch leak & offline replay tests |
| **Phase 7** | PostgreSQL CI & 23-Step E2E Test | Phase 1–6 | High | GitHub Actions workflow green |
| **Phase 8** | Docker, Health Probes & Backup Drill | Phase 7 | Medium | Container build & restore drill |
| **Phase 9** | Documentation & Evidence Attestation | Phase 1–8 | Low | Audit against `PROD-READINESS.md` |

---

## Immediate Next Steps (Day 1 Action Plan)

To begin implementation immediately according to this roadmap:

1. **Step 1: Run Static Audit**
   Execute the baseline architectural check to pinpoint all 45+ locations where SQLite and direct database calls currently reside.
2. **Step 2: Implement Phase 1 Fail-Fast Startup**
   Lock down `server/utils/env.js` and `server/server.js` so PostgreSQL is strictly required in production mode.
3. **Step 3: Provision PostgreSQL in CI**
   Update `.github/workflows/ci.yml` with a live PostgreSQL container so every subsequent pull request is verified against the real production engine.
