-- ============================================================================
-- Migration: RLS policies for authenticated read access
-- Purpose: Allow authenticated website users to read all tables and views
-- Note: V0 uses simple authenticated-user policies. V1 will add per-partner
--       row filtering via partner_company_id.
-- ============================================================================

-- Tables
ALTER TABLE partner_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read partner_companies"
  ON partner_companies FOR SELECT TO authenticated USING (true);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read bank_accounts"
  ON bank_accounts FOR SELECT TO authenticated USING (true);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read entities"
  ON entities FOR SELECT TO authenticated USING (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tags"
  ON tags FOR SELECT TO authenticated USING (true);

ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read entity_tags"
  ON entity_tags FOR SELECT TO authenticated USING (true);

ALTER TABLE entity_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read entity_contacts"
  ON entity_contacts FOR SELECT TO authenticated USING (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read projects"
  ON projects FOR SELECT TO authenticated USING (true);

ALTER TABLE project_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read project_entities"
  ON project_entities FOR SELECT TO authenticated USING (true);

ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read valuations"
  ON valuations FOR SELECT TO authenticated USING (true);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read quotes"
  ON quotes FOR SELECT TO authenticated USING (true);

ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read costs"
  ON costs FOR SELECT TO authenticated USING (true);

ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read cost_items"
  ON cost_items FOR SELECT TO authenticated USING (true);

ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read ar_invoices"
  ON ar_invoices FOR SELECT TO authenticated USING (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read payments"
  ON payments FOR SELECT TO authenticated USING (true);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read loans"
  ON loans FOR SELECT TO authenticated USING (true);

ALTER TABLE loan_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read loan_schedule"
  ON loan_schedule FOR SELECT TO authenticated USING (true);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read loan_payments"
  ON loan_payments FOR SELECT TO authenticated USING (true);

ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read project_budgets"
  ON project_budgets FOR SELECT TO authenticated USING (true);
