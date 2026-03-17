-- Fix: set search_path on fn_create_invoice_with_items to prevent
-- schema injection (Supabase linter: function_search_path_mutable)

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
BEGIN
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
