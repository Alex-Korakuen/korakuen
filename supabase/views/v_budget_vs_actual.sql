-- View: v_budget_vs_actual
-- Purpose: Compares budgeted amounts vs actual spending per project per category.
--          Shows variance and percentage used for budget tracking.
--          USD actual costs are converted to PEN using the invoice's exchange_rate (mid-rate).
-- Source tables: project_budgets, invoice_items, invoices, projects
-- Used by: Project budget dashboard, project detail page

CREATE OR REPLACE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  -- Actual spending per project per category from invoice_items
  -- Only project_cost type (not SG&A), only payable direction
  -- USD amounts converted to PEN using stored mid-rate exchange_rate
  SELECT
    i.project_id,
    ii.category,
    COALESCE(SUM(
      CASE WHEN i.currency = 'USD' THEN ii.subtotal * i.exchange_rate
           ELSE ii.subtotal
      END
    ), 0) AS actual_amount
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.direction = 'payable'
    AND i.cost_type = 'project_cost'
    AND i.project_id IS NOT NULL
    AND i.is_active = true
    AND (i.quote_status IS NULL OR i.quote_status = 'accepted')
  GROUP BY i.project_id, ii.category
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
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;
