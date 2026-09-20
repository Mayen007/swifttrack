-- ==============================================================================
-- PRODUCTION RELATIONAL SCHEMA FOR SINGLE-TENANT MULTI-BRANCH LOGISTICS + POS
-- Database: PostgreSQL 14+ (High Precision, Strict Typing & Immutability Triggers)
-- Company: SwiftTrack Kenya Logistics Ltd (Single Owner - No tenant_id)
-- Primary Isolation Key: branch_id
-- ==============================================================================

-- 1. COMPANY SETTINGS (Single-record application owner)
CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    kra_pin VARCHAR(50) NOT NULL,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Nairobi',
    country VARCHAR(100) NOT NULL DEFAULT 'Kenya',
    receipt_header TEXT,
    receipt_footer TEXT,
    etims_enabled BOOLEAN NOT NULL DEFAULT true,
    etims_branch_code VARCHAR(20) DEFAULT '00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    location_desc TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT true
);

-- 5. PERMISSIONS
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(100) NOT NULL,
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
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT, -- NULL for global Super Admin
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    token_version INTEGER NOT NULL DEFAULT 1,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret TEXT,
    two_factor_recovery_codes TEXT,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8a. BRANDS
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8b. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100) DEFAULT 'Nairobi',
    country VARCHAR(100) DEFAULT 'Kenya',
    lead_time_days INTEGER DEFAULT 3,
    payment_terms VARCHAR(50) DEFAULT 'NET30',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    barcode VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL DEFAULT 'PCS',
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    wholesale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_category VARCHAR(50) NOT NULL DEFAULT 'STANDARD_16',
    min_stock_alert INTEGER NOT NULL DEFAULT 10,
    max_stock_alert INTEGER NOT NULL DEFAULT 500,
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    reorder_quantity INTEGER NOT NULL DEFAULT 50,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ DEFAULT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9a. PRODUCT VARIANTS
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_sku VARCHAR(100) NOT NULL UNIQUE,
    variant_barcode VARCHAR(100) UNIQUE,
    variant_name VARCHAR(255) NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    model VARCHAR(100),
    attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_price_override NUMERIC(12, 2),
    selling_price_override NUMERIC(12, 2),
    wholesale_price_override NUMERIC(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9b. VARIANT INVENTORY
CREATE TABLE IF NOT EXISTS variant_inventory (
    id SERIAL PRIMARY KEY,
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
    last_recounted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, variant_id)
);

-- 9c. BRANCH-SPECIFIC PRICING
CREATE TABLE IF NOT EXISTS branch_product_prices (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    cost_price NUMERIC(12, 2),
    selling_price NUMERIC(12, 2) NOT NULL,
    wholesale_price NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, product_id, variant_id)
);

-- 9d. BULK & QUANTITY BREAK PRICING
CREATE TABLE IF NOT EXISTS product_bulk_pricing (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    min_quantity INTEGER NOT NULL,
    max_quantity INTEGER,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_percent NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, variant_id, min_quantity)
);

-- 10. INVENTORY (Warehouse stock balance)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_in_transit INTEGER NOT NULL DEFAULT 0,
    quantity_damaged INTEGER NOT NULL DEFAULT 0,
    quantity_expired INTEGER NOT NULL DEFAULT 0,
    last_recounted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_warehouse_product UNIQUE (warehouse_id, product_id)
);

