-- Fix: Remove duplicate RLS read policy on exchange_rates
-- Migration 20260304000008 created "Authenticated users can read exchange rates"
-- Migration 20260307000005 created "Authenticated users can read exchange_rates" (duplicate)
-- Rollback: CREATE POLICY "Authenticated users can read exchange_rates" ON exchange_rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read exchange_rates" ON exchange_rates;
