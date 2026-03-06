-- ============================================================
-- Korakuen Management System — Add label to bank_accounts
-- Migration: 20260305000005
-- Date: 2026-03-05
--
-- Adds a unique label column to bank_accounts for simplified
-- lookups in Excel import templates. Replaces the composite
-- bank_name + account_number_last4 key with a single field.
-- ============================================================

-- Add column as nullable first so we can backfill
ALTER TABLE bank_accounts ADD COLUMN label VARCHAR;

-- Backfill existing rows with bank_name-last4
UPDATE bank_accounts
SET label = bank_name || '-' || account_number_last4;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE bank_accounts ALTER COLUMN label SET NOT NULL;
ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_label_unique UNIQUE (label);

-- ============================================================
-- End of migration 20260305000005
-- Rollback: ALTER TABLE bank_accounts DROP COLUMN label;
-- ============================================================
