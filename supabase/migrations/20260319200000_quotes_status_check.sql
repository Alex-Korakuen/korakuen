-- Add CHECK constraint on quotes.status to enforce valid values at DB level
ALTER TABLE quotes
  ADD CONSTRAINT chk_quotes_status
  CHECK (status IN ('pending', 'accepted', 'rejected'));
