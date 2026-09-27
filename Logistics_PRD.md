# SwiftTrack Logistics — Product Requirements Document

**Status:** Draft for product discovery  
**Version:** 0.1  
**Product:** SwiftTrack Logistics  
**Domain:** Parcel logistics, regional transport, and last-mile delivery

> This is a product hypothesis, not a record of completed customer interviews. Business rules, operational practices, pricing, regulatory requirements, payment rails, connectivity assumptions, and role definitions must be validated with real operators before implementation is treated as final.

---

## 1. Executive Summary

SwiftTrack Logistics is an operations platform for parcel and courier businesses that receive shipments, move them through a network of hubs, transport them across one or more route legs, and complete customer pickup or last-mile delivery.

The product is built around one operational question:

> **Where is this shipment, who currently has responsibility for it, what has happened to it, what happens next, and has the money and delivery evidence been reconciled?**

The core journey is:

```text
BOOK → PRICE → PAY → ACCEPT → SCAN → SORT → CONSOLIDATE → MOVE
→ TRACK → RECEIVE → DELIVER / PICK UP → PROVE → RECONCILE
```

SwiftTrack is intentionally focused on parcel and last-mile operations rather than becoming a generic ERP for every logistics category.

---

## 2. Product Vision

### Vision

Build a reliable operating system for businesses that move parcels through regional networks and last-mile delivery operations.

### Product promise

SwiftTrack gives operators one operational record for every shipment from booking through final delivery.

### Primary value propositions

- Complete shipment visibility.
- Traceable custody and movement.
- Structured transport and delivery operations.
- Reliable proof of delivery.
- Controlled payment and COD reconciliation.
- Centralized exception handling.
- Self-service customer tracking.

---

## 3. Target Customer

### 3.1 Primary customer profile

The initial target is a parcel/courier/logistics business that:

- accepts customer shipments;
- operates one or more branches, hubs, or agent locations;
- moves shipments between locations;
- uses drivers or transport operators;
- offers customer pickup and/or last-mile delivery;
- accepts multiple payment methods;
- needs shipment tracking and operational visibility.

The initial product should suit regional operators moving shipments between cities, towns, remote locations, and potentially national borders.

### 3.2 Example operating models

```text
Branch → Branch
Hub → Hub
Hub → Branch → Customer
Customer → Hub → Hub → Customer
Customer → Hub → Transport Run → Last Mile → Recipient
```

### 3.3 Initial boundaries

The first product is not intended to be a full system for ocean freight, airline cargo management, customs brokerage, full accounting ERP, heavy warehouse automation, or fleet maintenance management. Those capabilities may be integrated later.

---

## 4. Problems to Solve

### 4.1 Shipment visibility
Operators may know a shipment was booked without knowing its current physical or operational location.

**Solution:** maintain current status, current location, latest event, operational responsibility, transport assignment, and next expected action.

### 4.2 Weak chain of custody
Packages change hands between agents, hub staff, vehicles, drivers, and delivery personnel.

**Solution:** record important handoffs, scans, custody changes, and physical receipt events.

### 4.3 Manual transport coordination
Dispatchers need to know which shipments belong on a particular movement and whether they were actually loaded and received.

**Solution:** route legs, transport runs, manifests, load/unload events, drivers, and vehicles.

### 4.4 Failed deliveries
A failed delivery should lead to an operational next step rather than a dead-end status.

**Solution:** delivery attempts, reasons, rescheduling, customer contact, and return-to-hub workflows.

### 4.5 Customer support overload
Customers repeatedly ask where their parcels are because internal systems do not expose reliable tracking.

**Solution:** public shipment lookup by tracking number and automated milestone notifications.

### 4.6 Payment and COD leakage
Collections become difficult to reconcile after money moves through drivers, branches, and finance staff.

**Solution:** separate charges, payments, COD obligations, collections, deposits/remittances, reconciliation, and variance handling.

### 4.7 Operational exceptions
Delays, missing packages, damage, wrong routing, breakdowns, recipient unavailability, and payment problems are part of real operations.

**Solution:** explicit exception workflows with responsibility, status, resolution, and audit history.

