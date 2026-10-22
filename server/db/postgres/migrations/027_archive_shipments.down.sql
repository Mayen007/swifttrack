DROP INDEX IF EXISTS idx_shipments_archived;

ALTER TABLE shipments
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS is_archived;
