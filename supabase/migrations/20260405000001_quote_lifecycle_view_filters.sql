-- Migration: Exclude non-accepted quotes from financial views
-- Pending and rejected quotes (quote_status = 'pending'/'rejected') must not appear
-- in financial aggregations. Only regular invoices (quote_status IS NULL) and
-- accepted quotes (quote_status = 'accepted') are included.
-- Rollback: Remove the AND (i.quote_status ...) clause from both views.

-- 1. v_invoice_totals — root financial view, cascades to:
--    v_invoice_balances, v_invoices_with_loans, v_obligation_calendar,
--    v_igv_position, v_retencion_dashboard
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
    i.quote_status,
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
    i.document_ref,
    i.notes,
    COALESCE(SUM(ii.subtotal), 0) AS subtotal
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
  WHERE i.is_active = true
    AND (i.quote_status IS NULL OR i.quote_status = 'accepted')
  GROUP BY
    i.id, i.direction, i.project_id, i.partner_id,
    i.entity_id, i.quote_status, i.purchase_order_id, i.cost_type,
    i.title, i.invoice_number, i.invoice_date, i.due_date,
    i.igv_rate, i.detraccion_rate, i.retencion_applicable,
    i.retencion_rate, i.retencion_verified, i.currency,
    i.exchange_rate, i.comprobante_type,
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
  quote_status,
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

-- 2. v_budget_vs_actual — has its own query to invoices (not through v_invoice_totals)
CREATE OR REPLACE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  SELECT
    i.project_id,
    ii.category,
    COALESCE(SUM(
      CASE WHEN i.currency = 'USD' THEN ii.subtotal * i.exchange_rate
           ELSE ii.subtotal
      END
    ), 0) AS actual_amount
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.direction = 'payable'
    AND i.cost_type = 'project_cost'
    AND i.project_id IS NOT NULL
    AND i.is_active = true
    AND (i.quote_status IS NULL OR i.quote_status = 'accepted')
  GROUP BY i.project_id, ii.category
)
SELECT
  pb.project_id,
  p.project_code,
  p.name                AS project_name,
  pb.category,
  pb.budgeted_amount,
  pb.currency           AS budgeted_currency,
  COALESCE(ac.actual_amount, 0) AS actual_amount,
  pb.budgeted_amount - COALESCE(ac.actual_amount, 0) AS variance,
  ROUND(
    (COALESCE(ac.actual_amount, 0) / NULLIF(pb.budgeted_amount, 0)) * 100, 1
  )                     AS pct_used,
  pb.notes
FROM project_budgets pb
JOIN projects p ON p.id = pb.project_id
LEFT JOIN actual_costs ac
  ON ac.project_id = pb.project_id
  AND ac.category = pb.category
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;
