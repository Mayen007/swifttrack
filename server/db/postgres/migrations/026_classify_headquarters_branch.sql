-- Headquarters is an administrative location, not an operational parcel hub.
UPDATE branches
SET is_hub = FALSE,
    hub_type = 'HEADQUARTERS',
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'NRB-HQ';
