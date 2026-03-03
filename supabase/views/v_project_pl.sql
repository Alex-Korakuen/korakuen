-- View: v_project_pl
-- Purpose: Profit and loss per project. Shows income (AR subtotals), project costs
--          (cost subtotals where cost_type = 'project_cost'), and gross profit.
--          Grouped by currency — never mixes currencies.
-- Source tables: ar_invoices, v_cost_totals, projects
-- Used by: Project dashboard, project detail page, financial reports

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
