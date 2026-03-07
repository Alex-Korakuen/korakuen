-- ============================================================================
-- Migration: Create categories table, seed data, rename SGA 'other', add FKs
-- Purpose: Move hardcoded cost item categories to a database table so they're
--          managed from one place. SGA's 'other' becomes 'other_sga' to give
--          each category a unique name (name is the primary key).
-- ============================================================================

-- === TABLE: categories ===

CREATE TABLE categories (
  name        VARCHAR(50) PRIMARY KEY,
  cost_type   VARCHAR(20) NOT NULL,                -- 'project_cost' or 'sga'
  label       VARCHAR(100) NOT NULL,               -- display name
  sort_order  INTEGER NOT NULL DEFAULT 0,           -- controls menu/display ordering
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === SEED DATA ===

INSERT INTO categories (name, cost_type, label, sort_order) VALUES
  ('materials',             'project_cost', 'Materials',             1),
  ('labor',                 'project_cost', 'Labor',                 2),
  ('subcontractor',         'project_cost', 'Subcontractor',         3),
  ('equipment_rental',      'project_cost', 'Equipment Rental',      4),
  ('permits_regulatory',    'project_cost', 'Permits & Regulatory',  5),
  ('other',                 'project_cost', 'Other',                 6),
  ('software_licenses',     'sga',          'Software Licenses',     1),
  ('partner_compensation',  'sga',          'Partner Compensation',  2),
  ('professional_services', 'sga',          'Professional Services', 3),
  ('other_sga',             'sga',          'Other',                 4);

-- === RENAME SGA 'other' → 'other_sga' in existing data ===

UPDATE cost_items
SET category = 'other_sga'
WHERE category = 'other'
  AND cost_id IN (SELECT id FROM costs WHERE cost_type = 'sga');

-- === FOREIGN KEYS ===

ALTER TABLE cost_items
  ADD CONSTRAINT fk_cost_items_category
  FOREIGN KEY (category) REFERENCES categories(name) ON DELETE RESTRICT;

ALTER TABLE project_budgets
  ADD CONSTRAINT fk_project_budgets_category
  FOREIGN KEY (category) REFERENCES categories(name) ON DELETE RESTRICT;

-- === RLS ===

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read categories"
  ON categories FOR SELECT TO authenticated USING (true);
