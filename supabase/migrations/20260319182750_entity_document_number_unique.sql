-- Enforce uniqueness of document_number among active entities.
-- Partial index allows deactivated entities' document numbers to be reused,
-- matching the application-level check in createEntity().
CREATE UNIQUE INDEX idx_entities_document_number_active
  ON entities (document_number)
  WHERE is_active = true;