---

## 5. Product Principles

1. **Shipment-first:** the shipment is the primary business object; POS, transport, delivery, and payments support its lifecycle.
2. **Event-backed state:** current status is supported by a historical event trail.
3. **Physical reality matters:** the system distinguishes expected state from what was physically received, loaded, transported, or handed over.
4. **Exceptions are workflows:** operational failure is expected and must be managed.
5. **Offline-capable at the edge:** driver and field workflows must tolerate intermittent connectivity.
6. **Server-side enforcement:** authorization, state transitions, payment validation, custody, and financial invariants cannot depend on the frontend.
7. **Auditability by default:** critical operational and financial mutations leave immutable evidence.

---

## 6. Core Actors

| Actor | Primary responsibilities |
|---|---|
| Owner / Admin | Organization-wide visibility, configuration, users, pricing and controls |
| Operations Manager | Network monitoring, exception resolution, operational oversight |
| Hub Manager | Hub operations, staff, receiving, sorting, dispatch |
| Dispatcher | Transport planning, driver/vehicle assignment, run management |
| Intake Agent | Customer booking, pricing, payment, labeling and acceptance |
| Hub/Warehouse Operator | Receiving, scanning, sorting, loading and unloading |
| Driver | Assigned transport runs, scans, movement updates and delivery tasks |
| Delivery Operator | Last-mile delivery and proof of delivery |
| Finance User | Payments, COD, refunds and reconciliation |
| Customer / Sender | Shipment creation, payment, tracking and support |
| Recipient | Tracking, pickup/delivery and receipt confirmation |
| Support User | Shipment investigation and customer assistance |

Roles may be combined in smaller businesses. Permissions should remain capability-based.

---

## 7. Product Modules

### 7.1 Network Management

Manage organizations, hubs, branches, locations, service areas, routes, route legs, and operating schedules.

### 7.2 Customer Management

Manage individuals, businesses, senders, recipients, addresses, contacts, history, corporate accounts, and contract pricing where applicable.

### 7.3 Shipment Management

Manage shipment identity, tracking number, origin, destination, sender, recipient, service type, declared value, chargeable weight, dimensions, parcel count, status, lifecycle and notes.

A shipment may contain one or more parcels.

### 7.4 Pricing

Support configurable pricing rules such as flat route price, weight bands, distance, dimensional weight, delivery type, special handling, remote-area surcharge, contract pricing, discounts, and COD fees. The actual pricing model must be validated.

### 7.5 Payments & Billing

Support cash, mobile money, card, bank transfer, and customer-account/credit where required. Payments must be attributable, validated, auditable, idempotent, and reconcilable.

### 7.6 Hub Operations

Support receiving, barcode/QR scanning, sorting, temporary storage, loading, unloading, handoffs, manifests, and discrepancy handling.

### 7.7 Transport Management

Support routes, route legs, transport runs, drivers, vehicles, manifests, shipment assignment, departure, checkpoints, arrival, and transport exceptions.

**Route leg** = planned network connection.  
**Transport run** = actual execution of a route leg.

### 7.8 Tracking

Track booking, acceptance, scans, hub arrival/departure, transport assignment, transit events, delivery attempts, delivery, and exceptions.

### 7.9 Last-Mile Delivery

Support delivery creation, assignment, driver acceptance, stops, contact information, delivery attempts, rescheduling, failed delivery, and return-to-hub.

### 7.10 Proof of Delivery

Support configurable evidence including OTP, recipient name, signature, photo, GPS, timestamp, and device information.

### 7.11 Exceptions & Claims

Manage delayed, lost, damaged, misrouted, recipient-unavailable, wrong-address, refused, partial-delivery, vehicle-breakdown, payment, and border/customs exceptions. Claims can become a more advanced module later.

### 7.12 COD & Reconciliation

Track expected → collected → remitted/deposited → reconciled, including variances, collector, method, deposit/reference, approvals, and audit.

### 7.13 Notifications

Support SMS, WhatsApp, email, and push where available. Notification processing must not block the core shipment transaction and failed sends must be retryable.

