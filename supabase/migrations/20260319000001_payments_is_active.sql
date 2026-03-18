-- Add is_active column to payments table for soft-delete support
ALTER TABLE payments ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Recreate all 5 views that reference payments to filter by is_active = true

-- 1. v_invoice_balances
DROP VIEW IF EXISTS v_invoices_with_loans;
DROP VIEW IF EXISTS v_obligation_calendar;
DROP VIEW IF EXISTS v_invoice_balances CASCADE;

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
  CASE
    WHEN it.direction = 'receivable'
      THEN it.total - it.detraccion_amount - it.retencion_amount
    ELSE it.total
  END AS net_amount,
  COALESCE(SUM(
    CASE WHEN p.currency = it.currency THEN p.amount
         ELSE ROUND(p.amount / p.exchange_rate, 2)
    END
  ), 0) AS amount_paid,
  it.total - COALESCE(SUM(
    CASE WHEN p.currency = it.currency THEN p.amount
         ELSE ROUND(p.amount / p.exchange_rate, 2)
    END
  ), 0) AS outstanding,
  COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  GREATEST(0,
    it.total - COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0)
    - GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
        CASE WHEN p.payment_type = 'detraccion' THEN
          CASE WHEN p.currency = it.currency THEN p.amount
               ELSE ROUND(p.amount / p.exchange_rate, 2)
          END
        END
      ), 0))
    - GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS payable_or_receivable,
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0)) AS bdn_outstanding,
  CASE WHEN it.currency = 'PEN' THEN
    GREATEST(0, COALESCE(it.detraccion_amount, 0)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  ELSE
    GREATEST(0,
      ROUND(COALESCE(it.detraccion_amount, 0) * it.exchange_rate, 2)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  END AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0) >= it.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status,
  GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0)) AS retencion_outstanding
FROM v_invoice_totals it
LEFT JOIN payments p
  ON p.related_id = it.invoice_id
  AND p.related_to = 'invoice'
  AND p.is_active = true
GROUP BY
  it.invoice_id, it.direction, it.project_id, it.entity_id,
  it.partner_company_id, it.cost_type, it.title, it.invoice_number,
  it.invoice_date, it.due_date, it.igv_rate, it.detraccion_rate,
  it.retencion_applicable, it.retencion_rate, it.retencion_verified,
  it.currency, it.exchange_rate, it.comprobante_type, it.payment_method,
  it.document_ref, it.notes, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;


-- 2. v_payments_enriched
DROP VIEW IF EXISTS v_payments_enriched;

CREATE VIEW v_payments_enriched
WITH (security_invoker = on)
AS

-- Part 1: Payments related to invoices
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_company_id,
  p.bank_account_id,
  p.notes,
  i.invoice_number,
  i.project_id,
  pr.project_code,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ba.bank_name
FROM payments p
JOIN invoices i ON i.id = p.related_id
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'invoice'
  AND p.is_active = true

UNION ALL

-- Part 2: Payments related to loan schedule entries
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_company_id,
  p.bank_account_id,
  p.notes,
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  ba.bank_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'loan_schedule'
  AND p.is_active = true

ORDER BY payment_date DESC;


-- 3. v_bank_balances
DROP VIEW IF EXISTS v_bank_balances;

CREATE OR REPLACE VIEW v_bank_balances
WITH (security_invoker = on)
AS
SELECT
  ba.id                 AS bank_account_id,
  ba.partner_company_id,
  pc.name               AS partner_name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active,
  COALESCE(
    SUM(
      CASE
        WHEN p.direction = 'inbound' THEN p.amount
        ELSE -p.amount
      END
    ), 0
  )                     AS balance,
  COUNT(p.id)           AS transaction_count
FROM bank_accounts ba
JOIN partner_companies pc ON pc.id = ba.partner_company_id
LEFT JOIN payments p ON p.bank_account_id = ba.id AND p.is_active = true
GROUP BY
  ba.id,
  ba.partner_company_id,
  pc.name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active
HAVING ba.is_active = true
    OR COALESCE(SUM(CASE WHEN p.direction = 'inbound' THEN p.amount ELSE -p.amount END), 0) <> 0;


-- 4. v_loan_balances
DROP VIEW IF EXISTS v_loan_balances;

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
  JOIN payments p ON p.related_to = 'loan_schedule' AND p.related_id = ls.id AND p.is_active = true
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
      AND p.is_active = true
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


-- 5. v_obligation_calendar
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
  ib.invoice_number,
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
  ib.bdn_outstanding_pen,
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
  NULL::VARCHAR          AS invoice_number,
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
  0::NUMERIC(15,2)       AS bdn_outstanding_pen,
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
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;


-- 6. Recreate v_invoices_with_loans (depends on v_invoice_balances)
-- Check if it existed before and recreate
CREATE OR REPLACE VIEW v_invoices_with_loans
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices
SELECT
  ib.invoice_id AS id,
  'commercial'::VARCHAR AS type,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  ib.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ib.title,
  ib.invoice_number,
  ib.invoice_date,
  ib.due_date,
  ib.currency,
  ib.total,
  ib.amount_paid,
  ib.outstanding,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status,
  NULL::UUID AS loan_id,
  CASE
    WHEN ib.payment_status = 'paid' THEN 'current'
    WHEN ib.due_date IS NULL THEN 'current'
    WHEN CURRENT_DATE <= ib.due_date THEN 'current'
    WHEN CURRENT_DATE - ib.due_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - ib.due_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - ib.due_date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CASE
    WHEN ib.due_date IS NULL THEN 0
    ELSE GREATEST(0, CURRENT_DATE - ib.due_date)
  END AS days_overdue
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id

UNION ALL

-- Part 2: Loan schedule entries
SELECT
  ls.id,
  'loan'::VARCHAR AS type,
  'payable'::VARCHAR AS direction,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  l.entity_id,
  l.lender_name AS entity_name,
  l.purpose AS title,
  NULL::VARCHAR AS invoice_number,
  l.date_borrowed AS invoice_date,
  ls.scheduled_date AS due_date,
  l.currency,
  ls.scheduled_amount AS total,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  0::NUMERIC(15,2) AS bdn_outstanding,
  0::NUMERIC(15,2) AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END AS payment_status,
  ls.loan_id,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'current'
    WHEN ls.scheduled_date IS NULL THEN 'current'
    WHEN CURRENT_DATE <= ls.scheduled_date THEN 'current'
    WHEN CURRENT_DATE - ls.scheduled_date <= 30 THEN '1-30'
    WHEN CURRENT_DATE - ls.scheduled_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - ls.scheduled_date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  CASE
    WHEN ls.scheduled_date IS NULL THEN 0
    ELSE GREATEST(0, CURRENT_DATE - ls.scheduled_date)
  END AS days_overdue
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
