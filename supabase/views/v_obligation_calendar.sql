-- View: v_obligation_calendar
-- Purpose: Shows unpaid and partially paid obligations sorted by due date with days remaining.
--          Combines commercial invoices (both AP and AR) and loan repayment schedule.
--          Calendar pages filter by direction at query time.
-- Source tables: v_invoice_balances, projects, entities, loan_schedule, loans, payments
-- Used by: AP Calendar page, AR Calendar page, payment planning

CREATE OR REPLACE VIEW v_obligation_calendar
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id,
  NULL::UUID             AS loan_id,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ib.cost_type,
  ib.invoice_date       AS date,
  ib.title,
  ib.currency,
  ib.exchange_rate,
  ib.document_ref,
  ib.due_date,
  (ib.due_date - CURRENT_DATE) AS days_remaining,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.payable_or_receivable AS payable,
  ib.bdn_outstanding,
  ib.payment_status
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id
WHERE ib.due_date IS NOT NULL
  AND ib.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule (always payable direction)
SELECT
  'loan'::VARCHAR        AS type,
  NULL::UUID             AS invoice_id,
  ls.loan_id,
  'payable'::VARCHAR     AS direction,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  l.entity_id,
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
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS payable,
  0::NUMERIC(15,2)       AS bdn_outstanding,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;
