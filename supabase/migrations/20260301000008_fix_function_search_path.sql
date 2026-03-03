-- ============================================================
-- Korakuen Management System — Fix function search_path
-- Migration: 008
-- Date: 2026-03-01
-- Sets search_path on update_updated_at() to satisfy Supabase linter
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
