-- Migration 003: Performance, Compound, Partial & GIN Indexes
-- Up migration: Adds indexes for high-throughput Kenyan logistics and POS operations

-- Compound indexes for multi-tenant / branch-scoped querying
CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch_id, role_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_prod ON inventory(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_branch_prod ON inventory_movements(branch_id, product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_status ON deliveries(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_date ON audit_logs(branch_id, created_at);

-- Partial indexes for high-frequency active operational filters
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(branch_id, status) WHERE status NOT IN ('COMPLETED', 'CANCELLED');
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_active ON deliveries(driver_id, status) WHERE status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT');
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(warehouse_id, product_id) WHERE quantity_available <= 10;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active) WHERE is_active = true;

-- Authentication & Token lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status, created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_ip ON login_history(ip_address, created_at);

-- GIN indexes for JSONB payloads (cart snapshots & audit logs)
CREATE INDEX IF NOT EXISTS idx_audit_logs_gin_new ON audit_logs USING GIN (new_value);
CREATE INDEX IF NOT EXISTS idx_held_sales_gin_cart ON held_sales USING GIN (cart_data_json);
