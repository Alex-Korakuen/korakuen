-- ============================================================
-- Korakuen Management System — Add is_active to reference tables
-- Migration: 003
-- Date: 2026-03-01
--
-- is_active applies only to reference/master data tables — records
-- that represent entities which can become inactive over time.
--
-- Transaction tables (costs, cost_items, ar_invoices, payments)
-- are permanent financial records. They are never soft-deleted.
-- Errors are corrected via reversing entries, not deletion.
--
-- Historical reference tables (valuations, quotes, project_entities)
-- are also permanent — they record facts that happened.
--
-- entity_tags excluded — uses hard deletes by design.
-- ============================================================

ALTER TABLE tags
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE projects
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- End of migration 003
-- Rollback: ALTER TABLE tags DROP COLUMN is_active;
--           ALTER TABLE projects DROP COLUMN is_active;
-- ============================================================
