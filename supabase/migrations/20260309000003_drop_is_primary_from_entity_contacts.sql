-- Drop is_primary column from entity_contacts
-- This field was not used for any business logic — purely visual, not worth maintaining.

ALTER TABLE entity_contacts DROP COLUMN is_primary;
