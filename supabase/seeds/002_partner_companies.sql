-- ============================================================
-- Korakuen Management System — Seed Data: Partner Companies
-- File: 002_partner_companies.sql
-- Date: 2026-03-01
--
-- Seeds the partner_companies table with 3 partner companies.
--
-- *** ALL VALUES ARE PLACEHOLDERS ***
-- Replace names, RUCs, document numbers, and contact info
-- with real data before running in production.
--
-- Partner 1 (Alex): bank_tracking_full = true (full bank tracking)
-- Partners 2 & 3: bank_tracking_full = false (reference only)
-- ============================================================

-- Partner 1 — Alex (full bank tracking)
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO partner_companies (name, ruc, owner_name, owner_document_type, owner_document_number, bank_tracking_full)
VALUES (
  'Korakuen SAC',       -- PLACEHOLDER: real company name
  '20000000001',        -- PLACEHOLDER: real 11-digit RUC
  'Alex Partner',       -- PLACEHOLDER: real owner full name
  'DNI',
  '00000001',           -- PLACEHOLDER: real 8-digit DNI
  true                  -- Alex gets full bank balance tracking
);

-- Partner 2
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO partner_companies (name, ruc, owner_name, owner_document_type, owner_document_number, bank_tracking_full)
VALUES (
  'Partner B SAC',      -- PLACEHOLDER: real company name
  '20000000002',        -- PLACEHOLDER: real 11-digit RUC
  'Partner B',          -- PLACEHOLDER: real owner full name
  'DNI',
  '00000002',           -- PLACEHOLDER: real 8-digit DNI
  false                 -- reference only — no full bank tracking
);

-- Partner 3
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO partner_companies (name, ruc, owner_name, owner_document_type, owner_document_number, bank_tracking_full)
VALUES (
  'Partner C SAC',      -- PLACEHOLDER: real company name
  '20000000003',        -- PLACEHOLDER: real 11-digit RUC
  'Partner C',          -- PLACEHOLDER: real owner full name
  'DNI',
  '00000003',           -- PLACEHOLDER: real 8-digit DNI
  false                 -- reference only — no full bank tracking
);
