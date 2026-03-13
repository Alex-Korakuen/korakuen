-- View: v_loan_balances
-- Purpose: Shows borrowed amount, total owed (principal + return), total paid,
--          and outstanding balance per loan. Status derived from payment totals.
-- Source tables: loans, loan_schedule, payments
-- Used by: Loan tracking dashboard, financial position

CREATE OR REPLACE VIEW v_loan_balances
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
    CASE
      WHEN l.return_type = 'percentage' THEN
        l.amount + ROUND(l.amount * COALESCE(l.agreed_return_rate, 0) / 100, 2)
      WHEN l.return_type = 'fixed' THEN
        l.amount + COALESCE(l.agreed_return_amount, 0)
      ELSE l.amount
    END AS total_owed
  FROM loans l
),
loan_paid AS (
  SELECT
    ls.loan_id,
    COALESCE(SUM(p.amount), 0) AS total_paid
  FROM loan_schedule ls
  JOIN payments p ON p.related_to = 'loan_schedule' AND p.related_id = ls.id
  GROUP BY ls.loan_id
),
schedule_stats AS (
  SELECT
    ls.loan_id,
    COUNT(*) AS scheduled_payments_count,
    COUNT(*) FILTER (
      WHERE COALESCE(ps.paid_amount, 0) >= ls.scheduled_amount
    ) AS paid_schedule_count
  FROM loan_schedule ls
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM payments p
    WHERE p.related_to = 'loan_schedule'
      AND p.related_id = ls.id
  ) ps ON true
  GROUP BY ls.loan_id
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
  COALESCE(lp.total_paid, 0) AS total_paid,
  lt.total_owed - COALESCE(lp.total_paid, 0) AS outstanding,
  CASE
    WHEN COALESCE(lp.total_paid, 0) = 0 THEN 'active'
    WHEN lt.total_owed - COALESCE(lp.total_paid, 0) <= 0 THEN 'settled'
    ELSE 'partially_paid'
  END AS status,
  lt.due_date,
  COALESCE(ss.scheduled_payments_count, 0) AS scheduled_payments_count,
  COALESCE(ss.paid_schedule_count, 0) AS paid_schedule_count
FROM loan_totals lt
LEFT JOIN loan_paid lp ON lp.loan_id = lt.loan_id
LEFT JOIN schedule_stats ss ON ss.loan_id = lt.loan_id;
