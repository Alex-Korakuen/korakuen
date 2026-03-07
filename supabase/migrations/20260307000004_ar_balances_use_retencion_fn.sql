-- Migration: Replace inline retencion calculation with fn_retencion_amount()
-- Consistency fix: all other views use tax helper functions

DROP VIEW IF EXISTS v_ar_balances;
CREATE VIEW v_ar_balances
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
    fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate) AS retencion_amount
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
