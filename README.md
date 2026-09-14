# SwiftTrack Kenya — Enterprise Multi-Branch Logistics & Retail Platform

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WCAG](https://img.shields.io/badge/Accessibility-WCAG_AAA-10B981?style=flat-square)
![License](https://img.shields.io/badge/License-Proprietary-blue?style=flat-square)

An enterprise-grade supply chain, warehouse inventory, retail point-of-sale, and last-mile courier fulfillment platform engineered specifically for Kenya's multi-regional logistics landscape. 

SwiftTrack Kenya connects physical regional hubs (**Nairobi Central Hub**, **Mombasa Port & Coastal**, **Kisumu Lake Basin**, and **Nakuru Depot**) with strict data isolation, real-time telemetry, M-Pesa Daraja payment workflows, and statutory Kenya Revenue Authority (KRA) 16% Fiscal Output VAT compliance.

---

## Key Architectural Pillars

### 1. Dieter Rams / Braun Functionalism Aesthetic
- **Matte Obsidian Canvas (`#0c0e12`)**: High-contrast, zero-distraction dark mode paired with a crisp porcelain light mode (`#f8fafc`).
- **Precision Data Hierarchy**: High-density tabular numerals (`tabular-nums`), `Plus Jakarta Sans` for interface controls, and `JetBrains Mono` for hardware readouts, serial numbers, VAT calculations, and timestamps.
- **Mission-Critical Telemetry Signals**: High-visibility semantic signals: Nominal (Emerald `#10b981`), Caution (Amber `#f59e0b`), Critical (Rose `#ef4444`), Transit (Cyan `#06b6d4`), and Primary Action (Blue `#3b82f6`).

### 2. Strict Multi-Branch Data Segregation
- Regional station cashiers and branch managers only access local inventory, POS tenders, and courier dispatches.
- Regional HQ administrators possess consolidated cross-hub visibility (`HQ-ALL`) with real-time station filtering.

### 3. Enterprise Production Cryptography & Hardening
- **Cryptographic Dynamic Salt Hashing**: 16-byte cryptographically random dynamic salt `scrypt` hashing (`server/utils/security.js`) with constant-time verification and zero-downtime legacy hash auto-upgrading.
- **Enterprise Security Middleware**: Sliding-window IP rate limiting, strict HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), and origin-validated CORS (`server/middleware/security.js`).
- **Production Guard (`DEMO_MODE=false`)**: High-entropy 512-bit `JWT_SECRET` verification. Unauthenticated demo role switching is strictly rejected with `403 Forbidden`.

### 4. Statutory Kenya Fiscal & Tax Compliance
- **KRA 16% Fiscal Output VAT Schedule**: Automated tripartite turnover breakdown (Gross Turnover, Taxable Sales Base, and Output VAT Remittance) with ETR audit verification badges.
- **ESC/POS 80mm/58mm Thermal Receipts**: Styled for direct receipt printing with branch KRA PIN, cashier register code, tax breakdown, and M-Pesa reference codes.
- **M-Pesa Daraja STK Push Integration**: Native mobile money prompt simulation with countdown timers, callback validation, and automatic receipt ledger settlement.

---

## Operational Modules

| # | Operational Module | Purpose & Core Capabilities |
| :--- | :--- | :--- |
| **1** | **Executive Dashboard** | High-density telemetry strip with gross sales, active couriers, ticket averages, and 10 visual BI analytics charts (Order status distribution, 14-day revenue curves, regional hub comparisons). |
| **2** | **Cashier POS Register** | Rapid checkout matrix with F2 hotkey, barcode scan input, category filters, held carts, line discounts (0%-15%), KRA 16% VAT computation, M-Pesa STK prompt trigger, and thermal receipt printing. |
| **3** | **Fleet Dispatch Pipeline** | 5-Stage Kanban board (`Ready for Dispatch` → `Courier Allocated` → `Hub Departure` → `Active Road Transit` → `Delivered POD`), courier assignment, priority cycling (`NORMAL`, `HIGH`, `URGENT`), and delivery exceptions ledger. |
| **4** | **Warehouse Inventory Matrix** | Multi-warehouse stock tracking across all 25 catalog SKUs, stock level adjustments, inter-branch transfer manifests (Request → Approve → Dispatch → Receive), low-stock deficit alerts, and immutable SQL audit ledger. |
| **5** | **Orders & Historical Sales** | Comprehensive sales ledger filtered by branch, tender method (M-Pesa, Cash, Bank), delivery channel (POS vs Courier), and one-click receipt reprint. |
| **6** | **Driver Mobile POD Portal** | Courier-optimized mobile interface displaying active delivery routes, customer phone dialer, navigation hints, and digital Proof of Delivery capture (Signature + OTP). |
| **7** | **Petty Cash & Operating Expenses** | Regional overhead tracking, float disbursement vouchers, category classification (Fuel, Maintenance, Utilities, Packaging), and managerial approval workflow. |
| **8** | **Governance & Approvals Console** | Dual-control internal control center for branch managers to approve or reject pending customer refunds, expense vouchers, and inter-branch stock transfers. |
| **9** | **Statutory Fiscal & P&L Reports** | Statutory KRA 16% VAT output filings, monthly tax trends, P&L operating statements, and cost-of-goods-sold (COGS) analytics. |

---

## Role-Based Access Control (RBAC) & Test Accounts

The platform comes pre-configured with granular permissions across 5 distinct system roles.

| Role | Username | Password | Assigned Branch | Primary Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `admin123` | All Hubs (`HQ-ALL`) | Full global governance, analytics, and platform administration |
| **Branch Manager** | `manager.nairobi`<br>`manager.mombasa`<br>`manager.kisumu`<br>`manager.nakuru` | `manager123` | Nairobi Central (`NRB-HQ`)<br>Mombasa Port (`MSA-01`)<br>Kisumu Basin (`KSM-01`)<br>Nakuru Depot (`NAK1`) | Regional approvals, expense authorization, and station audits |
| **Cashier** | `cashier.nairobi`<br>`cashier.mombasa`<br>`cashier.kisumu`<br>`cashier.nakuru` | `cashier123` | Respective Branch | POS register sales, M-Pesa tenders, and held cart management |
| **Dispatcher** | `dispatcher.nairobi`<br>`dispatcher.mombasa`<br>`dispatcher.kisumu`<br>`dispatcher.nakuru` | `dispatcher123` | Respective Branch | Manifest allocation, fleet assignment, and exception handling |
| **Driver / Courier** | `driver.nairobi`<br>`driver.mombasa`<br>`driver.kisumu`<br>`driver.nakuru` | `driver123` | Respective Branch | Mobile route queue, stage progression, and digital POD capture |

---

## Dual-Mode Database Engine & Backup Architecture

SwiftTrack features a dual-mode SQLite engine running in Write-Ahead Logging (`WAL`) mode with zero external service dependencies:

### 1. Production Mode Bootstrap (`npm run db:reset:prod`)
- Automatically creates a pre-reset snapshot backup.
- Initializes clean foundation master records:
  - 4 Active regional branches and strategic warehouses.
  - 5 System roles with granular RBAC permissions.
  - 10 Operational staff users with cryptographic dynamic salt hashes.
  - 25 Product Catalog SKUs with baseline safety inventory.
  - Fleet delivery vehicles, registered drivers, and standard counter accounts.
  - **Zero mock transactions or synthetic historical noise.**

### 2. Multi-Branch Demo Data Seeder (`npm run db:seed:branches`)
- Injects 400+ realistic operational orders across 14 historical days.
- Over KES 17,000,000 in simulated multi-branch turnover.
- 160+ courier dispatches with GPS history, active in-transit pins, and POD records.
- Realistic held carts, pending refund requests, and authentic Kenyan expense vouchers.
- Active inter-branch stock transfers between Nairobi, Mombasa, Kisumu, and Nakuru.

### 3. Automated Point-in-Time Snapshot Backups (`npm run db:backup`)
- Generates point-in-time timestamped backups inside `backups/`.
- Verifies SHA-256 cryptographic checksums for data integrity.
- Enforces automated retention pruning (keeps the latest 10 snapshots).

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher

### 1. Installation
Clone the repository and install dependencies for both the server and the frontend client:

```bash
# Clone the repository
git clone https://github.com/Mayen007/swifttrack.git
cd swifttrack

# Install backend dependencies
npm install

# Install frontend client dependencies
cd client
npm install
cd ..
```

### 2. Environment Configuration
Create an active `.env` file from the provided template:

```bash
cp .env.example .env
```

Review the `.env` settings:
```ini
PORT=4000
NODE_ENV=development
DEMO_MODE=true
JWT_SECRET=swifttrack_jwt_super_secret_production_key_2026_change_in_prod
SESSION_EXPIRY=24h
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:4000
DATABASE_PATH=data/logistics_platform.db
```

### 3. Database Initialization
Initialize the database with the rich multi-branch demo dataset (or use `--prod` for a clean slate):

```bash
# Populate rich multi-branch demo simulation dataset
npm run db:seed:branches

# OR initialize a pure, clean production foundation
# npm run db:reset:prod
```

### 4. Running the Application
Launch both the backend API server and the frontend client development server in separate terminal windows:

```bash
# Terminal 1: Start Express API server (Runs on port 4000)
npm run start

# Terminal 2: Start Vite client dev server (Runs on port 5173 or 5174)
npm run dev
```

Open your browser and navigate to:
```
http://localhost:5173
```

---

## Verification & Testing

SwiftTrack includes an automated end-to-end operational verification suite ([`tests/verify-system.js`](file:///c:/Users/ariic/Documents/Logistics%20Platform/tests/verify-system.js)) covering **14 critical lifecycle flows**:

```bash
npm test
```

### Test Coverage (14/14 Passing)
1. **Authentication & Token Issuance**: Verifies credentials across all 5 roles and invalid login rejection (401).
2. **Strict Multi-Branch Isolation**: Confirms cross-branch inventory and orders return 403 Forbidden.
3. **Role-Based Action Authorization**: Enforces RBAC action boundaries (Cashier cannot adjust stock; Dispatcher cannot access POS).
4. **POS Walk-in Sale & Atomic Deduction**: Checks sales tender, 16% VAT calculation, and atomic stock decrements.
5. **Refund Workflow & Automatic Restock**: Tests cashier refund filing, manager approval, and automatic stock re-crediting.
6. **Fleet Dispatch & Mobile POD**: Validates manifest creation, driver allocation, in-transit state, and OTP/Signature verification.
7. **Audit Trail Immutability**: Confirms SQLite database triggers strictly forbid UPDATE and DELETE on `audit_logs`.
8. **Dynamic Salt Cryptographic Hashing**: Validates 16-byte random salt hashing and automatic legacy hash upgrades.
9. **Enterprise Security Headers**: Tests presence of CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.
10. **Production Demo Mode Guard**: Confirms `/api/auth/demo-switch` is rejected with 403 when `DEMO_MODE=false`.
11. **Database Snapshot Backup Engine**: Verifies point-in-time snapshot creation and SHA-256 checksum integrity.
12. **Inter-Branch Stock Transfer Lifecycle**: Validates transfer request, manager approval, dispatch, and hub receiving.
13. **Branch-Isolated Reporting (P&L & VAT)**: Validates statutory 16% VAT calculations and P&L metrics per branch.
14. **High-Contrast Theme Tokens**: Verifies light and dark mode WCAG AAA compliance and token presence.

---

## Available NPM Scripts

### Root Scripts (`package.json`)
- `npm run start` — Starts the Express backend API server on port 4000.
- `npm run dev` — Launches the Vite frontend client development server.
- `npm run build` — Compiles production frontend client assets into `client/dist/`.
- `npm test` — Executes the 14-test end-to-end verification suite.
- `npm run db:setup` — Initializes SQLite database schemas and triggers.
- `npm run db:seed:branches` — Seeds full multi-branch demo dataset (Nairobi, Mombasa, Kisumu, Nakuru).
- `npm run db:seed:prod` — Seeds clean production baseline records.
- `npm run db:reset:prod` — Safely backs up, clears, and rebuilds a pristine production database.
- `npm run db:reset:demo` — Backs up, clears, and resets the demo database.
- `npm run db:backup` — Creates an instant SHA-256 verified database snapshot in `backups/`.

### Client Scripts (`client/package.json`)
- `npm run dev` — Starts Vite dev server with Hot Module Replacement (HMR).
- `npm run build` — Bundles client assets with Tailwind CSS v4 and minification.
- `npm run preview` — Locally previews production client build.

---

## Repository Structure

```
swifttrack/
├── backups/                         # Automated point-in-time SQLite snapshots (.db + .sha256)
├── client/                          # React 18 + Vite frontend application
│   ├── src/
│   │   ├── components/              # Reusable UI instruments (Navbar, StatCards, Telemetry)
│   │   ├── context/                 # AuthContext, ThemeContext (WCAG AAA dark/light modes)
│   │   ├── services/                # Centralized API client (formatKES, formatCompactKES, toasts)
│   │   ├── utils/                   # Sound engine (Web Audio API hardware sound chimes)
│   │   ├── views/                   # Operational screens (Dashboard, POS, Dispatch, Reports, etc.)
│   │   ├── App.jsx                  # Main view router & role authorization gate
│   │   ├── index.css                # Dieter Rams design tokens & Tailwind CSS v4 styling
│   │   └── main.jsx                 # Client entry point
│   ├── package.json                 # Client dependencies & build configuration
│   └── vite.config.js               # Vite bundler configuration
├── data/                            # SQLite database storage (WAL mode)
│   └── logistics_platform.db
├── server/                          # Express.js backend application
│   ├── db/
│   │   ├── database.js              # SQLite connection, schema migrations, and audit triggers
│   │   ├── seed.js                  # Production & demo seed foundations
│   │   ├── seedDemoBranches.js      # Comprehensive multi-branch demo simulation engine
│   │   └── backup.js                # SHA-256 verified database backup & pruning engine
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification & RBAC role authorization guards
│   │   └── security.js              # Rate limiting, security headers, CORS origin verification
│   ├── routes/                      # REST API endpoints (auth, pos, orders, inventory, dispatch, reports)
│   ├── utils/
│   │   └── security.js              # 16-byte dynamic salt scrypt hashing & legacy auto-upgrade
│   └── server.js                    # Express app initialization & HTTP listener
├── tests/
│   └── verify-system.js             # 14-test end-to-end system verification suite
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore patterns
├── README.md                        # Master documentation
└── package.json                     # Root project scripts & server dependencies
```

---

## Design System & Quality Assurance

The visual aesthetics, typography, and responsive breakpoints of SwiftTrack Kenya have been audited and documented in accordance with the `design-review` specification:
- **Design Review Document**: [`.design/multi-branch-platform/DESIGN_REVIEW.md`](file:///c:/Users/ariic/Documents/Logistics%20Platform/.design/multi-branch-platform/DESIGN_REVIEW.md)
- **Visual Capture Archive**: 13 responsive screenshots across Desktop (1280×800), Tablet (768×1024), and Mobile (375×812) viewports in both Dark and Light modes are preserved in [`.design/multi-branch-platform/screenshots/`](file:///c:/Users/ariic/Documents/Logistics%20Platform/.design/multi-branch-platform/screenshots/).

---

## License

Proprietary — All rights reserved. Developed for SwiftTrack Logistics Kenya.
