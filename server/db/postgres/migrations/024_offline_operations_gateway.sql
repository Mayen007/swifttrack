-- server/db/postgres/migrations/024_offline_operations_gateway.sql
-- SwiftTrack Logistics: Generalized Durable Offline Operations Gateway (PRD Section 21)

CREATE TABLE IF NOT EXISTS offline_sync_logs (
    id SERIAL PRIMARY KEY,
    client_operation_id VARCHAR(255) NOT NULL UNIQUE,
    operation_type VARCHAR(100) NOT NULL,
    device_id VARCHAR(255),
    app_version VARCHAR(50),
    user_id INTEGER REFERENCES users(id),
    client_timestamp TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    result_payload TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_client_op ON offline_sync_logs(client_operation_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_device ON offline_sync_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_logs(status);
