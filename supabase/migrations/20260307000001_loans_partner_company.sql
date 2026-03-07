-- ============================================================
-- Migration: 20260307000001
-- Date: 2026-03-07
-- Purpose: Add partner_company_id to loans table
-- Loans are no longer private to Alex — any partner can take loans.
-- The borrowing partner keeps the spread between the agreed 10% return
-- and whatever they actually pay the lender.
-- ============================================================

-- Add partner_company_id column (nullable first for existing data)
ALTER TABLE loans
ADD COLUMN partner_company_id UUID;

-- Existing loans were all Alex's — assign to Korakuen SAC (bank_tracking_full = true)
UPDATE loans
SET partner_company_id = (
  SELECT id FROM partner_companies
  WHERE bank_tracking_full = true
  LIMIT 1
)
WHERE partner_company_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE loans
ALTER COLUMN partner_company_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE loans
ADD CONSTRAINT fk_loans_partner_companies
  FOREIGN KEY (partner_company_id)
  REFERENCES partner_companies(id)
  ON DELETE RESTRICT;
