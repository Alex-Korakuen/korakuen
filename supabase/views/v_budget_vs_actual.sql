-- View: v_budget_vs_actual
-- Purpose: Compares budgeted amounts vs actual spending per project per category.
--          Shows variance and percentage used for budget tracking.
-- Source tables: project_budgets, invoice_items, invoices, projects
-- Used by: Project budget dashboard, project detail page

CREATE OR REPLACE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  -- Actual spending per project per category from invoice_items
  -- Only project_cost type (not SG&A), only payable direction
  SELECT
    i.project_id,
    ii.category,
    i.currency,
    COALESCE(SUM(ii.subtotal), 0) AS actual_amount
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.direction = 'payable'
    AND i.cost_type = 'project_cost'
    AND i.project_id IS NOT NULL
  GROUP BY i.project_id, ii.category, i.currency
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
-- No is_active filter on projects: budget history must remain visible
-- even after project deactivation. Filtering handled at the application layer.
JOIN projects p ON p.id = pb.project_id
LEFT JOIN actual_costs ac
  ON ac.project_id = pb.project_id
  AND ac.category = pb.category
  AND ac.currency = pb.currency
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;
