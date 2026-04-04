-- Migration: Fix fn_create_invoice_with_items items loop
-- The `item` loop variable was declared as RECORD on 2026-03-30, but the
-- body uses the JSONB `->>` operator to extract fields. Postgres has no
-- `record ->> text` operator, so every call to this RPC that iterates
-- items fails with: operator does not exist: record ->> unknown.
-- Restore `item JSONB` so `item->>'title'` resolves correctly.

CREATE OR REPLACE FUNCTION fn_create_invoice_with_items(
  header_data JSONB,
  items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_invoice_id UUID;
  item JSONB;
  item_count INT := 0;
  v_direction TEXT;
  v_retencion_applicable BOOLEAN;
BEGIN
  v_direction := header_data->>'direction';
  v_retencion_applicable := COALESCE((header_data->>'retencion_applicable')::BOOLEAN, false);

  -- Validate: retencion fields only allowed on receivable
  IF v_direction = 'payable' AND v_retencion_applicable = true THEN
    RAISE EXCEPTION 'retencion_applicable cannot be true for payable invoices';
  END IF;

  IF v_direction = 'payable' AND header_data->>'retencion_rate' IS NOT NULL THEN
    RAISE EXCEPTION 'retencion_rate must be null for payable invoices';
  END IF;

  -- Validate: at least one item
  IF jsonb_array_length(items_data) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Insert invoice header
  INSERT INTO invoices (
    direction, cost_type, partner_id, invoice_date, title,
    invoice_number, igv_rate, currency, exchange_rate,
    project_id, entity_id,
    detraccion_rate, retencion_applicable, retencion_rate,
    comprobante_type, document_ref, due_date, notes,
    quote_status
  )
  VALUES (
    header_data->>'direction',
    header_data->>'cost_type',
    (header_data->>'partner_id')::UUID,
    (header_data->>'invoice_date')::DATE,
    header_data->>'title',
    header_data->>'invoice_number',
    (header_data->>'igv_rate')::NUMERIC,
    header_data->>'currency',
    (header_data->>'exchange_rate')::NUMERIC,
    (header_data->>'project_id')::UUID,
    (header_data->>'entity_id')::UUID,
    (header_data->>'detraccion_rate')::NUMERIC,
    COALESCE((header_data->>'retencion_applicable')::BOOLEAN, false),
    (header_data->>'retencion_rate')::NUMERIC,
    header_data->>'comprobante_type',
    header_data->>'document_ref',
    (header_data->>'due_date')::DATE,
    header_data->>'notes',
    header_data->>'quote_status'
  )
  RETURNING id INTO new_invoice_id;

  -- Insert line items
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, title, category, subtotal,
      quantity, unit_of_measure, unit_price, quote_date
    )
    VALUES (
      new_invoice_id,
      item->>'title',
      item->>'category',
      (item->>'subtotal')::NUMERIC,
      (item->>'quantity')::NUMERIC,
      item->>'unit_of_measure',
      (item->>'unit_price')::NUMERIC,
      (item->>'quote_date')::DATE
    );
    item_count := item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'invoice_id', new_invoice_id,
    'items_count', item_count
  );
END;
$$;
