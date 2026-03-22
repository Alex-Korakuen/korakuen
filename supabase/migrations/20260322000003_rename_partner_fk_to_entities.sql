-- Rename FK constraints from fk_*_partner to fk_*_partner_entity
-- These were created in 20260322000001_merge_partners_into_entities.sql
-- referencing the entities table, but named with _partner suffix.
-- Using _partner_entity to disambiguate from entity_id FKs on the same tables.

ALTER TABLE bank_accounts
  RENAME CONSTRAINT fk_bank_accounts_partner
  TO fk_bank_accounts_partner_entity;

ALTER TABLE project_partners
  RENAME CONSTRAINT fk_project_partners_partner
  TO fk_project_partners_partner_entity;

ALTER TABLE invoices
  RENAME CONSTRAINT fk_invoices_partner
  TO fk_invoices_partner_entity;

ALTER TABLE payments
  RENAME CONSTRAINT fk_payments_partner
  TO fk_payments_partner_entity;

ALTER TABLE loans
  RENAME CONSTRAINT fk_loans_partner
  TO fk_loans_partner_entity;
