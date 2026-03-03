-- View: v_partner_ledger
-- Purpose: Shows each partner's financial contribution per project, calculates
--          proportional ownership percentages, and income distribution.
-- Source tables: costs, bank_accounts, partner_companies, projects, v_cost_totals, ar_invoices, payments
-- Used by: Partner ledger page, settlement calculations, partner dashboard

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