-- 11. INVENTORY MOVEMENTS (Append-only stock ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, -- PURCHASE_RECEIPT, SALE_DEDUCTION, SALE_RETURN, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT_ADD, ADJUSTMENT_DEDUCT, DAMAGED_WRITE_OFF
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    from_state VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, RESERVED, IN_TRANSIT, DAMAGED, EXPIRED, EXTERNAL
    to_state VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',   -- AVAILABLE, RESERVED, IN_TRANSIT, DAMAGED, EXPIRED, EXTERNAL
    reference_type VARCHAR(50) NOT NULL, -- SALE, ORDER, TRANSFER, ADJUSTMENT, MANUAL, QUARANTINE, EXPIRY, WRITE_OFF
    reference_id VARCHAR(100),
    reason TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. STOCK ADJUSTMENT REQUESTS & APPROVALS
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    adjustment_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(50) NOT NULL, -- ADD, DEDUCT, WRITE_OFF
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. INTER-BRANCH STOCK TRANSFERS
CREATE TABLE IF NOT EXISTS stock_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(100) NOT NULL UNIQUE,
    source_branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    target_branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    target_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, IN_TRANSIT, RECEIVED, REJECTED, CANCELLED
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    received_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. STOCK TRANSFER ITEMS
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id SERIAL PRIMARY KEY,
    stock_transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_requested INTEGER NOT NULL,
    quantity_sent INTEGER NOT NULL DEFAULT 0,
    quantity_received INTEGER NOT NULL DEFAULT 0
);

-- 15. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
    customer_number VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Nairobi',
    kra_pin VARCHAR(50),
    notes TEXT,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15a. CUSTOMER SPECIFIC PRICING & TIER AGREEMENTS
CREATE TABLE IF NOT EXISTS customer_product_prices (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    customer_tier VARCHAR(50),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    special_price NUMERIC(12, 2) NOT NULL,
    discount_percent NUMERIC(5, 2),
    min_quantity INTEGER DEFAULT 1,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, customer_tier, product_id, variant_id)
);

-- 15b. PROMOTIONS & SCHEDULED DISCOUNTS
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    promo_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value NUMERIC(12, 2) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
    target_id INTEGER,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    min_spend NUMERIC(12, 2) DEFAULT 0.00,
    min_quantity INTEGER DEFAULT 1,
    usage_limit INTEGER,
    times_used INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_type VARCHAR(50) NOT NULL DEFAULT 'POS_WALKIN', -- POS_WALKIN, DELIVERY_ORDER
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, PREPARING, READY_FOR_DISPATCH, DISPATCHED, DELIVERED, COMPLETED, CANCELLED
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, REFUNDED
    delivery_required BOOLEAN NOT NULL DEFAULT false,
    delivery_address TEXT,
    delivery_city VARCHAR(100),
    recipient_name VARCHAR(255),
    recipient_phone VARCHAR(50),
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12, 2) NOT NULL
);

-- 18. SALES (Completed POS checkouts)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    sale_number VARCHAR(100) NOT NULL UNIQUE,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    tax_amount NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID', -- PAID, PARTIALLY_REFUNDED, REFUNDED
    receipt_printed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 19. SALE ITEMS
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);

