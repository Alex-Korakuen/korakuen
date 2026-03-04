-- ============================================================
-- Korakuen Management System — Atomic cost creation function
-- Migration: 20260304000005
-- Date: 2026-03-04
--
-- Creates a Postgres function that inserts a cost header and
-- its line items in a single transaction. If either insert
-- fails, the entire operation rolls back — no orphan headers.
-- Called from the CLI via supabase.rpc().
-- ============================================================

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
    exchange_rate, project_id, valuation_id, entity_id, quote_id,
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
    (header_data->>'valuation_id')::UUID,
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

-- ============================================================
-- End of migration 20260304000005
-- Rollback: DROP FUNCTION fn_create_cost_with_items;
-- ============================================================
