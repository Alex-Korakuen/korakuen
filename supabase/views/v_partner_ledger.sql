-- View: v_partner_ledger
-- Purpose: Shows each partner's financial contribution per project in PEN,
--          using transaction-date exchange rates for USD conversion.
--          Calculates proportional ownership percentages and income distribution.
-- Source tables: costs, bank_accounts, partner_companies, projects, v_cost_totals, ar_invoices
-- Used by: Partner ledger page, partner dashboard

CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  -- Each partner's total cost contribution per project, converted to PEN
  -- USD amounts use the stored transaction-date exchange_rate on each cost
  SELECT
    ct.project_id,
    ba.partner_company_id,
    COALESCE(SUM(
      CASE WHEN ct.currency = 'USD'
        THEN ct.subtotal * ct.exchange_rate  -- transaction-date conversion
        ELSE ct.subtotal                     -- PEN passes through
      END
    ), 0) AS contribution_amount_pen
  FROM v_cost_totals ct
  JOIN bank_accounts ba ON ba.id = ct.bank_account_id
  WHERE ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ba.partner_company_id
),
project_totals AS (
  -- Total costs per project in PEN (for percentage calculation)
  SELECT
    project_id,
    SUM(contribution_amount_pen) AS total_project_costs_pen
  FROM partner_costs
  GROUP BY project_id
),
project_income AS (
  -- Total AR income per project, converted to PEN at transaction-date rate
  SELECT
    ar.project_id,
    COALESCE(SUM(
      CASE WHEN ar.currency = 'USD'
        THEN ar.subtotal * ar.exchange_rate  -- transaction-date conversion
        ELSE ar.subtotal                     -- PEN passes through
      END
    ), 0) AS total_income_pen
  FROM ar_invoices ar
  GROUP BY ar.project_id
)
SELECT
  pc.project_id,
  p.project_code,
  p.name                AS project_name,
  pc.partner_company_id,
  pco.name              AS partner_name,
  pc.contribution_amount_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND((pc.contribution_amount_pen / pt.total_project_costs_pen) * 100, 2)
    ELSE 0
  END                   AS contribution_pct,
  COALESCE(pi.total_income_pen, 0) AS project_income_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND(
        COALESCE(pi.total_income_pen, 0)
        * (pc.contribution_amount_pen / pt.total_project_costs_pen), 2
      )
    ELSE 0
  END                   AS income_share_pen
FROM partner_costs pc
-- No is_active filter on projects/partner_companies: financial history must remain
-- visible even after deactivation. Filtering handled at the application layer.
JOIN projects p         ON p.id = pc.project_id
JOIN partner_companies pco ON pco.id = pc.partner_company_id
JOIN project_totals pt  ON pt.project_id = pc.project_id
LEFT JOIN project_income pi ON pi.project_id = pc.project_id
ORDER BY p.project_code, pco.name;
