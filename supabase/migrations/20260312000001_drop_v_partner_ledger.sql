-- Drop v_partner_ledger view
-- Settlement logic is computed in application layer (queries.ts) using v_cost_totals directly.
-- The view is no longer referenced anywhere in the codebase.

DROP VIEW IF EXISTS v_partner_ledger;
