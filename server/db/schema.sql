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
    tax_pin TEXT,
    vat_registered INTEGER NOT NULL DEFAULT 1,
    withholding_tax_rate REAL NOT NULL DEFAULT 0.0,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_branch TEXT,
    mpesa_paybill TEXT,
    mpesa_account_no TEXT,
    rating REAL NOT NULL DEFAULT 5.0,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8c. SUPPLIER CONTACTS
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8d. SUPPLIER PRODUCTS CATALOG & CONTRACTED PRICING
CREATE TABLE IF NOT EXISTS supplier_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    supplier_sku TEXT,
    agreed_cost REAL NOT NULL,
    min_order_quantity INTEGER NOT NULL DEFAULT 1,
    lead_time_days INTEGER DEFAULT 3,
    is_preferred INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, product_id)
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
    unit_of_measure TEXT NOT NULL DEFAULT 'PCS',
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
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
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
    purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL,
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
    delivery_fee REAL NOT NULL DEFAULT 0.0,
    delivery_address TEXT,
    delivery_city TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    special_instructions TEXT,
    inventory_allocated INTEGER NOT NULL DEFAULT 0,
    allocated_at DATETIME,
    dispatched_at DATETIME,
    delivered_at DATETIME,
    cancelled_at DATETIME,
    cancellation_reason TEXT,
    internal_notes TEXT,
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

-- 17a. ORDER STATUS TIMELINE & HISTORY
CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17a2. ORDER INTERNAL NOTES
CREATE TABLE IF NOT EXISTS order_internal_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- 21a. PAYMENT INTENTS (Decoupled Payment Engine)
CREATE TABLE IF NOT EXISTS payment_intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL, -- MPESA, CARD, CASH, BANK
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SUCCESS, FAILED, TIMEOUT, CANCELLED, REFUNDED
    idempotency_key TEXT UNIQUE,
    provider_reference TEXT, -- e.g. CheckoutRequestID or Card Auth Code
    external_reference TEXT, -- e.g. M-Pesa Receipt Number or Bank Slip No
    phone_number TEXT,
    metadata TEXT, -- JSON string
    failure_reason TEXT,
    timeout_at DATETIME,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 21b. PAYMENTS (Completed Transaction Ledger)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
    sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    payment_number TEXT NOT NULL UNIQUE,
    payment_method TEXT NOT NULL, -- CASH, MPESA, CARD, BANK
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    reference_code TEXT,
    provider_reference TEXT,
    mpesa_receipt_number TEXT,
    mpesa_phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, PENDING, FAILED, REFUNDED
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    reconciled_at DATETIME,
    reconciled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21c. PAYMENT CALLBACKS (Webhook Audit & Duplicate Callback Protection)
CREATE TABLE IF NOT EXISTS payment_callbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
    provider TEXT NOT NULL, -- MPESA, CARD, BANK
    provider_reference TEXT NOT NULL, -- e.g. CheckoutRequestID
    result_code INTEGER,
    result_description TEXT,
    raw_payload TEXT NOT NULL,
    is_processed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_reference)
);

-- 21d. PAYMENT AUDIT TRAIL (Immutable State Transition History)
CREATE TABLE IF NOT EXISTS payment_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_intent_id INTEGER NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_type TEXT NOT NULL, -- SYSTEM, USER, PROVIDER_CALLBACK
    actor_id TEXT,
    details TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21e. PAYMENT REFUNDS (Direct Payment Reversals)
