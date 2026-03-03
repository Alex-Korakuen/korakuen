-- Migration: Add exchange_rate passthrough to v_cost_balances and v_ap_calendar
-- Purpose: Eliminates separate DB query for exchange_rate in Cash Flow page
-- Depends on: 20260303000003_exchange_rate_required (loans now has exchange_rate)
-- Rollback: DROP VIEW v_ap_calendar; DROP VIEW v_cost_balances; then re-create from previous definitions

-- Must drop dependent views first (CREATE OR REPLACE cannot add columns in the middle)
DROP VIEW IF EXISTS v_ap_calendar;
DROP VIEW IF EXISTS v_cost_balances;

-- ============================================================
-- v_cost_balances — add exchange_rate from v_cost_totals
-- ============================================================

CREATE VIEW v_cost_balances
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

-- ============================================================
-- v_ap_calendar — add exchange_rate from both branches
-- ============================================================

CREATE VIEW v_ap_calendar
WITH (security_invoker = on)
AS

-- Part 1: Supplier invoices (existing cost-based obligations)
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
LEFT JOIN projects p ON p.id = cb.project_id AND p.is_active = true
LEFT JOIN entities e ON e.id = cb.entity_id AND e.is_active = true
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
  NULL::NUMERIC(15,2)    AS amount_paid,
  ls.scheduled_amount    AS outstanding,
  CASE
    WHEN ls.paid THEN 'paid'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects p ON p.id = l.project_id AND p.is_active = true
WHERE ls.paid = false

ORDER BY due_date ASC;
