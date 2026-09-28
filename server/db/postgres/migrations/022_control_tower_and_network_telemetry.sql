-- server/db/postgres/migrations/022_control_tower_and_network_telemetry.sql
-- Stage 8: Operations Control Tower & Network Telemetry
-- PRD Section 20: Control Tower Live Telemetry & Exception Dashboard

-- 1. Seed Control Tower Permissions
INSERT INTO permissions (code, module, description)
VALUES 
    ('control_tower:view', 'ControlTower', 'View operational control tower telemetry, corridor movement, and alert queues'),
    ('control_tower:resolve', 'ControlTower', 'Acknowledge, assign, and fast-resolve operational bottleneck alerts')
ON CONFLICT (code) DO NOTHING;

-- 2. Assign permissions:
-- SUPER_ADMIN (1): view, resolve
-- BRANCH_MANAGER (2): view, resolve
-- DISPATCHER (3): view, resolve
-- CASHIER (4): view
-- DRIVER (5): view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('control_tower:view', 'control_tower:resolve')
  AND (
      (r.id IN (1, 2, 3)) OR
      (r.id IN (4, 5) AND p.code = 'control_tower:view')
  )
ON CONFLICT DO NOTHING;
