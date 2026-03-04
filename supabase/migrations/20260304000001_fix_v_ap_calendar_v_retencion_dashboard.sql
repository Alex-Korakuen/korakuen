-- Migration: Remove is_active filters from v_ap_calendar, add comment to v_retencion_dashboard
-- Reason: Outstanding AP obligations and retencion history must remain visible
--         even if the associated project or entity is deactivated.
--         Matches the design principle used by v_entity_transactions, v_partner_ledger, v_project_pl.

-- Recreate v_ap_calendar without is_active filters
CREATE OR REPLACE VIEW v_ap_calendar
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
-- No is_active filter on projects/entities: outstanding obligations must remain visible
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
  NULL::NUMERIC(15,2)    AS amount_paid,
  ls.scheduled_amount    AS outstanding,
  CASE
    WHEN ls.paid THEN 'paid'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.paid = false

ORDER BY due_date ASC;

-- Recreate v_retencion_dashboard (unchanged logic, added explanatory comment)
CREATE OR REPLACE VIEW v_retencion_dashboard
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.entity_id,
    ar.invoice_number,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.retencion_rate,
    ar.currency,
    ar.retencion_verified,
    ROUND(ar.subtotal * (ar.igv_rate / 100), 2) AS igv_amount
  FROM ar_invoices ar
  WHERE ar.retencion_applicable = true
),
ar_with_totals AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    ROUND(
      (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100, 2
    ) AS retencion_amount
  FROM ar_base ab
)
SELECT
  awt.ar_invoice_id,
  p.project_code,
  e.legal_name          AS client_name,
  awt.invoice_number,
  awt.invoice_date,
  awt.due_date,
  awt.gross_total,
  awt.retencion_amount,
  awt.currency,
  awt.retencion_verified,
  (CURRENT_DATE - awt.invoice_date) AS days_since_invoice
-- No is_active filter on projects/entities: retencion history must remain visible
FROM ar_with_totals awt
JOIN projects p ON p.id = awt.project_id
JOIN entities e ON e.id = awt.entity_id
ORDER BY
  awt.retencion_verified ASC,
  (CURRENT_DATE - awt.invoice_date) DESC;
