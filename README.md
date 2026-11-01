# SwiftTrack — Production-Grade Logistics, Multi-Leg Corridor & Last-Mile Transportation Platform

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Authoritative-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Dev/Offline-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=flat-square&logo=docker&logoColor=white)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions_Passing-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Test Suites](https://img.shields.io/badge/Verification-46_Scheduled_Suites-10B981?style=flat-square)
![Design System](https://img.shields.io/badge/Aesthetics-Dieter_Rams_Functionalism-0c0e12?style=flat-square)
![WCAG](https://img.shields.io/badge/Accessibility-WCAG_AAA-10B981?style=flat-square)

An enterprise-grade, high-throughput parcel transportation, multi-leg corridor linehaul, fleet telemetry, last-mile courier fulfillment, and Cash-on-Delivery (COD) reconciliation platform. 

SwiftTrack connects physical regional hubs (**Nairobi parcel hub `NBO987`**, **Mombasa Port & Coastal Terminal `MSA-01`**, **Kisumu Lake Basin Depot `KSM-01`**, and **Nakuru Transit Depot `NAK1`**) with strict multi-branch data isolation, multi-piece parcel rating, lock-and-load manifest invariants, driver mobile POD with 6-digit OTP delivery confirmation, transactional outbox notifications, real-time control tower telemetry, and statutory KRA fiscal compliance. Headquarters (`NRB-HQ`) remains an administrative location and is excluded from operational hub selectors.

---

## Table of Contents

- [1. Operational Architecture & End-to-End Parcel Journey](#1-operational-architecture--end-to-end-parcel-journey)
- [2. Architectural Pillars & Core Separation of Concerns](#2-architectural-pillars--core-separation-of-concerns)
- [3. Operational Subsystems & Domain Modules](#3-operational-subsystems--domain-modules)
  - [3.1 Shipment & Multi-Piece Parcel Core](#31-shipment--multi-piece-parcel-core)
  - [3.2 Multi-Leg Corridors & Cross-Border Customs](#32-multi-leg-corridors--cross-border-customs)
  - [3.3 Manifest Engine & Transport Runs](#33-manifest-engine--transport-runs)
  - [3.4 Physical Chain of Custody & Hub Intake](#34-physical-chain-of-custody--hub-intake)
  - [3.5 Last-Mile Delivery & Driver Mobile POD](#35-last-mile-delivery--driver-mobile-pod)
  - [3.6 Cash on Delivery (COD) & Financial Remittance](#36-cash-on-delivery-cod--financial-remittance)
  - [3.7 Operations Control Tower & Real-Time Telemetry](#37-operations-control-tower--real-time-telemetry)
  - [3.8 Transactional Outbox & Notifications Engine](#38-transactional-outbox--notifications-engine)
  - [3.9 Durable Offline & Edge Operations Gateway](#39-durable-offline--edge-operations-gateway)
  - [3.10 Logistics Counter POS & Fiscal Intake](#310-logistics-counter-pos--fiscal-intake)
- [4. Authoritative Database Architecture & Migrations](#4-authoritative-database-architecture--migrations)
- [5. Role-Based Access Control (RBAC) & Test Accounts](#5-role-based-access-control-rbac--test-accounts)
- [6. Enterprise Security & Cryptographic Hardening](#6-enterprise-security--cryptographic-hardening)
- [7. Automated Verification & Test Matrix](#7-automated-verification--test-matrix)
- [8. Deployment & Container Orchestration](#8-deployment--container-orchestration)
- [9. Getting Started & Local Development](#9-getting-started--local-development)
- [10. Environment Configuration](#10-environment-configuration)
- [11. Repository Structure](#11-repository-structure)
- [12. Production Documentation Suite](#12-production-documentation-suite)

---

## 1. Operational Architecture & End-to-End Parcel Journey

SwiftTrack guides each parcel through a sequence of custody handoffs. The exact route
depends on the service, destination, payment terms, and whether a delivery needs
intervention; notifications and Control Tower monitoring support the journey throughout
rather than acting as final steps.

| Stage | Operator action | Primary workspace |
| --- | --- | --- |
| Book | Capture sender, recipient, service, parcel details, and payment; create the waybill. | Parcel Intake (POS) or an authorized API integration |
| Receive | Record physical acceptance and custody at the origin station. | Hub Operations |
| Sort and dispatch | Sort for the next leg, consolidate into a manifest, assign an eligible driver and vehicle, then dispatch. | Hub Operations and Dispatch |
| Transfer between hubs | Track the leg, receive the parcel into a persisted receiving session, and investigate any manifest variance. Repeat sorting and dispatch for each remaining leg. | Dispatch and Hub Operations |
| Deliver or hold for pickup | Assign last-mile work, record the delivery attempt, and capture a required reason if it fails; alternatively, keep the parcel ready for customer pickup. | Dispatch, Driver Portal, or Hub Operations |
| Close the financial handoff | Record proof of delivery. For Cash on Delivery (COD), remit collected funds and reconcile the batch. | Driver Portal and COD Settlement & Reconciliation |

Operators can open a shipment to see its current status and the recommended next
operational step. The available action depends on the operator's role; if that role cannot
perform the next handoff, the shipment status still provides the point to coordinate from.
Use the Control Tower to monitor live work and investigate exceptions. A failed delivery,
payment hold, custody variance, or customs hold may interrupt the usual sequence and must
be resolved before the parcel proceeds.

Tracking history, customer notifications, and operational telemetry are cross-cutting
records: they are updated or surfaced as events occur, not treated as separate custody
handoffs. Only live operational records should be presented as current metrics; unavailable
feeds must remain visibly unavailable rather than being represented by invented values.

---

## 2. Architectural Pillars & Core Separation of Concerns

SwiftTrack strictly separates four distinct domain concepts to ensure full auditability and zero state corruption:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN STATE                                                             │
│    Canonical Lifecycle: DRAFT → CONFIRMED → IN_TRANSIT → AT_HUB →           │
│    OUT_FOR_DELIVERY → DELIVERED | RETURNED | CANCELLED                     │
│    Enforced exclusively via domain services; direct SQL mutation prohibited.│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TRACKING EVENTS                                                          │
│    Append-only historical milestones for operators and consignees:          │
│    SHIPMENT_BOOKED, PARCEL_SCANNED, TRANSPORT_DEPARTED, HUB_RECEIVED,       │
│    DELIVERY_ATTEMPTED, POD_CAPTURED. Trigger-guarded against UPDATE/DELETE. │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PHYSICAL EVIDENCE                                                        │
│    Cryptographic artifacts verifying field reality: Digital signatures,     │
│    recipient OTP hashes, barcode serial scans, GPS coordinates, photos.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. IMMUTABLE AUDIT TRAIL                                                    │
│    Full forensic accountability: Actor ID, role, client IP, user agent,     │
│    prior state, new state, and delta payload recorded in audit_logs.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Aesthetic Philosophy: Dieter Rams / Braun Functionalism
- **Matte Obsidian Canvas (`#0c0e12`)**: High-contrast, zero-distraction dark mode paired with a crisp porcelain light mode (`#f8fafc`).
- **Precision Data Hierarchy**: High-density tabular numerals (`tabular-nums`), `Plus Jakarta Sans` for interface controls, and `JetBrains Mono` for hardware readouts, serial numbers, VAT calculations, and timestamps.
- **Mission-Critical Telemetry Signals**: Semantic telemetry indicators: Nominal (Emerald `#10b981`), Caution (Amber `#f59e0b`), Critical (Rose `#ef4444`), Transit (Cyan `#06b6d4`), and Primary Action (Blue `#3b82f6`).

---

## 3. Operational Subsystems & Domain Modules

### 3.1 Shipment & Multi-Piece Parcel Core
- **Volumetric Rating Engine**: Automatically compares actual gross weight vs. volumetric weight (`Length × Width × Height / 5000` or CBM factor) and charges the higher billable figure.
- **Multi-Piece Tracking**: Support for parent shipments containing multiple discrete parcels, each bearing an individual scannable barcode and custody tracking record.
- **Waybill Generation**: Unique alphanumeric waybill tracking codes, complete sender/recipient profiles, declared insurance values, and automated label generation.
- **Statutory Rules**: Rejects incomplete manifests, missing customer records, or negative declared weights.

### 3.2 Multi-Leg Corridors & Cross-Border Customs
- **Corridor Route Definition**: Formalized transit corridors (e.g., Mombasa Port ↔ Nairobi Central ↔ Nakuru Depot ↔ Kisumu Lake Basin).
- **Leg Decomposition**: Consignments automatically split into sequential legs with intermediate transit hubs. Completing an inbound leg at an intermediate transit hub automatically sets the consignment `AT_HUB` and activates the subsequent leg for manifest assignment in the outbound corridor queue.
- **Cross-Border Customs Clearance**: Full East African Community (EAC) cross-border customs declarations lifecycle: `DECLARED` → `INSPECTION` → `ON_HOLD` (with automated operational exception generation) → `CLEARED` → `RELEASED`.

### 3.3 Manifest Engine & Transport Runs
- **Lock-and-Load Invariants**: Cargo manifests transition through `DRAFT` → `LOCKED` → `DISPATCHED` → `COMPLETED`. Once a manifest is locked and dispatched, items cannot be silently added or removed.
- **Resource Eligibility Verification**: Transport runs strictly check vehicle status (preventing assignment of vehicles marked `MAINTENANCE` or `DECOMMISSIONED`) and driver status (preventing off-duty, suspended, or unassigned personnel).
- **En-Route Checkpoints**: Checkpoint passage updates manifest progress, records timestamps, and recalculates estimated time of arrival (ETA).

### 3.4 Physical Chain of Custody & Hub Intake
- **High-Velocity Barcode Sessions**: Rapid barcode scan handling with audio chime feedback for handheld terminals.
- **Formal Custody Handover**: Verifiable handoff records transferring responsibility between parties (Customer → Agent, Agent → Driver, Driver → Hub Receiving Bay).
- **Discrepancy Ledger**: Automated variance detection logging overages (unmanifested cargo arriving at hub), shortages (manifested cargo missing from vehicle), and transit damage.

### 3.5 Last-Mile Delivery & Driver Mobile POD
- **Driver Mobile POD Portal**: Dedicated, responsive mobile interface displaying driver delivery queues, one-touch phone dialer, navigation notes, and delivery priorities (`NORMAL`, `HIGH`, `URGENT`).
- **Three-Attempt Enforcement (`BR-008`)**: Failed deliveries require a mandatory failure reason code (`CUSTOMER_UNAVAILABLE`, `INCORRECT_ADDRESS`, `CUSTOMER_REFUSED`, `UNREACHABLE_LOCATION`, `RESCHEDULED`). Consignments return to depot after 3 failed attempts.
- **Tamper-Proof POD**: Delivery completion requires a valid recipient digital signature canvas capture, 6-digit OTP verification PIN, and geotagged GPS coordinates.

### 3.6 Cash on Delivery (COD) & Financial Remittance
- **COD Collections Ledger**: Tracks expected vs. collected cash for all COD consignments.
- **Driver Daily Float Remittance**: Drivers remit daily cash collections to station cashiers with receipt vouchers.
- **Mandatory Variance Justification (`BR-010`)**: Financial managers cannot approve COD reconciliation batches with discrepancies unless a formal justification memo and audit reason are provided.

### 3.7 Operations Control Tower & Real-Time Telemetry
- **Network-Wide Observability**: Consolidated dashboard tracking active transport runs, corridor transit times, hub dwell times, and bottleneck alerts.
- **SLA Breach Telemetry**: Real-time identification of overdue shipments, stalled transit legs, and unresolved custody exceptions.
- **Hub Volume Heatmaps**: Live monitoring of on-hand parcel counts across all regional distribution centers.

### 3.8 Transactional Outbox & Notifications Engine
- **Transactional Outbox Pattern**: Notifications (SMS, WhatsApp, Email) are written to the database outbox in the same transaction as the domain event, guaranteeing zero lost messages during external network outages.
- **Exponential Backoff Retry Worker**: Background worker polls the outbox and attempts delivery with exponential backoff intervals (`15s`, `30s`, `60s`, `120s`) up to max retries before marking as dead-letter for administrative review.
- **Template Interpolation**: Dynamic token substitution for waybill numbers, consignee names, OTP codes, and tracking links.

### 3.9 Durable Offline & Edge Operations Gateway
- **Edge Resilience**: Handheld PDAs and remote distribution centers operate seamlessly during intermittent connectivity.
- **Idempotent Client UUIDs**: Client-generated UUIDs prevent duplicate processing of replayed scan events and custody handovers.
- **Cached Response Synchronization**: Automatic batch sync upon network restoration with deterministic conflict resolution.

### 3.10 Logistics Counter POS & Fiscal Intake
- **Walk-in Parcel Booking**: Counter booking interface supporting package dimensioning, automated pricing quotes, recipient registration, and immediate waybill thermal printing.
- **Safaricom M-Pesa Daraja Integration**: Native STK Push simulation with callback confirmation and automatic ledger settlement.
- **Statutory KRA 16% Output VAT**: Compliant fiscal receipts displaying tax breakdown, KRA PIN, cashier register number, and ESC/POS 80mm/58mm formatting.

---

## 4. Authoritative Database Architecture & Migrations

SwiftTrack uses **PostgreSQL 16 as its authoritative production database engine**, with a high-performance, WAL-mode SQLite fallback engine for offline edge nodes and local unit tests.

### PostgreSQL Migration Suite (27 Sequential Migrations)
The authoritative schema is version-controlled in [`server/db/postgres/migrations/`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/):

| Migration | File | Description & Invariants Enforced |
| :--- | :--- | :--- |
| `001` | [`001_initial_schema.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/001_initial_schema.sql) | Baseline relational schema: 36 core tables, foreign keys, unique constraints. |
| `002` | [`002_soft_delete_and_retention.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/002_soft_delete_and_retention.sql) | Soft-deletion columns, retention metadata, and partial unique indexes. |
| `003` | [`003_performance_indexes.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/003_performance_indexes.sql) | Compound, partial, and GIN indexes for high-throughput logistics and POS queries. |
| `004` | [`004_commerce_catalog_variants_pricing.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/004_commerce_catalog_variants_pricing.sql) | Product catalog, variants, brands, suppliers, and dynamic pricing. |
| `005` | [`005_inventory_states.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/005_inventory_states.sql) | Multi-state inventory ledger (`ON_HAND`, `AVAILABLE`, `RESERVED`, `IN_TRANSIT`, `DAMAGED`, `EXPIRED`). |
| `006` | [`006_inventory_operations.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/006_inventory_operations.sql) | Stock movement and atomic inventory adjustment operations. |
| `007` | [`007_advanced_inventory.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/007_advanced_inventory.sql) | Batch/lot tracking, expiry control, and inventory valuation. |
| `008` | [`008_customer_management.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/008_customer_management.sql) | Shipper and consignee CRM directory, addresses, and credit terms. |
| `009` | [`009_pos_shifts_and_drawer.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/009_pos_shifts_and_drawer.sql) | POS shifts, cash drawer sessions, and register controls. |
| `010` | [`010_orders_engine.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/010_orders_engine.sql) | Order lifecycle, allocations, and tender balances. |
| `011` | [`011_payments_engine.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/011_payments_engine.sql) | Payments ledger, tenders, and M-Pesa transaction linkage. |
| `012` | [`012_procurement_lifecycle.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/012_procurement_lifecycle.sql) | Suppliers, purchase orders, goods receipt notes (GRN), and invoices. |
| `013` | [`013_fleet_drivers.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/013_fleet_drivers.sql) | Driver rostering, licences, duty status, and compliance records. |
| `014` | [`014_fleet_vehicles.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/014_fleet_vehicles.sql) | Fleet vehicles, capacity limits, maintenance, and telematics. |
| `015` | [`015_logistics_hubs_and_foundations.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/015_logistics_hubs_and_foundations.sql) | Hub capability extensions, logistics permissions, and the principal-bound `idempotency_keys` table (unique `(user_id, idempotency_key)`). |
| `016` | [`016_shipment_core.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/016_shipment_core.sql) | Shipment core: shipments, parcels, legs, waybills, and tracking events. |
| `017` | [`017_transport_management.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/017_transport_management.sql) | Corridors, transport runs, manifests, checkpoints, and vehicle assignments. |
| `018` | [`018_physical_custody_and_hub_operations.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/018_physical_custody_and_hub_operations.sql) | Barcode scans, formal handoffs, hub receiving, and discrepancy detection. |
| `019` | [`019_last_mile_delivery_and_exceptions.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/019_last_mile_delivery_and_exceptions.sql) | Delivery attempts, `BR-008` failure reasons, POD evidence, and centralized exceptions. |
| `020` | [`020_pos_counter_booking_and_waybills.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/020_pos_counter_booking_and_waybills.sql) | Counter booking, payment linking, and waybill generation. |
| `021` | [`021_cod_settlements_and_reconciliation.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/021_cod_settlements_and_reconciliation.sql) | COD settlements, remittances, and financial reconciliation (`BR-010`). |
| `022` | [`022_control_tower_and_network_telemetry.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/022_control_tower_and_network_telemetry.sql) | Operations Control Tower views and network telemetry aggregates. |
| `023` | [`023_logistics_notifications_engine.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/023_logistics_notifications_engine.sql) | Transactional outbox, notification templates, and delivery infrastructure. |
| `024` | [`024_remove_default_demo_tariffs.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/024_remove_default_demo_tariffs.sql) | Removes only unchanged sample global tariffs previously inserted by migration 023. |
| `025` | [`025_onboarding_flag.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/025_onboarding_flag.sql) | Persists organization onboarding completion state. |
| `026` | [`026_classify_headquarters_branch.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/026_classify_headquarters_branch.sql) | Classifies `NRB-HQ` as administrative headquarters, not an operational parcel hub. |
| `027` | [`027_archive_shipments.sql`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/db/postgres/migrations/027_archive_shipments.sql) | Adds shipment archival state (`is_archived`, `archived_at`) and index. |

### Data Access Architecture (Repository Pattern)
Business services communicate through dedicated domain repositories in [`server/repositories/`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/):
- [`shipmentRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/shipmentRepository.js) — Shipments, parcels, multi-leg decomposition, and state queries.
- [`transportRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/transportRepository.js) — Corridors, transport runs, manifests, and en-route checkpoints.
- [`vehicleRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/vehicleRepository.js) — Fleet registry, vehicle availability, maintenance flags, and telemetry.
- [`driverRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/driverRepository.js) — Driver roster, licensing credentials, shift duty states, and assignment tracking.
- [`hubRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/hubRepository.js) — Distribution centers, receiving bays, staging zones, and inventory balances.
- [`custodyRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/custodyRepository.js) — Barcode scan logs, physical handoffs, and shortage/overage logs.
- [`lastMileRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/lastMileRepository.js) — Delivery dispatches, attempt histories, and immutable POD evidence.
- [`codRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/codRepository.js) — Cash collection tracking, remittance deposits, and managerial reconciliation.
- [`notificationRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/notificationRepository.js) — Outbox queue persistence, worker delivery states, and dead letters.
- [`auditRepository.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/repositories/auditRepository.js) — Append-only audit trail logging and compliance inquiries.

---

## 5. Role-Based Access Control (RBAC) & Demo Accounts

SwiftTrack enforces strict branch data segregation and granular role capabilities across 5 operational tiers:

The role definitions and permissions are system metadata. Demo users and their credentials are
created only by local/CI demo seeders. Production creates no users; provision the first global
administrator through `npm run admin:bootstrap` with real identity details and a secure one-time
password, then create operational accounts from verified business records.

---

## 6. Enterprise Security & Cryptographic Hardening

- **Dynamic Salt Cryptography**: Passwords hashed using Node native `crypto.scrypt` with 16-byte cryptographically secure random salts and constant-time timing-safe comparison (`crypto.timingSafeEqual`).
- **Session Security & Rotating Refresh Tokens**: 15-minute short-lived JWT access tokens paired with 7-day single-use rotating refresh tokens. Immediate token revocation via database-backed blacklist table (`revoked_tokens`).
- **Principal-Bound Idempotency**: Authenticated mutating requests may supply an `Idempotency-Key`; records are scoped per user in the durable `idempotency_keys` table, only `2xx` responses are replayed, and authentication endpoints plus unauthenticated requests bypass the middleware so credential failures are never cached.
- **Brute-Force Protection & Account Lockout**: 5 consecutive failed login attempts trigger an automatic 15-minute account lockout (`HTTP 423 Locked`).
- **RFC 6238 TOTP Two-Factor Authentication**: Zero external dependency native TOTP engine (`server/utils/totp.js`) with Base32 decoding, HMAC-SHA1 30-second window drift tolerance, and 8 single-use backup recovery codes.
- **Enterprise Defense Headers**: Configured with strict Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and origin-verified CORS.

---

## 7. Automated Verification & Test Matrix

The unified runner at [`scripts/run-all-tests.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/scripts/run-all-tests.js) schedules **46 suites** covering backend services, state machines, database layers, security barriers, frontend contracts, and an end-to-end acceptance journey:

```text
======================================================================
SWIFTTRACK ENTERPRISE TEST RUNNER
46 suites scheduled via `npm run test:all`
The runner prints the authoritative PASS/FAIL summary per execution.
======================================================================
```

### Complete Test Catalog

The catalog mirrors `scripts/run-all-tests.js` exactly. Additional focused verification scripts not included in `test:all` (for example `tests/verify-auth-phase1.js`, `tests/verify-auth-phase1-2.js`, `tests/verify-api-foundation.js`, `tests/verify-phase1-exit-criteria.js`, `tests/verify-db-postgres.js`, and `tests/database/test-production-seed-safety.js`) can be run individually.

1. **Architectural Guardrails & Security (6 Suites)**
   - [`scripts/verify-architecture-rules.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/scripts/verify-architecture-rules.js) — Enforces repository boundaries and forbids direct database imports from routes/services.
   - [`scripts/audit-secrets.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/scripts/audit-secrets.js) — Scans tracked files for leaked credentials and private keys.
   - [`tests/security/test-sql-injection.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/security/test-sql-injection.js) — SQL injection defense across parameterized endpoints.
   - [`tests/security/test-csrf-cors.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/security/test-csrf-cors.js) — CORS origins, pre-flight headers, and CSRF token barriers.
   - [`tests/security/test-xss.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/security/test-xss.js) — Input sanitization, CSP headers, and payload escaping.
   - [`tests/security/test-idempotency-isolation.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/security/test-idempotency-isolation.js) — Principal-bound idempotency: anonymous bypass, per-user isolation, auth-failure/non-2xx non-caching, concurrent `409`, and expired-key reuse.

2. **Database & Data Architecture (1 Suite)**
   - [`tests/database/test-postgres-data-architecture.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/database/test-postgres-data-architecture.js) — All 27 PostgreSQL migrations, repository boundaries, constraints, and indexes.

3. **Core System & API Documentation Parity (2 Suites)**
   - [`tests/verify-system.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/verify-system.js) — Comprehensive integration flows spanning authentication, branch isolation, POS, stock, manifests, backups, and audit immutability.
   - [`tests/docs/test-api-doc-parity.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/docs/test-api-doc-parity.js) — Ensures documented endpoints exist in the live Express router and OpenAPI spec.

4. **Inventory & Warehousing (3 Suites)**
   - [`tests/inventory/test-inventory-states.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/inventory/test-inventory-states.js) — Reserved, allocated, in-transit, and damaged inventory transitions.
   - [`tests/inventory/test-inventory-operations.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/inventory/test-inventory-operations.js) — Atomic stock movements and adjustment guardrails.
   - [`tests/inventory/test-advanced-inventory.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/inventory/test-advanced-inventory.js) — Batch/lot expiry control and valuation.

5. **Point of Sale (2 Suites)**
   - [`tests/pos/test-complete-pos-workflow.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/pos/test-complete-pos-workflow.js) — POS cart tenders, KRA 16% VAT calculation, shift, and till management.
   - [`tests/logistics/test-pos-counter-booking.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-pos-counter-booking.js) — Counter booking, volumetric pricing, and waybill printing.

6. **Orders Engine (1 Suite)**
   - [`tests/orders/test-orders-engine.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/orders/test-orders-engine.js) — Order lifecycle, allocation, branch filtering, and tender balances.

7. **Commercial Catalog & Customers (3 Suites)**
   - [`tests/commerce/test-catalog-variants.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/commerce/test-catalog-variants.js) — SKU variants, brands, categories, and packaging dimensions.
   - [`tests/commerce/test-pricing-engine.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/commerce/test-pricing-engine.js) — Dynamic pricing matrices, customer discounts, and tier rules.
   - [`tests/customers/test-customer-management.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/customers/test-customer-management.js) — Corporate shipper profiles, addresses, and credit limits.

8. **Procurement Lifecycle (1 Suite)**
   - [`tests/procurement/test-procurement-lifecycle.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/procurement/test-procurement-lifecycle.js) — PO creation, approvals, goods receiving notes (GRN), and invoice matching.

9. **Reporting & Analytics (1 Suite)**
   - [`tests/reports/test-reports-engine.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/reports/test-reports-engine.js) — Financial reporting and operational analytics aggregates.

10. **Payments & Billing (2 Suites)**
    - [`tests/payments/test-payments-engine.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/payments/test-payments-engine.js) — Payments ledger, tender handling, and M-Pesa settlement.
    - [`tests/logistics/test-daraja-gateway.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-daraja-gateway.js) — Safaricom Daraja STK push and callback processing.

11. **Logistics & Transport Runs (12 Suites)**
    - [`tests/logistics/test-shipments-core.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-shipments-core.js) — Canonical state machine transitions, dimensional rating, and parcel integrity.
    - [`tests/logistics/test-transport-runs.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-transport-runs.js) — Corridors, vehicle lock-and-load validation, manifests, and checkpoints.
    - [`tests/logistics/test-physical-custody.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-physical-custody.js) — Scan tracking, formal handoffs, and shortage/overage detection.
    - [`tests/logistics/test-last-mile-delivery.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-last-mile-delivery.js) — Dispatch queue, BR-008 failure codes, and OTP/signature POD.
    - [`tests/logistics/test-cod-settlement.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-cod-settlement.js) — COD collection, remittance float, and variance approvals.
    - [`tests/logistics/test-control-tower.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-control-tower.js) — Network telemetry, bottleneck alerts, and corridor monitoring.
    - [`tests/logistics/test-notifications-engine.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-notifications-engine.js) — Transactional outbox drain, templating, and exponential backoff.
    - [`tests/logistics/test-notifications-gateway.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-notifications-gateway.js) — Africa's Talking and Twilio gateway dispatch.
    - [`tests/logistics/test-multi-leg-and-customs.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-multi-leg-and-customs.js) — Multi-leg transshipment and cross-border customs declarations.
    - [`tests/logistics/test-customs-manifest.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-customs-manifest.js) — EAC customs and ASYCUDA manifest handling.
    - [`tests/logistics/test-offline-sync.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-offline-sync.js) — Edge sync queue, idempotent replay deduplication, and sync caches.
    - [`tests/logistics/test-client-offline-queue.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-client-offline-queue.js) — Client-side offline queue persistence and auto-replay.

12. **Fleet Management (2 Suites)**
    - [`tests/logistics/test-vehicles-management.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-vehicles-management.js) — Vehicle registration, maintenance lifecycle, and capacity checks.
    - [`tests/logistics/test-drivers-management.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-drivers-management.js) — Driver rostering, licence validity, and duty statuses.

13. **Frontend Integrity (7 Suites)**
    - [`tests/pos/test-frontend-pos.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/pos/test-frontend-pos.js) — POS register UI, scanner events, and held carts.
    - [`tests/orders/test-frontend-orders.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/orders/test-frontend-orders.js) — Orders table UI, filters, and receipt reprinting.
    - [`tests/payments/test-frontend-payments.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/payments/test-frontend-payments.js) — Payment modals, change calculation, and tender confirmation.
    - [`tests/procurement/test-frontend-procurement.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/procurement/test-frontend-procurement.js) — Procurement UI routing, PO status chips, and GRN forms.
    - [`tests/logistics/test-frontend-drivers.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-frontend-drivers.js) — Driver assignment UI, route lists, and courier controls.
    - [`tests/logistics/test-frontend-vehicles.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-frontend-vehicles.js) — Fleet UI state and vehicle dispatch instruments.
    - [`tests/frontend/test-ui-contracts.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/frontend/test-ui-contracts.js) — Shared UI contracts and modal stacking behavior.

14. **Disaster Recovery & Observability (2 Suites)**
    - [`tests/database/test-backup-restore.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/database/test-backup-restore.js) — Database backup and restore drill.
    - [`tests/system/test-metrics-endpoint.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/system/test-metrics-endpoint.js) — Prometheus metrics and health endpoint contracts.

15. **End-to-End Acceptance (1 Suite)**
    - [`tests/logistics/test-e2e-acceptance.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/logistics/test-e2e-acceptance.js) — Complete multi-leg consignment journey from booking to POD.

### Running Test Suites

```bash
# Run all 46 test suites across the repository
npm run test:all

# Run specific domain test suites
npm run test:shipments      # Shipment Core & Rating
npm run test:transport      # Corridors, Manifests & Transport Runs
npm run test:custody        # Chain of Custody & Hub Intake
npm run test:last-mile      # Last-Mile Delivery & Mobile POD
npm run test:cod            # COD Collections & Remittance Reconciliation
npm run test:control-tower  # Control Tower & Operational Intelligence
npm run test:notifications  # Transactional Outbox & Notification Worker
npm run test:multi-leg      # Multi-Leg Corridors & Customs Clearance
npm run test:offline        # Offline Sync & Idempotency
npm run test:security       # SQLi, CSRF/CORS, XSS & Idempotency Isolation
npm run test:idempotency    # Principal-Bound Idempotency Suite
npm run test:e2e            # Complete 23-Step End-to-End Consignment Journey
```

---

## 8. Deployment & Container Orchestration

SwiftTrack includes a production-grade multi-stage [Dockerfile](file:///c:/Users/ariic/Documents/Logistics%20Platform/Dockerfile), an orchestration [docker-compose.yml](file:///c:/Users/ariic/Documents/Logistics%20Platform/docker-compose.yml), and a complete [GitHub Actions CI/CD Pipeline](file:///c:/Users/ariic/Documents/Logistics%20Platform/.github/workflows/ci.yml).

### Docker Compose Architecture
The production stack orchestrates three isolated services:
1. **`postgres`**: Official `postgres:18-alpine` database pre-configured with pooled connections, volume persistence (`pgdata`), and automatic initialization of all 27 migrations.
2. **`app`**: Multi-stage Node.js 22 runtime serving the Express.js API backend and static pre-compiled React 18 / Vite 6 client application under an unprivileged `node` user with healthcheck monitoring.
3. **`worker`**: Dedicated background worker container running the transactional outbox notifications processor and sync engine with isolated resource boundaries.

### Launching with Docker Compose

```bash
# 1. Clone repository
git clone https://github.com/Mayen007/swifttrack.git
cd swifttrack

# 2. Configure production environment
cp .env.example .env
# Edit .env with your production JWT secret and database credentials

# 3. Launch the containerized stack
docker compose up -d

# 4. View service logs
docker compose logs -f
```

The application is immediately available at `http://localhost:4000`.

---

## 9. Getting Started & Local Development

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **NPM**: v10.0.0 or higher
- **PostgreSQL**: v16 (optional for local SQLite mode)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Mayen007/swifttrack.git
cd swifttrack

# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

### 3. Database Initialization & Seeding

```bash
# Local/CI only: initialize PostgreSQL schema and demo fixtures
npm run db:migrate
npm run db:pg:seed

# Local demo: initialize SQLite demo data (zero external database required)
npm run db:seed:branches

# Production: migrate PostgreSQL and seed system roles/permissions only
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm run db:seed:prod
```

Production seeding does not create company settings, branches, warehouses, staff, customers,
products, inventory, vehicles, orders, sales, or telemetry. Provision those records from
verified live business data before operational use. Create the first global administrator
with real identity details; provide `ADMIN_FULL_NAME`, `ADMIN_EMAIL`, and `ADMIN_PHONE`
alongside `ADMIN_INITIAL_PASSWORD` (or let the tool generate a one-time password), then run
`npm run admin:bootstrap`. Never run demo seed commands or a clean/reset command against
production.

The multi-leg acceptance simulator is available in local development only; its API endpoint
is disabled when `NODE_ENV=production` to prevent test shipments from being written to live
operational records.

### 4. Running Locally

Launch both the backend API server and the frontend client development server in separate terminal windows:

```bash
# Terminal 1: Start Express API server (Port 4000)
npm run start

# Terminal 2: Start Vite client dev server (Port 5173)
npm run dev
```

Open your browser and navigate to:
```
http://localhost:5173
```

---

## 10. Environment Configuration

All environment variables are documented with sensible defaults in [`.env.example`](file:///c:/Users/ariic/Documents/Logistics%20Platform/.env.example):

| Variable | Default | Purpose & Constraints |
| :--- | :--- | :--- |
| `PORT` | `4000` | Backend Express HTTP port |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `DEMO_MODE` | `true` | Enables simulated demo switch endpoints; set `false` in production |
| `DB_CLIENT` | `sqlite` | Primary database driver (`postgres` or `sqlite`) |
| `DATABASE_URL` | `postgres://...` | Connection URI for PostgreSQL instances |
| `DATABASE_PATH` | `data/logistics_platform.db` | Local file path when running in SQLite mode |
| `JWT_SECRET` | `...` | Secret key for signing JWTs (must be >= 32 chars in production) |
| `SESSION_EXPIRY`| `24h` | JWT session token validity window |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origin URLs for browser API calls |
| `WORKER_INTERVAL_MS` | `15000` | Polling interval for background notifications outbox |
| `PGPOOL_MAX` | `25` | Maximum pooled client connections in PostgreSQL mode |
| `PGPOOL_MIN` | `5` | Minimum idle connections preserved in pool |
| `DARAJA_ENVIRONMENT` | `sandbox` | Safaricom Daraja API mode (`sandbox` or `production`) |
| `DARAJA_CONSUMER_KEY` | `""` | Safaricom Daraja 3.0 API Consumer Key |
| `DARAJA_CONSUMER_SECRET` | `""` | Safaricom Daraja 3.0 API Consumer Secret |
| `DARAJA_SHORTCODE` | `174379` | Safaricom M-Pesa Paybill or Till number |
| `DARAJA_PASSKEY` | `...` | Lipa Na M-Pesa Online passkey for STK Push |
| `DARAJA_CALLBACK_URL` | `https://...` | Public HTTPS webhook endpoint for payment callbacks |

---

## 11. Repository Structure

```
swifttrack/
├── .github/
│   └── workflows/
│       └── ci.yml                   # Automated GitHub Actions test & build workflow
├── client/                          # React 18 + Vite frontend SPA
│   ├── src/
│   │   ├── components/              # UI instruments (Sidebar, Navbar, StatCards, Telemetry)
│   │   ├── context/                 # AuthContext, ThemeContext (WCAG AAA dark/light modes)
│   │   ├── services/                # Unified API client & sound engine chimes
│   │   ├── views/                   # Operational screens (Control Tower, Multi-Leg, POS, POD)
│   │   ├── App.jsx                  # Root view router & role authorization barrier
│   │   ├── index.css                # Dieter Rams design tokens & Tailwind CSS v4
│   │   └── main.jsx                 # Client entry point
│   ├── package.json                 # Client dependencies & Vite scripts
│   └── vite.config.js               # Bundler configuration
├── data/                            # Local SQLite storage (WAL mode)
│   └── logistics_platform.db
├── docs/                            # Production documentation & operational runbooks
│   ├── API.md                       # Complete OpenAPI & REST API specification
│   ├── ARCHITECTURE.md              # Domain design, state machines, and database architecture
│   └── RUNBOOK.md                   # Operational incident response, backups, and migration drills
├── scripts/                         # Operational & maintenance utilities
│   └── migrate-sqlite-to-postgres.js# Automated cross-database migration tool
├── server/                          # Express.js backend application
│   ├── db/
│   │   ├── postgres/
│   │   │   ├── migrations/          # 27 Authoritative PostgreSQL migration files
│   │   │   ├── migrator.js          # Programmatic migration runner (up, rollback, status)
│   │   │   ├── pool.js              # Connection pooling & health checks
│   │   │   ├── transactions.js      # ACID transaction execution helper
│   │   │   └── seed.js              # PostgreSQL reference seed engine
│   │   ├── dbAdapter.js             # Dual-engine unified SQL abstraction layer
│   │   ├── database.js              # SQLite engine with audit triggers
│   │   ├── seed.js                  # Production & demo seed foundations
│   │   ├── seedDemoBranches.js      # Multi-branch simulation generator
│   │   └── backup.js                # SHA-256 verified snapshot backup engine
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification & RBAC authorization guards
│   │   └── security.js              # Rate limiting, security headers, CORS guards
│   ├── repositories/                # Domain data-access repositories
│   │   ├── shipmentRepository.js    # Shipments, parcels, legs
│   │   ├── transportRepository.js   # Corridors, runs, manifests, checkpoints
│   │   ├── vehicleRepository.js     # Fleet vehicles & availability
│   │   ├── driverRepository.js      # Driver profiles & duty status
│   │   ├── hubRepository.js         # Hubs, warehouses, bays
│   │   ├── custodyRepository.js     # Barcode scans, custody handoffs, variances
│   │   ├── lastMileRepository.js    # Dispatches, delivery attempts, POD
│   │   ├── codRepository.js         # COD tracking & managerial reconciliation
│   │   ├── notificationRepository.js# Transactional outbox persistence
│   │   ├── auditRepository.js       # Forensic audit trail access
│   │   └── index.js                 # Unified repository registry
│   ├── routes/                      # REST API endpoints
│   │   ├── auth.js                  # Authentication, sessions, 2FA
│   │   ├── shipments.js             # Shipment lifecycle & waybills
│   │   ├── transport.js             # Corridors & manifest dispatch
│   │   ├── custody.js               # Scans & custody handoffs
│   │   ├── lastMile.js              # Driver mobile routes & POD
│   │   ├── cod.js                   # COD reconciliation & remittance
│   │   ├── controlTower.js          # Control tower observability & telemetry
│   │   ├── offlineSync.js           # Idempotent edge operations
│   │   ├── pos.js                   # Logistics counter booking & tenders
│   │   └── ...                      # Additional routes (inventory, procurement, etc.)
│   ├── services/                    # Core business domain services
│   │   ├── shipmentService.js       # Canonical state machine engine
│   │   ├── transportService.js      # Manifest locking & transport runs
│   │   ├── lastMileService.js       # Delivery attempts (BR-008) & OTP POD
│   │   ├── codService.js            # COD ledger & variance justifications (BR-010)
│   │   ├── notificationsService.js  # Transactional outbox delivery engine
│   │   └── e2eAcceptanceService.js  # 23-step consignment journey orchestrator
│   ├── utils/
│   │   ├── security.js              # Scrypt hashing with 16-byte dynamic salts
│   │   └── totp.js                  # Native RFC 6238 TOTP two-factor engine
│   ├── workers/
│   │   └── notificationWorker.js    # Exponential backoff outbox processor
│   └── server.js                    # Express app initialization & HTTP listener
├── tests/                           # 46 Automated verification test suites
│   ├── logistics/                   # Logistics core & operational suites
│   ├── database/                    # PostgreSQL migrations & repository architecture
│   ├── security/                    # SQL injection, CSRF, XSS, headers
│   ├── inventory/                   # Stock operations & inter-branch transfers
│   ├── procurement/                 # PO lifecycle & vendor workflows
│   ├── commerce/                    # Pricing matrices & product variants
│   ├── customers/                   # Customer CRM & credit limits
│   ├── orders/                      # Order engine & receipt printing
│   ├── payments/                    # M-Pesa STK push & payment tenders
│   ├── pos/                         # POS counter workflow & barcode scanner
│   └── verify-system.js             # 14-flow end-to-end integration suite
├── Dockerfile                       # Multi-stage production container definition
├── docker-compose.yml               # PostgreSQL 16 + API + Worker orchestration
├── .env.example                     # Environment template
└── package.json                     # Root project configuration & scripts
```

---

## 12. Production Documentation Suite

Comprehensive architecture, API contracts, incident runbooks, and production readiness certifications are available in the repository documentation suite:

| Document | File Path | Scope & Focus |
| :--- | :--- | :--- |
| **System Architecture Specification** | [`docs/ARCHITECTURE.md`](file:///c:/Users/ariic/Documents/Logistics%20Platform/docs/ARCHITECTURE.md) | Component architecture, domain state machines, dual-engine `dbAdapter`, 27 migrations, retention, outbox pattern, and security pillars. |
| **REST API Reference & Specification** | [`docs/API.md`](file:///c:/Users/ariic/Documents/Logistics%20Platform/docs/API.md) | Complete OpenAPI / REST endpoints, request/response JSON schemas, rate limits, status codes, and error code matrix. |
| **Production Incident & Operations Runbook** | [`docs/RUNBOOK.md`](file:///c:/Users/ariic/Documents/Logistics%20Platform/docs/RUNBOOK.md) | Pre-flight checklists, PostgreSQL migration drills, snapshot backups, RPO/RTO targets, worker queue management, and emergency response playbooks. |
| **Production Readiness Certification** | [`PROD-READINESS.md`](file:///c:/Users/ariic/Documents/Logistics%20Platform/PROD-READINESS.md) | Authoritative certification deliverable, 28-area readiness matrix, feature completion matrix, and attestation record. |
| **Machine-Readable Attestation** | [`tests/production-readiness-certification.json`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/production-readiness-certification.json) | Structured compliance metadata and operational domain seals. |

---

## License

Proprietary — All rights reserved. Developed for SwiftTrack Logistics.
