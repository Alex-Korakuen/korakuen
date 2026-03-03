-- View: v_ar_balances
-- Purpose: Derives igv_amount, gross_total, detraccion, retencion, net_receivable,
--          amount_paid, outstanding, and payment_status per AR invoice
-- Source tables: ar_invoices, payments
-- Used by: v_settlement_dashboard, AR detail pages, project P&L, company P&L

CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.valuation_id,
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
    ar.currency,
    ar.exchange_rate,
    ar.document_ref,
    ar.is_internal_settlement,
    ar.notes,
    ROUND(ar.subtotal * (ar.igv_rate / 100), 2) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    ROUND(
      (ab.subtotal + ab.igv_amount) * COALESCE(ab.detraccion_rate, 0) / 100, 2
    )                           AS detraccion_amount,
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
  ac.valuation_id,
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
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.is_internal_settlement,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount,
  ac.gross_total - ac.detraccion_amount - ac.retencion_amount AS net_receivable,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ac.gross_total - COALESCE(SUM(p.amount), 0) AS outstanding,
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
  ac.valuation_id,
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
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.is_internal_settlement,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount;