### 7.14 Reporting & Control Tower

Provide network-wide operational visibility: shipment counts, status distribution, hub activity, delayed shipments, exceptions, transport runs, deliveries, COD, revenue, and reconciliation.

### 7.15 Audit & Governance

Audit critical status transitions, pricing changes/overrides, payments, refunds, COD reconciliation, assignment changes, user/permission changes, exception resolution, and critical master-data changes.

---

## 8. Core Domain Model

### 8.1 Principal entities

```text
Organization
Hub
ServiceArea
Route
RouteLeg

Customer
CustomerAddress

Shipment
Parcel
ShipmentLeg
TrackingEvent
Handoff
ScanEvent

TransportRun
Manifest
ManifestItem

Driver
Vehicle

Delivery
DeliveryAttempt
ProofOfDelivery

Charge
Payment
Refund
CODSettlement

Exception
Claim

Notification
Document

User
Role
Permission
AuditLog
```

### 8.2 Principal relationships

```text
Customer
   │
   ▼
Shipment
   ├── Parcel(s)
   ├── ShipmentLeg(s)
   ├── TrackingEvent(s)
   ├── Payment(s)
   ├── Exception(s)
   └── Delivery(s)
          ├── DeliveryAttempt(s)
          └── ProofOfDelivery

Route
  ↓
RouteLeg
  ↓
TransportRun
  ├── Driver
  ├── Vehicle
  └── Manifest
          ↓
      ManifestItems
          ↓
       Shipments
```

A shipment may travel over multiple legs:

```text
Shipment S1
  Leg 1: Narus → Kapoeta
  Leg 2: Kapoeta → Torit
  Leg 3: Torit → Juba
```

---

## 9. Core Operational Workflows

### 9.1 Booking

```text
Customer
  ↓
Intake Agent
  ↓
Sender + Recipient
  ↓
Parcel details
  ↓
Origin + Destination
  ↓
Pricing
  ↓
Payment / Pay on Delivery
  ↓
Shipment created
  ↓
Tracking number + waybill
```

### 9.2 Hub intake

```text
Shipment arrives
  ↓
Scan
  ↓
Verify expected shipment
  ↓
Record condition
  ↓
Accept into hub
  ↓
Sort
```

### 9.3 Transport

```text
Pending shipments
  ↓
Select route leg
  ↓
Create transport run
  ↓
Assign vehicle + driver
  ↓
Create manifest
  ↓
Load + scan
  ↓
Dispatch
  ↓
Transit events
  ↓
Arrive
  ↓
Unload + receive
```

### 9.4 Multi-leg shipment

```text
Shipment
   ↓
Leg 1
   ↓
Hub A
   ↓
Leg 2
   ↓
Hub B
   ↓
Leg 3
   ↓
Destination
```

### 9.5 Last mile

```text
Ready for delivery
  ↓
Create delivery
  ↓
Assign driver
  ↓
Driver accepts
  ↓
Out for delivery
  ↓
Attempt
  ├── Success → POD → Delivered
  └── Failure → Reason → Reschedule / Return
```

### 9.6 COD

```text
Expected
  ↓
Collected
  ↓
Remitted / Deposited
  ↓
Reconciled
  ↓
Variance resolved
```

---

## 10. Shipment Lifecycle

The exact status model is subject to discovery. Initial proposal:

```text
DRAFT
  ↓
BOOKED
  ↓
PAYMENT_PENDING / PAID
  ↓
ACCEPTED
  ↓
AT_ORIGIN_HUB
  ↓
SORTED
  ↓
READY_FOR_DISPATCH
  ↓
LOADED
  ↓
IN_TRANSIT
  ↓
AT_HUB
  ↓
READY_FOR_PICKUP / READY_FOR_DELIVERY
  ↓
OUT_FOR_DELIVERY
  ↓
DELIVERED
```

Alternative or interrupting states may include:

```text
CANCELLED
ON_HOLD
EXCEPTION
DELIVERY_FAILED
RETURNED
```

The backend must enforce valid transitions; arbitrary status updates are prohibited.

---

## 11. Transport Run Lifecycle