CREATE TABLE IF NOT EXISTS payment_refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_number TEXT NOT NULL UNIQUE,
    payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    payment_intent_id INTEGER REFERENCES payment_intents(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
    vehicle_type TEXT NOT NULL, -- MOTORCYCLE, VAN, TRUCK, PICKUP, TUKTUK, LORRY
    make TEXT NOT NULL DEFAULT 'Toyota',
    model TEXT NOT NULL,
    year_of_manufacture INTEGER,
    chassis_number TEXT,
    engine_number TEXT,
    color TEXT DEFAULT 'White',
    fuel_type TEXT NOT NULL DEFAULT 'DIESEL', -- DIESEL, PETROL, ELECTRIC, HYBRID
    fuel_tank_capacity_liters REAL DEFAULT 70.0,
    ownership_type TEXT NOT NULL DEFAULT 'COMPANY_OWNED', -- COMPANY_OWNED, LEASED, THIRD_PARTY
    max_capacity_kg INTEGER NOT NULL DEFAULT 500,
    cargo_volume_cbm REAL DEFAULT 6.0,
    current_odometer_km REAL NOT NULL DEFAULT 0.0,
    initial_odometer_km REAL NOT NULL DEFAULT 0.0,
    last_service_odometer_km REAL DEFAULT 0.0,
    next_service_odometer_km REAL DEFAULT 5000.0,
    last_service_date DATE,
    next_service_date DATE,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, IN_TRANSIT, UNDER_MAINTENANCE, OUT_OF_SERVICE, RESERVED
    status_reason TEXT,
    status_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25a. VEHICLE FUEL LOGS
CREATE TABLE IF NOT EXISTS vehicle_fuel_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    fuel_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fuel_type TEXT NOT NULL DEFAULT 'DIESEL',
    quantity_liters REAL NOT NULL,
    cost_per_liter REAL NOT NULL,
    total_cost REAL NOT NULL,
    odometer_km REAL NOT NULL,
    fuel_station TEXT,
    receipt_voucher_no TEXT,
    payment_method TEXT NOT NULL DEFAULT 'CORPORATE_CARD', -- CORPORATE_CARD, MPESA_B2B, PETTY_CASH, INVOICE
    full_tank_flag INTEGER NOT NULL DEFAULT 1,
    calculated_consumption_kml REAL,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25b. VEHICLE MAINTENANCE & GARAGE RECORDS
CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_number TEXT NOT NULL UNIQUE,
    service_type TEXT NOT NULL, -- PREVENTIVE_SCHEDULED, REPAIR_CORRECTIVE, TIRE_REPLACEMENT, OIL_CHANGE, INSPECTION_NTSA, BRAKE_OVERHAUL, ACCIDENT_REPAIR
    severity TEXT NOT NULL DEFAULT 'ROUTINE', -- ROUTINE, MEDIUM, URGENT, CRITICAL
    service_date DATE NOT NULL,
    odometer_km REAL NOT NULL,
    service_provider TEXT NOT NULL,
    invoice_reference TEXT,
    parts_cost REAL NOT NULL DEFAULT 0.0,
    labor_cost REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    description TEXT NOT NULL,
    parts_replaced TEXT,
    next_service_due_date DATE,
    next_service_due_km REAL,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25c. VEHICLE MILEAGE & TRIP LOGS
CREATE TABLE IF NOT EXISTS vehicle_mileage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    trip_type TEXT NOT NULL DEFAULT 'DELIVERY_RUN', -- DELIVERY_RUN, RELOCATION, MAINTENANCE, TEST_DRIVE
    start_odometer_km REAL NOT NULL,
    end_odometer_km REAL NOT NULL,
    distance_km REAL NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25d. VEHICLE STATUS TRANSITION HISTORY
CREATE TABLE IF NOT EXISTS vehicle_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_code TEXT UNIQUE,
    employment_type TEXT NOT NULL DEFAULT 'FULL_TIME', -- FULL_TIME, CONTRACTOR, CASUAL
    hire_date DATE,
    avatar_url TEXT,
    blood_group TEXT,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    email TEXT,
    residential_address TEXT,
    city TEXT DEFAULT 'Nairobi',
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,
    national_id TEXT,
    kra_pin TEXT,
    nssf_number TEXT,
    nhif_number TEXT,
    license_number TEXT NOT NULL,
    license_classes TEXT NOT NULL DEFAULT 'B, C1', -- A2, B, C1, C, CE
    license_issue_date DATE,
    license_expiry_date DATE,
    ntsa_verified INTEGER NOT NULL DEFAULT 1,
    ntsa_verification_date DATE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ON_DELIVERY, OFF_DUTY, ON_LEAVE, SUSPENDED
    status_reason TEXT,
    status_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rating REAL NOT NULL DEFAULT 5.0,
    current_latitude REAL,
    current_longitude REAL,
    last_ping_at DATETIME,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26a. DRIVER STATUS TRANSITION HISTORY
CREATE TABLE IF NOT EXISTS driver_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26b. DRIVER SAFETY & INCIDENT LOGS
CREATE TABLE IF NOT EXISTS driver_incident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL, -- ACCIDENT, TRAFFIC_VIOLATION, CUSTOMER_COMPLAINT, VEHICLE_BREAKDOWN, DELAY
    severity TEXT NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    incident_date DATETIME NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT,
    logged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 27. DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    delivery_number TEXT NOT NULL UNIQUE,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    delivery_type TEXT DEFAULT 'LAST_MILE',
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatcher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT', -- PENDING_ASSIGNMENT, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED, RESCHEDULED, RETURN_TO_HUB, RETURN_TO_BRANCH, RETURN_RECEIVED
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL, HIGH, URGENT
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    pod_required_methods TEXT DEFAULT 'SIGNATURE,GPS',
    destination_address TEXT,
    destination_city TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    cod_amount_expected REAL DEFAULT 0.0,
    cod_amount_collected REAL DEFAULT 0.0,
    scheduled_pickup_at DATETIME,
    estimated_delivery_at DATETIME,
    actual_delivery_at DATETIME,
    failure_reason TEXT,
    failure_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 27a. DELIVERY ATTEMPTS
CREATE TABLE IF NOT EXISTS delivery_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL, -- SUCCESS, FAILED, RESCHEDULED
    failure_reason TEXT,
    failure_notes TEXT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    latitude REAL,
    longitude REAL,
    rescheduled_for DATETIME,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery ON delivery_attempts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_shipment ON delivery_attempts(shipment_id);

-- 28. DELIVERY ITEMS
CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE RESTRICT,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
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
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    otp_code TEXT,
    otp_verified INTEGER NOT NULL DEFAULT 0,
    signature_data TEXT, -- Base64 SVG or PNG signature representation
    photo_data TEXT,     -- Base64 or local image URL
    latitude REAL,
    longitude REAL,
    device_id TEXT,
    notes TEXT,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Immutability enforcement on proof_of_delivery (Rule POD-005)
CREATE TRIGGER IF NOT EXISTS trg_prevent_pod_update
BEFORE UPDATE ON proof_of_delivery
BEGIN
    SELECT RAISE(ABORT, 'Audit Violation: proof_of_delivery records are legally binding evidence and cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_pod_delete
BEFORE DELETE ON proof_of_delivery
BEGIN
    SELECT RAISE(ABORT, 'Audit Violation: proof_of_delivery records are legally binding evidence and cannot be deleted.');
END;

-- 30a. EXCEPTIONS (Centralized Operational Exception Management)
CREATE TABLE IF NOT EXISTS exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exception_number TEXT UNIQUE NOT NULL,
    exception_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    root_cause TEXT,
    resolution_notes TEXT,
    reported_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_exceptions_shipment ON exceptions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_delivery ON exceptions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_type ON exceptions(exception_type);

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

-- ============================================================================
-- PHASE 8: COMPLETE PROCUREMENT LIFECYCLE
-- ============================================================================

-- 1. PURCHASE REQUISITIONS (PR)
CREATE TABLE IF NOT EXISTS purchase_requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_number TEXT NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    urgency TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    needed_by_date DATE,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'CANCELLED'
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at DATETIME,
    rejection_reason TEXT,
    notes TEXT,
    total_estimated_cost REAL NOT NULL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisition_id INTEGER NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    requested_quantity INTEGER NOT NULL,
    estimated_unit_cost REAL NOT NULL DEFAULT 0.0,
    notes TEXT
);

-- 2. PURCHASE ORDERS (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL UNIQUE,
    purchase_requisition_id INTEGER REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED'
    payment_terms TEXT NOT NULL DEFAULT 'NET30',
    currency TEXT NOT NULL DEFAULT 'KES',
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    shipping_fee REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    expected_delivery_date DATE,
    approved_at DATETIME,
    sent_at DATETIME,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    ordered_quantity INTEGER NOT NULL,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    tax_rate REAL NOT NULL DEFAULT 16.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0
);

-- 3. SUPPLIER INVOICES (BILLS)
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    supplier_invoice_no TEXT NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    stock_receipt_id INTEGER REFERENCES stock_receipts(id) ON DELETE SET NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    amount_paid REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'
    notes TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. SUPPLIER PAYMENTS (OUTBOUND DISBURSEMENTS)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id) ON DELETE RESTRICT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'BANK', -- 'BANK', 'MPESA', 'CASH', 'CARD'
    reference_number TEXT NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. SUPPLIER RETURNS (DEBIT NOTES)
