-- ============================================================
-- Korakuen Management System — Add notes to v_cost_totals
-- Migration: 009
-- Date: 2026-03-01
-- Adds c.notes to v_cost_totals view output.
-- Requires DROP CASCADE because adding a column changes the
-- view's column order, which CREATE OR REPLACE cannot do.
-- All dependent views are recreated below.
--
-- Rollback: Drop all views and recreate from migration 007
-- ============================================================

-- Drop v_cost_totals and all dependent views
DROP VIEW IF EXISTS v_cost_totals CASCADE;


-- === v_cost_totals (updated — now includes notes) ===

CREATE OR REPLACE VIEW v_cost_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    c.id                  AS cost_id,
    c.project_id,
    c.valuation_id,
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
    c.document_ref,
    c.due_date,
    c.notes,
    COALESCE(SUM(ci.subtotal), 0) AS subtotal
  FROM costs c
  LEFT JOIN cost_items ci ON ci.cost_id = c.id
  GROUP BY
    c.id,
    c.project_id,
    c.valuation_id,
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
    c.document_ref,
    c.due_date,
    c.notes
),
with_igv AS (
  SELECT
    *,
    ROUND(subtotal * (igv_rate / 100), 2) AS igv_amount
  FROM item_sums
)
SELECT
  cost_id,
  project_id,
  valuation_id,
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
  document_ref,
  due_date,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount                                                    AS total,
  ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2)  AS detraccion_amount
FROM with_igv;


-- === v_cost_balances (recreated — depends on v_cost_totals) ===

CREATE OR REPLACE VIEW v_cost_balances
WITH (security_invoker = on)
AS
SELECT
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.bank_account_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ct.total - COALESCE(SUM(p.amount), 0) AS outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ct.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM v_cost_totals ct
LEFT JOIN payments p
  ON p.related_id = ct.cost_id
  AND p.related_to = 'cost'
GROUP BY
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.bank_account_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount;


-- === v_ap_calendar (recreated — depends on v_cost_balances) ===

CREATE OR REPLACE VIEW v_ap_calendar
WITH (security_invoker = on)
AS
SELECT
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
ORDER BY cb.due_date ASC;


-- === v_entity_transactions (recreated — depends on v_cost_totals) ===

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
  ROUND(ar.subtotal + ar.subtotal * (ar.igv_rate / 100), 2) AS total_with_igv,
  ar.document_ref,
  ar.id                 AS transaction_id
FROM ar_invoices ar
JOIN entities e ON e.id = ar.entity_id
LEFT JOIN projects p ON p.id = ar.project_id

ORDER BY date DESC;


-- === v_project_pl (recreated — depends on v_cost_totals) ===

CREATE OR REPLACE VIEW v_project_pl
WITH (security_invoker = on)
AS
WITH project_income AS (
  SELECT
    ar.project_id,
    ar.currency,
    COALESCE(SUM(ar.subtotal), 0) AS total_income
  FROM ar_invoices ar
  GROUP BY ar.project_id, ar.currency
),
project_costs AS (
  SELECT
    ct.project_id,
    ct.currency,
    COALESCE(SUM(ct.subtotal), 0) AS total_costs
  FROM v_cost_totals ct
  WHERE ct.cost_type = 'project_cost'
    AND ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ct.currency
),
-- Collect all project+currency combinations from both income and costs
all_project_currencies AS (
  SELECT project_id, currency FROM project_income
  UNION
  SELECT project_id, currency FROM project_costs
)
SELECT
  p.id                  AS project_id,
  p.project_code,
  p.name                AS project_name,
  p.status              AS project_status,
  apc.currency,
  COALESCE(pi.total_income, 0)       AS total_income,
  COALESCE(pc.total_costs, 0)        AS total_costs,
  COALESCE(pi.total_income, 0)
    - COALESCE(pc.total_costs, 0)    AS gross_profit,
  CASE
    WHEN COALESCE(pi.total_income, 0) > 0
      THEN ROUND(
        (COALESCE(pi.total_income, 0) - COALESCE(pc.total_costs, 0))
        / COALESCE(pi.total_income, 0) * 100, 2
      )
    ELSE 0
  END                   AS gross_margin_pct
FROM all_project_currencies apc
-- No is_active filter: financial history must remain visible even after project
-- deactivation. Filtering handled at the application layer.
JOIN projects p         ON p.id = apc.project_id
LEFT JOIN project_income pi ON pi.project_id = apc.project_id
                           AND pi.currency = apc.currency
LEFT JOIN project_costs pc  ON pc.project_id = apc.project_id
                           AND pc.currency = apc.currency
ORDER BY p.project_code, apc.currency;