```text
PLANNED
  ↓
READY_FOR_LOADING
  ↓
LOADING
  ↓
LOADED
  ↓
DISPATCHED
  ↓
IN_TRANSIT
  ↓
ARRIVED
  ↓
UNLOADING
  ↓
COMPLETED
```

Possible exception states include `DELAYED`, `BREAKDOWN`, and `CANCELLED`.

---

## 12. Delivery Lifecycle

```text
CREATED
  ↓
ASSIGNED
  ↓
ACCEPTED
  ↓
OUT_FOR_DELIVERY
  ↓
DELIVERY_ATTEMPTED
  ├── SUCCESS → DELIVERED
  └── FAILED → RESCHEDULED / RETURN_TO_HUB
```

A delivery can have multiple attempts.

---

## 13. Business Rules

| ID | Rule |
|---|---|
| BR-001 | Every shipment must have a globally unique tracking number. |
| BR-002 | A shipment remains the same business object across transport legs. |
| BR-003 | A shipment may have multiple transport legs. |
| BR-004 | A route leg is not a transport run; runs execute route legs. |
| BR-005 | A shipment cannot be considered loaded unless present on the run manifest. |
| BR-006 | Destination arrival must support expected-versus-received discrepancy detection. |
| BR-007 | Successful delivery requires the POD evidence configured for that delivery. |
| BR-008 | A failed delivery requires a reason. |
| BR-009 | Financial mutations must be represented by explicit financial operations, not direct status edits. |
| BR-010 | COD reconciliation must identify expected, collected, deposited/remitted, and variance amounts. |
| BR-011 | Users may only perform actions permitted by their role and operational scope. |
| BR-012 | Critical mutations must be auditable. |
| BR-013 | Retried client operations must not create duplicate business records. |
| BR-014 | Offline sync operations must have stable client operation IDs. |

---

## 14. Functional Requirements

### SHP — Shipment

- **SHP-001:** Authorized users shall create shipments.
- **SHP-002:** The system shall generate unique tracking numbers.
- **SHP-003:** The system shall record sender and recipient information.
- **SHP-004:** A shipment shall support one or more parcels.
- **SHP-005:** A shipment shall have origin and destination.
- **SHP-006:** The system shall maintain current shipment state.
- **SHP-007:** The system shall maintain immutable shipment event history.
- **SHP-008:** Invalid lifecycle transitions shall be rejected.

### PAR — Parcel

- **PAR-001:** Record weight.
- **PAR-002:** Optionally record dimensions.
- **PAR-003:** Support parcel count.
- **PAR-004:** Support condition recording at defined handoffs.

### HUB — Hub Operations

- **HUB-001:** Authorized users shall receive shipments.
- **HUB-002:** Receipt shall identify the hub.
- **HUB-003:** The system shall support barcode/QR scanning.
- **HUB-004:** The system shall support incoming shipment discrepancy recording.
- **HUB-005:** The system shall support sorting and outbound preparation.

### TRN — Transport

- **TRN-001:** Authorized users shall create transport runs from route legs.
- **TRN-002:** A run shall have an origin and destination.
- **TRN-003:** A run shall support driver and vehicle assignment.
- **TRN-004:** A run shall have a manifest.
- **TRN-005:** The system shall record loading.
- **TRN-006:** The system shall record unloading/receiving.
- **TRN-007:** Shipments shall support multi-leg movement.

### TRK — Tracking

- **TRK-001:** Significant shipment movements shall generate tracking events.
- **TRK-002:** Events shall record timestamp and source.
- **TRK-003:** Events may reference hub/location, user, run and notes.
- **TRK-004:** Internal users shall see current status and history within their scope.
- **TRK-005:** Customers shall be able to perform tracking-number lookup without an account.

### DLV — Delivery

- **DLV-001:** Authorized users shall create delivery tasks.
- **DLV-002:** Authorized dispatchers shall assign delivery tasks.
- **DLV-003:** Drivers shall only see assignments within their scope.
- **DLV-004:** Deliveries shall support multiple attempts.
- **DLV-005:** Failed attempts shall require a reason.
- **DLV-006:** Failed deliveries shall support rescheduling.
- **DLV-007:** The system shall support return-to-hub.

