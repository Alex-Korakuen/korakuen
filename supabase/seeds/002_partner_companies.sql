-- ============================================================
-- Korakuen Management System — Seed Data: Partner Companies
-- File: 002_partner_companies.sql
-- Date: 2026-03-22
--
-- Seeds partner companies as entities tagged 'partner'.
-- Also creates owner contacts for each partner.
--
-- *** ALL VALUES ARE PLACEHOLDERS ***
-- Replace names, RUCs, document numbers, and contact info
-- with real data before running in production.
-- ============================================================

-- Ensure 'partner' tag exists
INSERT INTO tags (name, notes)
VALUES ('partner', 'Identifies the three partner companies that own Korakuen')
ON CONFLICT (name) DO NOTHING;

-- Partner 1 — Alex
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO entities (entity_type, document_type, document_number, legal_name)
VALUES ('company', 'RUC', '20000000001', 'Korakuen SAC');

INSERT INTO entity_tags (entity_id, tag_id)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000001' AND document_type = 'RUC'),
  (SELECT id FROM tags WHERE name = 'partner')
);

INSERT INTO entity_contacts (entity_id, full_name, role, is_primary)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000001' AND document_type = 'RUC'),
  'Alex Partner',       -- PLACEHOLDER: real owner full name
  'Owner',
  true
);

-- Partner 2
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO entities (entity_type, document_type, document_number, legal_name)
VALUES ('company', 'RUC', '20000000002', 'Partner B SAC');

INSERT INTO entity_tags (entity_id, tag_id)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000002' AND document_type = 'RUC'),
  (SELECT id FROM tags WHERE name = 'partner')
);

INSERT INTO entity_contacts (entity_id, full_name, role, is_primary)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000002' AND document_type = 'RUC'),
  'Partner B',          -- PLACEHOLDER: real owner full name
  'Owner',
  true
);

-- Partner 3
-- PLACEHOLDER: Replace name, ruc, owner details with real data
INSERT INTO entities (entity_type, document_type, document_number, legal_name)
VALUES ('company', 'RUC', '20000000003', 'Partner C SAC');

INSERT INTO entity_tags (entity_id, tag_id)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000003' AND document_type = 'RUC'),
  (SELECT id FROM tags WHERE name = 'partner')
);

INSERT INTO entity_contacts (entity_id, full_name, role, is_primary)
VALUES (
  (SELECT id FROM entities WHERE document_number = '20000000003' AND document_type = 'RUC'),
  'Partner C',          -- PLACEHOLDER: real owner full name
  'Owner',
  true
);
