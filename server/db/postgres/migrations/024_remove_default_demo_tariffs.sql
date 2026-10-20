-- Remove only the exact global tariff values inserted as sample defaults in migration 023.
DELETE FROM logistics_pricing_tariffs
WHERE origin_hub_id IS NULL
  AND destination_hub_id IS NULL
  AND currency = 'KES'
  AND is_active = true
  AND (
      (service_type = 'STANDARD'
       AND base_weight_kg = 5.0
       AND base_price = 350.0
       AND per_kg_above_base = 50.0
       AND cod_fee_percent = 2.0
       AND min_cod_fee = 100.0
       AND insurance_rate_percent = 1.0)
      OR
      (service_type = 'EXPRESS'
       AND base_weight_kg = 5.0
       AND base_price = 600.0
       AND per_kg_above_base = 80.0
       AND cod_fee_percent = 2.0
       AND min_cod_fee = 100.0
       AND insurance_rate_percent = 1.0)
      OR
      (service_type = 'SAME_DAY'
       AND base_weight_kg = 5.0
       AND base_price = 850.0
       AND per_kg_above_base = 120.0
       AND cod_fee_percent = 2.0
       AND min_cod_fee = 100.0
       AND insurance_rate_percent = 1.0)
  );
