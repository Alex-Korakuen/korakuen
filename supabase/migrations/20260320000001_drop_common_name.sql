-- Migration: Drop common_name column from entities
-- All display names now use legal_name only.

-- 1. Drop dependent views
DROP VIEW IF EXISTS v_invoices_with_loans;
DROP VIEW IF EXISTS v_obligation_calendar;
DROP VIEW IF EXISTS v_payments_enriched;

-- 2. Drop the column
ALTER TABLE entities DROP COLUMN common_name;

-- 3. Recreate views with e.legal_name instead of COALESCE(e.common_name, e.legal_name)

-- v_invoices_with_loans
CREATE OR REPLACE VIEW v_invoices_with_loans
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable, all statuses)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id         AS id,
  NULL::UUID            AS loan_id,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  e.legal_name          AS entity_name,
  ib.cost_type,
  ib.title,
  ib.invoice_number,
  ib.comprobante_type,
  ib.document_ref,
  ib.invoice_date,
  ib.due_date,
  ib.currency,
  ib.exchange_rate,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.retencion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status,
  CASE
    WHEN ib.due_date IS NOT NULL THEN (CURRENT_DATE - ib.due_date)
    ELSE 0
  END AS days_overdue,
  CASE
    WHEN ib.due_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ib.due_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ib.due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id

UNION ALL

-- Part 2: Loan repayment schedule entries (always payable direction, all statuses)
SELECT
  'loan'::VARCHAR       AS type,
  ls.id                 AS id,
  ls.loan_id,
  'payable'::VARCHAR    AS direction,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                AS project_name,
  l.entity_id,
  l.lender_name         AS entity_name,
  NULL::VARCHAR         AS cost_type,
  l.purpose             AS title,
  NULL::VARCHAR         AS invoice_number,
  NULL::VARCHAR         AS comprobante_type,
  NULL::VARCHAR         AS document_ref,
  l.date_borrowed       AS invoice_date,
  ls.scheduled_date     AS due_date,
  l.currency,
  l.exchange_rate,
  NULL::NUMERIC(15,2)   AS subtotal,
  NULL::NUMERIC(15,2)   AS igv_amount,
  ls.scheduled_amount   AS total,
  NULL::NUMERIC(15,2)   AS detraccion_amount,
  NULL::NUMERIC(15,2)   AS retencion_amount,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END AS payment_status,
  CASE
    WHEN ls.scheduled_date IS NOT NULL THEN (CURRENT_DATE - ls.scheduled_date)
    ELSE 0
  END AS days_overdue,
  CASE
    WHEN ls.scheduled_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id

ORDER BY due_date DESC NULLS LAST;


-- v_obligation_calendar
CREATE OR REPLACE VIEW v_obligation_calendar
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id,
  NULL::UUID             AS loan_id,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  e.legal_name          AS entity_name,
  ib.cost_type,
  ib.invoice_date       AS date,
  ib.title,
  ib.invoice_number,
  ib.currency,
  ib.exchange_rate,
  ib.document_ref,
  ib.due_date,
  (ib.due_date - CURRENT_DATE) AS days_remaining,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.payable_or_receivable AS payable,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id
WHERE ib.due_date IS NOT NULL
  AND ib.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule (always payable direction)
SELECT
  'loan'::VARCHAR        AS type,
  NULL::UUID             AS invoice_id,
  ls.loan_id,
  'payable'::VARCHAR     AS direction,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  l.entity_id,
  l.lender_name          AS entity_name,
  NULL::VARCHAR          AS cost_type,
  l.date_borrowed        AS date,
  l.purpose              AS title,
  NULL::VARCHAR          AS invoice_number,
  l.currency,
  l.exchange_rate,
  NULL::VARCHAR          AS document_ref,
  ls.scheduled_date      AS due_date,
  (ls.scheduled_date - CURRENT_DATE) AS days_remaining,
  NULL::NUMERIC(15,2)    AS subtotal,
  NULL::NUMERIC(15,2)    AS igv_amount,
  ls.scheduled_amount    AS total,
  NULL::NUMERIC(15,2)    AS detraccion_amount,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS payable,
  0::NUMERIC(15,2)       AS bdn_outstanding,
  0::NUMERIC(15,2)       AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;


-- v_payments_enriched
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
  p.partner_company_id,
  p.bank_account_id,
  p.notes,
  -- Enriched from invoice
  i.invoice_number,
  i.project_id,
  pr.project_code,
  e.legal_name          AS entity_name,
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
  p.partner_company_id,
  p.bank_account_id,
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

ORDER BY payment_date DESC;
