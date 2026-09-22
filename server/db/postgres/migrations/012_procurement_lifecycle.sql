-- server/db/postgres/migrations/012_procurement_lifecycle.sql
-- SwiftTrack Kenya: Phase 8 Suppliers & Procurement Lifecycle Schema Migration

-- 1. Extend suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_pin VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vat_registered INTEGER NOT NULL DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS withholding_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS mpesa_paybill VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS mpesa_account_no VARCHAR(50);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 5.0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Extend stock_receipts and stock_receipt_items
ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER;
ALTER TABLE stock_receipt_items ADD COLUMN IF NOT EXISTS purchase_order_item_id INTEGER;

-- 3. Supplier contacts
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(50) NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);

-- 4. Supplier products catalog
CREATE TABLE IF NOT EXISTS supplier_products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    supplier_sku VARCHAR(100),
    agreed_cost NUMERIC(15,2) NOT NULL,
    min_order_quantity INTEGER NOT NULL DEFAULT 1,
    lead_time_days INTEGER DEFAULT 3,
    is_preferred INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_supplier_products_supplier_prod UNIQUE (supplier_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);

-- 5. Purchase Requisitions (PR)
CREATE TABLE IF NOT EXISTS purchase_requisitions (
    id SERIAL PRIMARY KEY,
    pr_number VARCHAR(60) NOT NULL UNIQUE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    urgency VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
    needed_by_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    notes TEXT,
    total_estimated_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_branch ON purchase_requisitions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    requested_quantity INTEGER NOT NULL,
    estimated_unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pr_items_req ON purchase_requisition_items(requisition_id);

-- 6. Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(60) NOT NULL UNIQUE,
    purchase_requisition_id INTEGER REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    payment_terms VARCHAR(30) NOT NULL DEFAULT 'NET30',
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    expected_delivery_date DATE,
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    ordered_quantity INTEGER NOT NULL,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 16.0,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

-- 7. Supplier Invoices (Bills)
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(60) NOT NULL UNIQUE,
    supplier_invoice_no VARCHAR(100) NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    stock_receipt_id INTEGER REFERENCES stock_receipts(id) ON DELETE SET NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);

-- 8. Supplier Payments (Disbursements)
CREATE TABLE IF NOT EXISTS supplier_payments (
    id SERIAL PRIMARY KEY,
    payment_number VARCHAR(60) NOT NULL UNIQUE,
    supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id) ON DELETE RESTRICT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    amount NUMERIC(15,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK',
    reference_number VARCHAR(150) NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    processed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice ON supplier_payments(supplier_invoice_id);

-- 9. Supplier Returns (Debit Notes)
CREATE TABLE IF NOT EXISTS supplier_returns (
    id SERIAL PRIMARY KEY,
    return_number VARCHAR(60) NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    stock_receipt_id INTEGER REFERENCES stock_receipts(id) ON DELETE SET NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    reason VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
    id SERIAL PRIMARY KEY,
    supplier_return_id INTEGER NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0.0,
    from_inventory_state VARCHAR(30) NOT NULL DEFAULT 'DAMAGED',
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_returns_supplier ON supplier_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_return_items_ret ON supplier_return_items(supplier_return_id);

-- 10. Immutable Procurement Audit Trail
CREATE TABLE IF NOT EXISTS procurement_audit_trail (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_number VARCHAR(60) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proc_audit_entity ON procurement_audit_trail(entity_type, entity_id);
