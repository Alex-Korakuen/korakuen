-- ============================================================
-- Migration: Add document_ref to payments table
-- Date: 2026-03-23
-- Purpose: Store SharePoint file reference for payment receipts
--          (e.g. PRY001-PY-001) — same pattern as invoices.document_ref
-- ============================================================

-- 1. Add column
ALTER TABLE payments
  ADD COLUMN document_ref VARCHAR(100); -- e.g. PRY001-PY-001 — links to payment receipt in SharePoint

-- 2. Recreate v_payments_enriched to expose the new column
DROP VIEW IF EXISTS v_payments_enriched;

CREATE VIEW v_payments_enriched
WITH (security_invoker = on)
AS

-- Part 1: Payments related to invoices
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.notes,
  -- Enriched from invoice
  i.invoice_number,
  i.project_id,
  pr.project_code,
  e.legal_name              AS entity_name,
  -- Enriched from bank account
  ba.bank_name
FROM payments p
JOIN invoices i ON i.id = p.related_id AND i.is_active = true
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'invoice'
  AND p.is_active = true

UNION ALL

-- Part 2: Payments related to loan schedule entries
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'loan_schedule'
  AND p.is_active = true

UNION ALL

-- Part 3: Loan disbursement payments (inflow when loan is received)
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name
FROM payments p
JOIN loans l ON l.id = p.related_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'loan'
  AND p.is_active = true

ORDER BY payment_date DESC;
