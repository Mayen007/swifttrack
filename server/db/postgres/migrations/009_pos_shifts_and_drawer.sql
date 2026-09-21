-- server/db/postgres/migrations/009_pos_shifts_and_drawer.sql
-- SwiftTrack Kenya: Phase 5 POS Shifts & Cash Drawer Control Schema Migration

-- 1. Create pos_shifts table
CREATE TABLE IF NOT EXISTS pos_shifts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    shift_number VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    opening_cash NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    closing_cash NUMERIC(15,2),
    expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cash_variance NUMERIC(15,2) DEFAULT 0.00,
    total_sales_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_sales_count INTEGER NOT NULL DEFAULT 0,
    total_cash_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_mpesa_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_card_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_bank_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_refunds_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    reconciliation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_cashier ON pos_shifts(cashier_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_shifts_branch ON pos_shifts(branch_id);

-- 2. Create cash_drawer_movements table
CREATE TABLE IF NOT EXISTS cash_drawer_movements (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    cashier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    reference_id VARCHAR(100),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_movements_shift ON cash_drawer_movements(shift_id);

-- 3. Add shift_id to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES pos_shifts(id) ON DELETE SET NULL;
