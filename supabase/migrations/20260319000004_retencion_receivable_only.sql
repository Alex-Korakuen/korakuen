-- Enforce business rule: retencion applies to receivable invoices only.
-- Korakuen is NOT a retencion agent — only clients withhold retencion from Korakuen.

-- 1. Safety: clear any accidental retencion flags on existing payables
UPDATE invoices
SET retencion_applicable = false,
    retencion_rate = NULL,
    retencion_verified = false
WHERE direction = 'payable'
  AND retencion_applicable = true;

-- 2. Add CHECK constraint
ALTER TABLE invoices
  ADD CONSTRAINT chk_retencion_receivable_only
  CHECK (direction = 'receivable' OR retencion_applicable = false);

-- 3. Add validation to fn_create_invoice_with_items
CREATE OR REPLACE FUNCTION fn_create_invoice_with_items(
  header_data JSONB,
  items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_invoice_id UUID;
  item JSONB;
  item_count INT := 0;
  item_idx INT := 0;
BEGIN
  -- Validate required header fields
  IF header_data->>'direction' IS NULL
     OR header_data->>'direction' NOT IN ('payable', 'receivable') THEN
    RAISE EXCEPTION 'direction must be payable or receivable';
  END IF;

  IF header_data->>'partner_company_id' IS NULL THEN
    RAISE EXCEPTION 'partner_company_id is required';
  END IF;

  IF header_data->>'invoice_date' IS NULL THEN
    RAISE EXCEPTION 'invoice_date is required';
  END IF;

  IF header_data->>'currency' IS NULL
     OR header_data->>'currency' NOT IN ('PEN', 'USD') THEN
    RAISE EXCEPTION 'currency must be PEN or USD';
  END IF;

  IF header_data->>'exchange_rate' IS NULL THEN
    RAISE EXCEPTION 'exchange_rate is required';
  END IF;

  -- Retencion only on receivables
  IF header_data->>'direction' = 'payable'
     AND COALESCE((header_data->>'retencion_applicable')::BOOLEAN, false) = true THEN
    RAISE EXCEPTION 'retencion_applicable cannot be true for payable invoices';
  END IF;

  -- Validate items array is present and non-empty
  IF items_data IS NULL OR jsonb_array_length(items_data) = 0 THEN
    RAISE EXCEPTION 'items_data must contain at least one item';
  END IF;

  -- Validate each item has required fields
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    item_idx := item_idx + 1;
    IF item->>'title' IS NULL OR item->>'title' = '' THEN
      RAISE EXCEPTION 'item % title is required', item_idx;
    END IF;
    IF item->>'subtotal' IS NULL THEN
      RAISE EXCEPTION 'item % subtotal is required', item_idx;
    END IF;
  END LOOP;

  -- Insert invoice header
  INSERT INTO invoices (
    direction, cost_type, partner_company_id, invoice_date, title,
    invoice_number, igv_rate, currency, exchange_rate, project_id,
    entity_id, quote_id, detraccion_rate, retencion_applicable,
    retencion_rate, comprobante_type, payment_method, document_ref,
    due_date, notes
  )
  VALUES (
    header_data->>'direction',
    header_data->>'cost_type',
    (header_data->>'partner_company_id')::UUID,
    (header_data->>'invoice_date')::DATE,
    header_data->>'title',
    header_data->>'invoice_number',
    (header_data->>'igv_rate')::NUMERIC,
    header_data->>'currency',
    (header_data->>'exchange_rate')::NUMERIC,
    (header_data->>'project_id')::UUID,
    (header_data->>'entity_id')::UUID,
    (header_data->>'quote_id')::UUID,
    (header_data->>'detraccion_rate')::NUMERIC,
    COALESCE((header_data->>'retencion_applicable')::BOOLEAN, false),
    (header_data->>'retencion_rate')::NUMERIC,
    header_data->>'comprobante_type',
    header_data->>'payment_method',
    header_data->>'document_ref',
    (header_data->>'due_date')::DATE,
    header_data->>'notes'
  )
  RETURNING id INTO new_invoice_id;

  -- Insert line items
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, title, category, subtotal,
      quantity, unit_of_measure, unit_price, notes
    )
    VALUES (
      new_invoice_id,
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
    'invoice_id', new_invoice_id,
    'items_count', item_count
  );
END;
$$;
