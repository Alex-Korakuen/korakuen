-- RLS INSERT / UPDATE / DELETE policies for website data entry
-- All writable tables get INSERT + UPDATE for authenticated users.
-- entity_tags gets DELETE (junction table, no soft-delete column).

-- entities
CREATE POLICY "Authenticated users can insert entities"
  ON entities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update entities"
  ON entities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- entity_tags (junction — also needs DELETE)
CREATE POLICY "Authenticated users can insert entity_tags"
  ON entity_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete entity_tags"
  ON entity_tags FOR DELETE TO authenticated USING (true);

-- entity_contacts
CREATE POLICY "Authenticated users can insert entity_contacts"
  ON entity_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update entity_contacts"
  ON entity_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- projects
CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projects"
  ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- project_partners
CREATE POLICY "Authenticated users can insert project_partners"
  ON project_partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project_partners"
  ON project_partners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- project_entities
CREATE POLICY "Authenticated users can insert project_entities"
  ON project_entities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project_entities"
  ON project_entities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- project_budgets
CREATE POLICY "Authenticated users can insert project_budgets"
  ON project_budgets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project_budgets"
  ON project_budgets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- quotes
CREATE POLICY "Authenticated users can insert quotes"
  ON quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quotes"
  ON quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- costs
CREATE POLICY "Authenticated users can insert costs"
  ON costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update costs"
  ON costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- cost_items
CREATE POLICY "Authenticated users can insert cost_items"
  ON cost_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cost_items"
  ON cost_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ar_invoices
CREATE POLICY "Authenticated users can insert ar_invoices"
  ON ar_invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ar_invoices"
  ON ar_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- payments
CREATE POLICY "Authenticated users can insert payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments"
  ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- bank_accounts
CREATE POLICY "Authenticated users can insert bank_accounts"
  ON bank_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update bank_accounts"
  ON bank_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- loans
CREATE POLICY "Authenticated users can insert loans"
  ON loans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update loans"
  ON loans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- loan_schedule
CREATE POLICY "Authenticated users can insert loan_schedule"
  ON loan_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update loan_schedule"
  ON loan_schedule FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- loan_payments
CREATE POLICY "Authenticated users can insert loan_payments"
  ON loan_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update loan_payments"
  ON loan_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
