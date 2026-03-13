-- Migration: Simplify loan payment model
-- Changes:
--   1. Migrate existing loan_payments data into payments table (related_to = 'loan_schedule')
--   2. Drop loan_schedule.paid and loan_schedule.actual_payment_id (derive from payments)
--   3. Drop loans.status (derive in view)
--   4. Drop loan_payments table entirely
--   5. Recreate v_loan_balances and v_ap_calendar views
-- Rollback: Recreate loan_payments table, restore loans.status and loan_schedule columns

-- ============================================================
-- Step 1: Migrate loan_payments data into payments table
-- ============================================================

-- 1a: Payments linked to schedule entries (via loan_schedule.actual_payment_id)
INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id, notes)
SELECT
  'loan_schedule',
  ls.id,
  'outbound',
  'regular',
  lp.payment_date,
  lp.amount,
  lp.currency,
  lp.exchange_rate,
  l.partner_company_id,
  lp.notes
FROM loan_payments lp
JOIN loans l ON l.id = lp.loan_id
JOIN loan_schedule ls ON ls.actual_payment_id = lp.id;

-- 1b: Orphan loan_payments (not linked to any schedule entry)
--     Create schedule entries for them, then insert payments
DO $$
DECLARE
  rec RECORD;
  new_schedule_id UUID;
BEGIN
  FOR rec IN
    SELECT lp.*, l.partner_company_id
    FROM loan_payments lp
    JOIN loans l ON l.id = lp.loan_id
    WHERE NOT EXISTS (
      SELECT 1 FROM loan_schedule ls WHERE ls.actual_payment_id = lp.id
    )
  LOOP
    INSERT INTO loan_schedule (loan_id, scheduled_date, scheduled_amount, exchange_rate)
    VALUES (rec.loan_id, rec.payment_date, rec.amount, rec.exchange_rate)
    RETURNING id INTO new_schedule_id;

    INSERT INTO payments (related_to, related_id, direction, payment_type, payment_date, amount, currency, exchange_rate, partner_company_id, notes)
    VALUES ('loan_schedule', new_schedule_id, 'outbound', 'regular', rec.payment_date, rec.amount, rec.currency, rec.exchange_rate, rec.partner_company_id, rec.notes);
  END LOOP;
END $$;

-- ============================================================
-- Step 2: Drop dependent views, then drop loan_schedule columns
-- ============================================================

-- Views depend on loan_schedule.paid — must drop before altering
DROP VIEW IF EXISTS v_ap_calendar;
DROP VIEW IF EXISTS v_loan_balances;

-- Drop FK first
ALTER TABLE loan_schedule DROP CONSTRAINT fk_loan_schedule_loan_payments;

ALTER TABLE loan_schedule DROP COLUMN paid;
ALTER TABLE loan_schedule DROP COLUMN actual_payment_id;

-- ============================================================
-- Step 3: Drop loans.status (now derived in view)
-- ============================================================

ALTER TABLE loans DROP COLUMN status;

-- ============================================================
-- Step 4: Drop loan_payments table
-- ============================================================

-- Drop RLS policies first
DROP POLICY IF EXISTS "Authenticated users can insert loan_payments" ON loan_payments;
DROP POLICY IF EXISTS "Authenticated users can update loan_payments" ON loan_payments;

DROP TABLE loan_payments;

-- ============================================================
-- Step 5: Recreate v_loan_balances (derive status + total_paid from payments)
-- ============================================================

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

-- ============================================================
-- Step 6: Recreate v_ap_calendar (derive schedule entry status from payments)
-- ============================================================

CREATE OR REPLACE VIEW v_ap_calendar
WITH (security_invoker = on)
AS

-- Part 1: Supplier invoices (existing cost-based obligations)
SELECT
  'supplier_invoice'::VARCHAR AS type,
  cb.cost_id,
  NULL::UUID             AS loan_id,
  cb.partner_company_id,
  cb.project_id,
  p.project_code,
  p.name              AS project_name,
  cb.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  cb.cost_type,
  cb.date,
  cb.title,
  cb.currency,
  cb.exchange_rate,
  cb.document_ref,
  cb.due_date,
  (cb.due_date - CURRENT_DATE) AS days_remaining,
  cb.subtotal,
  cb.igv_amount,
  cb.total,
  cb.detraccion_amount,
  cb.amount_paid,
  cb.outstanding,
  GREATEST(0, cb.outstanding - GREATEST(0, COALESCE(cb.detraccion_amount, 0) - cb.detraccion_paid)) AS payable,
  GREATEST(0, COALESCE(cb.detraccion_amount, 0) - cb.detraccion_paid) AS bdn_outstanding,
  cb.payment_status
FROM v_cost_balances cb
LEFT JOIN projects p ON p.id = cb.project_id
LEFT JOIN entities e ON e.id = cb.entity_id
WHERE cb.due_date IS NOT NULL
  AND cb.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule (derive status from payments)
SELECT
  'loan_payment'::VARCHAR AS type,
  NULL::UUID             AS cost_id,
  ls.loan_id,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  NULL::UUID             AS entity_id,
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
  0::NUMERIC(15,2) AS bdn_outstanding,
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
