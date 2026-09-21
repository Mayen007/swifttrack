-- ==============================================================================
-- PRODUCTION RELATIONAL SCHEMA FOR SINGLE-TENANT MULTI-BRANCH LOGISTICS + POS
-- Database: SQLite (Node.js 24 node:sqlite engine with WAL & Foreign Keys)
-- Company: SwiftTrack Kenya Logistics Ltd (Single Owner - No tenant_id)
-- Primary Isolation Key: branch_id
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. COMPANY SETTINGS (Single-record application owner)
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL,
    registration_number TEXT,
    kra_pin TEXT NOT NULL,
    vat_rate REAL NOT NULL DEFAULT 16.0,
    currency TEXT NOT NULL DEFAULT 'KES',
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Nairobi',
    country TEXT NOT NULL DEFAULT 'Kenya',
    receipt_header TEXT,
    receipt_footer TEXT,
    etims_enabled INTEGER NOT NULL DEFAULT 1,
    etims_branch_code TEXT DEFAULT '00',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location_desc TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 1
);

-- 5. PERMISSIONS
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    description TEXT NOT NULL
);

-- 6. ROLE_PERMISSIONS
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 7. USERS
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT, -- NULL for global Super Admin
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at DATETIME,
    password_changed_at DATETIME,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    token_version INTEGER NOT NULL DEFAULT 1,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0,
    two_factor_secret TEXT,
    two_factor_recovery_codes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8a. BRANDS
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8b. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Nairobi',
    country TEXT DEFAULT 'Kenya',
    lead_time_days INTEGER DEFAULT 3,
    payment_terms TEXT DEFAULT 'NET30',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'PCS',
    cost_price REAL NOT NULL DEFAULT 0.0,
    selling_price REAL NOT NULL DEFAULT 0.0,
    wholesale_price REAL NOT NULL DEFAULT 0.0,
    tax_category TEXT NOT NULL DEFAULT 'STANDARD_16', -- STANDARD_16, ZERO_RATED_0, EXEMPT
    min_stock_alert INTEGER NOT NULL DEFAULT 10,
    max_stock_alert INTEGER NOT NULL DEFAULT 500,
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    reorder_quantity INTEGER NOT NULL DEFAULT 50,
    costing_method TEXT NOT NULL DEFAULT 'FIFO', -- FIFO, WEIGHTED_AVERAGE
    is_serialized INTEGER NOT NULL DEFAULT 0,
    images TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9a. PRODUCT VARIANTS
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_sku TEXT NOT NULL UNIQUE,
    variant_barcode TEXT UNIQUE,
    variant_name TEXT NOT NULL,
    size TEXT,
    color TEXT,
    model TEXT,
    attributes_json TEXT NOT NULL DEFAULT '{}',
    cost_price_override REAL,
    selling_price_override REAL,
    wholesale_price_override REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9b. VARIANT INVENTORY (Warehouse stock balance per variant)
CREATE TABLE IF NOT EXISTS variant_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_in_transit INTEGER NOT NULL DEFAULT 0,
    quantity_damaged INTEGER NOT NULL DEFAULT 0,
    quantity_expired INTEGER NOT NULL DEFAULT 0,
    average_cost REAL NOT NULL DEFAULT 0.0,
    last_recounted_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, variant_id)
);

-- 9c. BRANCH-SPECIFIC PRICING
CREATE TABLE IF NOT EXISTS branch_product_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    cost_price REAL,
    selling_price REAL NOT NULL,
    wholesale_price REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, product_id, variant_id)
);

-- 9d. BULK & QUANTITY BREAK PRICING
CREATE TABLE IF NOT EXISTS product_bulk_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    min_quantity INTEGER NOT NULL,
    max_quantity INTEGER,
    unit_price REAL NOT NULL,
    discount_percent REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variant_id, min_quantity)
);

-- 10. INVENTORY (Warehouse stock balance)
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_in_transit INTEGER NOT NULL DEFAULT 0,
    quantity_damaged INTEGER NOT NULL DEFAULT 0,
    quantity_expired INTEGER NOT NULL DEFAULT 0,
    average_cost REAL NOT NULL DEFAULT 0.0,
    last_recounted_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id)
);

