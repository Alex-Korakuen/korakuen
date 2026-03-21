-- Migration: Restrict write access to admin users only
-- Partners get read-only access; only users with app_metadata.role = 'admin' can write.
-- Requires: Set {"role": "admin"} in app_metadata for admin users via Supabase Dashboard.

-- ============================================================
-- Step 1: Helper function
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ============================================================
-- Step 2: Drop all existing write policies
-- ============================================================

-- entities
DROP POLICY IF EXISTS "Authenticated users can insert entities" ON entities;
DROP POLICY IF EXISTS "Authenticated users can update entities" ON entities;

-- entity_tags
DROP POLICY IF EXISTS "Authenticated users can insert entity_tags" ON entity_tags;
DROP POLICY IF EXISTS "Authenticated users can delete entity_tags" ON entity_tags;

-- entity_contacts
DROP POLICY IF EXISTS "Authenticated users can insert entity_contacts" ON entity_contacts;
DROP POLICY IF EXISTS "Authenticated users can update entity_contacts" ON entity_contacts;

-- projects
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON projects;

-- project_partners
DROP POLICY IF EXISTS "Authenticated users can insert project_partners" ON project_partners;
DROP POLICY IF EXISTS "Authenticated users can update project_partners" ON project_partners;

-- project_budgets
DROP POLICY IF EXISTS "Authenticated users can insert project_budgets" ON project_budgets;
DROP POLICY IF EXISTS "Authenticated users can update project_budgets" ON project_budgets;

-- quotes
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON quotes;

-- payments
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;

-- bank_accounts
DROP POLICY IF EXISTS "Authenticated users can insert bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Authenticated users can update bank_accounts" ON bank_accounts;

-- loans
DROP POLICY IF EXISTS "Authenticated users can insert loans" ON loans;
DROP POLICY IF EXISTS "Authenticated users can update loans" ON loans;

-- loan_schedule
DROP POLICY IF EXISTS "Authenticated users can insert loan_schedule" ON loan_schedule;
DROP POLICY IF EXISTS "Authenticated users can update loan_schedule" ON loan_schedule;

-- invoices
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON invoices;

-- invoice_items
DROP POLICY IF EXISTS "Authenticated users can insert invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated users can update invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Authenticated users can delete invoice_items" ON invoice_items;

-- ============================================================
-- Step 3: Recreate write policies — admin only
-- ============================================================

-- entities
CREATE POLICY "Admin users can insert entities"
  ON entities FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update entities"
  ON entities FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- entity_tags (junction — also needs DELETE)
CREATE POLICY "Admin users can insert entity_tags"
  ON entity_tags FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can delete entity_tags"
  ON entity_tags FOR DELETE TO authenticated USING (is_admin());

-- entity_contacts
CREATE POLICY "Admin users can insert entity_contacts"
  ON entity_contacts FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update entity_contacts"
  ON entity_contacts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- projects
CREATE POLICY "Admin users can insert projects"
  ON projects FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update projects"
  ON projects FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- project_partners
CREATE POLICY "Admin users can insert project_partners"
  ON project_partners FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update project_partners"
  ON project_partners FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- project_budgets
CREATE POLICY "Admin users can insert project_budgets"
  ON project_budgets FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update project_budgets"
  ON project_budgets FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- quotes
CREATE POLICY "Admin users can insert quotes"
  ON quotes FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update quotes"
  ON quotes FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- payments
CREATE POLICY "Admin users can insert payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update payments"
  ON payments FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- bank_accounts
CREATE POLICY "Admin users can insert bank_accounts"
  ON bank_accounts FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update bank_accounts"
  ON bank_accounts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- loans
CREATE POLICY "Admin users can insert loans"
  ON loans FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update loans"
  ON loans FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- loan_schedule
CREATE POLICY "Admin users can insert loan_schedule"
  ON loan_schedule FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update loan_schedule"
  ON loan_schedule FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- invoices
CREATE POLICY "Admin users can insert invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update invoices"
  ON invoices FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- invoice_items
CREATE POLICY "Admin users can insert invoice_items"
  ON invoice_items FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin users can update invoice_items"
  ON invoice_items FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin users can delete invoice_items"
  ON invoice_items FOR DELETE TO authenticated USING (is_admin());
