-- View: v_invoices_with_loans
-- Purpose: Unified view of all commercial invoices (payable + receivable) and loan schedule entries.
--          Shows ALL statuses (paid, partial, pending) with aging bucket computation.
--          Used by the Invoices browse page.
-- Source tables: v_invoice_balances, projects, entities, loan_schedule, loans, payments
-- Used by: Invoices page (browse), future drill-down from Financial Position / Cash Flow
-- Dependencies: fn_aging_bucket()

CREATE OR REPLACE VIEW v_invoices_with_loans
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable, all statuses)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id         AS id,
  NULL::UUID            AS loan_id,
  ib.direction,
  ib.partner_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  e.legal_name              AS entity_name,
  ib.cost_type,
  ib.title,
  ib.invoice_number,
  ib.comprobante_type,
  ib.quote_status,
  ib.document_ref,
  ib.invoice_date,
  ib.due_date,
  ib.currency,
  ib.exchange_rate,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.retencion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status,
  -- Aging: days past due (positive = overdue, negative/zero = current)
  CASE
    WHEN ib.due_date IS NOT NULL THEN (CURRENT_DATE - ib.due_date)
    ELSE 0
  END AS days_overdue,
  fn_aging_bucket(ib.due_date) AS aging_bucket
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id

UNION ALL

-- Part 2: Loan repayment schedule entries (always payable direction, all statuses)
SELECT
  'loan'::VARCHAR       AS type,
  ls.id                 AS id,
  ls.loan_id,
  'payable'::VARCHAR    AS direction,
  l.partner_id,
  l.project_id,
  p.project_code,
  p.name                AS project_name,
  l.entity_id,
  l.lender_name         AS entity_name,
  NULL::VARCHAR         AS cost_type,
  l.purpose             AS title,
  NULL::VARCHAR         AS invoice_number,
  NULL::VARCHAR         AS comprobante_type,
  NULL::VARCHAR         AS quote_status,
  NULL::VARCHAR         AS document_ref,
  l.date_borrowed       AS invoice_date,
  ls.scheduled_date     AS due_date,
  l.currency,
  l.exchange_rate,
  NULL::NUMERIC(15,2)   AS subtotal,
  NULL::NUMERIC(15,2)   AS igv_amount,
  ls.scheduled_amount   AS total,
  NULL::NUMERIC(15,2)   AS detraccion_amount,
  NULL::NUMERIC(15,2)   AS retencion_amount,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END AS payment_status,
  CASE
    WHEN ls.scheduled_date IS NOT NULL THEN (CURRENT_DATE - ls.scheduled_date)
    ELSE 0
  END AS days_overdue,
  fn_aging_bucket(ls.scheduled_date) AS aging_bucket
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id;
