-- ============================================================
-- Migration: 20260307000003
-- Date: 2026-03-07
-- Purpose: Add partner_company_id to v_loan_balances view
-- ============================================================

DROP VIEW IF EXISTS v_loan_balances;
CREATE VIEW v_loan_balances
WITH (security_invoker = on)
AS
WITH loan_totals AS (
  SELECT
    l.id AS loan_id,
    l.lender_name,
    l.lender_contact,
    l.amount AS principal,
    l.currency,
    l.exchange_rate,
    l.date_borrowed,
    l.project_id,
    l.partner_company_id,
    l.purpose,
    l.return_type,
    l.agreed_return_rate,
    l.agreed_return_amount,
    l.due_date,
    l.status,
    CASE
      WHEN l.return_type = 'percentage' THEN
        l.amount + ROUND(l.amount * COALESCE(l.agreed_return_rate, 0) / 100, 2)
      WHEN l.return_type = 'fixed' THEN
        l.amount + COALESCE(l.agreed_return_amount, 0)
      ELSE l.amount
    END AS total_owed
  FROM loans l
)
SELECT
  lt.loan_id,
  lt.lender_name,
  lt.lender_contact,
  lt.principal,
  lt.currency,
  lt.exchange_rate,
  lt.date_borrowed,
  lt.project_id,
  lt.partner_company_id,
  lt.purpose,
  lt.total_owed,
  COALESCE(SUM(lp.amount), 0) AS total_paid,
  lt.total_owed - COALESCE(SUM(lp.amount), 0) AS outstanding,
  lt.status,
  lt.due_date,
  COALESCE(sched.scheduled_payments_count, 0) AS scheduled_payments_count,
  COALESCE(sched.paid_schedule_count, 0) AS paid_schedule_count
FROM loan_totals lt
LEFT JOIN loan_payments lp ON lp.loan_id = lt.loan_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS scheduled_payments_count,
    COUNT(*) FILTER (WHERE ls.paid = true) AS paid_schedule_count
  FROM loan_schedule ls
  WHERE ls.loan_id = lt.loan_id
) sched ON true
GROUP BY
  lt.loan_id,
  lt.lender_name,
  lt.lender_contact,
  lt.principal,
  lt.currency,
  lt.exchange_rate,
  lt.date_borrowed,
  lt.project_id,
  lt.partner_company_id,
  lt.purpose,
  lt.total_owed,
  lt.status,
  lt.due_date,
  sched.scheduled_payments_count,
  sched.paid_schedule_count;
