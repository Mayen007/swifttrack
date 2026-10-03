-- server/db/postgres/migrations/025_seed_default_tariffs.sql
-- SwiftTrack Logistics: Seed baseline logistics pricing tariffs

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