-- 11. INVENTORY MOVEMENTS (Append-only stock ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL, -- PURCHASE_RECEIPT, SALE_DEDUCTION, SALE_RETURN, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT_ADD, ADJUSTMENT_DEDUCT, DAMAGED_WRITE_OFF
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    from_state TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, RESERVED, IN_TRANSIT, DAMAGED, EXPIRED, EXTERNAL
    to_state TEXT NOT NULL DEFAULT 'AVAILABLE',   -- AVAILABLE, RESERVED, IN_TRANSIT, DAMAGED, EXPIRED, EXTERNAL
    reference_type TEXT NOT NULL, -- SALE, ORDER, TRANSFER, ADJUSTMENT, MANUAL, QUARANTINE, EXPIRY, WRITE_OFF
    reference_id TEXT,
    reason TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. STOCK ADJUSTMENT REQUESTS & APPROVALS
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    adjustment_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL, -- ADD, DEDUCT, WRITE_OFF
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. INTER-BRANCH STOCK TRANSFERS
CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_number TEXT NOT NULL UNIQUE,
    source_branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    target_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, IN_TRANSIT, RECEIVED, REJECTED, CANCELLED
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. STOCK TRANSFER ITEMS
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_requested INTEGER NOT NULL,
    quantity_sent INTEGER NOT NULL DEFAULT 0,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    quantity_discrepancy INTEGER NOT NULL DEFAULT 0,
    discrepancy_reason TEXT
);

-- 14a. GOODS RECEIVED NOTES (INBOUND STOCK RECEIPTS)
CREATE TABLE IF NOT EXISTS stock_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_invoice_no TEXT,
    delivery_note_no TEXT,
    received_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'CANCELLED'
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14b. STOCK RECEIPT ITEMS
CREATE TABLE IF NOT EXISTS stock_receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity_received INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    batch_number TEXT,
    expiry_date DATE,
    condition TEXT NOT NULL DEFAULT 'GOOD' -- 'GOOD', 'DAMAGED'
);

-- 14c. STOCKTAKES & PHYSICAL CYCLE COUNTS
CREATE TABLE IF NOT EXISTS stocktakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stocktake_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    count_type TEXT NOT NULL DEFAULT 'CYCLE_COUNT', -- 'FULL', 'CYCLE_COUNT', 'CATEGORY'
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'PENDING_APPROVAL', 'RECONCILED', 'CANCELLED'
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reconciled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_products_counted INTEGER NOT NULL DEFAULT 0,
    total_variance_units INTEGER NOT NULL DEFAULT 0,
    total_variance_value REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    reconciled_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14d. STOCKTAKE ITEMS
CREATE TABLE IF NOT EXISTS stocktake_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    system_quantity INTEGER NOT NULL DEFAULT 0,
    counted_quantity INTEGER,
    variance_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    variance_value REAL NOT NULL DEFAULT 0.0,
    counted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'COUNTED', 'VERIFIED'
    notes TEXT,
    counted_at DATETIME
);

-- 14e. CERTIFIED STOCK WRITE-OFFS
CREATE TABLE IF NOT EXISTS stock_write_offs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    write_off_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    from_state TEXT NOT NULL DEFAULT 'DAMAGED', -- 'DAMAGED', 'EXPIRED', 'AVAILABLE', 'LOST'
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_loss_value REAL NOT NULL DEFAULT 0.0,
    reason_category TEXT NOT NULL, -- 'EXPIRED', 'DAMAGED', 'THEFT_LOST', 'OBSOLETE', 'CONTAMINATED'
    disposal_method TEXT NOT NULL DEFAULT 'SCRAPPED', -- 'SCRAPPED', 'DESTROYED', 'RTV_SUPPLIER', 'DONATED'
    status TEXT NOT NULL DEFAULT 'APPROVED', -- 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14f. BATCH & LOT TRACKING
CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    receipt_item_id INTEGER REFERENCES stock_receipt_items(id) ON DELETE SET NULL,
    initial_quantity INTEGER NOT NULL,
    quantity_available INTEGER NOT NULL,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    manufacturing_date DATE,
    expiry_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DEPLETED', 'EXPIRED', 'QUARANTINED', 'RECALLED'
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_id, batch_number)
);

