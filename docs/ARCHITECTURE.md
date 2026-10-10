# SwiftTrack — System Architecture Specification

**Version:** 1.0.0  
**Status:** Authoritative Production Reference  
**Design Paradigm:** Layered Domain-Driven Architecture · Dieter Rams Functionalism Aesthetic · Dual-Engine Persistence Abstraction  

---

## Table of Contents

- [1. Architectural Overview & Design Philosophy](#1-architectural-overview--design-philosophy)
- [2. Component Architecture & Data Flow](#2-component-architecture--data-flow)
- [3. Separation of Concerns: The Four Pillars](#3-separation-of-concerns-the-four-pillars)
- [4. Canonical Domain Lifecycles & State Machines](#4-canonical-domain-lifecycles--state-machines)
  - [4.1 Shipment Core & Parcel Rating](#41-shipment-core--parcel-rating)
  - [4.2 Transport Runs & Manifest Invariants](#42-transport-runs--manifest-invariants)
  - [4.3 Physical Chain of Custody & Hub Operations](#43-physical-chain-of-custody--hub-operations)
  - [4.4 Last-Mile Delivery & Proof of Delivery (POD)](#44-last-mile-delivery--proof-of-delivery-pod)
  - [4.5 Cash on Delivery (COD) & Reconciliation](#45-cash-on-delivery-cod--reconciliation)
  - [4.6 Cross-Border Customs Clearance](#46-cross-border-customs-clearance)
- [5. Persistence & Database Architecture](#5-persistence--database-architecture)
  - [5.1 Dual-Engine Adapter (`dbAdapter.js`)](#51-dual-engine-adapter-dbadapterjs)
  - [5.2 PostgreSQL 16 Authoritative Migration Architecture](#52-postgresql-16-authoritative-migration-architecture)
  - [5.3 Partitioning, Retention & Immutability Triggers](#53-partitioning-retention--immutability-triggers)
  - [5.4 Domain Repository Registry](#54-domain-repository-registry)
- [6. Asynchronous Messaging & Edge Resilience](#6-asynchronous-messaging--edge-resilience)
  - [6.1 Transactional Outbox Pattern](#61-transactional-outbox-pattern)
  - [6.2 Durable Offline Operations Gateway](#62-durable-offline-operations-gateway)
- [7. Security, Identity & Cryptography Architecture](#7-security-identity--cryptography-architecture)
- [8. Operations Control Tower & Observability](#8-operations-control-tower--observability)

---

## 1. Architectural Overview & Design Philosophy

SwiftTrack is engineered as an enterprise-grade, high-throughput parcel transportation, multi-leg corridor linehaul, fleet telemetry, last-mile courier fulfillment, and Cash-on-Delivery (COD) reconciliation platform designed for multi-regional logistics operations.

### Key Architectural Tenets
1. **Logistics-First Operating Model**: Every system flow anchors directly to the physical custody chain: `Counter Booking → Waybill → Multi-Piece Parcels → Corridors → Manifests → Linehaul Runs → Checkpoints → Hub Intake → Last-Mile Dispatch → Proof of Delivery → COD Reconciliation`.
2. **Unidirectional Dependency Flow**: Presentation components communicate strictly via REST endpoints; API controllers invoke domain services; services execute business logic and invariants; persistence is strictly delegated to domain repositories.
3. **Strict Separation of Reality and Telemetry**: The system rigorously differentiates between actual field scans, historical logs, and automated estimations. Generated or simulated telemetry is never disguised as live operational data.
4. **Dieter Rams / Braun Functionalism Aesthetic**: The user interface employs a Matte Obsidian canvas (`#0c0e12`), high-contrast tabular typography (`tabular-nums`), zero decorative clutter, and semantic hardware-style signals (Emerald, Amber, Rose, Cyan).

---

## 2. Component Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER (CLIENT)                         │
│  React 18.3 SPA · Vite 6.2 · Dieter Rams / Matte Obsidian Design System     │
│  Tailwind CSS v4 · Web Audio Hardware Sound Chimes · PWA Mobile Driver POD  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            API & ROUTING LAYER                              │
│  Express.js 5.2 · CORS Origin Verification · Tiered Rate Limiting           │
│  Security Defense Headers (CSP, HSTS, X-Frame-Options, X-Content-Type)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    AUTHENTICATION & RBAC MIDDLEWARE                         │
│  JWT Access Tokens (15m) · Single-Use Rotating Refresh Tokens (7d)          │
│  Token Blacklist Revocation · Multi-Branch Isolation Scope (NRB, MSA, etc.)│
│  RFC 6238 TOTP Two-Factor Authentication Engine · Scrypt Dynamic Salts      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           DOMAIN SERVICES LAYER                             │
│  Canonical Shipment State Machine Engine · Volumetric Pricing Calculator    │
│  Lock-and-Load Manifest Invariants · BR-008 Last-Mile Attempt Engine        │
│  BR-010 COD Variance Justification · Transactional Outbox Dispatcher        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         DATA REPOSITORY LAYER                               │
│  shipmentRepository · transportRepository · vehicleRepository               │
│  driverRepository · hubRepository · custodyRepository · lastMileRepository   │
│  codRepository · notificationRepository · auditRepository                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                   DUAL-ENGINE DATABASE ADAPTER (dbAdapter)                  │
│  Unified Parameterized Query Translation ($1, $2 ↔ ?) · ACID Transactions   │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  AUTHORITATIVE PRODUCTION ENGINE     │  OFFLINE EDGE / LOCAL DEV FALLBACK   │
│  PostgreSQL 16 Relational Database   │  Node 24 Native SQLite (WAL Mode)    │
│  23 Sequential Schema Migrations     │  Append-Only Triggers                │
│  Connection Pooling (pg.Pool)        │  Deterministic Fixtures & Offline Q  │
└──────────────────────────────────────┴──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        BACKGROUND WORKER ENGINE                             │
│  Transactional Outbox Polling Worker · Exponential Backoff Retries          │
│  SMS / WhatsApp / Email Delivery Pipeline · Dead-Letter Exception Logging   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Separation of Concerns: The Four Pillars

To prevent state corruption, audit gaps, and ambiguous field realities, SwiftTrack enforces an immutable conceptual separation between four distinct elements:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN STATE                                                             │
│    Canonical Lifecycle: DRAFT → CONFIRMED → IN_TRANSIT → AT_HUB →           │
│    OUT_FOR_DELIVERY → DELIVERED | RETURNED | CANCELLED                     │
│    Controlled exclusively via domain services; direct SQL mutation is       │
│    prohibited by database triggers and software architecture.                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TRACKING EVENTS                                                          │
│    Append-only historical milestones for operators and consignees:          │
│    SHIPMENT_BOOKED, PARCEL_SCANNED, TRANSPORT_DEPARTED, HUB_RECEIVED,       │
│    DELIVERY_ATTEMPTED, POD_CAPTURED. Trigger-guarded against UPDATE/DELETE. │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PHYSICAL EVIDENCE                                                        │
│    Cryptographic and sensory artifacts verifying real-world events:         │
│    Digital signatures, recipient OTP tokens, barcode serial scans, GPS       │
│    geotags, exception photographs, weight scale readings.                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. IMMUTABLE AUDIT TRAIL                                                    │
│    Forensic operational accounting: Actor ID, role, client IP, user agent,   │
│    prior state, new state, and delta payload recorded in audit_logs.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Canonical Domain Lifecycles & State Machines

### 4.1 Shipment Core & Parcel Rating
- **Volumetric Rating Formula**: The system calculates dimensional weight as:
  `Volumetric Weight (kg) = (Length cm × Width cm × Height cm) / 5000`
  The billable weight is established as `max(Actual Weight, Volumetric Weight)`.
- **Multi-Piece Tracking**: Consignments contain one or more physical parcels. Each parcel is assigned an individual barcode and tracked through physical scan sessions independently.
- **Canonical Lifecycle**:
  ```text
  [ DRAFT ] ──► (Quote Booked) ──► [ BOOKED ] ──► (Dispatched) ──► [ IN_TRANSIT ]
                                                                             │
                                                                             ▼
  [ DELIVERED ] ◄── (POD Capture) ◄── [ OUT_FOR_DELIVERY ] ◄── (Intake) ◄── [ AT_HUB ]
  ```

### 4.2 Transport Runs & Manifest Invariants
- **Lock-and-Load Invariants**: Cargo manifests transition through `DRAFT` $\to$ `LOCKED` $\to$ `DISPATCHED` $\to$ `COMPLETED`. 
- **Immutability Guarantee**: Once a manifest is locked and dispatched, parcels cannot be silently added, removed, or reassigned. Any physical variation must be recorded as an overage or shortage during hub receiving.
- **Resource Conflict Guards**: The system validates that assigned vehicles are active and available (rejecting vehicles in `MAINTENANCE` or `DECOMMISSIONED` status) and that drivers are active and within legal shift duty limits.

### 4.3 Physical Chain of Custody & Hub Operations
- **High-Velocity Barcode Sessions**: Barcode scan inputs trigger sound chimes and log custody transitions atomically.
- **Discrepancy Auditing**: When a transport run arrives at a destination receiving bay, inbound parcels are scanned against the locked manifest. Variances trigger automated logging:
  - *Shortage*: Manifested parcel missing from vehicle intake scan.
  - *Overage*: Unmanifested parcel discovered inside vehicle.
  - *Damage*: Visual defect recorded with mandatory photographic/notes evidence.

### 4.4 Last-Mile Delivery & Proof of Delivery (POD)
- **Three-Attempt Enforcement (`BR-008`)**: Delivery failures require an operational reason code:
  `CUSTOMER_UNAVAILABLE`, `INCORRECT_ADDRESS`, `CUSTOMER_REFUSED`, `UNREACHABLE_LOCATION`, `RESCHEDULED`.
- After 3 failed attempts, consignments transition to `FAILED_DELIVERY` and trigger a return-to-hub workflow.
- **Multi-Evidence Verification**: Delivery completion requires:
  1. Recipient digital signature canvas capture.
  2. 6-digit OTP delivery PIN confirmation.
  3. Geotagged GPS latitude and longitude coordinates.
  4. Recipient identity name.

### 4.5 Cash on Delivery (COD) & Reconciliation
- **Collection Ledger**: Tracks expected vs collected funds for all COD waybills.
- **Daily Remittance**: Drivers remit daily cash collections to branch cashiers with physical deposit vouchers.
- **Managerial Variance Justification (`BR-010`)**: If collected cash differs from expected cash, managerial reconciliation is rejected unless an audited justification memo is provided.

### 4.6 Cross-Border Customs Clearance
- Models the East African Community (EAC) border post workflow:
  ```text
  [ DECLARED ] ──► [ INSPECTION ] ──► [ ON_HOLD ] (Exception Logged)
                          │                   │
                          ▼                   ▼
                     [ CLEARED ] ◄────── (Resolved)
                          │
                          ▼
                     [ RELEASED ]
  ```

---

## 5. Persistence & Database Architecture

### 5.1 Dual-Engine Adapter (`dbAdapter.js`)
SwiftTrack uses an intelligent database abstraction layer ([server/db/dbAdapter.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/dbAdapter.js)) that normalizes SQL operations across:
1. **PostgreSQL 16**: Connection pooling, parameterized queries (`$1, $2, ...`), and explicit transactional blocks (`BEGIN`, `COMMIT`, `ROLLBACK`).
2. **Node 24 Native SQLite**: High-performance local development and offline edge mode using `node:sqlite` in Write-Ahead Logging (`WAL`) mode with parameterized queries (`?`).

### 5.2 PostgreSQL 16 Authoritative Migration Architecture
The authoritative production schema is structured into **23 sequential, transactional migrations** in [server/db/postgres/migrations/](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/):

```
001_initial_schema.sql                 -> Branches, users, roles, products, inventory, orders
002_logistics_core.sql                 -> Shipments, parcels, tracking events, custody scans
003_transport_and_runs.sql             -> Corridors, transport runs, manifests, checkpoints
004_fleet_and_drivers.sql              -> Fleet vehicles, drivers, licenses, maintenance
005_last_mile_and_pod.sql              -> Delivery attempts, failure reasons (BR-008), POD
006_cod_and_reconciliation.sql         -> COD transactions, remittances, reconciliation (BR-010)
007_notifications_outbox.sql           -> Transactional outbox, templates, worker status
008_offline_sync_queue.sql             -> Edge sync queues, operation idempotency keys
009_cross_border_customs.sql           -> Border posts, declarations, customs inspections
010_indexes_and_constraints.sql        -> Foreign keys, unique waybill indexing, query performance
011_pos_counter_booking.sql            -> Walk-in counter sessions, parcel quote calculation
012_immutable_audit_triggers.sql       -> PostgreSQL PL/pgSQL triggers blocking UPDATE/DELETE
013_pricing_engine.sql                 -> Rate cards, corridor distance matrices, weight tiers
014_customer_crm.sql                   -> Shipper & consignee CRM directory, corporate accounts
015_warehouse_bins_and_zones.sql       -> Warehouse bin locations, quarantine bays, staging zones
016_procurement_and_purchase_orders.sql-> Vendor management, POs, Goods Receipt Notes (GRN)
017_inter_branch_transfers.sql         -> Stock transfer requests, dispatch manifests, transit
018_expenses_and_petty_cash.sql        -> Branch petty cash floats, expense vouchers, approvals
019_session_and_token_revocation.sql   -> Active user sessions, JWT token revocation blacklist
020_totp_two_factor_auth.sql           -> RFC 6238 TOTP secrets, single-use recovery codes
021_control_tower_views.sql            -> Materialized analytical views for bottleneck detection
022_partitioning_for_high_volume.sql   -> Monthly range partitioning on tracking & audit tables
023_retention_and_archival_policies.sql-> Automated data retention routines and cold storage jobs
```

### 5.3 Partitioning, Retention & Immutability Triggers
- **Partitioning**: High-volume tables (`tracking_events`, `audit_logs`, `custody_scans`) are partitioned by month via range partitioning in Migration `022`, ensuring sub-millisecond query performance as log volumes scale into tens of millions.
- **Audit Immutability Triggers**: Migration `012` installs PL/pgSQL triggers on `audit_logs` and `tracking_events` that abort any `UPDATE` or `DELETE` statement with a `CANNOT_MODIFY_IMMUTABLE_LOG` database exception.
- **Archival Policies**: Migration `023` establishes automated data retention functions for pruning non-regulatory temporary sync logs while safeguarding financial and custody evidence.

### 5.4 Domain Repository Registry
All database operations pass through specialized repositories in [server/repositories/](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/):
- `shipmentRepository` — Consignments, parcels, legs, waybills.
- `transportRepository` — Linehaul corridors, runs, manifests, checkpoints.
- `vehicleRepository` — Vehicle assets, types, maintenance, availability.
- `driverRepository` — Driver personnel, license compliance, shift duty.
- `hubRepository` — Regional stations, warehouses, receiving bays.
- `custodyRepository` — Scan sessions, formal handoffs, custody logs.
- `lastMileRepository` — Courier dispatches, attempt histories, POD.
- `codRepository` — Cash collection, remittance vouchers, reconciliation batches.
- `notificationRepository` — Transactional outbox persistence and worker state.
- `auditRepository` — Tamper-proof operational audit logging.

---

## 6. Asynchronous Messaging & Edge Resilience

### 6.1 Transactional Outbox Pattern
To prevent dual-write inconsistencies between database mutations and external messaging providers:
1. When a domain event occurs (e.g., `ShipmentBooked`, `OutForDelivery`, `PODCaptured`), an outbox record is inserted into `notification_outbox` within the **same atomic database transaction**.
2. An isolated background worker ([server/workers/notificationWorker.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/workers/notificationWorker.js)) polls the queue at configurable intervals (`WORKER_INTERVAL_MS=15000`).
3. Outbox dispatches execute with exponential backoff retries (`15s`, `30s`, `60s`, `120s`). Failed dispatches transition to `DEAD_LETTER` after maximum attempts for administrative review.

### 6.2 Durable Offline Operations Gateway
For remote depots and field drivers operating in low-connectivity zones:
- Handheld PDAs generate unique client operation UUIDs for each field action (`SCAN`, `CUSTODY_HANDOFF`, `HUB_RECEIVE`, `DELIVERY_ATTEMPT`, `DELIVERY_POD`).
- Operations are queued locally in browser IndexedDB / SQLite edge cache.
- Upon reconnection, operations sync in batch. The server verifies idempotency keys in `offline_sync_queue` (Migration `008`), preventing duplicate scans or replay attacks while returning cached responses for previously processed operations.

---

## 7. Security, Identity & Cryptography Architecture

- **Password Hashing**: Native Node.js `crypto.scrypt` with 16-byte cryptographically secure dynamic random salts and constant-time timing-safe comparison (`crypto.timingSafeEqual`).
- **Token Security**: 15-minute short-lived JWT access tokens paired with 7-day single-use rotating refresh tokens. Tokens are fingerprinted and invalidated immediately upon logout via database blacklist table `revoked_tokens`.
- **Brute-Force Account Protection**: 5 consecutive invalid login attempts trigger an automated 15-minute account lockout (`HTTP 423 Locked`).
- **Two-Factor Authentication (RFC 6238 TOTP)**: Zero-dependency native TOTP engine ([server/utils/totp.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/utils/totp.js)) supporting Base32 secret decoding, HMAC-SHA1 algorithm, 30-second window drift tolerance, and 8 single-use backup recovery codes.
- **Enterprise Defense Headers**: Configured with Content Security Policy (CSP Level 3), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and origin-verified CORS.

---

## 8. Operations Control Tower & Observability

The Control Tower ([server/routes/controlTower.js](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/routes/controlTower.js)) acts as the central nervous system of the logistics platform:
- **Corridor Transit Times**: Measures planned vs actual elapsed time across linehaul routes.
- **Hub Dwell Heatmaps**: Identifies staging backlog and bays where parcel dwell time exceeds SLA thresholds.
- **SLA Breach Telemetry**: Real-time identification of overdue consignments, stalled corridor legs, and unresolved custody exceptions.
- **Truthful KPI Computation**: Empty datasets return explicit `N/A` or zero states rather than misleading 100% scores. All telemetry is enforced server-side according to the requesting user's regional branch authorization.
