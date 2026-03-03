-- ============================================================
-- Korakuen Management System — Project Budgets
-- Migration: 20260302000004
-- Date: 2026-03-02
--
-- Creates the project_budgets table (Layer 7). Stores budget
-- targets per project per category. Compared against actual
-- costs from cost_items via the v_budget_vs_actual view.
--
-- Category values must match cost_items project cost categories:
-- materials, labor, subcontractor, equipment_rental,
-- permits_regulatory, other
-- ============================================================

-- === TABLE: project_budgets ===

CREATE TABLE project_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  category VARCHAR NOT NULL,                    -- must match cost_items categories exactly
  budgeted_amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,                 -- USD or PEN
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  CONSTRAINT fk_project_budgets_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_project_budgets_project_category
    UNIQUE (project_id, category)
);

-- Auto-update updated_at on any change
CREATE TRIGGER trg_project_budgets_updated_at
  BEFORE UPDATE ON project_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- End of migration 20260302000004
-- Rollback: DROP TABLE project_budgets;
-- ============================================================
