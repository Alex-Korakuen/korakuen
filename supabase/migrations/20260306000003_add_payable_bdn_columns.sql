-- Migration: Add payable + bdn_outstanding columns to v_ap_calendar and v_ar_balances
-- These derived columns split outstanding into regular payable vs Banco de la Nación (detracción)

-- v_ap_calendar: DROP + CREATE (adding new columns to UNION ALL)
DROP VIEW IF EXISTS v_ap_calendar;

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
  GREATEST(0, cb.outstanding - COALESCE(cb.detraccion_amount, 0)) AS payable,
  LEAST(cb.outstanding, COALESCE(cb.detraccion_amount, 0)) AS bdn_outstanding,
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


-- v_ar_balances: DROP + CREATE (adding receivable and bdn_outstanding columns)
DROP VIEW IF EXISTS v_ar_balances;

CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.bank_account_id,
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
    ROUND(
      CASE
        WHEN ab.retencion_applicable
          THEN (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100
        ELSE 0
      END, 2
    )                           AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
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
  GREATEST(0, ac.gross_total - COALESCE(SUM(p.amount), 0) - COALESCE(ac.detraccion_amount, 0)) AS receivable,
  LEAST(ac.gross_total - COALESCE(SUM(p.amount), 0), COALESCE(ac.detraccion_amount, 0)) AS bdn_outstanding,
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
  ac.bank_account_id,
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
