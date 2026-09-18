# SwiftTrack Production Readiness

**Assessment date:** 2026-09-18  
**Scope:** Existing repository, backend API, React client, SQLite database, operational verification suite.

## Current Baseline

The platform is a working operational MVP, not an empty product. These capabilities are implemented and verified by `npm test`:

- Authentication for five roles: Super Admin, Branch Manager, Dispatcher, Cashier, Driver.
- Branch isolation and RBAC action boundaries.
- POS checkout, KES pricing, VAT calculation, stock deduction, held carts, receipts.
- Refund request and manager approval with inventory restock.
- Delivery creation, dispatcher assignment, driver status updates, OTP/signature/GPS POD.
- Inventory adjustments, low-stock views, immutable movement ledger, inter-branch transfers.
- Expenses and approval workflows.
- Branch, user, audit, order, notification, dashboard, and financial reporting views.
- SQLite foreign keys, WAL mode, append-only audit triggers, password hashing, security headers, CORS, login rate limiting, and database snapshot checksums.
- Production frontend build succeeds.

**Verification snapshot:** `npm test` passes all 14 system checks. `npm run build` succeeds, with a warning for a 621 KB minified JavaScript chunk.

## P0: Must Pass Before Production Go-Live

### Secrets, identity, and access

- [ ] Remove all shared/default credentials from production seed data and documentation. Force a password change on first login; verify no seeded account retains `Password123!`.
- [ ] Require `JWT_SECRET` in production, reject known/example values, and document secret rotation. Do not start with the `.env.example` secret.
- [ ] Align the README account table with the actual seeded usernames and password policy. Remove credentials from public distribution if this repository is shared.
- [ ] Replace client-side bearer-token persistence in `localStorage` with a reviewed session strategy. If browser tokens remain, document the XSS threat model and add CSP/XSS testing.
- [ ] Add session revocation, logout invalidation, idle timeout, password reset, account lockout, and optional MFA for privileged roles.
- [ ] Review every route against the permission matrix, especially customer/order visibility, branch switching, reports, audit access, and destructive actions.
- [ ] Verify production CORS contains only real HTTPS origins; reject wildcard and localhost origins in production.

### Payments and statutory compliance

- [ ] Replace the simulated M-Pesa STK push in `server/routes/kenya.js` with a real Daraja integration, including OAuth, encrypted/configured credentials, callback authentication, timeout/retry handling, idempotency, reconciliation, and failure states.
- [ ] Replace generated eTIMS-looking invoice/QR values with an approved KRA/eTIMS integration or explicitly label the feature as non-production. Store submission status, response IDs, retries, and rejection reasons.
- [ ] Obtain written confirmation from finance/tax owners that VAT, rounding, credit notes, refund tax treatment, invoice numbering, and branch tax configuration are correct.
- [ ] Test every payment state: pending, success, duplicate callback, timeout, failed, reversed, partial payment, refund, and offline recovery.

### Data safety and recovery

- [ ] Add versioned database migrations. `schema.sql` initialization is not a replacement for controlled upgrades of an existing production database.
- [ ] Automate encrypted off-host backups; the current local snapshot plus SHA-256 checksum does not provide disaster recovery by itself.
- [ ] Define and test RPO/RTO, restore procedure, backup retention, backup monitoring, and quarterly restore drills.
- [ ] Verify WAL/shm handling and backup consistency under active writes. Never copy a live SQLite file without a consistent backup procedure.
- [ ] Add data export and retention/deletion policy for customers, POD signatures, phone numbers, audit logs, and financial records.

### Runtime and deployment

- [ ] Pin and document the supported Node runtime. The code uses `node:sqlite`; confirm the deployment runtime supports it, then add an `.nvmrc`/container image/CI check.
- [ ] Add a production process manager or container deployment with graceful shutdown, restart policy, resource limits, and readiness/liveness probes.
- [ ] Terminate TLS at a documented proxy/load balancer and verify HSTS only runs behind HTTPS.
- [ ] Add structured JSON logs with request IDs, user/branch context, redaction of secrets and payment data, and centralized log retention.
- [ ] Add monitoring and alerting for health failures, authentication spikes, 5xx responses, payment failures, backup failures, database growth, and delivery/POD exceptions.
- [ ] Replace the process-local login rate limiter with a shared store or edge/WAF policy for multi-instance deployments.
- [ ] Review request body limits and uploads. Signature/POD data is accepted as a large JSON body; enforce size/type/content validation and safe storage policy.

## P1: Complete the Product for Daily Operations

### Commercial operations

- [ ] Customer management: create/edit/search customers, duplicate detection, branch ownership, KRA PIN validation, customer history, and privacy controls.
- [ ] Product management: CRUD categories/SKUs, price history, tax class, barcode validation, activation/archive, bulk import/export, and approval for price changes.
- [ ] Purchasing and receiving: suppliers, purchase orders, goods receiving, landed cost, supplier invoices, and stock receipt reconciliation.
- [ ] Stock control: cycle counts, variance approval, reserved stock lifecycle, damaged/expired stock, multi-warehouse moves, and stock valuation.
- [ ] POS controls: cashier shift open/close, till float, end-of-day reconciliation, cash variance, receipt reprint permissions, offline queue, and printer/scanner failure handling.
- [ ] Sales controls: customer credit limits, quotations, sales orders, partial fulfillment, cancellations, credit notes, partial refunds, and discount approval enforcement.
- [ ] Dispatch controls: route planning, manifests, loading confirmation, vehicle capacity validation, driver availability, reschedule flow, return-to-hub, failed delivery retry, and proof attachment retention.
- [ ] Fleet management: vehicle servicing, insurance/license expiry, fuel logs, odometer, maintenance costs, and driver compliance records.
- [ ] Finance: configurable chart of accounts, bank reconciliation, expense evidence attachments, accounts receivable/payable, settlement reports, and export to accounting software.
- [ ] Notifications: persisted delivery channels (email/SMS/WhatsApp/push), retry queue, templates, user preferences, and escalation rules. Current notifications are in-app only.

