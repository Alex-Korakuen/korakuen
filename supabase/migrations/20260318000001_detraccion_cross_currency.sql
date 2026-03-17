-- Migration: Support cross-currency detraccion payments
-- Problem: Detraccion deposits to Banco de la Nacion are always in PEN,
--          even for USD invoices. The view must convert PEN detraccion payments
--          to invoice currency for outstanding math, and expose bdn_outstanding_pen
--          (always PEN) for Financial Position summation.

-- Drop dependent views first (adding column requires full recreate)
DROP VIEW IF EXISTS v_invoices_with_loans;
DROP VIEW IF EXISTS v_obligation_calendar;
DROP VIEW IF EXISTS v_invoice_balances;

-- Recreate v_invoice_balances with cross-currency detraccion support
CREATE VIEW v_invoice_balances
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
  -- Payment aggregation: convert cross-currency payments to invoice currency
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
  -- Detraccion paid: converted to invoice currency
  COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0) AS detraccion_paid,
  -- Retencion paid: always in invoice currency (no cross-currency)
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- Payable/receivable: outstanding minus remaining detraccion and retencion portions
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
  -- BDN outstanding in invoice currency (for table/modal display)
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0)) AS bdn_outstanding,
  -- BDN outstanding in PEN (for Financial Position cross-currency summation)
  CASE WHEN it.currency = 'PEN' THEN
    GREATEST(0, COALESCE(it.detraccion_amount, 0)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  ELSE
    GREATEST(0,
      ROUND(COALESCE(it.detraccion_amount, 0) * it.exchange_rate, 2)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  END AS bdn_outstanding_pen,
  -- Payment status
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


-- Recreate v_obligation_calendar with bdn_outstanding_pen
CREATE VIEW v_obligation_calendar
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
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;


-- Recreate v_invoices_with_loans with bdn_outstanding_pen
CREATE VIEW v_invoices_with_loans
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable, all statuses)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id         AS id,
  NULL::UUID            AS loan_id,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ib.cost_type,
  ib.title,
  ib.invoice_number,
  ib.comprobante_type,
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
  CASE
    WHEN ib.due_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ib.due_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ib.due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
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
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                AS project_name,
  l.entity_id,
  l.lender_name         AS entity_name,
  NULL::VARCHAR         AS cost_type,
  l.purpose             AS title,
  NULL::VARCHAR         AS invoice_number,
  NULL::VARCHAR         AS comprobante_type,
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
  CASE
    WHEN ls.scheduled_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id

ORDER BY due_date DESC NULLS LAST;
