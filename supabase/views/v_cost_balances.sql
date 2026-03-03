-- View: v_cost_balances
-- Purpose: Shows amount_paid, outstanding balance, and payment_status per cost
-- Source tables: v_cost_totals, payments
-- Used by: v_ap_calendar, cost detail pages, payment tracking

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
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount;
