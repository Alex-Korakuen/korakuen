-- ============================================================
-- Korakuen Management System — Phase 3.5 Indexes
-- Migration: 20260302000006
-- Date: 2026-03-02
--
-- Adds missing indexes for Layer 6 tables (loans module).
-- Follows same pattern as migration 002 (initial indexes).
-- ============================================================

-- === INDEXES: loans ===

CREATE INDEX idx_loans_project_id ON loans(project_id);

-- === INDEXES: loan_schedule ===

CREATE INDEX idx_loan_schedule_loan_id ON loan_schedule(loan_id);

-- === INDEXES: loan_payments ===

CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);

-- ============================================================
-- End of migration 20260302000006
-- ============================================================
