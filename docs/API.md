# SwiftTrack — REST API Specification & Reference

**Version:** 1.4.0  
**Base URL:** `/api/v1` (Master Versioned) · `/api` (Legacy Aliases Supported)  
**Content-Type:** `application/json`  
**Authentication:** Bearer JWT (`Authorization: Bearer <token>`)  

---

## Domain Scope & Architecture Truth

### Logistics, Linehaul & Courier Operations Reference
This specification document serves as the operational reference manual specifically for the **SwiftTrack Logistics, Linehaul & Courier Operations** domain:
- **Authentication & Staff Identity** (`/api/v1/auth`)
- **Shipments & Consignments** (`/api/v1/shipments`, `/api/v1/tracking`)
- **Linehaul Transport Management & Manifests** (`/api/v1/transport`)
- **Physical Chain of Custody & Hub Operations** (`/api/v1/custody`)
- **Last-Mile Delivery Tasks & Driver Mobile POD** (`/api/v1/deliveries`, `/api/v1/delivery-tasks`)
- **Cash on Delivery (COD) Financial Remittance** (`/api/v1/cod`)
- **Operations Control Tower Telemetry** (`/api/v1/control-tower`)
- **Durable Offline Edge Synchronization** (`/api/v1/offline`)
- **Fleet Vehicles & Driver Management** (`/api/v1/vehicles`, `/api/v1/drivers`)
- **Counter POS Booking & Fiscal Payments** (`/api/v1/pos`, `/api/v1/kenya`)