### POD — Proof of Delivery

- **POD-001:** POD method shall be configurable.
- **POD-002:** POD capture shall record timestamp.
- **POD-003:** POD shall identify actor/device where applicable.
- **POD-004:** The system shall support signature, OTP, photo and GPS evidence where configured.
- **POD-005:** POD records shall be protected against ordinary user modification.

### PAY — Payments

- **PAY-001:** Multiple payments shall be supported where business rules allow.
- **PAY-002:** Payment references shall be stored.
- **PAY-003:** Duplicate payment submission shall be prevented through idempotency.
- **PAY-004:** Payment state shall derive from financial records.
- **PAY-005:** Financial transactions shall support currency.

### COD — Cash on Delivery

- **COD-001:** COD shall be represented as a shipment financial obligation.
- **COD-002:** Expected amount shall be stored.
- **COD-003:** Collected amount shall be stored.
- **COD-004:** Remittance/deposit shall be stored.
- **COD-005:** Variance shall be identifiable.
- **COD-006:** Reconciliation shall require appropriate authorization.

### EXC — Exceptions

- **EXC-001:** Authorized users shall raise shipment exceptions.
- **EXC-002:** Exceptions shall have type and status.
- **EXC-003:** Critical exceptions shall be visible in operations dashboards.
- **EXC-004:** Resolution shall be auditable.
- **EXC-005:** The system shall support delayed, lost, damaged, misrouted and failed-delivery cases.

### NTF — Notifications

- **NTF-001:** Configured shipment milestones shall generate notification events.
- **NTF-002:** Notification failure shall not roll back the shipment transaction.
- **NTF-003:** Failed notifications shall be retryable.
- **NTF-004:** Delivery attempts shall be logged.

### AUD — Audit

- **AUD-001:** Critical changes shall create immutable audit records.
- **AUD-002:** Audit records shall identify actor, entity, action, time and before/after data where applicable.
- **AUD-003:** Ordinary APIs shall not permit audit record modification.

---

## 15. Cross-Border Capability

Cross-border handling is a conditional capability of a shipment leg, not a universal shipment state.

```text
Shipment Leg
  ↓
Cross-border required?
  ├── No → continue normal process
  └── Yes
       ↓
   Border workflow
       ↓
   Pending / Submitted / Cleared / Held
```

Where applicable, SwiftTrack should support:

- border point;
- regulatory/customs process status;
- document references;
- attachments;
- submission and clearance timestamps;
- hold reason;
- responsible operator.

The exact requirements and documents must be confirmed for each target corridor and shipment type.

---

## 16. Offline & Synchronization Requirements

Field applications must be able to perform selected operations without a live connection.

### Candidate offline operations

- viewing assigned tasks;
- scanning shipments;
- recording movement events;
- recording delivery attempts;
- capturing POD;
- recording selected payment information.

### Synchronization flow

```text
User Action
  ↓
Local Operation ID
  ↓
Local Queue
  ↓
Reconnect
  ↓
Server Idempotency Check
  ↓
Validation
  ↓
Apply
  ↓
Acknowledgement
```

Syncable operations should carry:

- operation ID;
- device ID;
- actor;
- created-at timestamp;
- entity;
- operation type;
- payload;
- synchronization state.

Conflict rules must be explicit. Critical operations must not silently overwrite a newer server state.

---

## 17. Security & Authorization

### Authentication

The platform should support secure authentication, session management, password security, and optional MFA for privileged users.

### Authorization

Permissions should be capability-based, for example:

```text
shipment.create
shipment.view
shipment.cancel
shipment.status_update
transport.create
transport.assign
transport.dispatch
transport.receive
delivery.assign
delivery.attempt
delivery.complete
payment.create
refund.approve
cod.reconcile
```

Operational scopes should support:

```text
GLOBAL
NETWORK
HUB
RUN
SHIPMENT
DELIVERY
SELF
```

The backend must enforce these scopes.

---

## 18. Non-Functional Requirements

### Reliability