### Platform workflows

- [ ] Replace view switching based on client state/query parameters with explicit routing and deep-link authorization.
- [ ] Add pagination, server-side filtering/sorting, exports, and consistent empty/loading/error states to all large operational tables.
- [ ] Add an admin settings surface for company profile, branches, VAT, receipt templates, numbering, payment providers, notification providers, and feature flags.
- [ ] Add import/export tooling with validation reports and rollback for users, products, customers, opening stock, and branches.
- [ ] Add API versioning, OpenAPI documentation, request validation schemas, consistent error codes, and idempotency keys for financial/stock mutations.
- [ ] Add a customer-facing delivery tracking/status notification flow if customers are expected to self-serve.

## P1: Quality and Security Gates

- [ ] Add CI for install, lint, unit tests, integration tests, frontend build, migration checks, dependency audit, and secret scanning.
- [ ] Split `tests/verify-system.js` into isolated repeatable tests with a disposable test database. The current suite mutates the repository database and creates backup artifacts.
- [ ] Add negative and concurrency tests for every stock/payment/refund/transfer mutation, including duplicate requests and stale state.
- [ ] Add API contract tests for all routes and branch-isolation tests for every branch-scoped resource, not only representative endpoints.
- [ ] Add browser E2E tests for each role's highest-value workflow, including mobile driver layout, keyboard POS flow, printing, and network errors.
- [ ] Add accessibility checks: keyboard-only navigation, focus management, labels, screen-reader names, contrast, reduced motion, and mobile touch targets.
- [ ] Add dependency update policy and run `npm audit` with documented exceptions. Keep lockfiles synchronized.
- [ ] Run a threat model and external penetration test covering JWT, CORS, CSP, IDOR/branch isolation, injection, file/data URI handling, rate limiting, and sensitive logging.
- [ ] Define performance budgets. Investigate the current 621 KB JS chunk with route-level code splitting and verify API/database response targets under realistic branch volume.

## P2: Product Expansion

- [ ] Multi-tenant architecture if more than one owning company will use the platform. Current schema is explicitly single-tenant.
- [ ] Native/PWA offline-first driver app with background sync and conflict resolution.
- [ ] Live fleet tracking with location consent, retention policy, geofencing, ETA calculation, and map provider integration.
- [ ] Automated replenishment recommendations, demand forecasting, and branch transfer suggestions.
- [ ] Customer portal/API, webhook subscriptions, and partner integrations.
- [ ] Role/permission editor, approval policy builder, and configurable workflows.
- [ ] Advanced analytics: profitability by SKU/customer/route, service-level metrics, delivery cost, stock aging, and forecast accuracy.
- [ ] Localization for additional tax rules, currencies, languages, and regional operating policies.

## Go-Live Checklist

- [ ] Production environment is provisioned from infrastructure-as-code or a repeatable deployment script.
- [ ] HTTPS, DNS, CORS, secrets, database path, backups, and alert destinations are configured and smoke-tested.
- [ ] Production database is created with migrations and clean master data; no demo orders, fake telemetry, simulated payments, or test accounts remain.
- [ ] Real M-Pesa and eTIMS certification/integration has passed sandbox and production-readiness testing, or those features are disabled and clearly labeled.
- [ ] Admin, manager, cashier, dispatcher, and driver accounts are provisioned individually with least privilege and recovery contacts.
- [ ] UAT sign-off completed for POS, refund, inventory, transfer, dispatch/POD, expenses, reports, audit, and branch isolation.
- [ ] Backup restore drill passed and RPO/RTO recorded.
- [ ] Security review and vulnerability scan passed; all P0 findings closed.
- [ ] Monitoring dashboards, on-call ownership, incident runbook, support escalation, and rollback procedure are available.
- [ ] Finance, operations, tax, and data-protection owners sign off on launch.

## Recommended Delivery Order

1. **Production gate:** secrets, identity, HTTPS/CORS, runtime pinning, migrations, backups, logging, monitoring.
2. **Compliance gate:** real M-Pesa, eTIMS, VAT/refund/credit-note validation, reconciliation.
3. **Operational completeness:** customers, purchasing/receiving, stock counts, shifts/reconciliation, fleet maintenance, notification delivery.
4. **Reliability gate:** CI, isolated tests, contract/E2E tests, concurrency/idempotency, performance and accessibility budgets.
5. **Expansion:** offline driver experience, live tracking, customer portal, forecasting, and multi-tenant support if required.

## Evidence and Known Mismatches

- `npm test`: passes all 14 checks on 2026-09-18.
- `npm run build`: succeeds; Vite reports a 621 KB minified chunk.
- `server/routes/kenya.js`: M-Pesa endpoint is explicitly simulated; eTIMS endpoint generates verification-shaped data rather than submitting to KRA.
- `client/src/services/api.js`: accepts a token from the URL and stores it in `localStorage`.
- `server/middleware/security.js`: rate limiting is an in-memory `Map`, so it is not shared across instances.
- `.env.example` and `README.md`: contain development/example secrets and account credentials; README account values do not match the actual seed values.
- `server/db/database.js`: uses Node's native SQLite API; deployment must use a compatible Node runtime.
