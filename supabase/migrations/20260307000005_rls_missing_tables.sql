-- ============================================================================
-- Migration: Add missing RLS policies for project_partners and exchange_rates
-- Purpose: These tables were omitted from the original RLS migration
--          (20260303000002). Without policies, views using security_invoker
--          (e.g. v_partner_ledger) return empty results for authenticated users.
-- ============================================================================

ALTER TABLE project_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read project_partners"
  ON project_partners FOR SELECT TO authenticated USING (true);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read exchange_rates"
  ON exchange_rates FOR SELECT TO authenticated USING (true);
