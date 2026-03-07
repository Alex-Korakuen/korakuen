-- ============================================================
-- Korakuen Management System — Tax calculation helper functions
-- Migration: 20260306000002
-- Date: 2026-03-06
--
-- Creates reusable IMMUTABLE functions for IGV, detraccion,
-- and retencion calculations. Updates 5 views to use them.
-- ============================================================

-- ============================================================
-- 1. Create helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION fn_igv_amount(subtotal NUMERIC, igv_rate NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ROUND(subtotal * (igv_rate / 100), 2);
$$;

CREATE OR REPLACE FUNCTION fn_detraccion_amount(subtotal NUMERIC, igv_amount NUMERIC, detraccion_rate NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2);
$$;

CREATE OR REPLACE FUNCTION fn_retencion_amount(subtotal NUMERIC, igv_amount NUMERIC, retencion_rate NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ROUND((subtotal + igv_amount) * COALESCE(retencion_rate, 0) / 100, 2);
$$;

-- ============================================================
-- 2. Recreate views using helper functions
-- ============================================================

-- v_cost_totals (depended on by v_cost_balances, v_ap_calendar, v_entity_transactions, v_partner_ledger, v_igv_position)
CREATE OR REPLACE VIEW v_cost_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    c.id                  AS cost_id,
    c.project_id,
    c.bank_account_id,
    c.entity_id,
    c.quote_id,
    c.purchase_order_id,
    c.cost_type,
    c.date,
    c.title,
    c.igv_rate,
    c.detraccion_rate,
    c.currency,
    c.exchange_rate,
    c.comprobante_type,
    c.comprobante_number,
    c.payment_method,
    c.document_ref,
    c.due_date,
    c.notes,
    COALESCE(SUM(ci.subtotal), 0) AS subtotal
  FROM costs c
  LEFT JOIN cost_items ci ON ci.cost_id = c.id
  GROUP BY
    c.id,
    c.project_id,
    c.bank_account_id,
    c.entity_id,
    c.quote_id,
    c.purchase_order_id,
    c.cost_type,
    c.date,
    c.title,
    c.igv_rate,
    c.detraccion_rate,
    c.currency,
    c.exchange_rate,
    c.comprobante_type,
    c.comprobante_number,
    c.payment_method,
    c.document_ref,
    c.due_date,
    c.notes
),
with_igv AS (
  SELECT
    *,
    fn_igv_amount(subtotal, igv_rate) AS igv_amount
  FROM item_sums
)
SELECT
  cost_id,
  project_id,
  bank_account_id,
  entity_id,
  quote_id,
  purchase_order_id,
  cost_type,
  date,
  title,
  igv_rate,
  detraccion_rate,
  currency,
  exchange_rate,
  comprobante_type,
  comprobante_number,
  payment_method,
  document_ref,
  due_date,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount                                     AS total,
  fn_detraccion_amount(subtotal, igv_amount, detraccion_rate) AS detraccion_amount
FROM with_igv;

-- v_ar_balances
CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.bank_account_id,
    ar.entity_id,
    ar.partner_company_id,
    ar.invoice_number,
    ar.comprobante_type,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.detraccion_rate,
    ar.retencion_applicable,
    ar.retencion_rate,
    ar.retencion_verified,
    ar.currency,
    ar.exchange_rate,
    ar.document_ref,
    ar.notes,
    fn_igv_amount(ar.subtotal, ar.igv_rate) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    fn_detraccion_amount(ab.subtotal, ab.igv_amount, ab.detraccion_rate) AS detraccion_amount,
    ROUND(
      CASE
        WHEN ab.retencion_applicable
          THEN (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100
        ELSE 0
      END, 2
    )                           AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount,
  ac.gross_total - ac.detraccion_amount - ac.retencion_amount AS net_receivable,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ac.gross_total - COALESCE(SUM(p.amount), 0) AS outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ac.gross_total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM ar_computed ac
LEFT JOIN payments p
  ON p.related_id = ac.ar_invoice_id
  AND p.related_to = 'ar_invoice'
GROUP BY
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount;

-- v_retencion_dashboard
CREATE OR REPLACE VIEW v_retencion_dashboard
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.entity_id,
    ar.invoice_number,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.retencion_rate,
    ar.currency,
    ar.retencion_verified,
    fn_igv_amount(ar.subtotal, ar.igv_rate) AS igv_amount
  FROM ar_invoices ar
  WHERE ar.retencion_applicable = true
),
ar_with_totals AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate) AS retencion_amount
  FROM ar_base ab
)
SELECT
  awt.ar_invoice_id,
  p.project_code,
  e.legal_name          AS client_name,
  awt.invoice_number,
  awt.invoice_date,
  awt.due_date,
  awt.gross_total,
  awt.retencion_amount,
  awt.currency,
  awt.retencion_verified,
  (CURRENT_DATE - awt.invoice_date) AS days_since_invoice
