-- ============================================================
-- Korakuen Management System — Indexes
-- Migration: 002
-- Date: 2026-03-01
-- ============================================================

-- === INDEXES: costs ===

CREATE INDEX idx_costs_project_id ON costs(project_id);

CREATE INDEX idx_costs_entity_id ON costs(entity_id);

CREATE INDEX idx_costs_bank_account_id ON costs(bank_account_id);

CREATE INDEX idx_costs_valuation_id ON costs(valuation_id);

-- === INDEXES: cost_items ===

CREATE INDEX idx_cost_items_cost_id ON cost_items(cost_id);

-- === INDEXES: ar_invoices ===

CREATE INDEX idx_ar_invoices_project_id ON ar_invoices(project_id);

CREATE INDEX idx_ar_invoices_entity_id ON ar_invoices(entity_id);

CREATE INDEX idx_ar_invoices_valuation_id ON ar_invoices(valuation_id);

-- === INDEXES: payments ===

CREATE INDEX idx_payments_related_id ON payments(related_id);

CREATE INDEX idx_payments_bank_account_id ON payments(bank_account_id);

-- === INDEXES: entity_tags ===

CREATE INDEX idx_entity_tags_entity_id ON entity_tags(entity_id);

CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);

-- === INDEXES: project_entities ===

CREATE INDEX idx_project_entities_project_id ON project_entities(project_id);

CREATE INDEX idx_project_entities_entity_id ON project_entities(entity_id);

-- ============================================================
-- End of migration 002
-- Rollback: DROP INDEX for each index above in reverse order
-- ============================================================