Critical shipment, payment, manifest, custody, and reconciliation operations must be transactional.

### Performance

Operational pages and critical APIs must have defined response-time targets under expected branch/field conditions before production certification.

### Availability

Production must have an agreed uptime target and documented recovery process.

### Security

Use secure transport, protected secrets, server-side authorization, input validation, safe file handling, rate limiting, and secure session/token handling.

### Offline resilience

Field workflows must tolerate temporary disconnection and synchronize without duplicate mutations.

### Observability

Provide request IDs, structured logs, error tracking, health checks, metrics, and background-job monitoring.

### Backup and recovery

Use automated off-host backups, tested restoration, a defined RPO, and a defined RTO.

---

## 19. Integration Requirements

Potential integrations:

```text
SMS
Mobile Money
Banks
Maps / Routing
WhatsApp
Email
Barcode / QR
Receipt / Label Printers
Object Storage
Accounting Systems
External Websites / Portals
```

Provider-specific implementations should sit behind service interfaces where practical.

---

## 20. Control Tower

The main internal dashboard should answer three questions.

### What is happening now?

```text
Shipments today
In transit
At hubs
Ready for delivery
Out for delivery
Delivered
Exceptions
```

### What needs attention?

```text
Delayed shipments
Unreceived shipments
Manifest discrepancies
Failed deliveries
COD variances
Payment failures
Border/customs holds
```

### What is moving?

```text
Active transport runs
Drivers
Vehicles
Routes
Expected arrivals
```

---

## 21. Customer Tracking

Public tracking requires only a tracking number for basic status lookup.

Example:

```text
STK-100245

Current status: IN TRANSIT
Current location: Torit Hub
Route: Kapoeta → Torit → Juba

✓ Booked
✓ Received at Kapoeta
✓ Loaded
✓ Departed Kapoeta
✓ Arrived Torit
● Preparing for next leg
○ Delivered
```

The public view must avoid exposing unnecessary internal or sensitive information.

---

## 22. Reporting

### Operations

- shipment volume;
- status distribution;
- hub throughput;
- delayed shipments;
- exception rate;
- delivery success rate;
- average attempts.

### Transport

- active runs;
- completed runs;
- route volume;
- vehicle utilization;
- driver activity.

### Financial

- shipment revenue;
- payment collection;
- COD outstanding;
- COD variance;
- refunds;
- reconciliation.

### Customer

- shipment history;
- repeat usage;
- corporate volume where supported;
- delivery performance.

---

## 23. MVP Definition

The MVP succeeds only when one real shipment can travel through the complete core workflow.

### MVP vertical slice

```text
Create Customer
  ↓
Book Shipment
  ↓
Calculate Charge
  ↓
Record Payment
  ↓
Generate Tracking Number
  ↓
Receive at Origin Hub
  ↓
Scan / Sort
  ↓
Create Transport Run
  ↓
Create Manifest
  ↓
Load
  ↓
Dispatch
  ↓
Arrive at Destination Hub
  ↓
Receive
  ↓
Create Delivery
  ↓
Driver Accepts
  ↓
Out for Delivery
  ↓
POD
  ↓
Delivered
  ↓
Customer Tracking Updated
  ↓
Financial State Reconciled
```

### Minimum exception coverage

- shipment delay;
- manifest discrepancy;
- failed delivery;
- payment failure.

---

## 24. MVP Scope

### In scope

- single organization deployment;
- hub management;
- customer management;
- shipment booking;
- parcel details;
- configurable basic pricing;
- cash + one mobile-money rail;
- tracking number;
- shipment event history;
- hub receiving;
- scanning;
- route legs;
- transport runs;
- manifests;
- drivers;
- vehicles;
- delivery tasks;
- basic driver application;
- POD;
- public shipment tracking;
- basic exceptions;
- basic COD reconciliation;
- audit;
- RBAC;
- notifications;
- PostgreSQL backend.

### Out of scope for initial MVP

- advanced route optimization;
- full accounting;
- complex contract billing;
- advanced fleet maintenance;
- AI predictions;
- deep customs automation;
- marketplace functionality;
- multi-tenant SaaS administration;
- warehouse automation.