-- 14g. SERIAL NUMBERS
CREATE TABLE IF NOT EXISTS inventory_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT NOT NULL UNIQUE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'RESERVED', 'SOLD', 'DEFECTIVE', 'IN_TRANSIT'
    unit_cost REAL NOT NULL DEFAULT 0.0,
    allocated_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    allocated_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
    customer_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT DEFAULT 'Nairobi',
    kra_pin TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED')),
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15b. CUSTOMER DELIVERY ADDRESSES
CREATE TABLE IF NOT EXISTS customer_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_label TEXT NOT NULL DEFAULT 'Primary', -- 'Home', 'Office', 'Warehouse', 'Site A'
    address_line TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Nairobi',
    contact_name TEXT,
    contact_phone TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    delivery_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15c. CUSTOMER NOTES (Structured Timestamped Interaction Logs)
CREATE TABLE IF NOT EXISTS customer_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'GENERAL' CHECK(note_type IN ('GENERAL', 'PREFERENCE', 'ISSUE', 'CALL_LOG', 'ACCOUNT')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15a. CUSTOMER SPECIFIC PRICING & TIER AGREEMENTS
CREATE TABLE IF NOT EXISTS customer_product_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    customer_tier TEXT, -- 'RETAIL', 'WHOLESALE', 'VIP', 'CORPORATE'
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    special_price REAL NOT NULL,
    discount_percent REAL,
    min_quantity INTEGER DEFAULT 1,
    start_date DATETIME,
    end_date DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, customer_tier, product_id, variant_id)
);

-- 15b. PROMOTIONS & SCHEDULED DISCOUNTS
CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promo_code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL, -- 'PERCENTAGE', 'FIXED_AMOUNT', 'BOGO', 'BUNDLE'
    discount_value REAL NOT NULL,
    scope TEXT NOT NULL DEFAULT 'ALL', -- 'ALL', 'CATEGORY', 'PRODUCT', 'VARIANT'
    target_id INTEGER,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    min_spend REAL DEFAULT 0.0,
    min_quantity INTEGER DEFAULT 1,
    usage_limit INTEGER,
    times_used INTEGER NOT NULL DEFAULT 0,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_type TEXT NOT NULL DEFAULT 'POS_WALKIN', -- POS_WALKIN, DELIVERY_ORDER
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, PREPARING, READY_FOR_DISPATCH, DISPATCHED, DELIVERED, COMPLETED, CANCELLED
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, REFUNDED
    delivery_required INTEGER NOT NULL DEFAULT 0,
    delivery_address TEXT,
    delivery_city TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    special_instructions TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_rate REAL NOT NULL DEFAULT 16.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_price REAL NOT NULL
);

-- 17b. POS CASHIER SHIFTS & CASH DRAWER CONTROL
CREATE TABLE IF NOT EXISTS pos_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shift_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'RECONCILED')),
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    reconciled_at DATETIME,
    reconciled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    opening_cash REAL NOT NULL DEFAULT 0.0,
    closing_cash REAL,
    expected_cash REAL NOT NULL DEFAULT 0.0,
    cash_variance REAL DEFAULT 0.0,
    total_sales_amount REAL NOT NULL DEFAULT 0.0,
    total_sales_count INTEGER NOT NULL DEFAULT 0,
    total_cash_amount REAL NOT NULL DEFAULT 0.0,
    total_mpesa_amount REAL NOT NULL DEFAULT 0.0,
    total_card_amount REAL NOT NULL DEFAULT 0.0,
    total_bank_amount REAL NOT NULL DEFAULT 0.0,
    total_refunds_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    reconciliation_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17c. CASH DRAWER MOVEMENTS (Real-time physical float audit trail)
CREATE TABLE IF NOT EXISTS cash_drawer_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('FLOAT_IN', 'SALE_CASH', 'PAYOUT', 'REFUND_CASH', 'DROP_OUT')),
    amount REAL NOT NULL,
    reference_id TEXT,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. SALES (Completed POS checkouts)
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    sale_number TEXT NOT NULL UNIQUE,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    discount_approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    tax_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    total_cogs REAL NOT NULL DEFAULT 0.0,
    gross_profit REAL NOT NULL DEFAULT 0.0,
    gross_margin_pct REAL NOT NULL DEFAULT 0.0,
    payment_status TEXT NOT NULL DEFAULT 'PAID', -- PAID, PARTIALLY_REFUNDED, REFUNDED
    receipt_printed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. SALE ITEMS
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL,
    total_price REAL NOT NULL,
    cogs_amount REAL NOT NULL DEFAULT 0.0,
    batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
    serial_number TEXT
);

