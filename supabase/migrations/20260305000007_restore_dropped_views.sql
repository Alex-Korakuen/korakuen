-- ============================================================
-- Korakuen Management System — Restore Dropped Views
-- Migration: 20260305000007
-- Date: 2026-03-05
-- ============================================================
-- Migration 20260305000002 (drop_valuations) used DROP VIEW v_cost_totals CASCADE
-- which cascaded to v_cost_balances, v_ap_calendar, v_entity_transactions, v_igv_position.
-- Only v_cost_totals and v_ar_balances were recreated. This migration restores the 4 missing views.

-- 1. v_cost_balances (depends on v_cost_totals)
CREATE OR REPLACE VIEW v_cost_balances
WITH (security_invoker = on)
AS
SELECT
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.bank_account_id,
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
  ct.bank_account_id,
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

-- 2. v_ap_calendar (depends on v_cost_balances)
CREATE OR REPLACE VIEW v_ap_calendar
WITH (security_invoker = on)
AS

-- Part 1: Supplier invoices
SELECT
  'supplier_invoice'::VARCHAR AS type,
  cb.cost_id,
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
  cb.payment_status
FROM v_cost_balances cb
LEFT JOIN projects p ON p.id = cb.project_id
LEFT JOIN entities e ON e.id = cb.entity_id
WHERE cb.due_date IS NOT NULL
  AND cb.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule (private — Alex only)
SELECT
  'loan_payment'::VARCHAR AS type,
  NULL::UUID             AS cost_id,
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

-- 3. v_igv_position (depends on v_cost_totals)
CREATE OR REPLACE VIEW v_igv_position
WITH (security_invoker = on)
AS
WITH igv_collected AS (
  SELECT
    ar.currency,
    COALESCE(SUM(ROUND(ar.subtotal * (ar.igv_rate / 100), 2)), 0) AS igv_collected
  FROM ar_invoices ar
  GROUP BY ar.currency
),
igv_paid AS (
  SELECT
    ct.currency,
    COALESCE(SUM(ct.igv_amount), 0) AS igv_paid
  FROM v_cost_totals ct
  WHERE ct.igv_amount > 0
  GROUP BY ct.currency
),
all_currencies AS (
  SELECT currency FROM igv_collected
  UNION
  SELECT currency FROM igv_paid
)
SELECT
  ac.currency,
  COALESCE(ic.igv_collected, 0) AS igv_collected,
  COALESCE(ip.igv_paid, 0) AS igv_paid,
  COALESCE(ip.igv_paid, 0) - COALESCE(ic.igv_collected, 0) AS net_igv_position
FROM all_currencies ac
LEFT JOIN igv_collected ic ON ic.currency = ac.currency
LEFT JOIN igv_paid ip ON ip.currency = ac.currency
ORDER BY ac.currency;

-- 4. v_entity_transactions (depends on v_cost_totals)
CREATE OR REPLACE VIEW v_entity_transactions
WITH (security_invoker = on)
AS

-- Costs
SELECT
  ct.entity_id,
  e.legal_name          AS entity_name,
  ct.project_id,
  p.project_code,
  p.name                AS project_name,
  'cost'                AS transaction_type,
  ct.date,
  ct.title,
  NULL                  AS invoice_number,
  ct.currency,
  ct.subtotal           AS amount,
  ct.total              AS total_with_igv,
  ct.document_ref,
  ct.cost_id            AS transaction_id
FROM v_cost_totals ct
JOIN entities e ON e.id = ct.entity_id
LEFT JOIN projects p ON p.id = ct.project_id
WHERE ct.entity_id IS NOT NULL

UNION ALL

-- AR Invoices
SELECT
  ar.entity_id,
  e.legal_name          AS entity_name,
  ar.project_id,
  p.project_code,
  p.name                AS project_name,
  'ar_invoice'          AS transaction_type,
  ar.invoice_date       AS date,
  COALESCE(ar.notes, 'Invoice ' || ar.invoice_number) AS title,
  ar.invoice_number,
  ar.currency,
  ar.subtotal           AS amount,
  ROUND(ar.subtotal + ar.subtotal * (ar.igv_rate / 100), 2) AS total_with_igv,
  ar.document_ref,
  ar.id                 AS transaction_id
FROM ar_invoices ar
JOIN entities e ON e.id = ar.entity_id
LEFT JOIN projects p ON p.id = ar.project_id

ORDER BY date DESC;

-- RLS policies for authenticated read access
ALTER VIEW v_cost_balances SET (security_invoker = on);
ALTER VIEW v_ap_calendar SET (security_invoker = on);
ALTER VIEW v_igv_position SET (security_invoker = on);
ALTER VIEW v_entity_transactions SET (security_invoker = on);
