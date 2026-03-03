-- ============================================================
-- Korakuen Management System — Phase 3.5 Views
-- Migration: 20260302000005
-- Date: 2026-03-02
--
-- Deploys 2 new views and 2 updated views from Phase 3.5:
--   - v_cost_totals (updated: adds payment_method column)
--   - v_ap_calendar (updated: adds loan_schedule UNION)
--   - v_loan_balances (new)
--   - v_budget_vs_actual (new)
--
-- v_cost_totals adds a new column (payment_method), which requires DROP + CREATE.
-- PostgreSQL CREATE OR REPLACE cannot add columns to an existing view.
-- DROP CASCADE removes all dependent views — they are all recreated below.
--
-- Dependency chain dropped by CASCADE:
--   v_cost_totals → v_cost_balances → v_ap_calendar
--   v_cost_totals → v_project_pl
--   v_cost_totals → v_company_pl
--   v_cost_totals → v_entity_transactions
--   v_cost_totals → v_partner_ledger
-- ============================================================


-- === Step 1: Drop v_cost_totals and all dependent views ===

DROP VIEW IF EXISTS v_cost_totals CASCADE;


-- === Step 2: Recreate v_cost_totals (with payment_method) ===

CREATE VIEW v_cost_totals
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
    c.payment_method,
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
  payment_method,
  document_ref,
  due_date,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount                                                    AS total,
  ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2)  AS detraccion_amount
FROM with_igv;


-- === Step 3: Recreate v_cost_balances (dropped by CASCADE) ===

CREATE VIEW v_cost_balances
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


-- === Step 4: Recreate v_ap_calendar (dropped by CASCADE — now with loan UNION) ===

CREATE VIEW v_ap_calendar
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


-- === Step 5: Recreate v_project_pl (dropped by CASCADE) ===

CREATE VIEW v_project_pl
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
JOIN projects p         ON p.id = apc.project_id
LEFT JOIN project_income pi ON pi.project_id = apc.project_id
                           AND pi.currency = apc.currency
LEFT JOIN project_costs pc  ON pc.project_id = apc.project_id
                           AND pc.currency = apc.currency
ORDER BY p.project_code, apc.currency;


-- === Step 6: Recreate v_company_pl (dropped by CASCADE) ===

CREATE VIEW v_company_pl
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


-- === Step 7: Recreate v_entity_transactions (dropped by CASCADE) ===

CREATE VIEW v_entity_transactions
WITH (security_invoker = on)
AS

-- Costs (expenses associated with an entity)
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


-- === Step 8: Recreate v_partner_ledger (dropped by CASCADE) ===

CREATE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  SELECT
    ct.project_id,
    ba.partner_company_id,
    ct.currency,
    COALESCE(SUM(ct.subtotal), 0) AS contribution_amount
  FROM v_cost_totals ct
  JOIN bank_accounts ba ON ba.id = ct.bank_account_id
  WHERE ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ba.partner_company_id, ct.currency
),
project_totals AS (
  SELECT
    project_id,
    currency,
    SUM(contribution_amount) AS total_project_costs
  FROM partner_costs
  GROUP BY project_id, currency
),
project_income AS (
  SELECT
    ar.project_id,
    ar.currency,
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
JOIN projects p         ON p.id = pc.project_id
JOIN partner_companies pco ON pco.id = pc.partner_company_id
JOIN project_totals pt  ON pt.project_id = pc.project_id
                       AND pt.currency = pc.currency
LEFT JOIN project_income pi ON pi.project_id = pc.project_id
                           AND pi.currency = pc.currency
ORDER BY p.project_code, pco.name;


-- === Step 9: Create v_loan_balances (new) ===

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
    l.date_borrowed,
    l.project_id,
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
  lt.date_borrowed,
  lt.project_id,
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
  lt.date_borrowed,
  lt.project_id,
  lt.purpose,
  lt.total_owed,
  lt.status,
  lt.due_date,
  sched.scheduled_payments_count,
  sched.paid_schedule_count;


-- === Step 10: Create v_budget_vs_actual (new) ===

CREATE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  SELECT
    c.project_id,
    ci.category,
    c.currency,
    COALESCE(SUM(ci.subtotal), 0) AS actual_amount
  FROM cost_items ci
  JOIN costs c ON c.id = ci.cost_id
  WHERE c.cost_type = 'project_cost'
    AND c.project_id IS NOT NULL
  GROUP BY c.project_id, ci.category, c.currency
)
SELECT
  pb.project_id,
  p.project_code,
  p.name                AS project_name,
  pb.category,
  pb.budgeted_amount,
  pb.currency           AS budgeted_currency,
  COALESCE(ac.actual_amount, 0) AS actual_amount,
  pb.budgeted_amount - COALESCE(ac.actual_amount, 0) AS variance,
  ROUND(
    (COALESCE(ac.actual_amount, 0) / NULLIF(pb.budgeted_amount, 0)) * 100, 1
  )                     AS pct_used,
  pb.notes
FROM project_budgets pb
JOIN projects p ON p.id = pb.project_id
LEFT JOIN actual_costs ac
  ON ac.project_id = pb.project_id
  AND ac.category = pb.category
  AND ac.currency = pb.currency
ORDER BY p.project_code, pb.category;


-- ============================================================
-- End of migration 20260302000005
-- ============================================================
