-- server/db/postgres/migrations/021_cod_settlements_and_reconciliation.sql
-- Stage 7 / Phase 7: Cash on Delivery (COD) Settlement & Financial Reconciliation

-- 1. Create COD Settlements Table
CREATE TABLE IF NOT EXISTS cod_settlements (
    id SERIAL PRIMARY KEY,
    settlement_number VARCHAR(50) UNIQUE NOT NULL,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    hub_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    collector_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    collected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remitted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    variance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_COLLECTION', -- PENDING_COLLECTION, COLLECTED, REMITTED, RECONCILED, DISCREPANT, CANCELLED
    collection_method VARCHAR(30), -- CASH, MPESA, BANK
    collection_reference VARCHAR(100),
    collected_at TIMESTAMP WITH TIME ZONE,
    remittance_method VARCHAR(30), -- BANK_DEPOSIT, MPESA_PAYBILL, CASH_DROP
    remittance_reference VARCHAR(100),
    remitted_at TIMESTAMP WITH TIME ZONE,
    reconciled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciliation_notes TEXT,
    variance_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for Performance & Branch Scoping
CREATE INDEX IF NOT EXISTS idx_cod_settlements_shipment_id ON cod_settlements(shipment_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_delivery_id ON cod_settlements(delivery_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_hub_id ON cod_settlements(hub_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_collector_id ON cod_settlements(collector_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_status ON cod_settlements(status);

-- 3. Seed COD Permissions
INSERT INTO permissions (code, module, description)
VALUES 
    ('cod:view', 'COD', 'View COD settlements and reconciliation records'),
    ('cod:collect', 'COD', 'Record COD collection from recipient'),
    ('cod:remit', 'COD', 'Remit collected COD funds to finance/depot'),
    ('cod:reconcile', 'COD', 'Reconcile and sign off COD settlements and variances')
ON CONFLICT (code) DO NOTHING;

-- Assign permissions:
-- SUPER_ADMIN (1): All permissions
-- BRANCH_MANAGER (2): All permissions
-- CASHIER (4): view, collect, remit
-- DRIVER (5): view, collect, remit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('cod:view', 'cod:collect', 'cod:remit', 'cod:reconcile')
  AND (
      (r.id IN (1, 2)) OR
      (r.id IN (4, 5) AND p.code IN ('cod:view', 'cod:collect', 'cod:remit'))
  )
ON CONFLICT DO NOTHING;
