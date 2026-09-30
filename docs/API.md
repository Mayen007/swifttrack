# SwiftTrack — REST API Specification & Reference

**Version:** 1.4.0  
**Base URL:** `/api/v1` (Master Versioned) · `/api` (Legacy Aliases Supported)  
**Content-Type:** `application/json`  
**Authentication:** Bearer JWT (`Authorization: Bearer <token>`)  

---

## Table of Contents

- [1. Architectural Conventions & Standard Envelopes](#1-architectural-conventions--standard-envelopes)
- [2. Error Codes & HTTP Status Matrix](#2-error-codes--http-status-matrix)
- [3. Authentication & Session Security (`/api/v1/auth`)](#3-authentication--session-security-apiv1auth)
- [4. Shipment Core & Parcel Rating (`/api/v1/shipments`, `/api/v1/tracking`)](#4-shipment-core--parcel-rating-apiv1shipments-apiv1tracking)
- [5. Transport Management & Manifests (`/api/v1/transport`)](#5-transport-management--manifests-apiv1transport)
- [6. Physical Chain of Custody & Hub Operations (`/api/v1/custody`)](#6-physical-chain-of-custody--hub-operations-apiv1custody)
- [7. Last-Mile Delivery & Driver Mobile POD (`/api/v1/deliveries`, `/api/v1/delivery-tasks`)](#7-last-mile-delivery--driver-mobile-pod-apiv1deliveries-apiv1delivery-tasks)
- [8. Cash on Delivery (COD) & Financial Remittance (`/api/v1/cod`)](#8-cash-on-delivery-cod--financial-remittance-apiv1cod)
- [9. Operations Control Tower Telemetry (`/api/v1/control-tower`)](#9-operations-control-tower-telemetry-apiv1control-tower)
- [10. Durable Offline Edge Synchronization (`/api/v1/offline`)](#10-durable-offline-edge-synchronization-apiv1offline)
- [11. Fleet Vehicles & Driver Compliance (`/api/v1/vehicles`, `/api/v1/drivers`)](#11-fleet-vehicles--driver-compliance-apiv1vehicles-apiv1drivers)
- [12. Counter POS Booking & Fiscal Output VAT (`/api/v1/pos`, `/api/v1/kenya`)](#12-counter-pos-booking--fiscal-output-vat-apiv1pos-apiv1kenya)

---

## 1. Architectural Conventions & Standard Envelopes

### 1.1 Success Response Envelope
All standard v1 REST queries and mutations return structured JSON payloads:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 142,
    "timestamp": "2026-09-30T08:00:00.000Z"
  }
}
```

### 1.2 Error Response Envelope
Errors always return a non-2xx HTTP status code accompanied by machine-readable error codes:

```json
{
  "success": false,
  "error": {
    "code": "BR_008_FAILURE_REASON_REQUIRED",
    "message": "Delivery failure requires a valid operational reason code (CUSTOMER_UNAVAILABLE, INCORRECT_ADDRESS, etc.)",
    "details": null
  }
}
```

---

## 2. Error Codes & HTTP Status Matrix

| HTTP Status | Machine Code | Scenario & Invariant Enforced |
| :---: | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | Missing mandatory schema fields or negative weights/dimensions. |
| `400 Bad Request` | `BR_008_FAILURE_REASON_REQUIRED` | Attempting to record a delivery failure without a valid failure reason. |
| `400 Bad Request` | `BR_010_VARIANCE_JUSTIFICATION_REQUIRED` | Attempting to reconcile a COD batch with discrepancy without an audit memo. |
| `400 Bad Request` | `MANIFEST_LOCKED` | Attempting to modify shipments in a sealed or dispatched manifest. |
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
    "status": "CONFIRMED",
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
`GET /api/v1/tracking/:waybill`
- **Authentication:** Public (No token required).
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
      { "status": "CONFIRMED", "location": "NRB-HQ", "timestamp": "2026-09-30T08:15:00.000Z" },
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
`POST /api/v1/transport/manifests/:id/status`
- **Request Body:**
  ```json
  { "status": "LOCKED" }
  ```
- **Behavior:** Freezes manifest items. Subsequent attempts to add or delete parcels return `400 Bad Request (MANIFEST_LOCKED)`.

### 5.3 Depart Transport Run
`POST /api/v1/transport/runs/:id/status`
- **Request Body:**
  ```json
  { "status": "DEPARTED", "departure_odometer_km": 142350 }
  ```
- **Behavior:** Updates all manifested shipments and legs to `IN_TRANSIT` atomically, writes outbox tracking events, and creates immutable audit entries.

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
    "scan_id": 1052,
    "barcode": "PCL-WB-NRB-2026-0042-01",
    "status": "ACCEPTED",
    "timestamp": "2026-09-30T14:10:00.000Z"
  }
  ```

### 6.2 Receive Inbound Manifest with Discrepancy Auditing
`POST /api/v1/custody/receive-manifest`
- **Request Body:**
  ```json
  {
    "manifest_id": 12,
    "hub_id": 2,
    "scanned_barcodes": [
      "PCL-WB-NRB-2026-0042-01",
      "PCL-WB-NRB-2026-0043-01"
    ]
  }
  ```
- **Behavior:** Compares physical scanned barcodes against the locked manifest. Missing barcodes trigger shortage alerts; unmanifested barcodes trigger overage alerts in `manifest_discrepancies`.

---

## 7. Last-Mile Delivery & Driver Mobile POD (`/api/v1/deliveries`, `/api/v1/delivery-tasks`)

### 7.1 Driver Active Route Queue
`GET /api/v1/delivery-tasks`
- **Headers:** `Authorization: Bearer <driver_token>`
- **Response (200 OK):**
  ```json
  [
    {
      "task_id": 88,
      "waybill_number": "WB-NRB-2026-0042",
      "recipient_name": "Amina Hassan",
      "recipient_phone": "+254722333444",
      "address": "Moi Avenue, Mombasa",
      "priority": "HIGH",
      "is_cod": true,
      "cod_amount_kes": 8500.00,
      "attempt_count": 0
    }
  ]
  ```

### 7.2 Record Delivery Attempt Failure (`BR-008`)
`POST /api/v1/deliveries/:id/attempt`
- **Request Body:**
  ```json
  {
    "attempt_number": 1,
    "status": "FAILED",
    "failure_reason": "CUSTOMER_UNAVAILABLE",
    "notes": "Gate locked, called phone 3 times with no answer",
    "latitude": -4.0435,
    "longitude": 39.6682
  }
  ```
- **Invariants Checked:** Rejects requests missing `failure_reason`. If `attempt_number >= 3`, status automatically marks consignment as `FAILED_DELIVERY` and routes for hub return.

### 7.3 Complete Delivery with Digital POD
`POST /api/v1/deliveries/:id/pod`
- **Request Body:**
  ```json
  {
    "recipient_name": "Amina Hassan",
    "otp_pin": "582914",
    "signature_svg": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0...",
    "latitude": -4.0435,
    "longitude": 39.6682,
    "cod_collected_amount": 8500.00
  }
  ```
- **Behavior:** Validates 6-digit OTP code against consignment hash, commits digital signature, updates shipment state to `DELIVERED`, and generates COD ledger record.

---

## 8. Cash on Delivery (COD) & Financial Remittance (`/api/v1/cod`)

### 8.1 Driver Daily Float Remittance
`POST /api/v1/cod/settlements/:id/remit`
- **Request Body:**
  ```json
  {
    "collected_amount": 8500.00,
    "remitted_to_user_id": 3,
    "remittance_receipt_voucher": "REM-2026-09-0012"
  }
  ```

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

### 9.1 Network Summary Metrics
`GET /api/v1/control-tower/metrics`
- **Response (200 OK):**
  ```json
  {
    "active_shipments_total": 412,
    "in_transit_linehaul": 88,
    "out_for_delivery_courier": 64,
    "hub_dwell_overdue_alerts": 7,
    "failed_attempts_today": 3,
    "cod_unreconciled_total_kes": 142500.00,
    "fleet_active_count": 18,
    "corridor_ontime_rate_percent": 94.2
  }
  ```

### 9.2 Bottleneck & Dwell Detection
`GET /api/v1/control-tower/bottlenecks`
- **Response (200 OK):** Returns hubs and staging bays where average dwell time exceeds configured SLA (> 4 hours).

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

## 11. Fleet Vehicles & Driver Compliance (`/api/v1/vehicles`, `/api/v1/drivers`)

### 11.1 List Available Vehicles
`GET /api/v1/vehicles?status=ACTIVE&available=true`
- **Response (200 OK):** Returns fleet vehicles with verified capacity (CBM and kg limits) and current operating branch.

### 11.2 Check Driver Shift Status
`GET /api/v1/drivers/:id/compliance`
- **Response (200 OK):** Returns license expiration date, active duty status, and driving hour telemetry.

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
`POST /api/v1/kenya/mpesa/stkpush`
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
    "checkout_request_id": "ws_CO_300920260815124192",
    "response_code": "0",
    "customer_message": "Success. Request accepted for processing"
  }
  ```
