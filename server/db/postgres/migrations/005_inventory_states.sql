-- Migration 005: Inventory Engine - 3.1 Inventory States
-- Adds ON_HAND, AVAILABLE, RESERVED, IN_TRANSIT, DAMAGED, EXPIRED tracking

-- 1. Enhance inventory table with state columns
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_in_transit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_damaged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_expired INTEGER NOT NULL DEFAULT 0;

-- 2. Enhance variant_inventory table with state columns
ALTER TABLE variant_inventory ADD COLUMN IF NOT EXISTS quantity_in_transit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE variant_inventory ADD COLUMN IF NOT EXISTS quantity_damaged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE variant_inventory ADD COLUMN IF NOT EXISTS quantity_expired INTEGER NOT NULL DEFAULT 0;

-- 3. Enhance inventory_movements ledger with state transition metadata
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS from_state VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS to_state VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE';

-- 4. Create performance indexes for multi-state queries
CREATE INDEX IF NOT EXISTS idx_inventory_damaged ON inventory(branch_id, quantity_damaged) WHERE quantity_damaged > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_expired ON inventory(branch_id, quantity_expired) WHERE quantity_expired > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_in_transit ON inventory(branch_id, quantity_in_transit) WHERE quantity_in_transit > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_reserved ON inventory(branch_id, quantity_reserved) WHERE quantity_reserved > 0;
CREATE INDEX IF NOT EXISTS idx_movements_state_trans ON inventory_movements(product_id, from_state, to_state, created_at);
