-- ============================================================================
-- Migration: Rename auto-generated FK constraints on invoices + invoice_items
-- Purpose: The V1 unified invoices migration (20260312000002) used inline
--          REFERENCES syntax, which let PostgreSQL auto-generate constraint
--          names (e.g. invoices_entity_id_fkey). Every other table follows
--          the documented fk_[table]_[referenced_table] convention.
--          This migration renames the six offending constraints to match.
-- Rollback: Reverse each RENAME CONSTRAINT (swap old/new names).
-- ============================================================================

-- === invoices ===

ALTER TABLE invoices
  RENAME CONSTRAINT invoices_partner_company_id_fkey
  TO fk_invoices_partner_companies;

ALTER TABLE invoices
  RENAME CONSTRAINT invoices_project_id_fkey
  TO fk_invoices_projects;

ALTER TABLE invoices
  RENAME CONSTRAINT invoices_entity_id_fkey
  TO fk_invoices_entities;

ALTER TABLE invoices
  RENAME CONSTRAINT invoices_quote_id_fkey
  TO fk_invoices_quotes;

-- === invoice_items ===

ALTER TABLE invoice_items
  RENAME CONSTRAINT invoice_items_invoice_id_fkey
  TO fk_invoice_items_invoices;

ALTER TABLE invoice_items
  RENAME CONSTRAINT invoice_items_category_fkey
  TO fk_invoice_items_categories;
