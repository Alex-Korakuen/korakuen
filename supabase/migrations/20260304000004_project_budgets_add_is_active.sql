-- ============================================================
-- Korakuen Management System — Add is_active to project_budgets
-- Migration: 20260304000004
-- Date: 2026-03-04
--
-- Adds is_active soft-delete column to project_budgets for
-- consistency with all other reference/master data tables.
-- Previously, budget overwrites used hard deletes.
-- ============================================================

ALTER TABLE project_budgets
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Replace the absolute unique constraint with a partial unique
-- index on active rows only, so soft-deleted rows don't block
-- re-inserts for the same (project_id, category).
ALTER TABLE project_budgets
  DROP CONSTRAINT uq_project_budgets_project_category;

CREATE UNIQUE INDEX uq_project_budgets_project_category_active
  ON project_budgets (project_id, category)
  WHERE is_active = true;

-- Update v_budget_vs_actual to filter by is_active
CREATE OR REPLACE VIEW v_budget_vs_actual
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
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;

-- ============================================================
-- End of migration 20260304000004
-- Rollback:
--   DROP INDEX uq_project_budgets_project_category_active;
--   ALTER TABLE project_budgets ADD CONSTRAINT uq_project_budgets_project_category UNIQUE (project_id, category);
--   ALTER TABLE project_budgets DROP COLUMN is_active;
-- ============================================================
