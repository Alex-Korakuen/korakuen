-- ============================================================
-- Korakuen Management System — Informal Payment Support
-- Migration: 20260302000002
-- Date: 2026-03-02
-- Task: 3.12
-- ============================================================
-- Adds payment_method to costs table (bank_transfer, cash, check).
-- Comprobante_type expansion (adding liquidacion_de_compra, planilla_jornales, none)
-- is application-level validation only — no DB constraint change needed.
-- Rollback: ALTER TABLE costs DROP COLUMN payment_method;

ALTER TABLE costs ADD COLUMN payment_method VARCHAR(50); -- bank_transfer, cash, check
