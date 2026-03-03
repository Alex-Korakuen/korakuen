-- ============================================================
-- Korakuen Management System — Loans Module Schema
-- Migration: 20260302000003
-- Date: 2026-03-02
-- Layer 6 (private): loans, loan_schedule, loan_payments
-- ============================================================


-- === TABLE: loans ===
-- Personal financing arrangements — money borrowed from friends, family, or
-- informal lenders. Private to Alex. Completely isolated from business accounting.

CREATE TABLE loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lender_name VARCHAR NOT NULL,                            -- who Alex borrowed from
  lender_contact VARCHAR,                                  -- phone or email
  amount NUMERIC(15,2) NOT NULL,                           -- principal borrowed
  currency VARCHAR(3) NOT NULL,                            -- USD or PEN
  date_borrowed DATE NOT NULL,
  project_id UUID,                                         -- which project this funded, if any
  purpose TEXT NOT NULL,                                   -- freeform description
  agreed_return_rate NUMERIC(5,2),                         -- e.g. 8.00 (percent)
  agreed_return_amount NUMERIC(15,2),                      -- if fixed amount instead of %
  return_type VARCHAR NOT NULL,                            -- 'percentage' or 'fixed'
  due_date DATE,                                           -- overall repayment deadline
  status VARCHAR NOT NULL,                                 -- 'active', 'partially_paid', 'settled'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_loans_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: loan_schedule ===
-- Agreed repayment schedule for a loan. Optional — not all loans have a
-- structured schedule. Feeds v_ap_calendar as a second UNION source.

CREATE TABLE loan_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL,                                   -- references loans
  scheduled_date DATE NOT NULL,                            -- agreed payment date
  scheduled_amount NUMERIC(15,2) NOT NULL,                 -- amount due on this date
  paid BOOLEAN NOT NULL DEFAULT false,
  actual_payment_id UUID,                                  -- references loan_payments — FK added after loan_payments table exists
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_loan_schedule_loans
    FOREIGN KEY (loan_id)
    REFERENCES loans(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_loan_schedule_updated_at
  BEFORE UPDATE ON loan_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: loan_payments ===
-- Actual repayments made against loans. Separate from business payments table —
-- keeps personal finance isolated.

CREATE TABLE loan_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL,                                   -- references loans
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,                            -- USD or PEN
  source VARCHAR,                                          -- 'project_settlement', 'personal_funds', 'other'
  settlement_ref VARCHAR,                                  -- e.g. PRY001-Settlement-1 — links repayment to profit event
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_loan_payments_loans
    FOREIGN KEY (loan_id)
    REFERENCES loans(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_loan_payments_updated_at
  BEFORE UPDATE ON loan_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === DEFERRED FK: loan_schedule.actual_payment_id → loan_payments ===
-- Added after loan_payments exists to resolve forward reference.

ALTER TABLE loan_schedule
ADD CONSTRAINT fk_loan_schedule_loan_payments
  FOREIGN KEY (actual_payment_id)
  REFERENCES loan_payments(id)
  ON DELETE RESTRICT;
