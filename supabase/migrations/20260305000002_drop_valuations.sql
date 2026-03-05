-- ============================================================
-- Korakuen Management System — Drop valuations table
-- Migration: 20260305000001
-- Date: 2026-03-05
--
-- Removes the valuations feature entirely. Valuations were
-- dormant infrastructure (monthly billing periods) never
-- displayed on the website. AR invoices now link to projects
-- directly without an intermediate valuation record.
-- ============================================================

-- 1. Drop views that reference valuation_id (must drop before column removal)
--    Downstream views (v_cost_balances, v_ap_calendar, etc.) do NOT reference
--    valuation_id so they will auto-resolve once these are recreated.

DROP VIEW IF EXISTS v_ar_balances CASCADE;
DROP VIEW IF EXISTS v_cost_totals CASCADE;

-- 2. Recreate v_cost_totals without valuation_id

CREATE OR REPLACE VIEW v_cost_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    c.id                  AS cost_id,
    c.project_id,
    c.bank_account_id,
    c.entity_id,
    c.quote_id,
    c.purchase_order_id,
    c.cost_type,
    c.date,
    c.title,
    c.igv_rate,
    c.detraccion_rate,
    c.currency,
    c.exchange_rate,
    c.comprobante_type,
    c.comprobante_number,
    c.payment_method,
    c.document_ref,
    c.due_date,
    c.notes,
    COALESCE(SUM(ci.subtotal), 0) AS subtotal
  FROM costs c
  LEFT JOIN cost_items ci ON ci.cost_id = c.id
  GROUP BY
    c.id,
    c.project_id,
    c.bank_account_id,
    c.entity_id,
    c.quote_id,
    c.purchase_order_id,
    c.cost_type,
    c.date,
    c.title,
    c.igv_rate,
    c.detraccion_rate,
    c.currency,
    c.exchange_rate,
    c.comprobante_type,
    c.comprobante_number,
    c.payment_method,
    c.document_ref,
    c.due_date,
    c.notes
),
with_igv AS (
  SELECT
    *,
    ROUND(subtotal * (igv_rate / 100), 2) AS igv_amount
  FROM item_sums
)
SELECT
  cost_id,
  project_id,
  bank_account_id,
  entity_id,
  quote_id,
  purchase_order_id,
  cost_type,
  date,
  title,
  igv_rate,
  detraccion_rate,
  currency,
  exchange_rate,
  comprobante_type,
  comprobante_number,
  payment_method,
  document_ref,
  due_date,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount                                                    AS total,
  ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2)  AS detraccion_amount
FROM with_igv;

-- 3. Recreate v_ar_balances without valuation_id

CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.bank_account_id,
    ar.entity_id,
    ar.partner_company_id,
    ar.invoice_number,
    ar.comprobante_type,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.detraccion_rate,
    ar.retencion_applicable,
    ar.retencion_rate,
    ar.retencion_verified,
    ar.currency,
    ar.exchange_rate,
    ar.document_ref,
    ar.is_internal_settlement,
    ar.notes,
    ROUND(ar.subtotal * (ar.igv_rate / 100), 2) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    ROUND(
      (ab.subtotal + ab.igv_amount) * COALESCE(ab.detraccion_rate, 0) / 100, 2
    )                           AS detraccion_amount,
    ROUND(
      CASE
        WHEN ab.retencion_applicable
          THEN (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100
        ELSE 0
      END, 2
    )                           AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.is_internal_settlement,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount,
  ac.gross_total - ac.detraccion_amount - ac.retencion_amount AS net_receivable,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ac.gross_total - COALESCE(SUM(p.amount), 0) AS outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ac.gross_total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM ar_computed ac
LEFT JOIN payments p
  ON p.related_id = ac.ar_invoice_id
  AND p.related_to = 'ar_invoice'
GROUP BY
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
  ac.entity_id,
  ac.partner_company_id,
  ac.invoice_number,
  ac.comprobante_type,
  ac.invoice_date,
  ac.due_date,
  ac.subtotal,
  ac.igv_rate,
  ac.detraccion_rate,
  ac.retencion_applicable,
  ac.retencion_rate,
  ac.retencion_verified,
  ac.currency,
  ac.exchange_rate,
  ac.document_ref,
  ac.is_internal_settlement,
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount;

-- 4. Drop FK constraints on costs and ar_invoices

ALTER TABLE costs DROP CONSTRAINT fk_costs_valuations;
ALTER TABLE ar_invoices DROP CONSTRAINT fk_ar_invoices_valuations;

-- 5. Drop indexes

DROP INDEX IF EXISTS idx_costs_valuation_id;
DROP INDEX IF EXISTS idx_ar_invoices_valuation_id;

-- 6. Drop columns

ALTER TABLE costs DROP COLUMN valuation_id;
ALTER TABLE ar_invoices DROP COLUMN valuation_id;

-- 7. Update fn_create_cost_with_items — remove valuation_id

CREATE OR REPLACE FUNCTION fn_create_cost_with_items(
  header_data JSONB,
  items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_cost_id UUID;
  item JSONB;
  item_count INT := 0;
BEGIN
  -- Insert the cost header
  INSERT INTO costs (
    cost_type, bank_account_id, date, title, igv_rate, currency,
    exchange_rate, project_id, entity_id, quote_id,
    detraccion_rate, comprobante_type, comprobante_number,
    payment_method, document_ref, due_date, notes
  )
  VALUES (
    header_data->>'cost_type',
    (header_data->>'bank_account_id')::UUID,
    (header_data->>'date')::DATE,
    header_data->>'title',
    (header_data->>'igv_rate')::NUMERIC,
    header_data->>'currency',
    (header_data->>'exchange_rate')::NUMERIC,
    (header_data->>'project_id')::UUID,
    (header_data->>'entity_id')::UUID,
    (header_data->>'quote_id')::UUID,
    (header_data->>'detraccion_rate')::NUMERIC,
    header_data->>'comprobante_type',
    header_data->>'comprobante_number',
    header_data->>'payment_method',
    header_data->>'document_ref',
    (header_data->>'due_date')::DATE,
    header_data->>'notes'
  )
  RETURNING id INTO new_cost_id;

  -- Insert all line items
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO cost_items (
      cost_id, title, category, subtotal,
      quantity, unit_of_measure, unit_price, notes
    )
    VALUES (
      new_cost_id,
      item->>'title',
      item->>'category',
      (item->>'subtotal')::NUMERIC,
      (item->>'quantity')::NUMERIC,
      item->>'unit_of_measure',
      (item->>'unit_price')::NUMERIC,
      item->>'notes'
    );
    item_count := item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'cost_id', new_cost_id,
    'items_count', item_count
  );
END;
$$;

-- 8. Drop the valuations table and its dependencies

DROP POLICY IF EXISTS "Authenticated users can read valuations" ON valuations;
ALTER TABLE valuations DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_valuations_updated_at ON valuations;
DROP TABLE valuations;

-- ============================================================
-- End of migration 20260305000001
-- ============================================================
