-- ============================================================
-- Korakuen Management System — v_partner_ledger Profit-Based Settlement
-- Migration: 20260308000002
-- Date: 2026-03-08
-- Purpose: Fix settlement logic to distribute PROFIT (income - project costs)
--          by profit_share_pct, not total income. SG&A costs excluded.
--          Each partner should receive: costs_paid + profit × their %.
-- ============================================================

DROP VIEW IF EXISTS v_partner_ledger;

-- View: v_partner_ledger
-- Purpose: Shows each partner's financial position per project in PEN.
--          Distributes PROFIT (income - project costs) by profit_share_pct, not income.
--          SG&A costs excluded — they belong to the individual partner.
--          Each partner should receive from income pool: costs_paid + profit × their %.
-- Source tables: project_partners, costs, bank_accounts, partner_companies, projects, v_cost_totals, ar_invoices
-- Used by: Partner Balances page

CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  -- Each partner's total project cost contribution per project, converted to PEN
  -- Only project_cost type — SG&A excluded from settlement calculation
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
    AND ct.cost_type = 'project_cost'
  GROUP BY ct.project_id, ba.partner_company_id
),
project_totals AS (
  -- Total project costs in PEN (for contribution percentage calculation)
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
  pp.project_id,
  p.project_code,
  p.name                AS project_name,
  pp.partner_company_id,
  pco.name              AS partner_name,
  pp.profit_share_pct,
  COALESCE(pc.contribution_amount_pen, 0) AS contribution_amount_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND((COALESCE(pc.contribution_amount_pen, 0) / pt.total_project_costs_pen) * 100, 2)
    ELSE 0
  END                   AS contribution_pct,
  COALESCE(pi.total_income_pen, 0) AS project_income_pen,
  COALESCE(pt.total_project_costs_pen, 0) AS project_costs_pen,
  COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0) AS project_profit_pen,
  ROUND(
    (COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0))
    * (pp.profit_share_pct / 100), 2
  )                     AS profit_share_pen,
  -- What this partner should receive from the income pool:
  -- their costs back + their share of profit
  ROUND(
    COALESCE(pc.contribution_amount_pen, 0)
    + (COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0))
      * (pp.profit_share_pct / 100), 2
  )                     AS should_receive_pen
FROM project_partners pp
-- No is_active filter on projects/partner_companies: financial history must remain
-- visible even after deactivation. Filtering handled at the application layer.
JOIN projects p         ON p.id = pp.project_id
JOIN partner_companies pco ON pco.id = pp.partner_company_id
LEFT JOIN partner_costs pc ON pc.project_id = pp.project_id
                          AND pc.partner_company_id = pp.partner_company_id
LEFT JOIN project_totals pt ON pt.project_id = pp.project_id
LEFT JOIN project_income pi ON pi.project_id = pp.project_id
ORDER BY p.project_code, pco.name;