### Route Coverage & Reference Matrix
The SwiftTrack backend mounts 32 versioned route modules under `/api/v1` (`server/routes/v1/index.js`), comprising 330+ registered endpoints. By architectural design:
- **Logistics & Courier Reference:** Documented in detail in this guide (`docs/API.md`).
- **Retail ERP, Inventory, Governance & General Admin:** Documented in the machine-readable OpenAPI specification at [`server/docs/openapi.json`](file:///c:/Users/ariic/Documents/Logistics%20Platform/server/docs/openapi.json) and browsable interactively via `/api/v1/docs`.

| Route Module | Primary Focus | Documentation Source |
|---|---|---|
| `/auth` | Authentication, JWT sessions, 2FA/TOTP | `docs/API.md` §3 & `server/docs/openapi.json` |
| `/shipments` | Waybills, pricing quotes, parcel rating | `docs/API.md` §4 |
| `/tracking` | Public & consignee parcel tracking | `docs/API.md` §4 |
| `/transport` | Linehaul corridors, runs, manifests, customs | `docs/API.md` §5 |
| `/custody` | Scans, receiving sessions, handoffs, discrepancies | `docs/API.md` §6 |
| `/deliveries` | Dispatch execution, mobile POD, problem reports | `docs/API.md` §7 & `server/docs/openapi.json` |
| `/delivery-tasks` | Driver task lifecycle, attempts, hub returns | `docs/API.md` §7 |
| `/cod` | Float remittance, reconciliation, variance audit | `docs/API.md` §8 |
| `/control-tower` | Network telemetry summary, alerts, hub bottlenecks | `docs/API.md` §9 |
| `/offline` | Edge sync, idempotency replays | `docs/API.md` §10 |
| `/vehicles` | Fleet inventory, capacity, maintenance status | `docs/API.md` §11 |
| `/drivers` | Driver profiles, status history, performance, incidents | `docs/API.md` §11 |
| `/pos` | Counter parcel booking checkout | `docs/API.md` §12 & `server/docs/openapi.json` |
| `/kenya` | M-Pesa Daraja STK push simulation | `docs/API.md` §12 |
| `/branches` | Regional hubs, branches, stations | `server/docs/openapi.json` |
| `/products` | Catalog, SKUs, barcode lookup, pricing | `server/docs/openapi.json` |
| `/inventory` | Warehouse stock balances, adjustments, transfers | `server/docs/openapi.json` |
| `/orders` | Sales orders, order lines, fulfillment | `server/docs/openapi.json` |
| `/dispatch` | Central dispatch board, assignment queue | `server/docs/openapi.json` |
| `/refunds` | Customer refund requests, manager approvals | `server/docs/openapi.json` |
| `/expenses` | Branch operational expense vouchers | `server/docs/openapi.json` |
| `/reports` | KRA 16% VAT schedules, business intelligence | `server/docs/openapi.json` |
| `/audit` | Immutable compliance and security audit logs | `server/docs/openapi.json` |
| `/customers` | Customer directory, credit terms | `server/docs/openapi.json` |
| `/suppliers` | Vendor directory, procurement suppliers | `server/docs/openapi.json` |
| `/brands` | Product brand catalog | `server/docs/openapi.json` |
| `/promotions` | Discount promotions, POS campaigns | `server/docs/openapi.json` |
| `/procurement` | Purchase orders, GRNs, supplier receipts | `server/docs/openapi.json` |
| `/payments` | Payment methods, payment callbacks | `server/docs/openapi.json` |
| `/users` | Staff directory, RBAC roles, branch assignment | `server/docs/openapi.json` |
| `/notifications` | Staff notification bell & in-app alerts | `server/docs/openapi.json` |
| `/notifications-engine` | Automated logistics messaging triggers | Internal Service Engine |
| `/e2e` | Automated end-to-end acceptance scenarios | Internal Test Runner |

---

## Table of Contents

- [1. Architectural Conventions & Response Envelopes](#1-architectural-conventions--response-envelopes)
- [2. Error Codes & HTTP Status Matrix](#2-error-codes--http-status-matrix)
- [3. Authentication & Session Security (`/api/v1/auth`)](#3-authentication--session-security-apiv1auth)
- [4. Shipment Core & Parcel Rating (`/api/v1/shipments`, `/api/v1/tracking`)](#4-shipment-core--parcel-rating-apiv1shipments-apiv1tracking)
- [5. Transport Management & Manifests (`/api/v1/transport`)](#5-transport-management--manifests-apiv1transport)
- [6. Physical Chain of Custody & Hub Operations (`/api/v1/custody`)](#6-physical-chain-of-custody--hub-operations-apiv1custody)
- [7. Last-Mile Delivery & Driver Mobile POD (`/api/v1/deliveries`, `/api/v1/delivery-tasks`)](#7-last-mile-delivery--driver-mobile-pod-apiv1deliveries-apiv1delivery-tasks)
- [8. Cash on Delivery (COD) & Financial Remittance (`/api/v1/cod`)](#8-cash-on-delivery-cod--financial-remittance-apiv1cod)
- [9. Operations Control Tower Telemetry (`/api/v1/control-tower`)](#9-operations-control-tower-telemetry-apiv1control-tower)
- [10. Durable Offline Edge Synchronization (`/api/v1/offline`)](#10-durable-offline-edge-synchronization-apiv1offline)
- [11. Fleet Vehicles & Driver Management (`/api/v1/vehicles`, `/api/v1/drivers`)](#11-fleet-vehicles--driver-management-apiv1vehicles-apiv1drivers)
- [12. Counter POS Booking & Fiscal Output VAT (`/api/v1/pos`, `/api/v1/kenya`)](#12-counter-pos-booking--fiscal-output-vat-apiv1pos-apiv1kenya)

---

## 1. Architectural Conventions & Response Envelopes

### 1.1 Success Response Structure (Reality)
In production, standard v1 REST queries and mutations return **raw domain objects and arrays directly**, rather than wrapped inside a synthetic envelope:

- **Single resource lookups and mutations** return the resource object directly:
  ```json
  {
    "id": 42,
    "waybill_number": "WB-NRB-2026-0042",
    "status": "BOOKED",
    "origin_branch_id": 1,
    "destination_branch_id": 2
  }
  ```
- **List and collection queries** return JSON arrays directly (or an object with collection metadata where pagination applies):
  ```json
  [
    {
      "id": 1,
      "name": "Nairobi Central Hub",
      "code": "NRB-HQ",
      "is_active": 1
    }
  ]
  ```
- **Action/state mutation confirmations** return the affected entity along with confirmation messaging:
  ```json
  {
    "message": "Transport run successfully dispatched",
    "run": {
      "id": 12,
      "run_number": "RUN-NRB-MSA-2026-0012",
      "status": "IN_TRANSIT"
    }
  }
  ```

> [!NOTE]
> **Open Question on Uniform Response Envelopes:**  
> The codebase includes helper utilities (`res.apiSuccess`, `res.apiError` in `server/utils/response.js`) designed for a uniform `{ success: true, data: {...}, meta: {...} }` response envelope. However, active route handlers across the platform return raw domain entities directly (`res.json(shipments)`, `res.json(quote)`, `res.json({ message, run })`). Adopting a mandatory envelope wrapper across all endpoints remains an open architectural question for a future major release; changing response shapes now would break existing mobile, web, and handheld scanning clients. Therefore, this documentation reflects what the API actually returns today.

### 1.2 Error Response Structure
When an error occurs, handlers return an appropriate non-2xx HTTP status code accompanied by an error object:

```json
{
  "error": "Delivery failure requires a valid operational reason code (CUSTOMER_UNAVAILABLE, INCORRECT_ADDRESS, etc.)",
  "code": "BR_008_FAILURE_REASON_REQUIRED"
}
```

---

## 2. Error Codes & HTTP Status Matrix

| HTTP Status | Machine Code | Scenario & Invariant Enforced |
| :---: | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | Missing mandatory schema fields or negative weights/dimensions. |
| `400 Bad Request` | `BR_008_FAILURE_REASON_REQUIRED` | Attempting to record a delivery failure without a valid failure reason. |
| `400 Bad Request` | `BR_010_VARIANCE_JUSTIFICATION_REQUIRED` | Attempting to reconcile a COD batch with discrepancy without an audit memo. |
| `400 Bad Request` | `MANIFEST_LOCKED` | Attempting to modify shipments in a sealed or dispatched manifest (`BR-005`). |
| `401 Unauthorized`| `TOKEN_EXPIRED` / `REVOKED` | JWT access token expired, invalid signature, or revoked in blacklist table. |
| `403 Forbidden`   | `CROSS_BRANCH_FORBIDDEN` | Cashier or dispatcher attempting to access records outside their regional hub. |
| `404 Not Found`   | `ENTITY_NOT_FOUND` | Waybill, transport run, or vehicle ID does not exist. |
| `409 Conflict`    | `IDEMPOTENT_REPLAY` | Operation UUID already committed; returns cached response. |
| `423 Locked`      | `ACCOUNT_LOCKED` | 5 consecutive failed logins triggered a 15-minute brute-force lockout. |

---

## 3. Authentication & Session Security (`/api/v1/auth`)

### 3.1 Authenticate Staff User
`POST /api/v1/auth/login`
- **Rate Limit:** 10 requests per 15 minutes per IP.
- **Request Body:**
  ```json
  {
    "username": "dispatcher.nairobi",
    "password": "dispatcher123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "refreshToken": "7c8e9b4a1f...",
    "user": {
      "id": 4,
      "username": "dispatcher.nairobi",
      "fullName": "Juma Mwangi",
      "role": "DISPATCHER",
      "branchId": 1,
      "branchCode": "NRB-HQ",
      "totpEnabled": false
    }
  }
  ```

### 3.2 Rotate Refresh Token
`POST /api/v1/auth/refresh`
- **Request Body:**
  ```json
  { "refreshToken": "7c8e9b4a1f..." }
  ```
- **Behavior:** Verifies the 7-day refresh token, issues a fresh 15-minute access token, and issues a new single-use refresh token while invalidating the old token immediately.

### 3.3 Terminate Session (Logout)
`POST /api/v1/auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Behavior:** Blacklists the JWT access token `jti` in `revoked_tokens` table and destroys the active session record.

---

## 4. Shipment Core & Parcel Rating (`/api/v1/shipments`, `/api/v1/tracking`)

### 4.1 Calculate Rated Pricing Quote
`POST /api/v1/shipments/quote`
- **Request Body:**
  ```json
  {
    "origin_branch_id": 1,
    "destination_branch_id": 2,
    "service_level": "EXPRESS",
    "parcels": [
      { "weight_kg": 4.5, "length_cm": 40, "width_cm": 30, "height_cm": 25 },
      { "weight_kg": 2.0, "length_cm": 20, "width_cm": 15, "height_cm": 10 }
    ],
    "declared_value": 15000,
    "is_cod": true,
    "cod_amount": 15000
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "billable_weight_kg": 7.0,
    "volumetric_weight_kg": 6.6,
    "actual_weight_kg": 6.5,
    "base_rate": 650.00,
    "weight_charge": 350.00,
    "insurance_fee": 150.00,
    "cod_fee": 200.00,
    "vat_16_percent": 216.00,
    "total_quote_kes": 1566.00,
    "currency": "KES"
  }
  ```

### 4.2 Book New Parcel Shipment
`POST /api/v1/shipments`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "sender_name": "Acme Nairobi Ltd",
    "sender_phone": "+254711000111",
    "recipient_name": "Amina Hassan",
    "recipient_phone": "+254722333444",
    "origin_branch_id": 1,
    "destination_branch_id": 2,
    "destination_address": "Moi Avenue, Mombasa",
    "service_level": "STANDARD",
    "parcels": [
      { "weight_kg": 3.2, "description": "Electronics Spare Parts" }
    ],
    "is_cod": true,
    "cod_amount": 8500.00
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "shipment_id": 42,
    "waybill_number": "WB-NRB-2026-0042",
    "status": "BOOKED",
    "parcel_count": 1,
    "parcels": [
      { "id": 101, "barcode": "PCL-WB-NRB-2026-0042-01", "weight_kg": 3.2 }
    ],
    "legs": [
      { "leg_number": 1, "origin_hub": "NRB-HQ", "destination_hub": "MSA-01", "status": "PENDING" }
    ],
    "created_at": "2026-09-30T08:15:00.000Z"
  }
  ```

### 4.3 Public Consignee Tracking
`GET /api/v1/tracking/:trackingNumber`
- **Authentication:** Public (No token required).
- **Parameters:** `:trackingNumber` accepts either the shipment waybill number (e.g., `WB-NRB-2026-0042`) or an individual parcel barcode.
- **Response (200 OK):**
  ```json
  {
    "waybill_number": "WB-NRB-2026-0042",
    "status": "IN_TRANSIT",
    "origin": "Nairobi Central Hub",
    "destination": "Mombasa Port Hub",
    "current_location": "Mtito Andei Checkpoint",
    "estimated_delivery": "2026-10-01T14:00:00.000Z",
    "milestones": [
      { "status": "BOOKED", "location": "NRB-HQ", "timestamp": "2026-09-30T08:15:00.000Z" },
      { "status": "DISPATCHED", "location": "Nairobi Outbound Bay", "timestamp": "2026-09-30T10:00:00.000Z" },
      { "status": "CHECKPOINT", "location": "Mtito Andei", "timestamp": "2026-09-30T13:30:00.000Z" }
    ]
  }
  ```

---

## 5. Transport Management & Manifests (`/api/v1/transport`)

### 5.1 Create Linehaul Transport Run
`POST /api/v1/transport/runs`
- **Request Body:**
  ```json
  {
    "corridor_code": "NRB-MSA",
    "origin_hub_id": 1,
    "destination_hub_id": 2,
    "vehicle_id": 3,
    "driver_id": 5,
    "scheduled_departure": "2026-09-30T20:00:00.000Z"
  }
  ```
- **Invariants Checked:**
  - Vehicle must not be in `MAINTENANCE` or `DECOMMISSIONED` status.
  - Driver must be on active duty and unassigned to conflicting active runs.
- **Response (201 Created):** Returns run details with auto-generated empty manifest `MNF-NRB-MSA-2026-0012`.

### 5.2 Seal & Lock Manifest (Lock-and-Load)
`POST /api/v1/transport/runs/:id/manifest/lock`
- **URL Parameter:** `:id` is the Transport Run ID.
- **Behavior:** Freezes all manifest items and transitions manifested shipments to `LOADED` (`BR-005`). Subsequent attempts to add or delete items return `400 Bad Request (MANIFEST_LOCKED)`.
- **Response (200 OK):**
  ```json
  {
    "message": "Manifest successfully locked and shipments marked loaded",
    "run": {
      "id": 12,
      "manifest_status": "LOCKED",
      "total_shipments_count": 48
    }
  }
  ```

### 5.3 Depart & Dispatch Transport Run
`POST /api/v1/transport/runs/:id/dispatch`
- **URL Parameter:** `:id` is the Transport Run ID.
- **Request Body:**
  ```json
  {
    "departure_odometer_km": 142350,
    "notes": "Departed Nairobi Central on schedule via Mombasa Rd corridor"
  }
  ```
- **Behavior:** Updates run status to `IN_TRANSIT`, transitions all manifested shipments and legs to `IN_TRANSIT` atomically, writes tracking events, and creates immutable audit entries.
- **Response (200 OK):**
  ```json
  {
    "message": "Transport run successfully dispatched",
    "run": {
      "id": 12,
      "status": "IN_TRANSIT",
      "actual_departure": "2026-09-30T20:15:00.000Z"
    }
  }
  ```

### 5.4 Record Corridor Checkpoint
`POST /api/v1/transport/runs/:id/checkpoints`
- **URL Parameter:** `:id` is the Transport Run ID.
- **Request Body:**
  ```json
  {
    "location_name": "Mtito Andei Waypoint",
    "latitude": -2.6917,
    "longitude": 38.1672,
    "notes": "Routine linehaul inspection cleared"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 84,
    "transport_run_id": 12,
    "location_name": "Mtito Andei Waypoint",
    "recorded_at": "2026-10-01T01:30:00.000Z"
  }
  ```

### 5.5 Record Destination Hub Arrival
`POST /api/v1/transport/runs/:id/arrive`
- **URL Parameter:** `:id` is the Transport Run ID.
- **Request Body:**
  ```json
  {
    "arrival_odometer_km": 142835,
    "notes": "Arrived at Mombasa Port Hub receiving bay"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Transport run arrived at destination hub",
    "run": {
      "id": 12,
      "status": "ARRIVED",
      "actual_arrival": "2026-10-01T05:45:00.000Z"
    }
  }
  ```

### 5.6 Receive Manifest at Destination Hub
`POST /api/v1/transport/runs/:id/receive`
- **URL Parameter:** `:id` is the Transport Run ID.
- **Request Body:**
  ```json
  {
    "received_shipment_ids": [42, 43, 44]
  }
  ```
- **Behavior:** Verifies all received shipments against the locked manifest (`BR-006`). Any unreceived shipments are flagged as shortages; unmanifested items are flagged as overages in discrepancy auditing.
- **Response (200 OK):**
  ```json
  {
    "message": "Destination hub receiving completed",
    "status": "COMPLETED",
    "intact_count": 47,
    "discrepancy_count": 1
  }
  ```

---

## 6. Physical Chain of Custody & Hub Operations (`/api/v1/custody`)

### 6.1 Record Barcode Scan Event
`POST /api/v1/custody/scans`
- **Request Body:**
  ```json
  {
    "barcode": "PCL-WB-NRB-2026-0042-01",
    "scan_type": "HUB_INTAKE",
    "hub_id": 2,
    "location_details": "Receiving Bay 3",
    "client_operation_uuid": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1052,
    "barcode": "PCL-WB-NRB-2026-0042-01",
    "scan_type": "HUB_INTAKE",
    "hub_id": 2,
    "status": "ACCEPTED",
    "created_at": "2026-09-30T14:10:00.000Z"
  }
  ```

### 6.2 Record Batch Offline Scans
`POST /api/v1/custody/scans/batch`
- **Request Body:**
  ```json
  {
    "scans": [
      {
        "barcode": "PCL-WB-NRB-2026-0042-01",
        "scan_type": "SORT",
        "hub_id": 2,
        "scanned_at": "2026-09-30T14:15:00.000Z"
      }
    ]
  }
  ```
- **Response (200 OK):** Returns summary with `total`, `processed`, `duplicates`, and processed items.

### 6.3 Open Inbound Hub Receiving Session
`POST /api/v1/custody/receiving-sessions`
- **Request Body:**
  ```json
  {
    "hub_id": 2,
    "transport_run_id": 12,
    "manifest_id": 12,
    "station_bay": "Bay 3 - Inbound Linehaul",
    "notes": "Receiving morning linehaul run from Nairobi HQ"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 8,
    "session_number": "RCV-20261001-0008",
    "hub_id": 2,
    "transport_run_id": 12,
    "status": "IN_PROGRESS",
    "expected_packages_count": 48,
    "scanned_packages_count": 0
  }
  ```

### 6.4 Scan Item into Receiving Session
`POST /api/v1/custody/receiving-sessions/:id/scan`
- **URL Parameter:** `:id` is the Receiving Session ID.
- **Request Body:**
  ```json
  {
    "barcode": "PCL-WB-NRB-2026-0042-01",
    "condition": "GOOD",
    "location_desc": "Inbound Sorting Conveyor"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "SCANNED",
    "session_id": 8,
    "scanned_count": 1,
    "is_expected": true
  }
  ```

### 6.5 Complete Receiving Session with Discrepancy Auditing
`POST /api/v1/custody/receiving-sessions/:id/complete`
- **URL Parameter:** `:id` is the Receiving Session ID.
- **Request Body:**
  ```json
  {
    "notes": "Session completed. Shortages noted for shipment #45."
  }
  ```
- **Behavior:** Compares physical scanned barcodes against the transport manifest. Missing barcodes generate `SHORTAGE` discrepancy records; unexpected barcodes generate `OVERAGE` records in the `discrepancies` table.
- **Response (200 OK):**
  ```json
  {
    "id": 8,
    "status": "COMPLETED",
    "expected_packages_count": 48,
    "scanned_packages_count": 47,
    "intact_count": 47,
    "damaged_count": 0,
    "discrepancies_created": 1
  }
  ```

### 6.6 List Discrepancies & Audit Exceptions
`GET /api/v1/custody/discrepancies`
- **Query Parameters:** `status` (`OPEN`, `RESOLVED`), `discrepancy_type` (`SHORTAGE`, `OVERAGE`, `DAMAGED_PACKAGE`, `TAMPERED_SEAL`).
- **Response (200 OK):** Returns array of discrepancy audit records requiring investigation.

### 6.7 Resolve Discrepancy Record
`POST /api/v1/custody/discrepancies/:id/resolve`
- **URL Parameter:** `:id` is the Discrepancy ID.
- **Request Body:**
  ```json
  {
    "resolution_notes": "Package WB-NRB-2026-0045-01 was loaded onto auxiliary run #14; received intact at Mombasa 08:30.",
    "resolution_type": "FOUND_AUXILIARY_RUN"
  }
  ```
- **Response (200 OK):** Returns updated discrepancy record marked `RESOLVED`.

---

## 7. Last-Mile Delivery & Driver Mobile POD (`/api/v1/deliveries`, `/api/v1/delivery-tasks`)

### 7.1 Driver Active Route Task Queue
`GET /api/v1/delivery-tasks/tasks`
- **Headers:** `Authorization: Bearer <driver_token>`
- **Response (200 OK):**
  ```json
  {
    "deliveries": [
      {
        "id": 88,
        "delivery_number": "DEL-20261001-0088",
        "waybill_number": "WB-NRB-2026-0042",
        "recipient_name": "Amina Hassan",
        "recipient_phone": "+254722333444",
        "delivery_address": "Moi Avenue, Mombasa",
        "status": "ASSIGNED",
        "is_cod": 1,
        "cod_amount": 8500.00
      }
    ],
    "total": 1
  }
  ```

### 7.2 Start Delivery Run
`PATCH /api/v1/deliveries/:id/start`
- **URL Parameter:** `:id` is the Delivery ID.
- **Headers:** `Authorization: Bearer <driver_token>`
- **Response (200 OK):**
  ```json
  {
    "message": "Delivery started. Status updated to IN_TRANSIT",
    "delivery": {
      "id": 88,
      "status": "IN_TRANSIT"
    }
  }
  ```

### 7.3 Record Delivery Attempt Problem or Failure (`BR-008`)
`POST /api/v1/deliveries/:id/problem`
- **URL Parameter:** `:id` is the Delivery ID.
- **Request Body:**
  ```json
  {
    "failure_reason": "CUSTOMER_UNAVAILABLE",
    "failure_notes": "Gate locked, called recipient phone 3 times with no answer",
    "latitude": -4.0435,
    "longitude": 39.6682
  }
  ```
- **Invariants Checked:** Requires a valid operational `failure_reason` (e.g. `CUSTOMER_UNAVAILABLE`, `INCORRECT_ADDRESS`, `CUSTOMER_REJECTED`, `PREMISES_CLOSED`). Records telemetry in `delivery_status_history` and notifies the dispatch center.
- **Response (200 OK):**
  ```json
  {
    "message": "Problem reported successfully. Delivery marked FAILED",
    "deliveryId": 88,
    "status": "FAILED"
  }
  ```

### 7.4 Complete Delivery with Digital POD
`POST /api/v1/deliveries/:id/pod`
- **URL Parameter:** `:id` is the Delivery ID.
- **Request Body:**
  ```json
  {
    "recipient_name": "Amina Hassan",
    "recipient_id_type": "NATIONAL_ID",
    "recipient_id_number": "28471920",
    "signature_data": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0...",
    "pod_method": "SIGNATURE",
    "latitude": -4.0435,
    "longitude": 39.6682,
    "cod_collected": 8500.00,
    "cod_payment_method": "MPESA",
    "cod_mpesa_reference": "RKA8921KL9"
  }
  ```
- **Behavior:** Commits recipient signature, updates delivery state to `DELIVERED`, records coordinates, and generates an unremitted driver COD ledger entry if COD was collected.
- **Response (200 OK):**
  ```json
  {
    "message": "Proof of delivery submitted successfully. Delivery completed!",
    "status": "DELIVERED"
  }
  ```

### 7.5 Record Task Attempt via Delivery Tasks Router
`POST /api/v1/delivery-tasks/tasks/:id/attempt`
- **URL Parameter:** `:id` is the Delivery Task ID.
- **Request Body:**
  ```json
  {
    "outcome": "FAILED",
    "reason_code": "CUSTOMER_UNAVAILABLE",
    "notes": "Security guard denied entry; recipient not answering phone",
    "location": { "lat": -4.0435, "lng": 39.6682 }
  }
  ```
- **Response (200 OK):** Returns updated task details and attempt count.

---

## 8. Cash on Delivery (COD) & Financial Remittance (`/api/v1/cod`)

### 8.1 Driver Daily Float Remittance
`POST /api/v1/cod/settlements/:id/remit`
- **URL Parameter:** `:id` is the COD Settlement/Collection ID.
- **Request Body:**
  ```json
  {
    "collected_amount": 8500.00,
    "remitted_to_user_id": 3,
    "remittance_receipt_voucher": "REM-2026-09-0012"
  }
  ```
- **Response (200 OK):** Transitions COD collection status to `REMITTED` and records cashier custody.

### 8.2 Managerial COD Reconciliation (`BR-010`)
`POST /api/v1/cod/settlements/:id/reconcile`
- **Headers:** Must have `ROLE_BRANCH_MANAGER` or `ROLE_SUPER_ADMIN`.
- **Request Body (Discrepancy Case):**
  ```json
  {
    "expected_amount": 8500.00,
    "actual_amount": 8000.00,
    "variance_justification_memo": "Customer had KES 500 delivery fee waiver authorized by HQ ticket #4812",
    "approved_by": 2
  }
  ```
- **Invariants Checked:** Rejects reconciliation with discrepancy if `variance_justification_memo` is missing or empty (`HTTP 400 BR_010_VARIANCE_JUSTIFICATION_REQUIRED`).

---

## 9. Operations Control Tower Telemetry (`/api/v1/control-tower`)

### 9.1 Network Operational Summary
`GET /api/v1/control-tower/summary`
- **Authentication:** Bearer JWT required.
- **Response (200 OK):**
  ```json
  {
    "kpis": {
      "active_shipments": 412,
      "in_transit_linehaul": 88,
      "out_for_delivery": 64,
      "unreconciled_cod_kes": 142500.00,
      "active_fleet_count": 18,
      "on_time_rate_percent": 94.2
    },
    "attention_needed": {
      "overdue_hub_dwell": 7,
      "failed_deliveries_today": 3,
      "unresolved_discrepancies": 2
    },
    "generated_at": "2026-10-01T06:30:00.000Z"
  }
  ```

### 9.2 Actionable Alerts Queue
`GET /api/v1/control-tower/alerts`
- **Query Parameters:** `severity` (`CRITICAL`, `HIGH`, `MEDIUM`), `hub_id`.
- **Response (200 OK):**
  ```json
  [
    {
      "id": 14,
      "alert_type": "HUB_DWELL_BREACH",
      "severity": "HIGH",
      "hub_id": 2,
      "hub_name": "Mombasa Port Hub",
      "message": "7 consignments exceeding 4-hour cross-dock dwell SLA in Bay 3",
      "action_required": "Assign to local delivery run or staging rack",
      "created_at": "2026-10-01T05:00:00.000Z"
    }
  ]
  ```

### 9.3 Hub Throughput & Bottleneck Telemetry
`GET /api/v1/control-tower/hub-telemetry`
- **Response (200 OK):** Returns station-by-station operational throughput, inbound/outbound parcel queues, dock utilization, and average dwell times.

### 9.4 Active Corridors & Movement
`GET /api/v1/control-tower/active-corridors`
- **Response (200 OK):** Returns active linehaul transport runs, current waypoints, estimated arrival times, and corridor transit health across Nairobi, Mombasa, Kisumu, Nakuru, and Eldoret.

### 9.5 Fast-Resolve Alert
`POST /api/v1/control-tower/alerts/:type/:id/resolve`
- **URL Parameters:** `:type` is the alert category, `:id` is the alert entity identifier.
- **Request Body:**
  ```json
  {
    "resolution_notes": "Staged items moved to morning outbound run #16 by supervisor"
  }
  ```
- **Response (200 OK):** Acknowledges and clears the alert from the operational board.

---

## 10. Durable Offline Edge Synchronization (`/api/v1/offline`)

### 10.1 Batch Synchronize Edge Operations
`POST /api/v1/offline/sync`
- **Request Body:**
  ```json
  {
    "operations": [
      {
        "client_operation_uuid": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
        "operation_type": "SCAN",
        "payload": { "barcode": "PCL-WB-NRB-2026-0042-01", "hub_id": 2 },
        "client_timestamp": "2026-09-30T11:45:00.000Z"
      }
    ]
  }
  ```
- **Idempotency Guarantees:** Prevents duplicate mutation if `client_operation_uuid` was already processed, returning the previous execution result.

---

## 11. Fleet Vehicles & Driver Management (`/api/v1/vehicles`, `/api/v1/drivers`)

### 11.1 List Fleet Vehicles
`GET /api/v1/vehicles`
- **Query Parameters:** `status` (`ACTIVE`, `MAINTENANCE`, `DECOMMISSIONED`), `available` (`true`, `false`).
- **Response (200 OK):** Returns fleet vehicles with verified capacity (CBM and kg limits), fuel telemetry, and assigned operating branch.

### 11.2 Driver Performance Scorecard
`GET /api/v1/drivers/:id/performance`
- **URL Parameter:** `:id` is the Driver ID.
- **Response (200 OK):**
  ```json
  {
    "driver_id": 5,
    "driver_name": "Samuel Kiprop",
    "total_deliveries": 342,
    "completed_deliveries": 331,
    "failed_deliveries": 11,
    "on_time_rate_percent": 96.8,
    "rating": 4.85
  }
  ```

### 11.3 Driver Safety & Incident History
`GET /api/v1/drivers/:id/incidents`
- **URL Parameter:** `:id` is the Driver ID.
- **Response (200 OK):** Returns safety logs, traffic citations, cargo exception memos, and compliance audit entries.

### 11.4 Driver Status Transition History
`GET /api/v1/drivers/:id/status-history`
- **URL Parameter:** `:id` is the Driver ID.
- **Response (200 OK):** Returns chronological log of shift status transitions (`ON_DUTY`, `OFF_DUTY`, `SUSPENDED`).

### 11.5 Update Driver Shift Status
`PATCH /api/v1/drivers/:id/status`
- **URL Parameter:** `:id` is the Driver ID.
- **Request Body:**
  ```json
  {
    "status": "ON_DUTY",
    "notes": "Clocked in for morning shift at Nairobi Hub"
  }
  ```
- **Response (200 OK):** Returns updated driver record.

---

## 12. Counter POS Booking & Fiscal Output VAT (`/api/v1/pos`, `/api/v1/kenya`)

### 12.1 Walk-in Booking POS Checkout
`POST /api/v1/pos/checkout`
- **Request Body:**
  ```json
  {
    "tender_method": "MPESA",
    "amount_kes": 1566.00,
    "waybill_id": 42,
    "customer_phone": "+254711000111"
  }
  ```

### 12.2 M-Pesa Daraja STK Push Prompt
`POST /api/v1/kenya/mpesa/stk-push`
- **Request Body:**
  ```json
  {
    "phone": "254711000111",
    "amount": 1566.00,
    "reference": "WB-NRB-2026-0042"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "response_code": "0",
    "response_description": "Success. Request accepted for processing",
    "merchant_request_id": "MR_1727763600000",
    "checkout_request_id": "ws_CO_300920260815124192",
    "customer_message": "Success. An STK push prompt has been dispatched to +254711000111. Please enter your M-Pesa PIN on your phone to authorize payment of KSh 1566.00."
  }
  ```
