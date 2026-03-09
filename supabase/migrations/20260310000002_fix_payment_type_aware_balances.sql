-- Migration: Fix balance views to use payment_type-aware aggregation
-- Problem: receivable/bdn_outstanding/payable used naive formulas that didn't track
--          which payments were detraccion vs regular. After paying detraccion in full,
--          remaining outstanding was incorrectly attributed to BdN instead of receivable.
-- Fix: Use SUM(...) FILTER (WHERE payment_type = 'detraccion') for accurate splits.

-- Drop dependent views first, then source views
DROP VIEW IF EXISTS v_ap_calendar CASCADE;
DROP VIEW IF EXISTS v_cost_balances CASCADE;

-- Recreate v_cost_balances with detraccion_paid column
CREATE OR REPLACE VIEW v_cost_balances
WITH (security_invoker = on)
AS
SELECT
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.partner_company_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.exchange_rate,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ct.total - COALESCE(SUM(p.amount), 0) AS outstanding,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ct.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM v_cost_totals ct
LEFT JOIN payments p
  ON p.related_id = ct.cost_id
  AND p.related_to = 'cost'
GROUP BY
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.partner_company_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.exchange_rate,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount;

-- Recreate v_ap_calendar using detraccion_paid for accurate payable/bdn splits
CREATE OR REPLACE VIEW v_ap_calendar
WITH (security_invoker = on)
AS

-- Part 1: Supplier invoices (existing cost-based obligations)
SELECT
  'supplier_invoice'::VARCHAR AS type,
  cb.cost_id,
  NULL::UUID             AS loan_id,
  cb.partner_company_id,
  cb.project_id,
  p.project_code,
  p.name              AS project_name,
  cb.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  cb.cost_type,
  cb.date,
  cb.title,
  cb.currency,
  cb.exchange_rate,
  cb.document_ref,
  cb.due_date,
  (cb.due_date - CURRENT_DATE) AS days_remaining,
  cb.subtotal,
  cb.igv_amount,
  cb.total,
  cb.detraccion_amount,
  cb.amount_paid,
  cb.outstanding,
  GREATEST(0, cb.outstanding - GREATEST(0, COALESCE(cb.detraccion_amount, 0) - cb.detraccion_paid)) AS payable,
  GREATEST(0, COALESCE(cb.detraccion_amount, 0) - cb.detraccion_paid) AS bdn_outstanding,
  cb.payment_status
FROM v_cost_balances cb
LEFT JOIN projects p ON p.id = cb.project_id
LEFT JOIN entities e ON e.id = cb.entity_id
WHERE cb.due_date IS NOT NULL
  AND cb.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule
SELECT
  'loan_payment'::VARCHAR AS type,
  NULL::UUID             AS cost_id,
  ls.loan_id,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  NULL::UUID             AS entity_id,
  l.lender_name          AS entity_name,
  NULL::VARCHAR          AS cost_type,
  l.date_borrowed        AS date,
  l.purpose              AS title,
  l.currency,
  l.exchange_rate,
  NULL::VARCHAR          AS document_ref,
  ls.scheduled_date      AS due_date,
  (ls.scheduled_date - CURRENT_DATE) AS days_remaining,
  NULL::NUMERIC(15,2)    AS subtotal,
  NULL::NUMERIC(15,2)    AS igv_amount,
  ls.scheduled_amount    AS total,
  NULL::NUMERIC(15,2)    AS detraccion_amount,
  COALESCE(lp.amount, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(lp.amount, 0) AS outstanding,
  ls.scheduled_amount - COALESCE(lp.amount, 0) AS payable,
  0::NUMERIC(15,2) AS bdn_outstanding,
  CASE
    WHEN lp.amount IS NOT NULL AND lp.amount < ls.scheduled_amount THEN 'partial'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN loan_payments lp ON lp.id = ls.actual_payment_id
LEFT JOIN projects p ON p.id = l.project_id
WHERE NOT ls.paid

ORDER BY due_date ASC;

-- Drop and recreate v_ar_balances with payment_type-aware columns
DROP VIEW IF EXISTS v_ar_balances CASCADE;

CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.entity_id,
    ar.partner_company_id,
    ar.invoice_number,
    ar.comprobante_type,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.detraccion_rate,
    ar.retencion_applicable,
    ar.retencion_rate,
    ar.retencion_verified,
    ar.currency,
    ar.exchange_rate,
    ar.document_ref,
    ar.notes,
    fn_igv_amount(ar.subtotal, ar.igv_rate) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    fn_detraccion_amount(ab.subtotal, ab.igv_amount, ab.detraccion_rate) AS detraccion_amount,
    fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate) AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount,
  ac.gross_total - ac.detraccion_amount - ac.retencion_amount AS net_receivable,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ac.gross_total - COALESCE(SUM(p.amount), 0) AS outstanding,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- receivable: outstanding minus remaining detraccion and retencion portions
  GREATEST(0,
    ac.gross_total - COALESCE(SUM(p.amount), 0)
    - GREATEST(0, ac.detraccion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0))
    - GREATEST(0, ac.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS receivable,
  -- bdn_outstanding: detraccion amount minus what's been paid as detraccion
  GREATEST(0, ac.detraccion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0)) AS bdn_outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ac.gross_total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM ar_computed ac
LEFT JOIN payments p
  ON p.related_id = ac.ar_invoice_id
  AND p.related_to = 'ar_invoice'
GROUP BY
  ac.ar_invoice_id,
  ac.project_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount;