CREATE TABLE IF NOT EXISTS supplier_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    stock_receipt_id INTEGER REFERENCES stock_receipts(id) ON DELETE SET NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL, -- 'DAMAGED_ON_ARRIVAL', 'DEFECTIVE', 'OVER_DELIVERY', 'WRONG_ITEM', 'EXPIRED'
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'APPROVED', 'DISPATCHED', 'CREDITED_OR_REFUNDED'
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_return_id INTEGER NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    from_inventory_state TEXT NOT NULL DEFAULT 'DAMAGED', -- 'DAMAGED', 'AVAILABLE'
    reason TEXT
);

-- 6. IMMUTABLE PROCUREMENT AUDIT TRAIL
CREATE TABLE IF NOT EXISTS procurement_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'REQUISITION', 'PURCHASE_ORDER', 'GRN', 'INVOICE', 'PAYMENT', 'RETURN'
    entity_id INTEGER NOT NULL,
    entity_number TEXT NOT NULL,
    action TEXT NOT NULL, -- 'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'INVOICED', 'PAID', 'RETURNED', 'CANCELLED'
    from_status TEXT,
    to_status TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details TEXT, -- JSON payload
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. PROCUREMENT INDEXES
CREATE INDEX IF NOT EXISTS idx_pr_branch ON purchase_requisitions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_po ON stock_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_supplier ON supplier_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_proc_audit_entity ON procurement_audit_trail(entity_type, entity_id);

