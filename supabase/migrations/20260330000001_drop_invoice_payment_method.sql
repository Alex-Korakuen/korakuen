-- Migration: Drop payment_method from invoices table
-- Reason: payment_method belongs on payments, not invoices. An invoice can have
--         multiple payments via different methods. The payments table tracks actual
--         cash movement via bank_account_id + payment_type.
--
-- Changes:
--   1. Drop payment_method column from invoices
--   2. Recreate v_invoice_totals (remove payment_method)
--   3. Recreate v_invoice_balances (remove payment_method)
--   4. Recreate fn_create_invoice_with_items (remove payment_method from INSERT)

-- ============================================================
-- Step 1: Drop column
-- ============================================================

ALTER TABLE invoices DROP COLUMN payment_method;


-- ============================================================
-- Step 2: Recreate v_invoice_totals
-- ============================================================

CREATE OR REPLACE VIEW v_invoice_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    i.id                  AS invoice_id,
    i.direction,
    i.project_id,
    i.partner_id,
    i.entity_id,
    i.quote_id,
    i.purchase_order_id,
    i.cost_type,
    i.title,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.igv_rate,
    i.detraccion_rate,
    i.retencion_applicable,
    i.retencion_rate,
    i.retencion_verified,
    i.currency,
    i.exchange_rate,
    i.comprobante_type,
    i.document_ref,
    i.notes,
    COALESCE(SUM(ii.subtotal), 0) AS subtotal
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
  WHERE i.is_active = true
  GROUP BY
    i.id, i.direction, i.project_id, i.partner_id,
    i.entity_id, i.quote_id, i.purchase_order_id, i.cost_type,
    i.title, i.invoice_number, i.invoice_date, i.due_date,
    i.igv_rate, i.detraccion_rate, i.retencion_applicable,
    i.retencion_rate, i.retencion_verified, i.currency,
    i.exchange_rate, i.comprobante_type,
    i.document_ref, i.notes
),
with_igv AS (
  SELECT
    *,
    fn_igv_amount(subtotal, igv_rate) AS igv_amount
  FROM item_sums
)
SELECT
  invoice_id,
  direction,
  project_id,
  partner_id,
  entity_id,
  quote_id,
  purchase_order_id,
  cost_type,
  title,
  invoice_number,
  invoice_date,
  due_date,
  igv_rate,
  detraccion_rate,
  retencion_applicable,
  retencion_rate,
  retencion_verified,
  currency,
  exchange_rate,
  comprobante_type,
  document_ref,
  notes,
  subtotal,
  igv_amount,
  subtotal + igv_amount AS total,
  fn_detraccion_amount(subtotal, igv_amount, detraccion_rate) AS detraccion_amount,
  CASE WHEN retencion_applicable
    THEN fn_retencion_amount(subtotal, igv_amount, retencion_rate)
    ELSE 0
  END AS retencion_amount
FROM with_igv;


-- ============================================================
-- Step 3: Recreate v_invoice_balances
-- ============================================================

CREATE OR REPLACE VIEW v_invoice_balances
WITH (security_invoker = on)
AS
SELECT
  it.invoice_id,
  it.direction,
  it.project_id,
  it.entity_id,
  it.partner_id,
  it.cost_type,
  it.title,
  it.invoice_number,
  it.invoice_date,
  it.due_date,
  it.igv_rate,
  it.detraccion_rate,
  it.retencion_applicable,
  it.retencion_rate,
  it.retencion_verified,
  it.currency,
  it.exchange_rate,
  it.comprobante_type,
  it.document_ref,
  it.notes,
  it.subtotal,
  it.igv_amount,
  it.total,
  it.detraccion_amount,
  it.retencion_amount,
  CASE
    WHEN it.direction = 'receivable'
      THEN it.total - it.detraccion_amount - it.retencion_amount
    ELSE it.total
  END AS net_amount,
  COALESCE(SUM(
    CASE WHEN p.currency = it.currency THEN p.amount
         ELSE ROUND(p.amount / p.exchange_rate, 2)
    END
  ), 0) AS amount_paid,
  it.total - COALESCE(SUM(
    CASE WHEN p.currency = it.currency THEN p.amount
         ELSE ROUND(p.amount / p.exchange_rate, 2)
    END
  ), 0) AS outstanding,
  COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  GREATEST(0,
    it.total - COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0)
    - GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
        CASE WHEN p.payment_type = 'detraccion' THEN
          CASE WHEN p.currency = it.currency THEN p.amount
               ELSE ROUND(p.amount / p.exchange_rate, 2)
          END
        END
      ), 0))
    - GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS payable_or_receivable,
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0)) AS bdn_outstanding,
  CASE WHEN it.currency = 'PEN' THEN
    GREATEST(0, COALESCE(it.detraccion_amount, 0)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  ELSE
    GREATEST(0,
      ROUND(COALESCE(it.detraccion_amount, 0) * it.exchange_rate, 2)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  END AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    ), 0) >= it.total
      AND GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
        CASE WHEN p.payment_type = 'detraccion' THEN
          CASE WHEN p.currency = it.currency THEN p.amount
               ELSE ROUND(p.amount / p.exchange_rate, 2)
          END
        END
      ), 0)) = 0 THEN 'paid'
    ELSE 'partial'
  END AS payment_status,
  GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0)) AS retencion_outstanding
FROM v_invoice_totals it
LEFT JOIN payments p
  ON p.related_id = it.invoice_id
  AND p.related_to = 'invoice'
  AND p.is_active = true
GROUP BY
  it.invoice_id, it.direction, it.project_id, it.entity_id,
  it.partner_id, it.cost_type, it.title, it.invoice_number,
  it.invoice_date, it.due_date, it.igv_rate, it.detraccion_rate,
  it.retencion_applicable, it.retencion_rate, it.retencion_verified,
  it.currency, it.exchange_rate, it.comprobante_type,
  it.document_ref, it.notes, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;


-- ============================================================
-- Step 4: Recreate fn_create_invoice_with_items
-- ============================================================

DROP FUNCTION IF EXISTS fn_create_invoice_with_items(JSONB, JSONB);

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

  IF header_data->>'partner_id' IS NULL THEN
    RAISE EXCEPTION 'partner_id is required';
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
    direction, cost_type, partner_id, invoice_date, title,
    invoice_number, igv_rate, currency, exchange_rate, project_id,
    entity_id, quote_id, detraccion_rate, retencion_applicable,
    retencion_rate, comprobante_type, document_ref,
    due_date, notes
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
