-- Migration: Merge quotes table into invoices + invoice_items
-- Reason: Eliminate separate quotes table. A quote becomes an invoice with
--         comprobante_type = 'pending'. Quote items are invoice_items with a quote_date.
--         16 → 15 tables. No duplication, one record from quote to payment.

-- ============================================================
-- 1. Add new columns
-- ============================================================

-- quote_date on invoice_items: when this item was quoted (item provenance)
ALTER TABLE invoice_items ADD COLUMN quote_date DATE;

-- quote_status on invoices: quote lifecycle (null for non-quote invoices)
ALTER TABLE invoices ADD COLUMN quote_status VARCHAR(20);
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_quote_status
  CHECK (quote_status IS NULL OR quote_status IN ('pending', 'accepted', 'rejected'));

-- ============================================================
-- 2. Temporarily allow NULL partner_id for migrated quotes
-- ============================================================
ALTER TABLE invoices ALTER COLUMN partner_id DROP NOT NULL;

-- ============================================================
-- 3. Migrate existing quotes → invoices + invoice_items
-- ============================================================

-- Build a mapping table: old quote id → new invoice id
CREATE TEMP TABLE _quote_map AS
SELECT id AS quote_id, gen_random_uuid() AS new_invoice_id FROM quotes;

-- Insert invoices from quotes (one invoice per quote)
-- partner_id derived from: linked invoice or referencing invoice, else NULL
INSERT INTO invoices (
  id, direction, partner_id, project_id, entity_id, cost_type, title,
  comprobante_type, invoice_date, currency, exchange_rate, igv_rate,
  document_ref, notes, quote_status, is_active, is_auto_generated,
  created_at, updated_at
)
SELECT
  m.new_invoice_id,
  'payable',
  COALESCE(linked_inv.partner_id, referencing_inv.partner_id),
  q.project_id,
  q.entity_id,
  'project_cost',
  q.title,
  'pending',
  q.date_received,
  q.currency,
  q.exchange_rate,
  18.00,
  q.document_ref,
  q.notes,
  q.status,
  CASE WHEN q.status = 'rejected' THEN false ELSE true END,
  false,
  q.created_at,
  q.updated_at
FROM quotes q
JOIN _quote_map m ON m.quote_id = q.id
LEFT JOIN invoices linked_inv ON linked_inv.id = q.linked_invoice_id
LEFT JOIN invoices referencing_inv ON referencing_inv.quote_id = q.id;

-- Insert invoice_items from quotes (one item per quote)
INSERT INTO invoice_items (
  invoice_id, title, quantity, unit_of_measure, unit_price, subtotal, quote_date,
  created_at, updated_at
)
SELECT
  m.new_invoice_id,
  q.title,
  q.quantity,
  q.unit_of_measure,
  q.unit_price,
  q.subtotal,
  q.date_received,
  q.created_at,
  q.updated_at
FROM quotes q
JOIN _quote_map m ON m.quote_id = q.id;

DROP TABLE _quote_map;

-- ============================================================
-- 4. Mark existing invoices that referenced a quote via quote_id
-- ============================================================
UPDATE invoices SET quote_status = 'accepted'
WHERE quote_id IS NOT NULL;

-- ============================================================
-- 5. Drop dependent views, then drop quote_id from invoices
-- ============================================================

-- Drop in reverse dependency order (leaf views first)
DROP VIEW IF EXISTS v_invoices_with_loans;
DROP VIEW IF EXISTS v_obligation_calendar;
DROP VIEW IF EXISTS v_igv_position;
DROP VIEW IF EXISTS v_retencion_dashboard;
DROP VIEW IF EXISTS v_invoice_balances;
DROP VIEW IF EXISTS v_invoice_totals;

ALTER TABLE invoices DROP CONSTRAINT fk_invoices_quotes;
ALTER TABLE invoices DROP COLUMN quote_id;

-- ============================================================
-- 6. Drop quotes table + RLS + triggers
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read quotes" ON quotes;
DROP POLICY IF EXISTS "Admin users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Admin users can update quotes" ON quotes;
DROP TRIGGER IF EXISTS trg_quotes_updated_at ON quotes;
DROP TABLE quotes;

-- ============================================================
-- 7. Recreate fn_create_invoice_with_items (removed quote_id, added quote_status + quote_date)
-- ============================================================
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

  -- Insert invoice header (quote_id removed, quote_status added)
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

  -- Insert line items (quote_date added)
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

-- ============================================================
-- 8. Recreate v_invoice_totals (replace quote_id with quote_status)
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
    i.quote_status,
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
    i.entity_id, i.quote_status, i.purchase_order_id, i.cost_type,
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
  quote_status,
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
-- 9. Recreate v_invoices_with_loans (add quote_status passthrough)
-- ============================================================

