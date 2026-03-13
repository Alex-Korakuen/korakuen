-- View: v_invoice_balances
-- Purpose: Shows amount_paid, outstanding balance, and payment_status per invoice.
--          Tracks detraccion_paid and retencion_paid separately for accurate splits.
--          Works for both payable and receivable directions (replaces v_cost_balances + v_ar_balances).
-- Source tables: v_invoice_totals, payments
-- Used by: v_obligation_calendar, invoice detail pages, payment tracking, entity detail, financial position

CREATE OR REPLACE VIEW v_invoice_balances
WITH (security_invoker = on)
AS
SELECT
  it.invoice_id,
  it.direction,
  it.project_id,
  it.entity_id,
  it.partner_company_id,
  it.cost_type,
  it.title,
  it.invoice_number,
  it.invoice_date,
  it.due_date,
  it.igv_rate,
  it.detraccion_rate,
  it.retencion_applicable,
  it.retencion_rate,
  it.retencion_verified,
  it.currency,
  it.exchange_rate,
  it.comprobante_type,
  it.payment_method,
  it.document_ref,
  it.notes,
  it.subtotal,
  it.igv_amount,
  it.total,
  it.detraccion_amount,
  it.retencion_amount,
  -- Net amounts differ by direction
  CASE
    WHEN it.direction = 'receivable'
      THEN it.total - it.detraccion_amount - it.retencion_amount
    ELSE it.total
  END AS net_amount,
  -- Payment aggregation
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  it.total - COALESCE(SUM(p.amount), 0) AS outstanding,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- Payable/receivable: outstanding minus remaining detraccion and retencion portions
  GREATEST(0,
    it.total - COALESCE(SUM(p.amount), 0)
    - GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0))
    - GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS payable_or_receivable,
  -- BDN outstanding: detraccion amount minus what's been paid as detraccion
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0)) AS bdn_outstanding,
  -- Payment status
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= it.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM v_invoice_totals it
LEFT JOIN payments p
  ON p.related_id = it.invoice_id
  AND p.related_to = 'invoice'
GROUP BY
  it.invoice_id, it.direction, it.project_id, it.entity_id,
  it.partner_company_id, it.cost_type, it.title, it.invoice_number,
  it.invoice_date, it.due_date, it.igv_rate, it.detraccion_rate,
  it.retencion_applicable, it.retencion_rate, it.retencion_verified,
  it.currency, it.exchange_rate, it.comprobante_type, it.payment_method,
  it.document_ref, it.notes, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;