---

## 25. Roadmap

### V1 — End-to-End Shipment Operations

Booking, payment, hub receiving, tracking, manifests, transport runs, destination receiving, delivery, POD, and basic reconciliation.

**Goal:** prove a shipment can be managed end-to-end.

### V2 — Network Operations

Multiple hubs/routes, multi-leg movement, richer scanning, driver workflows, COD, multiple payment rails, notifications, stronger exceptions, and operations dashboards.

**Goal:** run a regional network through the platform.

### V3 — Operational Intelligence

SLA monitoring, delay analytics, hub throughput, route performance, vehicle utilization, customer analytics, and automated exception alerts.

**Goal:** move from system of record to system of operational intelligence.

### V4 — Ecosystem

Customer portals, corporate portals, public API, WhatsApp, maps/routing, accounting integrations, advanced cross-border workflows, and additional payment providers.

---

## 26. Success Metrics

### Operational

- percentage of shipments with complete event history;
- percentage of active shipments with known current location;
- shipment processing time;
- hub processing time;
- transport delay rate;
- delivery success rate;
- exception rate.

### Financial

- payment reconciliation rate;
- COD reconciliation rate;
- payment variance;
- refund rate;
- revenue by route/hub/service.

### Customer

- tracking usage;
- support inquiries per shipment;
- repeat-customer rate;
- delivery-notification engagement.

### Reliability

- duplicate-operation rate;
- synchronization failure rate;
- API error rate;
- notification failure rate;
- POD capture failure rate.

---

## 27. Existing SwiftTrack Reuse Strategy

The existing repository contains useful foundations and should be migrated rather than discarded.

### Reuse directly where appropriate

```text
Authentication
RBAC
Audit logging
Security middleware
API validation
Idempotency
Notifications foundation
Driver foundation
Fleet foundation
Dispatch foundation
Delivery/POD foundation
Customer foundation
Reporting foundation
```

### Transform

```text
POS
→ Counter booking + payment

Orders
→ Shipment domain

Transfers
→ Transport / shipment movement

Inventory concepts
→ Physical custody/package movement where applicable
```

### New core domains

```text
Shipment
Parcel
ShipmentLeg
TrackingEvent
ScanEvent
Handoff
TransportRun
Manifest
ManifestItem
Delivery
DeliveryAttempt
ProofOfDelivery
Exception
CODSettlement
```

### Deprioritize

Retail-specific features that do not strengthen the shipment lifecycle.

---

## 28. Technical Architecture Direction

Use a modular monolith initially.

```text
Web App + Driver App
        ↓
API Layer
        ↓
Application Services
        ├── Shipments
        ├── Customers
        ├── Pricing
        ├── Payments
        ├── Hubs
        ├── Transport
        ├── Tracking
        ├── Delivery
        ├── Exceptions
        ├── Notifications
        └── Reporting
        ↓
Repositories / Data Access
        ↓
PostgreSQL
```

Supporting infrastructure may include:

```text
Redis
 ├── cache
 ├── rate limiting
 ├── idempotency
 └── jobs

Object Storage
 ├── POD photos
 ├── signatures
 └── documents

Workers
 ├── SMS
 ├── notifications
 ├── synchronization
 ├── reports
 └── reconciliation
```

Core domain rules should not live directly inside Express route handlers.

---

## 29. Migration Strategy from Current SwiftTrack

### Stage 1 — Stabilize foundation

Before major domain migration:

- make PostgreSQL the live production persistence layer;
- eliminate split SQLite/PostgreSQL behavior;
- establish consistent repositories/services;
- harden authorization;
- correct idempotency principal binding;
- remove unsafe seeded production credentials;
- correct backup/restore claims;
- establish reliable CI verification.

### Stage 2 — Introduce shipment core

Build:

```text
Shipment
Parcel
TrackingEvent
ShipmentLeg
```

Keep existing retail features temporarily so the migration remains incremental.

### Stage 3 — Introduce transport

Build:

```text
Route
RouteLeg
TransportRun
Manifest
Vehicle
Driver
```

