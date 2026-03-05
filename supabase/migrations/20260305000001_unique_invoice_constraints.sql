-- ============================================================
-- Unique Invoice Number Constraints
-- Migration: 20260305000001
-- Date: 2026-03-05
--
-- Prevents duplicate invoice numbers:
-- 1. AR invoices: one invoice number per partner company
-- 2. Costs: one comprobante number per supplier entity
-- ============================================================

-- AR invoices: each partner company issues unique invoice numbers
ALTER TABLE ar_invoices
  ADD CONSTRAINT uq_ar_invoices_partner_invoice
  UNIQUE (partner_company_id, invoice_number);

-- Costs: each supplier has unique comprobante numbers
-- Partial index: only enforced when both entity_id and comprobante_number are present
-- (informal purchases without entity or comprobante are exempt)
CREATE UNIQUE INDEX uq_costs_entity_comprobante
  ON costs (entity_id, comprobante_number)
  WHERE entity_id IS NOT NULL AND comprobante_number IS NOT NULL;
