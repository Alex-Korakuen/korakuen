-- Migration: Add title to payments, drop notes from invoice_items
-- Reason: title and notes convention at header level only — no sub-item notes needed.
-- payments.title = what appears on the bank app. invoice_items.notes was always null.

-- === 1. Add title column to payments (nullable initially for backfill) ===
ALTER TABLE payments ADD COLUMN title TEXT;

-- === 2. Backfill existing payments with sensible defaults ===
UPDATE payments SET title = 'Detraccion' WHERE payment_type = 'detraccion';
UPDATE payments SET title = 'Retencion' WHERE payment_type = 'retencion';
UPDATE payments SET title = 'Pago' WHERE payment_type = 'regular' AND direction = 'outbound' AND title IS NULL;
UPDATE payments SET title = 'Cobro' WHERE payment_type = 'regular' AND direction = 'inbound' AND title IS NULL;

-- === 3. Make title NOT NULL after backfill ===
ALTER TABLE payments ALTER COLUMN title SET NOT NULL;

-- === 4. Drop notes from invoice_items ===
ALTER TABLE invoice_items DROP COLUMN notes;

-- === 5. Recreate fn_create_invoice_with_items without invoice_items.notes ===
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
  item RECORD;
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
    project_id, entity_id, quote_id,
    detraccion_rate, retencion_applicable, retencion_rate,
    comprobante_type, document_ref, due_date, notes
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
    (header_data->>'quote_id')::UUID,
    (header_data->>'detraccion_rate')::NUMERIC,
    COALESCE((header_data->>'retencion_applicable')::BOOLEAN, false),
    (header_data->>'retencion_rate')::NUMERIC,
    header_data->>'comprobante_type',
    header_data->>'document_ref',
    (header_data->>'due_date')::DATE,
    header_data->>'notes'
  )
  RETURNING id INTO new_invoice_id;

  -- Insert line items (no notes column)
  FOR item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, title, category, subtotal,
      quantity, unit_of_measure, unit_price
    )
    VALUES (
      new_invoice_id,
      item->>'title',
      item->>'category',
      (item->>'subtotal')::NUMERIC,
      (item->>'quantity')::NUMERIC,
      item->>'unit_of_measure',
      (item->>'unit_price')::NUMERIC
    );
    item_count := item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'invoice_id', new_invoice_id,
    'items_count', item_count
  );
END;
$$;

-- === 6. Recreate v_payments_enriched with title column ===
DROP VIEW IF EXISTS v_payments_enriched;

CREATE VIEW v_payments_enriched
WITH (security_invoker = on)
AS

-- Part 1: Payments related to invoices
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.title,
  p.notes,
  -- Enriched from invoice
  i.invoice_number,
  i.project_id,
  pr.project_code,
  e.legal_name              AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN invoices i ON i.id = p.related_id AND i.is_active = true
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'invoice'
  AND p.is_active = true

UNION ALL

-- Part 2: Payments related to loan schedule entries
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.title,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'loan_schedule'
  AND p.is_active = true

UNION ALL

-- Part 3: Loan disbursement payments (inflow when loan is received)
SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_id,
  p.bank_account_id,
  p.document_ref,
  p.title,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN loans l ON l.id = p.related_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'loan'
  AND p.is_active = true

ORDER BY payment_date DESC;
