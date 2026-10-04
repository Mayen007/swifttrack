-- server/db/postgres/migrations/023_logistics_notifications_engine.sql
-- Stage 9: Automated Milestone Notifications & Communications Dispatch Engine (SMS / WhatsApp / Email)
-- PRD Section 7.13 & Section 14 (NTF-001..004): Outbox Pattern, Multi-Channel Templates, Exponential Backoff

-- 0. Enhance deliveries table with secure POD OTP column
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pod_otp VARCHAR(20);

-- 1. Create Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    channels JSONB NOT NULL DEFAULT '["SMS", "WHATSAPP", "EMAIL"]'::jsonb,
    event_type VARCHAR(50) NOT NULL,
    sms_template TEXT NOT NULL,
    whatsapp_template TEXT NOT NULL,
    email_subject VARCHAR(200),
    email_template TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_code ON notification_templates(code);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event ON notification_templates(event_type);

-- 2. Create Transactional Notification Outbox Table (Non-blocking Outbox Pattern - Rule NTF-002)
CREATE TABLE IF NOT EXISTS notification_outbox (
    id SERIAL PRIMARY KEY,
    outbox_uuid VARCHAR(50) UNIQUE NOT NULL,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    delivery_id INTEGER REFERENCES deliveries(id) ON DELETE SET NULL,
    recipient_type VARCHAR(30) NOT NULL DEFAULT 'RECIPIENT', -- SENDER, RECIPIENT, DRIVER, OPS
    recipient_name VARCHAR(100),
    recipient_phone VARCHAR(50),
    recipient_email VARCHAR(100),
    channel VARCHAR(20) NOT NULL, -- SMS, WHATSAPP, EMAIL
    event_type VARCHAR(50) NOT NULL,
    template_code VARCHAR(50),
    subject VARCHAR(200),
    rendered_content TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, SENDING, SENT, FAILED, CANCELLED
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_retry ON notification_outbox(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_shipment ON notification_outbox(shipment_id);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_channel ON notification_outbox(channel);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_created ON notification_outbox(created_at);

-- 3. Create Notification Delivery Logs Table (Audit History - Rule NTF-004)
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    outbox_id INTEGER NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'SIMULATED_GATEWAY',
    provider_message_id VARCHAR(100),
    recipient_contact VARCHAR(100) NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL, -- SUCCESS, FAILED, BOUNCED
    response_payload JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_outbox ON notification_logs(outbox_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_shipment ON notification_logs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at);

-- 4. Seed Standard Logistics Notification Templates
INSERT INTO notification_templates (code, name, event_type, sms_template, whatsapp_template, email_subject, email_template)
VALUES
    (
        'BOOKED_CONFIRMATION',
        'Consignment Booking Confirmation',
        'BOOKED',
        'Habari {{recipient_name}}, package {{tracking_number}} has been booked from {{origin_city}} to {{dest_city}}. Live tracking: {{tracking_url}} - SwiftTrack',
        'Habari *{{recipient_name}}*, your consignment *{{tracking_number}}* is confirmed from {{origin_city}} to {{dest_city}}.\n\nTrack your package anytime: {{tracking_url}}\n\n_SwiftTrack Kenya Logistics_',
        'Consignment Booking Confirmation: {{tracking_number}}',
        '<h3>SwiftTrack Logistics</h3><p>Dear {{recipient_name}},</p><p>Your shipment <strong>{{tracking_number}}</strong> has been accepted for transit from <strong>{{origin_city}}</strong> to <strong>{{dest_city}}</strong>.</p><p><a href="{{tracking_url}}">Click here to track your shipment in real time</a>.</p>'
    ),
    (
        'ACCEPTED_AT_HUB',
        'Intake at Origin Station Hub',
        'ACCEPTED',
        'Update: Shipment {{tracking_number}} arrived and received at {{origin_hub_name}} hub. Track: {{tracking_url}}',
        'Update: Consignment *{{tracking_number}}* has been received and sorted at *{{origin_hub_name}}* hub.\n\nTrack: {{tracking_url}}',
        'Shipment Received at Origin Hub: {{tracking_number}}',
        '<h3>Hub Intake Complete</h3><p>Shipment <strong>{{tracking_number}}</strong> has been physically verified and staged at {{origin_hub_name}}.</p>'
    ),
    (
        'DISPATCHED_IN_TRANSIT',
        'Linehaul Transport Departure',
        'DISPATCHED',
        'SwiftTrack: Shipment {{tracking_number}} has departed {{origin_city}} on route to {{dest_city}}. Est delivery: {{eta}}',
        'SwiftTrack Fleet: Shipment *{{tracking_number}}* has departed {{origin_city}} in transit to {{dest_city}}.\n\nEst. Arrival: {{eta}}\nTrack: {{tracking_url}}',
        'Shipment Dispatched on Linehaul Run: {{tracking_number}}',
        '<h3>Your Package Is on the Move</h3><p>Shipment <strong>{{tracking_number}}</strong> has departed {{origin_city}} on active transport run.</p>'
    ),
    (
        'OUT_FOR_DELIVERY',
        'Courier Last-Mile Out for Delivery',
        'OUT_FOR_DELIVERY',
        'Habari {{recipient_name}}, shipment {{tracking_number}} is OUT FOR DELIVERY with courier {{driver_name}}. Required Delivery PIN: {{otp_code}}. Track: {{tracking_url}}',
        'Habari *{{recipient_name}}*! Your package *{{tracking_number}}* is out for delivery with our courier *{{driver_name}}* (Phone: {{driver_phone}}).\n\n*YOUR SECURE DELIVERY PIN: {{otp_code}}*\nPlease provide this PIN to the courier to complete delivery.\n\nTrack: {{tracking_url}}',
        'Out for Delivery: {{tracking_number}} (Delivery PIN Enclosed)',
        '<h3>Out for Delivery Today</h3><p>Dear {{recipient_name}}, your shipment <strong>{{tracking_number}}</strong> is out for delivery with courier <strong>{{driver_name}}</strong>.</p><div style="padding:15px; background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; font-size:18px;"><strong>Delivery OTP PIN: {{otp_code}}</strong></div><p>Please share this PIN with the courier to complete verification.</p>'
    ),
    (
        'DELIVERED_POD',
        'Successful Delivery Confirmation',
        'DELIVERED',
        'Delivered! Shipment {{tracking_number}} was successfully delivered and signed for. Thank you for choosing SwiftTrack Kenya!',
        '✅ *Delivered!* Your shipment *{{tracking_number}}* was successfully delivered to {{recipient_name}} and legally verified with Proof of Delivery.\n\nThank you for choosing SwiftTrack Kenya Logistics!',
        'Delivered Successfully: {{tracking_number}}',
        '<h3>Delivery Completed</h3><p>Shipment <strong>{{tracking_number}}</strong> has been successfully delivered and acknowledged with legal Proof of Delivery.</p>'
    ),
    (
        'DELIVERY_FAILED',
        'Delivery Attempt Exception',
        'DELIVERY_FAILED',
        'Notice: Delivery for {{tracking_number}} could not be completed: {{reason}}. Rescheduling for next dispatch. Details: {{tracking_url}}',
        '⚠️ *Delivery Exception*: Delivery attempt for *{{tracking_number}}* could not be completed due to: {{reason}}.\n\nOur dispatch team is rescheduling delivery. Track: {{tracking_url}}',
        'Delivery Attempt Notice: {{tracking_number}}',
        '<h3>Delivery Rescheduling Notice</h3><p>We attempted delivery of shipment <strong>{{tracking_number}}</strong>, but were unable to complete delivery due to: <strong>{{reason}}</strong>.</p><p>We are rescheduling delivery for the next dispatch window.</p>'
    ),
    (
        'OPERATIONAL_EXCEPTION',
        'Discrepancy or Operational Delay Alert',
        'EXCEPTION',
        'SwiftTrack Alert: An operational update was logged for shipment {{tracking_number}} ({{reason}}). Investigating with priority.',
        '⚠️ *SwiftTrack Operational Alert*: Update logged for shipment *{{tracking_number}}*:\n_{{reason}}_\n\nOur operations team is actively resolving this exception. Track: {{tracking_url}}',
        'Operational Update: {{tracking_number}}',
        '<h3>Operational Notice</h3><p>Shipment <strong>{{tracking_number}}</strong> encountered an operational event: <strong>{{reason}}</strong>. Our logistics team is investigating.</p>'
    )
ON CONFLICT (code) DO NOTHING;

-- 5. Seed Notification Permissions
INSERT INTO permissions (code, module, description)
VALUES 
    ('notifications:view', 'Notifications', 'View communications outbox queue, templates, delivery logs, and delivery rate KPIs'),
    ('notifications:manage', 'Notifications', 'Create and update message templates, test dispatch, and configure communication rails'),
    ('notifications:resend', 'Notifications', 'Trigger manual retry or force resend on communications outbox items')
ON CONFLICT (code) DO NOTHING;

-- 6. Role Permissions Assignment
-- SUPER_ADMIN (1): All permissions
-- BRANCH_MANAGER (2): view, resend
-- DISPATCHER (3): view, resend
-- CASHIER (4): view
-- DRIVER (5): view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code IN ('notifications:view', 'notifications:manage', 'notifications:resend')
  AND (
      (r.id = 1) OR
      (r.id IN (2, 3) AND p.code IN ('notifications:view', 'notifications:resend')) OR
      (r.id IN (4, 5) AND p.code = 'notifications:view')
  )
ON CONFLICT DO NOTHING;

-- 7. Durable Offline Operations Gateway (PRD Section 21)
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

-- 8. Seed Baseline Logistics Pricing Tariffs
INSERT INTO logistics_pricing_tariffs 
(origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
SELECT NULL, NULL, 'STANDARD', 5.0, 350.0, 50.0, 2.0, 100.0, 1.0, 'KES', true
WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'STANDARD');

INSERT INTO logistics_pricing_tariffs 
(origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
SELECT NULL, NULL, 'EXPRESS', 5.0, 600.0, 80.0, 2.0, 100.0, 1.0, 'KES', true
WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'EXPRESS');

INSERT INTO logistics_pricing_tariffs 
(origin_hub_id, destination_hub_id, service_type, base_weight_kg, base_price, per_kg_above_base, cod_fee_percent, min_cod_fee, insurance_rate_percent, currency, is_active)
SELECT NULL, NULL, 'SAME_DAY', 5.0, 850.0, 120.0, 2.0, 100.0, 1.0, 'KES', true
WHERE NOT EXISTS (SELECT 1 FROM logistics_pricing_tariffs WHERE origin_hub_id IS NULL AND destination_hub_id IS NULL AND service_type = 'SAME_DAY');

