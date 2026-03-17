-- ============================================================
-- Drop: project_entities table
-- Migration: 20260317000001
-- Date: 2026-03-17
-- Purpose: project_entities is unused — entity-project relationships
--          are already captured in invoices and quotes. No view,
--          query, or page references this table.
-- ============================================================

-- Drop RLS policies
DROP POLICY IF EXISTS "Authenticated users can read project_entities" ON project_entities;
DROP POLICY IF EXISTS "Authenticated users can insert project_entities" ON project_entities;
DROP POLICY IF EXISTS "Authenticated users can update project_entities" ON project_entities;

-- Drop trigger
DROP TRIGGER IF EXISTS trg_project_entities_updated_at ON project_entities;

-- Drop indexes
DROP INDEX IF EXISTS idx_project_entities_project_id;
DROP INDEX IF EXISTS idx_project_entities_entity_id;

-- Drop table
DROP TABLE project_entities;

-- ============================================================
-- End of migration 20260317000001
-- Rollback: recreate table, indexes, trigger, and RLS policies
--           from migrations 20260301000001, 20260301000002,
--           20260303000002, 20260309000001, 20260309000002
-- ============================================================
