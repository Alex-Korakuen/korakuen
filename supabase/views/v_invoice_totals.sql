-- View: v_invoice_totals
-- Purpose: Derives subtotal, igv_amount, detraccion_amount, retencion_amount, total
--          per invoice from invoice_items. Works for both payable and receivable directions.
-- Source tables: invoices, invoice_items
-- Used by: v_invoice_balances, v_obligation_calendar, v_igv_position, v_budget_vs_actual, queries.ts (settlement)

CREATE OR REPLACE VIEW v_invoice_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    i.id                  AS invoice_id,
    i.direction,
    i.project_id,
    i.partner_id,
    i.entity_id,
    i.quote_id,
    i.purchase_order_id,
    i.cost_type,
    i.title,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.igv_rate,
    i.detraccion_rate,
    i.retencion_applicable,
    i.retencion_rate,
    i.retencion_verified,
    i.currency,
    i.exchange_rate,
    i.comprobante_type,
    i.payment_method,
    i.document_ref,
    i.notes,
    COALESCE(SUM(ii.subtotal), 0) AS subtotal
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
  WHERE i.is_active = true
  GROUP BY
    i.id, i.direction, i.project_id, i.partner_id,
    i.entity_id, i.quote_id, i.purchase_order_id, i.cost_type,
    i.title, i.invoice_number, i.invoice_date, i.due_date,
    i.igv_rate, i.detraccion_rate, i.retencion_applicable,
    i.retencion_rate, i.retencion_verified, i.currency,
    i.exchange_rate, i.comprobante_type, i.payment_method,
    i.document_ref, i.notes
),
with_igv AS (
  SELECT
    *,
    fn_igv_amount(subtotal, igv_rate) AS igv_amount
  FROM item_sums
)
SELECT
  invoice_id,
  direction,
  project_id,
  partner_id,
  entity_id,
  quote_id,
  purchase_order_id,
  cost_type,
  title,
  invoice_number,
  invoice_date,
  due_date,
  igv_rate,
  detraccion_rate,
  retencion_applicable,
  retencion_rate,
  retencion_verified,
  currency,
  exchange_rate,
  comprobante_type,
  payment_method,
  document_ref,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount AS total,
  fn_detraccion_amount(subtotal, igv_amount, detraccion_rate) AS detraccion_amount,
  CASE WHEN retencion_applicable
    THEN fn_retencion_amount(subtotal, igv_amount, retencion_rate)
    ELSE 0
  END AS retencion_amount
FROM with_igv;
