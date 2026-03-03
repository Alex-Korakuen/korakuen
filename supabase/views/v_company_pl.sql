-- View: v_company_pl
-- Purpose: Consolidated company-level profit and loss.
--          Total AR income across all projects, total project costs, total SG&A,
--          and net profit. Grouped by currency — never mixes currencies.
-- Source tables: ar_invoices, v_cost_totals
-- Used by: Company dashboard, financial summary page

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
