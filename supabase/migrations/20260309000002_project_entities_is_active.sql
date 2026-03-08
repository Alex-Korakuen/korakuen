-- ============================================================
-- Fix: Add soft-delete support to project_entities
-- Migration: 20260309000002
-- Date: 2026-03-09
-- Purpose: Website actions use is_active for soft-delete and
--          duplicate checking on project_entities. Add the column.
-- ============================================================

-- Add is_active column (all existing rows are active)
ALTER TABLE project_entities
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- End of migration 20260309000002
-- Rollback: ALTER TABLE project_entities DROP COLUMN is_active;
-- ============================================================