-- === v_company_pl (recreated — depends on v_cost_totals) ===

CREATE OR REPLACE VIEW v_company_pl
WITH (security_invoker = on)
AS
WITH total_income AS (
  SELECT
    ar.currency,
    COALESCE(SUM(ar.subtotal), 0) AS total_income
  FROM ar_invoices ar
  GROUP BY ar.currency
),
total_project_costs AS (
  SELECT
    ct.currency,
    COALESCE(SUM(ct.subtotal), 0) AS total_project_costs
  FROM v_cost_totals ct
  WHERE ct.cost_type = 'project_cost'
  GROUP BY ct.currency
),
total_sga AS (
  SELECT
    ct.currency,
    COALESCE(SUM(ct.subtotal), 0) AS total_sga
  FROM v_cost_totals ct
  WHERE ct.cost_type = 'sga'
  GROUP BY ct.currency
),
-- Collect all currencies present in any of the three sources
all_currencies AS (
  SELECT currency FROM total_income
  UNION
  SELECT currency FROM total_project_costs
  UNION
  SELECT currency FROM total_sga
)
SELECT
  ac.currency,
  COALESCE(ti.total_income, 0)          AS total_income,
  COALESCE(tpc.total_project_costs, 0)  AS total_project_costs,
  COALESCE(ti.total_income, 0)
    - COALESCE(tpc.total_project_costs, 0) AS gross_profit,
  COALESCE(ts.total_sga, 0)            AS total_sga,
  COALESCE(ti.total_income, 0)
    - COALESCE(tpc.total_project_costs, 0)
    - COALESCE(ts.total_sga, 0)         AS net_profit,
  CASE
    WHEN COALESCE(ti.total_income, 0) > 0
      THEN ROUND(
        (COALESCE(ti.total_income, 0)
          - COALESCE(tpc.total_project_costs, 0)
          - COALESCE(ts.total_sga, 0))
        / COALESCE(ti.total_income, 0) * 100, 2
      )
    ELSE 0
  END                                   AS net_margin_pct
FROM all_currencies ac
LEFT JOIN total_income ti          ON ti.currency = ac.currency
LEFT JOIN total_project_costs tpc  ON tpc.currency = ac.currency
LEFT JOIN total_sga ts             ON ts.currency = ac.currency
ORDER BY ac.currency;


-- === v_partner_ledger (recreated — depends on v_cost_totals) ===

CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  -- Each partner's total cost contribution per project per currency
  SELECT
    ct.project_id,
    ba.partner_company_id,
    ct.currency,
    -- subtotal is pre-IGV (net amount before tax)
    COALESCE(SUM(ct.subtotal), 0) AS contribution_amount
  FROM v_cost_totals ct
  JOIN bank_accounts ba ON ba.id = ct.bank_account_id
  WHERE ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ba.partner_company_id, ct.currency
),
project_totals AS (
  -- Total costs per project per currency (for percentage calculation)
  SELECT
    project_id,
    currency,
    SUM(contribution_amount) AS total_project_costs
  FROM partner_costs
  GROUP BY project_id, currency
),
project_income AS (
  -- Total AR income invoiced per project per currency
  SELECT
    ar.project_id,
    ar.currency,
    -- subtotal is pre-IGV (net amount before tax)
    COALESCE(SUM(ar.subtotal), 0) AS total_income
  FROM ar_invoices ar
  GROUP BY ar.project_id, ar.currency
)
SELECT
  pc.project_id,
  p.project_code,
  p.name                AS project_name,
  pc.partner_company_id,
  pco.name              AS partner_name,
  pc.currency,
  pc.contribution_amount,
  CASE
    WHEN pt.total_project_costs > 0
      THEN ROUND((pc.contribution_amount / pt.total_project_costs) * 100, 2)
    ELSE 0
  END                   AS contribution_pct,
  COALESCE(pi.total_income, 0) AS project_income,
  CASE
    WHEN pt.total_project_costs > 0
      THEN ROUND(
        COALESCE(pi.total_income, 0)
        * (pc.contribution_amount / pt.total_project_costs), 2
      )
    ELSE 0
  END                   AS income_share
FROM partner_costs pc
-- No is_active filter on projects/partner_companies: financial history must remain
-- visible even after deactivation. Filtering handled at the application layer.
JOIN projects p         ON p.id = pc.project_id
JOIN partner_companies pco ON pco.id = pc.partner_company_id
JOIN project_totals pt  ON pt.project_id = pc.project_id
                       AND pt.currency = pc.currency
LEFT JOIN project_income pi ON pi.project_id = pc.project_id
                           AND pi.currency = pc.currency
ORDER BY p.project_code, pco.name;
