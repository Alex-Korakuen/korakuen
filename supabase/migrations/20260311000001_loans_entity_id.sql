-- Migration: Add entity_id FK to loans table
-- Purpose: Link loans to entities (lenders) for proper entity management
-- Backwards compatible: nullable column, existing loans keep lender_name as-is

ALTER TABLE loans
ADD COLUMN entity_id UUID;

ALTER TABLE loans
ADD CONSTRAINT fk_loans_entities
  FOREIGN KEY (entity_id)
  REFERENCES entities(id)
  ON DELETE RESTRICT;