-- 20. HELD SALES (POS Hold/Resume functionality)
CREATE TABLE IF NOT EXISTS held_sales (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    hold_reference VARCHAR(100) NOT NULL UNIQUE,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    cart_data_json JSONB NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 21. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    payment_number VARCHAR(100) NOT NULL UNIQUE,
    payment_method VARCHAR(50) NOT NULL, -- CASH, MPESA, CARD, BANK_TRANSFER
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    reference_code VARCHAR(100),
    mpesa_receipt_number VARCHAR(100),
    mpesa_phone_number VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, PENDING, FAILED, REFUNDED
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. REFUND REQUESTS (Requiring Branch Manager Approval)
CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    refund_request_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. REFUNDS (Processed execution after approval)
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    refund_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    refund_request_id INTEGER NOT NULL REFERENCES refund_requests(id) ON DELETE RESTRICT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    expense_number VARCHAR(100) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    category VARCHAR(50) NOT NULL, -- RENT, FUEL, PACKAGING, VEHICLE_MAINTENANCE, UTILITIES, SALARIES, OTHER
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payee VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH', -- CASH, MPESA, BANK_TRANSFER, CHEQUE
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL, -- MOTORCYCLE, VAN, TRUCK, PICKUP
    model VARCHAR(100) NOT NULL,
    max_capacity_kg INTEGER NOT NULL DEFAULT 500,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    license_number VARCHAR(100) NOT NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    phone VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ON_DELIVERY, OFF_DUTY
    current_latitude NUMERIC(10, 7),
    current_longitude NUMERIC(10, 7),
    last_ping_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 27. DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    delivery_number VARCHAR(100) NOT NULL UNIQUE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    dispatcher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_ASSIGNMENT', -- PENDING_ASSIGNMENT, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED, RETURN_TO_BRANCH, RETURN_RECEIVED
    priority VARCHAR(50) NOT NULL DEFAULT 'NORMAL', -- NORMAL, HIGH, URGENT
    scheduled_pickup_at TIMESTAMPTZ,
    estimated_delivery_at TIMESTAMPTZ,
    actual_delivery_at TIMESTAMPTZ,
    failure_reason TEXT,
    failure_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 28. DELIVERY ITEMS
CREATE TABLE IF NOT EXISTS delivery_items (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL
);

-- 29. DELIVERY STATUS HISTORY
CREATE TABLE IF NOT EXISTS delivery_status_history (
    id BIGSERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 30. PROOF OF DELIVERY
CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL UNIQUE REFERENCES deliveries(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    otp_code VARCHAR(50),
    otp_verified BOOLEAN NOT NULL DEFAULT false,
    signature_data TEXT, -- Base64 SVG or PNG
    photo_data TEXT,     -- Base64 or local image URL
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    notes TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 31. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE, -- NULL if global
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,     -- NULL if targeted to role/branch
    type VARCHAR(50) NOT NULL, -- LOW_STOCK, NEW_ORDER, DELIVERY_ASSIGNED, DELIVERY_FAILED, REFUND_REQUEST, TRANSFER_REQUEST, SYSTEM
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 32. AUDIT LOGS (Strictly APPEND-ONLY - PostgreSQL Trigger Enforced)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,       -- CREATE, UPDATE, DELETE, APPROVE, REJECT, DISPATCH, COMPLETE, LOGIN
    resource VARCHAR(50) NOT NULL,     -- SALE, ORDER, DELIVERY, INVENTORY, USER, BRANCH, REFUND, EXPENSE
    resource_id VARCHAR(100),
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 33. USER SESSIONS (Active device sessions with refresh tokens)
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 34. REVOKED TOKENS (Blacklisted JWT JTI)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(100) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 35. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 36. LOGIN HISTORY
CREATE TABLE IF NOT EXISTS login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username_attempted VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- SUCCESS, FAILED_PASSWORD, ACCOUNT_LOCKED, ACCOUNT_INACTIVE, 2FA_PENDING, 2FA_FAILED
    failure_reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 37. SCHEMA MIGRATIONS (Migration Tracking)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER NOT NULL DEFAULT 0
);

-- ==============================================================================
-- AUDIT LOG IMMUTABILITY (PL/pgSQL Trigger Function)
-- ==============================================================================
CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: audit_logs is append-only. Modification or deletion of audit records is strictly prohibited by compliance policy.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_immutability();

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_immutability();

-- ==============================================================================
-- PERFORMANCE, COMPOUND & PARTIAL INDEX STRATEGY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch_id, role_id);
CREATE INDEX IF NOT EXISTS idx_users_active_lookup ON users(username) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_prod ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(warehouse_id, product_id) WHERE quantity_available <= 10;
CREATE INDEX IF NOT EXISTS idx_movements_branch_prod ON inventory_movements(branch_id, product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(branch_id, status) WHERE status NOT IN ('COMPLETED', 'CANCELLED');
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_status ON deliveries(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_active ON deliveries(driver_id, status) WHERE status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT');
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_date ON audit_logs(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_gin_new ON audit_logs USING GIN (new_value);
CREATE INDEX IF NOT EXISTS idx_held_sales_gin_cart ON held_sales USING GIN (cart_data_json);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address, created_at);
