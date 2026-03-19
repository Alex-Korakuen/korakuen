-- Migration: Add soft-delete support to invoices (matches payments.is_active pattern)
-- Also adds DELETE policy on invoice_items (needed for edit: delete-and-reinsert items)

-- 1. Add is_active column to invoices
ALTER TABLE invoices ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Add DELETE policy on invoice_items
CREATE POLICY "Authenticated users can delete invoice_items"
  ON invoice_items FOR DELETE TO authenticated USING (true);
