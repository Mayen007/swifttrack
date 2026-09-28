-- server/db/postgres/migrations/020_pos_counter_booking_and_waybills.sql
-- Stage 6: Reposition the POS (Counter Booking, Payments Linking & Waybills)

-- 1. Add shipment_id reference to payments and payment_intents
ALTER TABLE payments ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_shipment_id ON payments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_shipment_id ON payment_intents(shipment_id);

-- 2. Seed Stage 6 Permissions
INSERT INTO permissions (code, module, description)
VALUES 
    ('pos:counter:book', 'POS', 'Book and accept parcel shipments at counter'),
    ('pos:counter:quote', 'POS', 'Calculate counter parcel quotes'),
    ('shipments:waybill:view', 'Shipments', 'Generate and view shipment waybills')
ON CONFLICT (code) DO NOTHING;

-- Assign permissions to SUPER_ADMIN (1), BRANCH_MANAGER (2), CASHIER (4)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id IN (1, 2, 4)
  AND p.code IN ('pos:counter:book', 'pos:counter:quote', 'shipments:waybill:view')
ON CONFLICT DO NOTHING;
