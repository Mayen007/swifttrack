UPDATE branches
SET is_hub = TRUE,
    hub_type = 'REGIONAL_HUB',
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'NRB-HQ';
