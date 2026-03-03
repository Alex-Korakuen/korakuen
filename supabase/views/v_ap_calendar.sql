-- View: v_ap_calendar
-- Purpose: Shows unpaid and partially paid obligations sorted by due date with days remaining.
--          Combines supplier invoices (from costs) and loan repayment schedule (from loan_schedule).
--          Feeds the Accounts Payable payment calendar on the website.
-- Source tables: v_cost_balances, projects, entities, loan_schedule, loans
-- Used by: AP calendar page, payment planning dashboard

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
FROM v_cost_balances cb
LEFT JOIN projects p ON p.id = cb.project_id AND p.is_active = true
LEFT JOIN entities e ON e.id = cb.entity_id AND e.is_active = true
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
LEFT JOIN projects p ON p.id = l.project_id AND p.is_active = true
WHERE ls.paid = false

ORDER BY due_date ASC;
