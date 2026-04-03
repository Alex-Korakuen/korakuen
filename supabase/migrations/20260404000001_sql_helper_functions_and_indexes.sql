-- ============================================================
-- Korakuen Management System — Helper functions & indexes
-- Migration: 20260404000001
-- Date: 2026-04-04
--
-- 1. fn_payment_in_invoice_currency() — converts a payment amount
--    to the invoice's currency using the payment's exchange rate.
--    Eliminates 6× duplicated CASE expression in v_invoice_balances.
--
-- 2. fn_aging_bucket() — returns aging bucket label from a due date.
--    Eliminates 2× duplicated CASE expression in v_invoices_with_loans.
--
-- 3. Composite indexes on payments for view join performance.
-- ============================================================

-- ============================================================
-- 1. Helper functions
-- ============================================================

-- Converts a payment amount to the invoice's currency.
-- When currencies match, returns the amount unchanged.
-- When they differ, divides by the payment's exchange rate
-- (PEN→USD: amount_pen / rate = amount_usd).
CREATE OR REPLACE FUNCTION fn_payment_in_invoice_currency(
  p_amount NUMERIC,
  p_payment_currency VARCHAR,
  p_invoice_currency VARCHAR,
  p_exchange_rate NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_payment_currency = p_invoice_currency THEN p_amount
    ELSE ROUND(p_amount / p_exchange_rate, 2)
  END;
$$;

-- Returns an aging bucket label based on days past due.
-- NULL or future due_date → 'current', then 1-30, 31-60, 61-90, 90+.
CREATE OR REPLACE FUNCTION fn_aging_bucket(p_due_date DATE)
RETURNS VARCHAR
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_due_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - p_due_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - p_due_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - p_due_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - p_due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END;
$$;

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Covers the v_invoice_balances JOIN: payments → invoices via related_id + related_to + is_active
CREATE INDEX IF NOT EXISTS idx_payments_invoice_active
  ON payments(related_id, related_to)
  WHERE is_active = true;

-- Covers the v_bank_balances JOIN: payments → bank_accounts
CREATE INDEX IF NOT EXISTS idx_payments_bank_active
  ON payments(bank_account_id)
  WHERE is_active = true;

-- Covers soft-delete filtering on invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_active
  ON invoices(is_active)
  WHERE is_active = true;

-- ============================================================
-- 3. Rewrite v_invoice_balances using fn_payment_in_invoice_currency()
-- ============================================================

CREATE OR REPLACE VIEW v_invoice_balances
WITH (security_invoker = on)
AS
SELECT
  it.invoice_id,
  it.direction,
  it.project_id,
  it.entity_id,
  it.partner_id,
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
  it.document_ref,
  it.notes,
  it.quote_status,
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
  COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)), 0) AS amount_paid,
  it.total - COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)), 0) AS outstanding,
  -- Detraccion paid: converted to invoice currency
  COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  -- Retencion paid: always in invoice currency (no cross-currency)
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- Payable/receivable: outstanding minus remaining detraccion and retencion portions
  GREATEST(0,
    it.total - COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)), 0)
    - GREATEST(0, COALESCE(it.detraccion_amount, 0)
        - COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)) FILTER (WHERE p.payment_type = 'detraccion'), 0))
    - GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS payable_or_receivable,
  -- BDN outstanding in invoice currency (for table/modal display)
  GREATEST(0, COALESCE(it.detraccion_amount, 0)
    - COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)) FILTER (WHERE p.payment_type = 'detraccion'), 0)) AS bdn_outstanding,
  -- BDN outstanding in PEN (for Financial Position cross-currency summation)
  CASE WHEN it.currency = 'PEN' THEN
    GREATEST(0, COALESCE(it.detraccion_amount, 0)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  ELSE
    GREATEST(0,
      ROUND(COALESCE(it.detraccion_amount, 0) * it.exchange_rate, 2)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  END AS bdn_outstanding_pen,
  -- Payment status (accounts for unpaid BDN detraccion obligations)
  CASE
    WHEN COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)), 0) >= it.total
      AND GREATEST(0, COALESCE(it.detraccion_amount, 0)
        - COALESCE(SUM(fn_payment_in_invoice_currency(p.amount, p.currency, it.currency, p.exchange_rate)) FILTER (WHERE p.payment_type = 'detraccion'), 0)) = 0
    THEN 'paid'
    ELSE 'partial'
  END AS payment_status,
  -- Retencion outstanding (retencion_amount minus retencion payments received)
  GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0)) AS retencion_outstanding
FROM v_invoice_totals it
LEFT JOIN payments p
  ON p.related_id = it.invoice_id
  AND p.related_to = 'invoice'
  AND p.is_active = true
GROUP BY
  it.invoice_id, it.direction, it.project_id, it.entity_id,
  it.partner_id, it.cost_type, it.title, it.invoice_number,
  it.invoice_date, it.due_date, it.igv_rate, it.detraccion_rate,
  it.retencion_applicable, it.retencion_rate, it.retencion_verified,
  it.currency, it.exchange_rate, it.comprobante_type,
  it.document_ref, it.notes, it.quote_status, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;

-- ============================================================
-- 4. Rewrite v_invoices_with_loans using fn_aging_bucket()
-- ============================================================

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