-- v_invoices_with_loans selects from v_invoice_balances which selects from v_invoice_totals.
-- v_invoice_balances does NOT expose quote_status currently, but v_invoices_with_loans needs it
-- for the invoices page filtering. We need to add it to v_invoice_balances first.

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
  it.quote_status,
  it.subtotal,
  it.igv_amount,
  it.total,
  it.detraccion_amount,
  it.retencion_amount,
  -- Net amounts differ by direction
  CASE
    WHEN it.direction = 'receivable'
      THEN it.total - it.detraccion_amount - it.retencion_amount
    ELSE it.total
  END AS net_amount,
  -- Payment aggregation: convert cross-currency payments to invoice currency
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
  -- Detraccion paid: converted to invoice currency
  COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0) AS detraccion_paid,
  -- Retencion paid: always in invoice currency (no cross-currency)
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- Payable/receivable: outstanding minus remaining detraccion and retencion portions
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
  -- BDN outstanding in invoice currency (for table/modal display)
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(
    CASE WHEN p.payment_type = 'detraccion' THEN
      CASE WHEN p.currency = it.currency THEN p.amount
           ELSE ROUND(p.amount / p.exchange_rate, 2)
      END
    END
  ), 0)) AS bdn_outstanding,
  -- BDN outstanding in PEN (for Financial Position cross-currency summation)
  CASE WHEN it.currency = 'PEN' THEN
    GREATEST(0, COALESCE(it.detraccion_amount, 0)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  ELSE
    GREATEST(0,
      ROUND(COALESCE(it.detraccion_amount, 0) * it.exchange_rate, 2)
      - COALESCE(SUM(CASE WHEN p.payment_type = 'detraccion' THEN p.amount END), 0))
  END AS bdn_outstanding_pen,
  -- Payment status (accounts for unpaid BDN detraccion obligations)
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
  -- Retencion outstanding (retencion_amount minus retencion payments received)
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
  it.document_ref, it.notes, it.quote_status, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;

-- v_invoices_with_loans needs quote_status for the invoices page filter
-- It reads from v_invoice_balances which now has quote_status
-- But the UNION columns must match, so we add it
DROP VIEW IF EXISTS v_invoices_with_loans;

CREATE OR REPLACE VIEW v_invoices_with_loans
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable, all statuses)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id         AS id,
  NULL::UUID            AS loan_id,
  ib.direction,
  ib.partner_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  e.legal_name              AS entity_name,
  ib.cost_type,
  ib.title,
  ib.invoice_number,
  ib.comprobante_type,
  ib.quote_status,
  ib.document_ref,
  ib.invoice_date,
  ib.due_date,
  ib.currency,
  ib.exchange_rate,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.retencion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status,
  -- Aging: days past due (positive = overdue, negative/zero = current)
  CASE
    WHEN ib.due_date IS NOT NULL THEN (CURRENT_DATE - ib.due_date)
    ELSE 0
  END AS days_overdue,
  CASE
    WHEN ib.due_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ib.due_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ib.due_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ib.due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id

UNION ALL

-- Part 2: Loan repayment schedule entries (always payable direction, all statuses)
SELECT
  'loan'::VARCHAR       AS type,
  ls.id                 AS id,
  ls.loan_id,
  'payable'::VARCHAR    AS direction,
  l.partner_id,
  l.project_id,
  p.project_code,
  p.name                AS project_name,
  l.entity_id,
  l.lender_name         AS entity_name,
  NULL::VARCHAR         AS cost_type,
  l.purpose             AS title,
  NULL::VARCHAR         AS invoice_number,
  NULL::VARCHAR         AS comprobante_type,
  NULL::VARCHAR         AS quote_status,
  NULL::VARCHAR         AS document_ref,
  l.date_borrowed       AS invoice_date,
  ls.scheduled_date     AS due_date,
  l.currency,
  l.exchange_rate,
  NULL::NUMERIC(15,2)   AS subtotal,
  NULL::NUMERIC(15,2)   AS igv_amount,
  ls.scheduled_amount   AS total,
  NULL::NUMERIC(15,2)   AS detraccion_amount,
  NULL::NUMERIC(15,2)   AS retencion_amount,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding,
  0::NUMERIC(15,2)      AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END AS payment_status,
  CASE
    WHEN ls.scheduled_date IS NOT NULL THEN (CURRENT_DATE - ls.scheduled_date)
    ELSE 0
  END AS days_overdue,
  CASE
    WHEN ls.scheduled_date IS NULL THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 0 THEN 'current'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 30 THEN '1-30'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - ls.scheduled_date) <= 90 THEN '61-90'
    ELSE '90+'
  END::VARCHAR AS aging_bucket
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id;

-- ============================================================
-- 10. Recreate remaining dropped views (unchanged, just need to exist again)
-- ============================================================

-- v_obligation_calendar
CREATE OR REPLACE VIEW v_obligation_calendar
WITH (security_invoker = on)
AS

SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id,
  NULL::UUID             AS loan_id,
  ib.direction,
  ib.partner_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  e.legal_name              AS entity_name,
  ib.cost_type,
  ib.invoice_date       AS date,
  ib.title,
  ib.invoice_number,
  ib.currency,
  ib.exchange_rate,
  ib.document_ref,
  ib.due_date,
  (ib.due_date - CURRENT_DATE) AS days_remaining,
  ib.subtotal,
  ib.igv_amount,
  ib.total,
  ib.detraccion_amount,
  ib.amount_paid,
  ib.outstanding,
  ib.payable_or_receivable AS payable,
  ib.bdn_outstanding,
  ib.bdn_outstanding_pen,
  ib.payment_status
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id
WHERE ib.due_date IS NOT NULL
  AND ib.payment_status IN ('pending', 'partial')

UNION ALL

SELECT
  'loan'::VARCHAR        AS type,
  NULL::UUID             AS invoice_id,
  ls.loan_id,
  'payable'::VARCHAR     AS direction,
  l.partner_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  l.entity_id,
  l.lender_name          AS entity_name,
  NULL::VARCHAR          AS cost_type,
  l.date_borrowed        AS date,
  l.purpose              AS title,
  NULL::VARCHAR          AS invoice_number,
  l.currency,
  l.exchange_rate,
  NULL::VARCHAR          AS document_ref,
  ls.scheduled_date      AS due_date,
  (ls.scheduled_date - CURRENT_DATE) AS days_remaining,
  NULL::NUMERIC(15,2)    AS subtotal,
  NULL::NUMERIC(15,2)    AS igv_amount,
  ls.scheduled_amount    AS total,
  NULL::NUMERIC(15,2)    AS detraccion_amount,
  COALESCE(pay.amount_paid, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS outstanding,
  ls.scheduled_amount - COALESCE(pay.amount_paid, 0) AS payable,
  0::NUMERIC(15,2)       AS bdn_outstanding,
  0::NUMERIC(15,2)       AS bdn_outstanding_pen,
  CASE
    WHEN COALESCE(pay.amount_paid, 0) >= ls.scheduled_amount THEN 'paid'
    WHEN COALESCE(pay.amount_paid, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.amount), 0) AS amount_paid
  FROM payments pm
  WHERE pm.related_to = 'loan_schedule'
    AND pm.related_id = ls.id
    AND pm.is_active = true
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;

-- v_igv_position
CREATE OR REPLACE VIEW v_igv_position
WITH (security_invoker = on)
AS
WITH igv_collected AS (
  SELECT
    it.currency,
    COALESCE(SUM(it.igv_amount), 0) AS igv_collected
  FROM v_invoice_totals it
  WHERE it.direction = 'receivable'
  GROUP BY it.currency
),
igv_paid AS (
  SELECT
    it.currency,
    COALESCE(SUM(it.igv_amount), 0) AS igv_paid
  FROM v_invoice_totals it
  WHERE it.direction = 'payable'
    AND it.igv_amount > 0
  GROUP BY it.currency
),
all_currencies AS (
  SELECT currency FROM igv_collected
  UNION
  SELECT currency FROM igv_paid
)
SELECT
  ac.currency,
  COALESCE(ic.igv_collected, 0) AS igv_collected,
  COALESCE(ip.igv_paid, 0) AS igv_paid,
  COALESCE(ip.igv_paid, 0) - COALESCE(ic.igv_collected, 0) AS net_igv_position
FROM all_currencies ac
LEFT JOIN igv_collected ic ON ic.currency = ac.currency
LEFT JOIN igv_paid ip ON ip.currency = ac.currency
ORDER BY ac.currency;

-- v_retencion_dashboard
CREATE OR REPLACE VIEW v_retencion_dashboard
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    i.invoice_id,
    i.project_id,
    i.entity_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.subtotal,
    i.igv_rate,
    i.retencion_rate,
    i.currency,
    i.retencion_verified,
    fn_igv_amount(i.subtotal, i.igv_rate) AS igv_amount
  FROM v_invoice_totals i
  WHERE i.direction = 'receivable'
    AND i.retencion_applicable = true
),
ar_with_totals AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate) AS retencion_amount
  FROM ar_base ab
)
SELECT
  awt.invoice_id,
  p.project_code,
  e.legal_name          AS client_name,
  awt.invoice_number,
  awt.invoice_date,
  awt.due_date,
  awt.gross_total,
  awt.retencion_amount,
  awt.currency,
  awt.retencion_verified,
  (CURRENT_DATE - awt.invoice_date) AS days_since_invoice
FROM ar_with_totals awt
JOIN projects p ON p.id = awt.project_id
JOIN entities e ON e.id = awt.entity_id
ORDER BY
  awt.retencion_verified ASC,
  (CURRENT_DATE - awt.invoice_date) DESC;