and connect them to shipments.

### Stage 4 — Introduce physical custody

Build:

```text
ScanEvent
Handoff
HubReceiving
Discrepancy
```

### Stage 5 — Build last mile

Build:

```text
Delivery
DeliveryAttempt
POD
Exception
```

### Stage 6 — Reposition the POS

The existing POS becomes a shipment booking/payment interface at a counter:

```text
Counter
  ↓
Shipment booking
  ↓
Pricing
  ↓
Payment
  ↓
Receipt / Waybill
```

---

## 30. End-to-End Acceptance Test

### Scenario

A customer books a parcel from one hub to another through an intermediate hub.

### Expected behavior

1. Shipment is created.
2. Unique tracking number is generated.
3. Charge is calculated.
4. Payment is recorded.
5. Parcel is accepted.
6. Shipment is scanned at origin.
7. Shipment is assigned to a manifest.
8. Manifest is assigned to a transport run.
9. Shipment is recorded as loaded.
10. Transport run departs.
11. Shipment receives an in-transit event.
12. Intermediate/destination hub receives the shipment.
13. Discrepancies are detected and recorded.
14. Shipment is assigned to the next leg.
15. Final destination receives the shipment.
16. Delivery task is created.
17. Driver receives assignment.
18. Delivery attempt is recorded.
19. POD is captured.
20. Shipment becomes delivered.
21. Customer tracking reflects the latest state.
22. Critical events are auditable.
23. Financial state is reconciled.

The same workflow must eventually be tested with offline operation, failed delivery, missing shipments, delayed runs, and retried payments.

---

## 31. Discovery Questions Before Sign-Off

### Business

- What exactly is accepted as a shipment?
- What is the business definition of shipment, parcel, consignment, and package?
- Are customers individuals, businesses, or both?
- How are prices calculated?
- Are corporate contracts supported?
- When is revenue considered earned?

### Operations

- What are the real hubs and branches?
- How are shipments sorted?
- How are manifests created?
- How are handoffs acknowledged?
- Can shipments change route?
- How often do shipments use intermediate hubs?
- How are discrepancies investigated?

### Delivery

- Is customer pickup, last-mile delivery, or both supported?
- How are drivers assigned?
- How many delivery attempts are permitted?
- What constitutes valid POD?
- Is OTP used?

### Finance

- Which payment rails are actually used?
- How is COD collected and remitted?
- Who performs reconciliation?
- Are multiple currencies required?
- Are credit customers supported?

### Cross-border

- Which corridors cross borders?
- What documentation is actually required?
- Who owns border processing?
- Which shipment categories require it?

### Technology

- What devices do agents use?
- Are barcode scanners available?
- Are label/receipt printers available?
- What connectivity conditions exist?
- Which SMS providers cover the required countries?
- Are maps/GPS practical in the operating areas?

---

## 32. Product Boundary

SwiftTrack's core job is:

> **Orchestrate and provide visibility into the movement of shipments through hubs, transport runs, and final delivery.**

The product hierarchy is:

```text
SHIPMENT
   ↓
MOVEMENT
   ↓
DELIVERY
   ↓
EVIDENCE
   ↓
RECONCILIATION
```

Everything else supports this chain.

---

## 33. Final Product Definition

### SwiftTrack Logistics

> **A shipment operations platform for parcel and courier businesses that connects booking, hub handling, transport, tracking, last-mile delivery, proof of delivery, exceptions, and financial reconciliation in one system.**

The central product is not the POS. The POS is one operational entry point into the shipment lifecycle.

---

## 34. PRD Decision Gate

This PRD becomes the implementation baseline only after:

```text
[ ] Target customer confirmed
[ ] Actual operating workflow documented
[ ] Roles validated
[ ] Pricing model validated
[ ] Shipment/parcel definition validated
[ ] Payment rails validated
[ ] COD process validated
[ ] Delivery/POD process validated
[ ] Cross-border requirements validated
[ ] Offline requirements validated
[ ] SMS/provider availability validated
[ ] MVP vertical slice approved
```

Until then, assumptions remain deliberately changeable.
