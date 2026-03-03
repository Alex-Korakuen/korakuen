-- ============================================================
-- Korakuen Management System — Fix Payments Index
-- Migration: 20260302000007
-- Date: 2026-03-03
-- Purpose: Replace single-column payments(related_id) index with
--          composite (related_id, related_to) for polymorphic lookups
-- ============================================================

DROP INDEX IF EXISTS idx_payments_related_id;

CREATE INDEX idx_payments_related_id_related_to ON payments(related_id, related_to);

-- ============================================================
-- End of migration
-- Rollback: DROP INDEX idx_payments_related_id_related_to;
--           CREATE INDEX idx_payments_related_id ON payments(related_id);
-- ============================================================