-- 20. HELD SALES (POS Hold/Resume functionality)
CREATE TABLE IF NOT EXISTS held_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    hold_reference TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    customer_phone TEXT,
    cart_data_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    total REAL NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    payment_number TEXT NOT NULL UNIQUE,
    payment_method TEXT NOT NULL, -- CASH, MPESA, CARD, BANK_TRANSFER
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    reference_code TEXT,
    mpesa_receipt_number TEXT,
    mpesa_phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, PENDING, FAILED, REFUNDED
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. REFUND REQUESTS (Requiring Branch Manager Approval)
CREATE TABLE IF NOT EXISTS refund_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_request_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. REFUNDS (Processed execution after approval)
CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    refund_request_id INTEGER NOT NULL REFERENCES refund_requests(id) ON DELETE RESTRICT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    reason TEXT NOT NULL,
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    category TEXT NOT NULL, -- RENT, FUEL, PACKAGING, VEHICLE_MAINTENANCE, UTILITIES, SALARIES, OTHER
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    payee TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH', -- CASH, MPESA, BANK_TRANSFER, CHEQUE
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    registration_number TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL, -- MOTORCYCLE, VAN, TRUCK, PICKUP
    model TEXT NOT NULL,
    max_capacity_kg INTEGER NOT NULL DEFAULT 500,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    license_number TEXT NOT NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ON_DELIVERY, OFF_DUTY
    current_latitude REAL,
    current_longitude REAL,
    last_ping_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 27. DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    delivery_number TEXT NOT NULL UNIQUE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatcher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT', -- PENDING_ASSIGNMENT, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED, RETURN_TO_BRANCH, RETURN_RECEIVED
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL, HIGH, URGENT
    scheduled_pickup_at DATETIME,
    estimated_delivery_at DATETIME,
    actual_delivery_at DATETIME,
    failure_reason TEXT,
    failure_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 28. DELIVERY ITEMS
CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL
);

-- 29. DELIVERY STATUS HISTORY
CREATE TABLE IF NOT EXISTS delivery_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    latitude REAL,
    longitude REAL,
    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 30. PROOF OF DELIVERY
CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    otp_code TEXT,
    otp_verified INTEGER NOT NULL DEFAULT 0,
    signature_data TEXT, -- Base64 SVG or PNG signature representation
    photo_data TEXT,     -- Base64 or local image URL
    latitude REAL,
    longitude REAL,
    notes TEXT,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 31. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE, -- NULL if global notification
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,     -- NULL if targeted to role/branch
    type TEXT NOT NULL, -- LOW_STOCK, NEW_ORDER, DELIVERY_ASSIGNED, DELIVERY_FAILED, REFUND_REQUEST, TRANSFER_REQUEST, SYSTEM
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    reference_type TEXT,
    reference_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 32. AUDIT LOGS (Strictly APPEND-ONLY - Triggers enforce no UPDATE / DELETE)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,       -- CREATE, UPDATE, DELETE, APPROVE, REJECT, DISPATCH, COMPLETE, LOGIN
    resource TEXT NOT NULL,     -- SALE, ORDER, DELIVERY, INVENTORY, USER, BRANCH, REFUND, EXPENSE
    resource_id TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    previous_value TEXT,        -- JSON snapshot
    new_value TEXT,             -- JSON snapshot
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOG IMMUTABILITY TRIGGERS
CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_update
BEFORE UPDATE ON audit_logs
BEGIN
    SELECT RAISE(FAIL, 'CRITICAL SECURITY VIOLATION: audit_logs is append-only and cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_logs_delete
BEFORE DELETE ON audit_logs
BEGIN
    SELECT RAISE(FAIL, 'CRITICAL SECURITY VIOLATION: audit_logs is append-only and records cannot be deleted.');
END;

-- PERFORMANCE & ISOLATION INDICES
CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch_id, role_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_prod ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch_prod ON inventory_movements(branch_id, product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_status ON deliveries(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_date ON audit_logs(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

-- ==============================================================================
-- 23. AUTHENTICATION HARDENING, SESSIONS & AUDIT TABLES
-- ==============================================================================

-- Active user device sessions with refresh token rotation
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);

-- Immediate JWT revocation blacklist
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jti TEXT NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);

-- Self-service password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);

-- Login and failed authentication attempt history
CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username_attempted TEXT NOT NULL,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED_PASSWORD', 'ACCOUNT_LOCKED', 'ACCOUNT_INACTIVE', '2FA_PENDING', '2FA_FAILED'
    failure_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address, created_at);