-- No is_active filter on projects/entities: retencion history must remain visible
FROM ar_with_totals awt
JOIN projects p ON p.id = awt.project_id
JOIN entities e ON e.id = awt.entity_id
ORDER BY
  awt.retencion_verified ASC,
  (CURRENT_DATE - awt.invoice_date) DESC;

-- v_igv_position
CREATE OR REPLACE VIEW v_igv_position
WITH (security_invoker = on)
AS
WITH igv_collected AS (
  SELECT
    ar.currency,
    COALESCE(SUM(fn_igv_amount(ar.subtotal, ar.igv_rate)), 0) AS igv_collected
  FROM ar_invoices ar
  GROUP BY ar.currency
),
igv_paid AS (
  SELECT
    ct.currency,
    COALESCE(SUM(ct.igv_amount), 0) AS igv_paid
  FROM v_cost_totals ct
  WHERE ct.igv_amount > 0
  GROUP BY ct.currency
),
all_currencies AS (
  SELECT currency FROM igv_collected
  UNION
  SELECT currency FROM igv_paid
)
SELECT
  ac.currency,
  COALESCE(ic.igv_collected, 0) AS igv_collected,
  COALESCE(ip.igv_paid, 0) AS igv_paid,
  COALESCE(ip.igv_paid, 0) - COALESCE(ic.igv_collected, 0) AS net_igv_position
FROM all_currencies ac
LEFT JOIN igv_collected ic ON ic.currency = ac.currency
LEFT JOIN igv_paid ip ON ip.currency = ac.currency
ORDER BY ac.currency;

-- v_entity_transactions
CREATE OR REPLACE VIEW v_entity_transactions
WITH (security_invoker = on)
AS

-- Costs (expenses associated with an entity)
-- No is_active filter on entities/projects: financial history must remain visible
-- even after deactivation. Filtering handled at the application layer.
SELECT
  ct.entity_id,
  e.legal_name          AS entity_name,
  ct.project_id,
  p.project_code,
  p.name                AS project_name,
  'cost'                AS transaction_type,
  ct.date,
  ct.title,
  NULL                  AS invoice_number,
  ct.currency,
  ct.subtotal           AS amount,
  ct.total              AS total_with_igv,
  ct.document_ref,
  ct.cost_id            AS transaction_id
FROM v_cost_totals ct
JOIN entities e ON e.id = ct.entity_id
LEFT JOIN projects p ON p.id = ct.project_id
WHERE ct.entity_id IS NOT NULL

UNION ALL

-- AR Invoices (income from an entity)
SELECT
  ar.entity_id,
  e.legal_name          AS entity_name,
  ar.project_id,
  p.project_code,
  p.name                AS project_name,
  'ar_invoice'          AS transaction_type,
  ar.invoice_date       AS date,
  COALESCE(ar.notes, 'Invoice ' || ar.invoice_number) AS title,
  ar.invoice_number,
  ar.currency,
  ar.subtotal           AS amount,
  ar.subtotal + fn_igv_amount(ar.subtotal, ar.igv_rate) AS total_with_igv,
  ar.document_ref,
  ar.id                 AS transaction_id
FROM ar_invoices ar
JOIN entities e ON e.id = ar.entity_id
LEFT JOIN projects p ON p.id = ar.project_id

ORDER BY date DESC;
