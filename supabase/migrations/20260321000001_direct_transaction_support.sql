-- ============================================================
-- Direct Transaction Support
-- Migration: 20260321000001
-- Date: 2026-03-21
--
-- 1. Add is_auto_generated to invoices (Change 4)
-- 2. Add 'intercompany' to cost_type valid values (Change 5)
-- ============================================================

-- 1. Add is_auto_generated column to invoices
ALTER TABLE invoices
  ADD COLUMN is_auto_generated BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop existing cost_type check and replace with one that includes 'intercompany'
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_cost_type_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_cost_type_check
  CHECK (cost_type IS NULL OR cost_type IN ('project_cost', 'sga', 'intercompany'));
