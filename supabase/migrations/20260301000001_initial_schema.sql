-- ============================================================
-- Korakuen Management System — Initial Schema
-- Migration: 001
-- Date: 2026-03-01
-- ============================================================

-- === SHARED TRIGGER FUNCTION ===

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';


-- === TABLE: partner_companies ===
-- The three partner companies. Referenced on every financial transaction.

CREATE TABLE partner_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                          -- legal company name
  ruc VARCHAR(11) NOT NULL,                            -- Peruvian company tax ID
  owner_name VARCHAR(255) NOT NULL,                    -- partner's full name
  owner_document_type VARCHAR(50) NOT NULL,            -- RUC, DNI, CE, Pasaporte
  owner_document_number VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  bank_tracking_full BOOLEAN NOT NULL DEFAULT false,   -- true for Alex, false for other partners
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_partner_companies_updated_at
  BEFORE UPDATE ON partner_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: bank_accounts ===
-- All bank accounts used for project transactions. Belongs to a partner company.

CREATE TABLE bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_company_id UUID NOT NULL,
  bank_name VARCHAR(255) NOT NULL,                     -- BCP, Interbank, BBVA, Scotiabank, Banco de la Nación, etc.
  account_number_last4 VARCHAR(4) NOT NULL,            -- last 4 digits only for reference
  account_type VARCHAR(50) NOT NULL,                   -- checking, savings, detraccion
  currency VARCHAR(3) NOT NULL,                        -- USD or PEN
  is_detraccion_account BOOLEAN NOT NULL DEFAULT false, -- true for Banco de la Nación detracción accounts
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_bank_accounts_partner_companies
    FOREIGN KEY (partner_company_id)
    REFERENCES partner_companies(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: entities ===
-- Every external party Korakuen does business with — companies and individuals.

CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,                    -- company, individual
  document_type VARCHAR(50) NOT NULL,                  -- RUC, DNI, CE, Pasaporte
  document_number VARCHAR(50) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,                    -- razón social or full legal name
  common_name VARCHAR(255),                            -- how you refer to them day to day
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: tags ===
-- Master list of all valid categorization tags. Used for entity tags and project roles.

CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,                   -- snake_case e.g. "cement_supplier"
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: entity_tags ===
-- Bridge table linking entities to tags. Many-to-many.
-- No updated_at or is_active — tag assignments are deleted and recreated.

CREATE TABLE entity_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_entity_tags_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_entity_tags_tags
    FOREIGN KEY (tag_id)
    REFERENCES tags(id)
    ON DELETE RESTRICT
);

-- No updated_at trigger for entity_tags


-- === TABLE: entity_contacts ===
-- People associated with an entity. For individuals: the person themselves (flagged primary).

CREATE TABLE entity_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(255),                                   -- e.g. "Sales Manager", "Project Manager"
  phone VARCHAR(50),
  email VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT false,           -- flags the main contact for this entity
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_entity_contacts_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_entity_contacts_updated_at
  BEFORE UPDATE ON entity_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: projects ===
-- Every construction project. The anchor for all financial data.

CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL UNIQUE,            -- auto sequential e.g. PRY001
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) NOT NULL,                   -- subcontractor, oxi
  status VARCHAR(50) NOT NULL,                         -- prospect, active, completed, cancelled
  client_entity_id UUID,                               -- nullable for prospects
  contract_value NUMERIC(15,2),                        -- total value client will pay
  contract_currency VARCHAR(3),                        -- USD or PEN
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,                                -- populated on completion
  location VARCHAR(255),                               -- region or city in Peru
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_projects_entities
    FOREIGN KEY (client_entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: project_entities ===
-- Bridge table linking entities to projects with a specific role (via tags).

CREATE TABLE project_entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  tag_id UUID NOT NULL,                                -- the role on this project, references tags
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_project_entities_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_project_entities_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_project_entities_tags
    FOREIGN KEY (tag_id)
    REFERENCES tags(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_project_entities_updated_at
  BEFORE UPDATE ON project_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: valuations ===
-- Monthly billing periods per project. Groups costs for invoicing.

CREATE TABLE valuations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  valuation_number INTEGER NOT NULL,                   -- sequential per project — 1, 2, 3...
  period_month INTEGER NOT NULL,                       -- 1-12
  period_year INTEGER NOT NULL,                        -- e.g. 2026
  status VARCHAR(50) NOT NULL,                         -- open, closed
  billed_value NUMERIC(15,2),                          -- amount actually invoiced
  billed_currency VARCHAR(3),                          -- USD or PEN
  date_closed DATE,                                    -- populated when status changes to closed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_valuations_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_valuations_updated_at
  BEFORE UPDATE ON valuations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: quotes ===
-- Quotes received from suppliers and subcontractors before committing to a purchase.

CREATE TABLE quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  date_received DATE NOT NULL,
  title TEXT NOT NULL,
  quantity NUMERIC(15,4),
  unit_of_measure VARCHAR(50),                         -- meters, units, hours, kg, etc.
  unit_price NUMERIC(15,4),
  subtotal NUMERIC(15,2) NOT NULL,
  igv_amount NUMERIC(15,2),
  total NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,                        -- USD or PEN
  exchange_rate NUMERIC(10,4),                         -- reference only
  status VARCHAR(50) NOT NULL,                         -- pending, accepted, rejected
  linked_cost_id UUID,                                 -- populated when accepted, references costs
  document_ref VARCHAR(100),                           -- e.g. PRY001-QT-001
  notes TEXT,                                          -- reason for rejection or other context
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_quotes_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_quotes_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT
);

-- Note: fk_quotes_costs for linked_cost_id is not added here to avoid
-- circular dependency (costs also references quotes). Application-level reference only.

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: costs ===
-- One row per invoice or cash movement. Header only — line items in cost_items.
-- Totals and payment status are never stored — always derived via views.

CREATE TABLE costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID,                                     -- null if SG&A
  valuation_id UUID,                                   -- null if SG&A or untagged
  bank_account_id UUID NOT NULL,                       -- partner derived from this
  entity_id UUID,                                      -- null if informal/unassigned
  quote_id UUID,                                       -- null if no prior quote
  purchase_order_id UUID,                              -- reserved for future PO module — always null in V0
  cost_type VARCHAR(50) NOT NULL,                      -- project_cost, sga
  date DATE NOT NULL,
  title TEXT NOT NULL,
  igv_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,        -- Peru VAT, editable per transaction
  detraccion_rate NUMERIC(5,2),                        -- percentage, null if not applicable
  currency VARCHAR(3) NOT NULL,                        -- USD or PEN
  exchange_rate NUMERIC(10,4),                         -- reference only
  comprobante_type VARCHAR(50),                        -- factura, boleta, recibo_por_honorarios
  comprobante_number VARCHAR(100),                     -- e.g. F001-00234
  document_ref VARCHAR(100),                           -- e.g. PRY001-AP-001 — links to SharePoint PDF
  due_date DATE,                                       -- feeds AP payment calendar
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_costs_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_costs_valuations
    FOREIGN KEY (valuation_id)
    REFERENCES valuations(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_costs_bank_accounts
    FOREIGN KEY (bank_account_id)
    REFERENCES bank_accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_costs_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_costs_quotes
    FOREIGN KEY (quote_id)
    REFERENCES quotes(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_costs_updated_at
  BEFORE UPDATE ON costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: cost_items ===
-- Line items for costs. Category lives here, not on the header.

CREATE TABLE cost_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_id UUID NOT NULL,
  title TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,                       -- materials, labor, subcontractor, equipment_rental, permits_regulatory, software_licenses, partner_compensation, business_development, professional_services, office_admin, other
  quantity NUMERIC(15,4),                              -- null for lump sum lines
  unit_of_measure VARCHAR(50),                         -- meters, units, hours, kg, days, etc.
  unit_price NUMERIC(15,4),                            -- null for lump sum lines
  subtotal NUMERIC(15,2) NOT NULL,                     -- quantity × unit_price or entered directly
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cost_items_costs
    FOREIGN KEY (cost_id)
    REFERENCES costs(id)
    ON DELETE CASCADE
);

CREATE TRIGGER trg_cost_items_updated_at
  BEFORE UPDATE ON cost_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: ar_invoices ===
-- Invoices sent to clients. One per valuation. Subtotal entered directly.

CREATE TABLE ar_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  valuation_id UUID NOT NULL,
  bank_account_id UUID NOT NULL,                       -- regular receipt account
  entity_id UUID NOT NULL,                             -- the client
  partner_company_id UUID NOT NULL,                    -- who issued the invoice
  invoice_number VARCHAR(100) NOT NULL,                -- own numbering from Alegra/Contasis
  comprobante_type VARCHAR(50) NOT NULL,               -- always factura for construction AR
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(15,2) NOT NULL,                     -- entered directly from valuation billed value
  igv_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,        -- Peru VAT
  detraccion_rate NUMERIC(5,2),                        -- editable, null if not applicable
  retencion_applicable BOOLEAN NOT NULL DEFAULT false,  -- Korakuen is NOT a retencion agent
  retencion_rate NUMERIC(5,2),                         -- default 3 if applicable
  currency VARCHAR(3) NOT NULL,                        -- USD or PEN
  exchange_rate NUMERIC(10,4),                         -- reference only
  document_ref VARCHAR(100),                           -- e.g. PRY001-AR-001
  is_internal_settlement BOOLEAN NOT NULL DEFAULT false, -- true when invoicing a partner company
  retencion_verified BOOLEAN NOT NULL DEFAULT false,     -- manually set to true once confirmed that client paid retencion to SUNAT
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ar_invoices_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_ar_invoices_valuations
    FOREIGN KEY (valuation_id)
    REFERENCES valuations(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_ar_invoices_bank_accounts
    FOREIGN KEY (bank_account_id)
    REFERENCES bank_accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_ar_invoices_entities
    FOREIGN KEY (entity_id)
    REFERENCES entities(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_ar_invoices_partner_companies
    FOREIGN KEY (partner_company_id)
    REFERENCES partner_companies(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_ar_invoices_updated_at
  BEFORE UPDATE ON ar_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === TABLE: payments ===
-- Unified payments table. Every actual movement of money — inbound and outbound.

CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  related_to VARCHAR(50) NOT NULL,                     -- cost, ar_invoice
  related_id UUID NOT NULL,                            -- the specific cost or AR invoice ID
  direction VARCHAR(50) NOT NULL,                      -- inbound, outbound
  payment_type VARCHAR(50) NOT NULL,                   -- regular, detraccion, retencion
  payment_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,                       -- in natural currency
  currency VARCHAR(3) NOT NULL,                        -- USD or PEN
  exchange_rate NUMERIC(10,4),                         -- reference only
  bank_account_id UUID,                                -- nullable — retencion never hits an account
  partner_company_id UUID NOT NULL,                    -- which partner's account was involved
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_payments_bank_accounts
    FOREIGN KEY (bank_account_id)
    REFERENCES bank_accounts(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_payments_partner_companies
    FOREIGN KEY (partner_company_id)
    REFERENCES partner_companies(id)
    ON DELETE RESTRICT
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- End of migration 001
-- Rollback: DROP all tables in reverse order, then DROP FUNCTION update_updated_at()
-- ============================================================

-- TODO (V1): Add Row Level Security (RLS) policies when Supabase Auth is enabled.
-- V0 has no authentication — all three partners share full read access via anon key.
-- When auth is added, restrict anon key access to read-only on views only.
