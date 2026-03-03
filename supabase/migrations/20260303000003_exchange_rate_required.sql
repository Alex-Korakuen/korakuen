-- Migration: Make exchange_rate NOT NULL on all financial transaction tables
-- Purpose: Ensures currency conversion always works (Cash Flow toggle, future P&L pages)
-- Default: 3.70 PEN per USD (backfill for existing records without a rate)

-- ============================================================
-- 1. Backfill existing NULLs with default rate
-- ============================================================

UPDATE costs SET exchange_rate = 3.70 WHERE exchange_rate IS NULL;
UPDATE ar_invoices SET exchange_rate = 3.70 WHERE exchange_rate IS NULL;
UPDATE payments SET exchange_rate = 3.70 WHERE exchange_rate IS NULL;
UPDATE quotes SET exchange_rate = 3.70 WHERE exchange_rate IS NULL;

-- ============================================================
-- 2. Make exchange_rate NOT NULL with default on existing tables
-- ============================================================

ALTER TABLE costs
  ALTER COLUMN exchange_rate SET NOT NULL,
  ALTER COLUMN exchange_rate SET DEFAULT 3.70;

ALTER TABLE ar_invoices
  ALTER COLUMN exchange_rate SET NOT NULL,
  ALTER COLUMN exchange_rate SET DEFAULT 3.70;

ALTER TABLE payments
  ALTER COLUMN exchange_rate SET NOT NULL,
  ALTER COLUMN exchange_rate SET DEFAULT 3.70;

ALTER TABLE quotes
  ALTER COLUMN exchange_rate SET NOT NULL,
  ALTER COLUMN exchange_rate SET DEFAULT 3.70;

-- ============================================================
-- 3. Add exchange_rate to loan tables (previously missing)
-- ============================================================

ALTER TABLE loans
  ADD COLUMN exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 3.70;

ALTER TABLE loan_schedule
  ADD COLUMN exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 3.70;

ALTER TABLE loan_payments
  ADD COLUMN exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 3.70;
