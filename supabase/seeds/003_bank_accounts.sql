-- ============================================================
-- Korakuen Management System — Seed Data: Bank Accounts
-- File: 003_bank_accounts.sql
-- Date: 2026-03-01
--
-- Seeds bank accounts for all three partner companies.
-- Uses subqueries on RUC to reference partner entities by ID
-- since UUIDs are auto-generated.
--
-- *** ALL last4 DIGITS ARE PLACEHOLDERS ***
-- Replace with real last-4 account digits before production.
--
-- Alex (Korakuen SAC): 4 accounts (full bank tracking)
--   - BCP PEN checking
--   - Interbank PEN checking
--   - BCP USD checking
--   - Banco de la Nacion PEN detraccion
--
-- Partner B: 1 account (reference only)
--   - BCP PEN checking
--
-- Partner C: 1 account (reference only)
--   - BBVA PEN checking
-- ============================================================

-- === Alex (Korakuen SAC) — Full bank tracking ===

-- BCP PEN checking account
-- PLACEHOLDER: last4 '0001' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000001'),
  'BCP',
  '0001',               -- PLACEHOLDER: real last 4 digits
  'checking',
  'PEN',
  false
);

-- Interbank PEN checking account
-- PLACEHOLDER: last4 '0002' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000001'),
  'Interbank',
  '0002',               -- PLACEHOLDER: real last 4 digits
  'checking',
  'PEN',
  false
);

-- BCP USD checking account
-- PLACEHOLDER: last4 '0003' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000001'),
  'BCP',
  '0003',               -- PLACEHOLDER: real last 4 digits
  'checking',
  'USD',
  false
);

-- Banco de la Nacion PEN detraccion account
-- PLACEHOLDER: last4 '0004' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000001'),
  'Banco de la Nación',
  '0004',               -- PLACEHOLDER: real last 4 digits
  'detraccion',
  'PEN',
  true                   -- this IS the detraccion account
);

-- === Partner B — Reference only ===

-- BCP PEN checking account
-- PLACEHOLDER: last4 '0005' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000002'),
  'BCP',
  '0005',               -- PLACEHOLDER: real last 4 digits
  'checking',
  'PEN',
  false
);

-- === Partner C — Reference only ===

-- BBVA PEN checking account
-- PLACEHOLDER: last4 '0006' — replace with real last 4 digits
INSERT INTO bank_accounts (partner_id, bank_name, account_number_last4, account_type, currency, is_detraccion_account)
VALUES (
  (SELECT id FROM entities WHERE document_type = 'RUC' AND document_number = '20000000003'),
  'BBVA',
  '0006',               -- PLACEHOLDER: real last 4 digits
  'checking',
  'PEN',
  false
);
