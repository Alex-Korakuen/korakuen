-- ============================================================
-- Korakuen Management System — Seed Data: Tags
-- File: 001_tags.sql
-- Date: 2026-03-01
--
-- Seeds the tags table with the 25 master tags from the schema
-- document (docs/08_schema.md, "Tags — Master List (Updated)").
--
-- Tags are the universal classification system — used for both
-- entity categorization and project roles. UUIDs auto-generate.
-- ============================================================

-- === Materials Suppliers ===

INSERT INTO tags (name, notes) VALUES
  ('concrete_supplier', 'Supplier of concrete and ready-mix products'),
  ('metal_supplier', 'Supplier of metal products — rebar, steel sheets, structural steel'),
  ('wood_supplier', 'Supplier of wood and lumber for construction'),
  ('aggregates_supplier', 'Supplier of sand, gravel, and crushed stone'),
  ('cement_supplier', 'Supplier of cement and related binding materials'),
  ('brick_supplier', 'Supplier of bricks, blocks, and masonry units'),
  ('paint_supplier', 'Supplier of paint, coatings, and finishing materials'),
  ('electrical_materials_supplier', 'Supplier of electrical materials — cables, conduits, panels'),
  ('plumbing_materials_supplier', 'Supplier of plumbing materials — pipes, fittings, fixtures'),
  ('general_materials_supplier', 'Supplier of miscellaneous construction materials not covered by other tags');

-- === Subcontractors by Trade ===

INSERT INTO tags (name, notes) VALUES
  ('electrical_subcontractor', 'Subcontractor specializing in electrical installations'),
  ('plumbing_subcontractor', 'Subcontractor specializing in plumbing and sanitary installations'),
  ('civil_works_subcontractor', 'Subcontractor for general civil works — foundations, structures, finishing'),
  ('carpentry_subcontractor', 'Subcontractor specializing in carpentry and woodwork'),
  ('steel_works_subcontractor', 'Subcontractor specializing in steel fabrication and installation');

-- === Equipment ===

INSERT INTO tags (name, notes) VALUES
  ('equipment_rental', 'Equipment rental provider — machinery, tools, scaffolding'),
  ('transport_logistics', 'Transport and logistics services — material delivery, freight');

-- === Services ===

INSERT INTO tags (name, notes) VALUES
  ('legal_services', 'Legal advisory and documentation services'),
  ('accounting_services', 'Accounting, bookkeeping, and tax advisory services'),
  ('engineering_services', 'Engineering consulting and design services'),
  ('topography_services', 'Topographic surveying and land measurement services');

-- === Other ===

INSERT INTO tags (name, notes) VALUES
  ('government_supervisor', 'Government entity or official supervising project execution'),
  ('oxi_financing_company', 'Private company financing public works under the OxI (Obras por Impuesto) framework'),
  ('client', 'Client entity — the party contracting Korakuen for project execution'),
  ('general_supplier', 'General-purpose supplier not fitting a specific material or trade category');