-- ============================================================================
-- PHASE 9: LOGISTICS & FLEET (9.1 DRIVERS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_drivers_branch ON drivers(branch_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
CREATE INDEX IF NOT EXISTS idx_drivers_national_id ON drivers(national_id);
CREATE INDEX IF NOT EXISTS idx_driver_status_hist ON driver_status_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_incidents ON driver_incident_logs(driver_id);

-- ============================================================================
-- PHASE 9: LOGISTICS & FLEET (9.2 VEHICLES)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_branch ON vehicles(branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(registration_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_vehicle ON vehicle_fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maint_vehicle ON vehicle_maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_vehicle ON vehicle_mileage_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_hist ON vehicle_status_history(vehicle_id);
-- ============================================================================
-- PHASE 10: LOGISTICS PLATFORM (STAGE 1 & STAGE 2 SHIPMENT CORE)
-- ============================================================================

-- 1. IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expires_at);

-- 2. LOGISTICS PRICING TARIFFS
CREATE TABLE IF NOT EXISTS logistics_pricing_tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_hub_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    destination_hub_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'STANDARD',
    base_weight_kg REAL NOT NULL DEFAULT 5.0,
    base_price REAL NOT NULL DEFAULT 350.0,
    per_kg_above_base REAL NOT NULL DEFAULT 50.0,
    cod_fee_percent REAL DEFAULT 2.0,
    min_cod_fee REAL DEFAULT 100.0,
    insurance_rate_percent REAL DEFAULT 1.0,
    remote_area_surcharge REAL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'KES',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(origin_hub_id, destination_hub_id, service_type)
);
CREATE INDEX IF NOT EXISTS idx_tariffs_route ON logistics_pricing_tariffs(origin_hub_id, destination_hub_id, service_type);

-- 3. SHIPMENTS
CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT NOT NULL UNIQUE,
    waybill_number TEXT UNIQUE,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    current_hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    current_location_desc TEXT,
    sender_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    sender_email TEXT,
    sender_address TEXT NOT NULL,
    sender_city TEXT NOT NULL,
    recipient_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_email TEXT,
    recipient_address TEXT NOT NULL,
    recipient_city TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'STANDARD',
    delivery_type TEXT NOT NULL DEFAULT 'LAST_MILE',
    status TEXT NOT NULL DEFAULT 'BOOKED',
    total_parcels INTEGER NOT NULL DEFAULT 1,
    actual_weight_kg REAL NOT NULL DEFAULT 0.0,
    volumetric_weight_kg REAL NOT NULL DEFAULT 0.0,
    chargeable_weight_kg REAL NOT NULL DEFAULT 0.0,
    declared_value REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'KES',
    base_rate REAL NOT NULL DEFAULT 0.0,
    weight_charge REAL NOT NULL DEFAULT 0.0,
    surcharges REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_terms TEXT NOT NULL DEFAULT 'PREPAID',
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    cod_amount REAL NOT NULL DEFAULT 0.0,
    cod_fee REAL NOT NULL DEFAULT 0.0,
    special_instructions TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_origin ON shipments(origin_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_destination ON shipments(destination_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_current_hub ON shipments(current_hub_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);

-- 4. PARCELS
CREATE TABLE IF NOT EXISTS parcels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_number TEXT NOT NULL UNIQUE,
    parcel_index INTEGER NOT NULL DEFAULT 1,
    weight_kg REAL NOT NULL,
    length_cm REAL NOT NULL DEFAULT 0.0,
    width_cm REAL NOT NULL DEFAULT 0.0,
    height_cm REAL NOT NULL DEFAULT 0.0,
    volumetric_weight_kg REAL NOT NULL DEFAULT 0.0,
    package_type TEXT NOT NULL DEFAULT 'BOX',
    description TEXT,
    condition_at_intake TEXT NOT NULL DEFAULT 'INTACT',
    intake_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_parcels_shipment ON parcels(shipment_id);
CREATE INDEX IF NOT EXISTS idx_parcels_number ON parcels(parcel_number);

-- 5. SHIPMENT LEGS
CREATE TABLE IF NOT EXISTS shipment_legs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    leg_sequence INTEGER NOT NULL,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    transport_run_id INTEGER,
    manifest_id INTEGER,
    is_cross_border INTEGER NOT NULL DEFAULT 0,
    border_post_name TEXT,
    customs_status TEXT DEFAULT 'NOT_APPLICABLE',
    customs_hold_reason TEXT,
    scheduled_departure DATETIME,
    actual_departure DATETIME,
    scheduled_arrival DATETIME,
    actual_arrival DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shipment_id, leg_sequence)
);
CREATE INDEX IF NOT EXISTS idx_shipment_legs_shipment ON shipment_legs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_legs_status ON shipment_legs(status);

-- 6. TRACKING EVENTS
CREATE TABLE IF NOT EXISTS tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    leg_id INTEGER REFERENCES shipment_legs(id) ON DELETE SET NULL,
    event_code TEXT NOT NULL,
    event_name TEXT NOT NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    location_desc TEXT,
    latitude REAL,
    longitude REAL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL DEFAULT 'STAFF',
    actor_name TEXT,
    description TEXT NOT NULL,
    is_customer_visible INTEGER NOT NULL DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON tracking_events(shipment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_events_code ON tracking_events(event_code);

-- TRACKING EVENTS IMMUTABILITY TRIGGERS
CREATE TRIGGER IF NOT EXISTS prevent_tracking_events_update
BEFORE UPDATE ON tracking_events
BEGIN
    SELECT RAISE(FAIL, 'CRITICAL SECURITY VIOLATION: tracking_events is append-only and cannot be modified.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_tracking_events_delete
BEFORE DELETE ON tracking_events
BEGIN
    SELECT RAISE(FAIL, 'CRITICAL SECURITY VIOLATION: tracking_events is append-only and records cannot be deleted.');
END;

-- ============================================================================
-- PHASE 11: TRANSPORT MANAGEMENT & MANIFESTS (STAGE 3)
-- ============================================================================

-- 1. ROUTES
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    distance_km REAL NOT NULL DEFAULT 0.0,
    estimated_duration_hours REAL NOT NULL DEFAULT 0.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_routes_origin_dest ON routes(origin_hub_id, destination_hub_id);

-- 2. ROUTE LEGS
CREATE TABLE IF NOT EXISTS route_legs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    leg_sequence INTEGER NOT NULL DEFAULT 1,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    distance_km REAL NOT NULL DEFAULT 0.0,
    estimated_duration_hours REAL NOT NULL DEFAULT 0.0,
    is_cross_border INTEGER NOT NULL DEFAULT 0,
    border_post_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_id, leg_sequence)
);
CREATE INDEX IF NOT EXISTS idx_route_legs_origin_dest ON route_legs(origin_hub_id, destination_hub_id);

-- 3. TRANSPORT RUNS
CREATE TABLE IF NOT EXISTS transport_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_number TEXT NOT NULL UNIQUE,
    route_leg_id INTEGER REFERENCES route_legs(id) ON DELETE RESTRICT,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatcher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PLANNED',
    scheduled_departure DATETIME,
    actual_departure DATETIME,
    scheduled_arrival DATETIME,
    actual_arrival DATETIME,
    current_odometer_km REAL DEFAULT 0.0,
    departure_odometer_km REAL DEFAULT 0.0,
    arrival_odometer_km REAL DEFAULT 0.0,
    total_shipments_count INTEGER NOT NULL DEFAULT 0,
    total_parcels_count INTEGER NOT NULL DEFAULT 0,
    total_weight_kg REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transport_runs_status ON transport_runs(status);
CREATE INDEX IF NOT EXISTS idx_transport_runs_driver ON transport_runs(driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_runs_vehicle ON transport_runs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transport_runs_hubs ON transport_runs(origin_hub_id, destination_hub_id);

-- 4. MANIFESTS
CREATE TABLE IF NOT EXISTS manifests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manifest_number TEXT NOT NULL UNIQUE,
    transport_run_id INTEGER NOT NULL REFERENCES transport_runs(id) ON DELETE CASCADE,
    origin_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    destination_hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    locked_at DATETIME,
    locked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_shipments INTEGER NOT NULL DEFAULT 0,
    total_parcels INTEGER NOT NULL DEFAULT 0,
    total_weight_kg REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manifests_run ON manifests(transport_run_id);
CREATE INDEX IF NOT EXISTS idx_manifests_status ON manifests(status);

-- 5. MANIFEST ITEMS
CREATE TABLE IF NOT EXISTS manifest_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manifest_id INTEGER NOT NULL REFERENCES manifests(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    shipment_leg_id INTEGER REFERENCES shipment_legs(id) ON DELETE SET NULL,
    loaded_at DATETIME,
    loaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    received_at DATETIME,
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ASSIGNED',
    discrepancy_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manifest_id, shipment_id)
);
CREATE INDEX IF NOT EXISTS idx_manifest_items_manifest ON manifest_items(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_items_shipment ON manifest_items(shipment_id);

-- 6. RUN CHECKPOINTS
CREATE TABLE IF NOT EXISTS run_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transport_run_id INTEGER NOT NULL REFERENCES transport_runs(id) ON DELETE CASCADE,
    checkpoint_name TEXT NOT NULL,
    location_desc TEXT,
    latitude REAL,
    longitude REAL,
    recorded_by_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON run_checkpoints(transport_run_id);

-- ============================================================================
-- PHASE 12: PHYSICAL CUSTODY & HUB OPERATIONS (Stage 4 Logistics PRD)
-- ============================================================================

-- 1. SCAN EVENTS (High-Throughput Chain of Custody Barcode Scans)
CREATE TABLE IF NOT EXISTS scan_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_uuid TEXT UNIQUE NOT NULL,
    barcode TEXT NOT NULL,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    scan_type TEXT NOT NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    location_desc TEXT,
    latitude REAL,
    longitude REAL,
    device_id TEXT,
    app_version TEXT,
    scanned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_offline_sync INTEGER NOT NULL DEFAULT 0,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_scan_events_barcode ON scan_events(barcode);
CREATE INDEX IF NOT EXISTS idx_scan_events_shipment_id ON scan_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_hub_id ON scan_events(hub_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_type ON scan_events(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_events_scanned_at ON scan_events(scanned_at);

-- Immutability enforcement on scan_events
CREATE TRIGGER IF NOT EXISTS trg_prevent_scan_events_update
BEFORE UPDATE ON scan_events
BEGIN
    SELECT RAISE(ABORT, 'Audit Violation: scan_events is an immutable chain-of-custody ledger. Updates are strictly prohibited.');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_scan_events_delete
BEFORE DELETE ON scan_events
BEGIN
    SELECT RAISE(ABORT, 'Audit Violation: scan_events is an immutable chain-of-custody ledger. Deletions are strictly prohibited.');
END;

-- 2. CUSTODY HANDOFFS (Physical Custody Handovers between parties)
CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handoff_number TEXT UNIQUE NOT NULL,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    handoff_type TEXT NOT NULL,
    releasing_actor_type TEXT NOT NULL,
    releasing_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    releasing_actor_name TEXT NOT NULL,
    receiving_actor_type TEXT NOT NULL,
    receiving_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    receiving_actor_name TEXT NOT NULL,
    package_condition TEXT NOT NULL DEFAULT 'GOOD',
    seal_number TEXT,
    verification_method TEXT NOT NULL DEFAULT 'BARCODE_SCAN',
    signature_data TEXT,
    notes TEXT,
    transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_handoffs_shipment_id ON handoffs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_hub_id ON handoffs(hub_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_number ON handoffs(handoff_number);

-- 3. HUB RECEIVING SESSIONS (Intake and Unloading Bay Sessions)
CREATE TABLE IF NOT EXISTS hub_receiving_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_number TEXT UNIQUE NOT NULL,
    hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    station_bay TEXT,
    operator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    expected_packages_count INTEGER NOT NULL DEFAULT 0,
    scanned_packages_count INTEGER NOT NULL DEFAULT 0,
    intact_count INTEGER NOT NULL DEFAULT 0,
    damaged_count INTEGER NOT NULL DEFAULT 0,
    unexpected_count INTEGER NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_receiving_sessions_hub ON hub_receiving_sessions(hub_id);
CREATE INDEX IF NOT EXISTS idx_receiving_sessions_run ON hub_receiving_sessions(transport_run_id);
CREATE INDEX IF NOT EXISTS idx_receiving_sessions_status ON hub_receiving_sessions(status);

-- 4. HUB RECEIVING ITEMS (Individual scans within receiving session)
CREATE TABLE IF NOT EXISTS hub_receiving_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES hub_receiving_sessions(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    barcode TEXT NOT NULL,
    is_expected INTEGER NOT NULL DEFAULT 1,
    condition TEXT NOT NULL DEFAULT 'GOOD',
    condition_notes TEXT,
    scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_receiving_items_session ON hub_receiving_items(session_id);
CREATE INDEX IF NOT EXISTS idx_receiving_items_shipment ON hub_receiving_items(shipment_id);

-- 5. DISCREPANCIES (Physical Inventory Exceptions & Investigations)
CREATE TABLE IF NOT EXISTS discrepancies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discrepancy_number TEXT UNIQUE NOT NULL,
    discrepancy_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    parcel_id INTEGER REFERENCES parcels(id) ON DELETE SET NULL,
    hub_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    transport_run_id INTEGER REFERENCES transport_runs(id) ON DELETE SET NULL,
    manifest_id INTEGER REFERENCES manifests(id) ON DELETE SET NULL,
    receiving_session_id INTEGER REFERENCES hub_receiving_sessions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    reported_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investigator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_action TEXT,
    resolution_notes TEXT,
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_discrepancies_hub ON discrepancies(hub_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_shipment ON discrepancies(shipment_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_discrepancies_type ON discrepancies(discrepancy_type);

-- ============================================================================
-- PHASE 14: POS COUNTER BOOKING, PAYMENTS LINKING & WAYBILL PERSISTENCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_shipment ON payments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_shipment ON payment_intents(shipment_id);



