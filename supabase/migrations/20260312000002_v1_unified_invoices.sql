-- Migration: V1 Unified Invoice Model
-- Merges costs + ar_invoices into a single invoices table with direction column.
-- Merges cost_items into invoice_items.
-- Updates payments.related_to references.
-- Renames quotes.linked_cost_id to linked_invoice_id.
-- Recreates all affected views.
-- Drops old tables, functions, and artifacts.
-- See docs/15_v1_restructure.md and docs/16_v1_migration_plan.md.

-- ============================================================
-- Step 1: Create invoices table
-- ============================================================

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction           VARCHAR NOT NULL CHECK (direction IN ('payable', 'receivable')),
  partner_company_id  UUID NOT NULL REFERENCES partner_companies(id) ON DELETE RESTRICT,
  project_id          UUID REFERENCES projects(id) ON DELETE RESTRICT,
  entity_id           UUID REFERENCES entities(id) ON DELETE RESTRICT,
  quote_id            UUID REFERENCES quotes(id) ON DELETE RESTRICT,
  purchase_order_id   UUID,

  cost_type           VARCHAR CHECK (cost_type IN ('project_cost', 'sga')),
  title               TEXT,
  invoice_number      VARCHAR(100),
  document_ref        VARCHAR(100),
  comprobante_type    VARCHAR(50),

  invoice_date        DATE NOT NULL,
  due_date            DATE,

  currency            VARCHAR(3) NOT NULL CHECK (currency IN ('PEN', 'USD')),
  exchange_rate       NUMERIC(10,4) NOT NULL,

  igv_rate            NUMERIC(5,2) NOT NULL DEFAULT 18,
  detraccion_rate     NUMERIC(5,2),
  retencion_applicable BOOLEAN DEFAULT false,
  retencion_rate      NUMERIC(5,2),
  retencion_verified  BOOLEAN DEFAULT false,
  payment_method      VARCHAR,

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Step 2: Create invoice_items table
-- ============================================================

CREATE TABLE invoice_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  category            VARCHAR(50) REFERENCES categories(name),
  quantity            NUMERIC(15,4),
  unit_of_measure     VARCHAR,
  unit_price          NUMERIC(15,4),
  subtotal            NUMERIC(15,2) NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Step 3: Triggers
-- ============================================================

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Step 4: Indexes
-- ============================================================

CREATE INDEX idx_invoices_project_id ON invoices(project_id);
CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
CREATE INDEX idx_invoices_partner_company_id ON invoices(partner_company_id);
CREATE INDEX idx_invoices_direction ON invoices(direction);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================================
-- Step 5: RLS policies
-- ============================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read invoices"
  ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read invoice_items"
  ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoices"
  ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can insert invoice_items"
  ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoice_items"
  ON invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Step 6: Migrate data — payable invoices (from costs)
-- ============================================================

INSERT INTO invoices (
  id, direction, partner_company_id, project_id, entity_id, quote_id,
  purchase_order_id, cost_type, title, invoice_number, document_ref,
  comprobante_type, invoice_date, due_date, currency, exchange_rate,
  igv_rate, detraccion_rate, payment_method, notes, created_at, updated_at
)
SELECT
  id, 'payable', partner_company_id, project_id, entity_id, quote_id,
  purchase_order_id, cost_type, title, comprobante_number, document_ref,
  comprobante_type, date, due_date, currency, exchange_rate,
  igv_rate, detraccion_rate, payment_method, notes, created_at, updated_at
FROM costs;

-- ============================================================
-- Step 7: Migrate data — invoice items (from cost_items)
-- ============================================================

INSERT INTO invoice_items (
  id, invoice_id, title, category, quantity, unit_of_measure,
  unit_price, subtotal, notes, created_at, updated_at
)
SELECT
  id, cost_id, title, category, quantity, unit_of_measure,
  unit_price, subtotal, notes, created_at, updated_at
FROM cost_items;

-- ============================================================
-- Step 8: Migrate data — receivable invoices (from ar_invoices)
-- ============================================================

INSERT INTO invoices (
  id, direction, partner_company_id, project_id, entity_id,
  invoice_number, document_ref, comprobante_type, invoice_date,
  due_date, currency, exchange_rate, igv_rate, detraccion_rate,
  retencion_applicable, retencion_rate, retencion_verified,
  notes, created_at, updated_at
)
SELECT
  id, 'receivable', partner_company_id, project_id, entity_id,
  invoice_number, document_ref, comprobante_type, invoice_date,
  due_date, currency, exchange_rate, igv_rate, detraccion_rate,
  retencion_applicable, retencion_rate, retencion_verified,
  notes, created_at, updated_at
FROM ar_invoices;

-- Synthetic line items for AR invoices (AR had no items in V0)
INSERT INTO invoice_items (invoice_id, title, subtotal, quantity, unit_price)
SELECT
  id,
  COALESCE(invoice_number, 'Invoice amount'),
  subtotal,
  1,
  subtotal
FROM ar_invoices;

-- ============================================================
-- Step 9: Update payments references
-- ============================================================

UPDATE payments
SET related_to = 'invoice'
WHERE related_to IN ('cost', 'ar_invoice');

-- ============================================================
-- Step 10: Update quotes reference
-- ============================================================

ALTER TABLE quotes RENAME COLUMN linked_cost_id TO linked_invoice_id;

-- ============================================================
-- Step 11: Drop dependent views (before dropping old tables)
-- ============================================================

DROP VIEW IF EXISTS v_ap_calendar CASCADE;
DROP VIEW IF EXISTS v_entity_transactions CASCADE;
DROP VIEW IF EXISTS v_igv_position CASCADE;
DROP VIEW IF EXISTS v_cost_balances CASCADE;
DROP VIEW IF EXISTS v_cost_totals CASCADE;
DROP VIEW IF EXISTS v_ar_balances CASCADE;
DROP VIEW IF EXISTS v_retencion_dashboard CASCADE;
DROP VIEW IF EXISTS v_budget_vs_actual CASCADE;

-- ============================================================
-- Step 12: Drop old RPC function
-- ============================================================

DROP FUNCTION IF EXISTS fn_create_cost_with_items(JSONB, JSONB);

-- ============================================================
-- Step 13: Drop old tables (CASCADE handles triggers, indexes, FKs, RLS)
-- ============================================================

DROP TABLE IF EXISTS cost_items CASCADE;
DROP TABLE IF EXISTS costs CASCADE;
DROP TABLE IF EXISTS ar_invoices CASCADE;

-- ============================================================
-- Step 14: Create new RPC function
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_invoice_with_items(
  header_data JSONB,
  items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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

-- ============================================================
-- Step 15: Recreate views — v_invoice_totals (replaces v_cost_totals)
-- ============================================================

CREATE OR REPLACE VIEW v_invoice_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    i.id                  AS invoice_id,
    i.direction,
    i.project_id,
    i.partner_company_id,
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
    i.payment_method,
    i.document_ref,
    i.notes,
    COALESCE(SUM(ii.subtotal), 0) AS subtotal
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
  GROUP BY
    i.id, i.direction, i.project_id, i.partner_company_id,
    i.entity_id, i.quote_id, i.purchase_order_id, i.cost_type,
    i.title, i.invoice_number, i.invoice_date, i.due_date,
    i.igv_rate, i.detraccion_rate, i.retencion_applicable,
    i.retencion_rate, i.retencion_verified, i.currency,
    i.exchange_rate, i.comprobante_type, i.payment_method,
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
  partner_company_id,
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
  payment_method,
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
-- Step 16: Recreate views — v_invoice_balances (replaces v_cost_balances + v_ar_balances)
-- ============================================================

CREATE OR REPLACE VIEW v_invoice_balances
WITH (security_invoker = on)
AS
SELECT
  it.invoice_id,
  it.direction,
  it.project_id,
  it.entity_id,
  it.partner_company_id,
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
  it.payment_method,
  it.document_ref,
  it.notes,
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
  -- Payment aggregation
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  it.total - COALESCE(SUM(p.amount), 0) AS outstanding,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  -- Payable/receivable: outstanding minus remaining detraccion and retencion portions
  GREATEST(0,
    it.total - COALESCE(SUM(p.amount), 0)
    - GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0))
    - GREATEST(0, it.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS payable_or_receivable,
  -- BDN outstanding: detraccion amount minus what's been paid as detraccion
  GREATEST(0, COALESCE(it.detraccion_amount, 0) - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0)) AS bdn_outstanding,
  -- Payment status
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= it.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM v_invoice_totals it
LEFT JOIN payments p
  ON p.related_id = it.invoice_id
  AND p.related_to = 'invoice'
GROUP BY
  it.invoice_id, it.direction, it.project_id, it.entity_id,
  it.partner_company_id, it.cost_type, it.title, it.invoice_number,
  it.invoice_date, it.due_date, it.igv_rate, it.detraccion_rate,
  it.retencion_applicable, it.retencion_rate, it.retencion_verified,
  it.currency, it.exchange_rate, it.comprobante_type, it.payment_method,
  it.document_ref, it.notes, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;

-- ============================================================
-- Step 17: Recreate views — v_obligation_calendar (replaces v_ap_calendar)
-- ============================================================

CREATE OR REPLACE VIEW v_obligation_calendar
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable)
SELECT
  'commercial'::VARCHAR AS type,
  ib.invoice_id,
  NULL::UUID             AS loan_id,
  ib.direction,
  ib.partner_company_id,
  ib.project_id,
  p.project_code,
  p.name                AS project_name,
  ib.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ib.cost_type,
  ib.invoice_date       AS date,
  ib.title,
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
  ib.payment_status
FROM v_invoice_balances ib
LEFT JOIN projects p ON p.id = ib.project_id
LEFT JOIN entities e ON e.id = ib.entity_id
WHERE ib.due_date IS NOT NULL
  AND ib.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule (always payable direction)
SELECT
  'loan'::VARCHAR        AS type,
  NULL::UUID             AS invoice_id,
  ls.loan_id,
  'payable'::VARCHAR     AS direction,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  l.entity_id,
  l.lender_name          AS entity_name,
  NULL::VARCHAR          AS cost_type,
  l.date_borrowed        AS date,
  l.purpose              AS title,
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
) pay ON true
LEFT JOIN projects p ON p.id = l.project_id
WHERE ls.scheduled_amount - COALESCE(pay.amount_paid, 0) > 0

ORDER BY due_date ASC;

-- ============================================================
-- Step 18: Recreate views — v_igv_position (simplified)
-- ============================================================

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

-- ============================================================
-- Step 19: Recreate views — v_retencion_dashboard (simplified)
-- ============================================================

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
-- No is_active filter on projects/entities: retencion history must remain visible
FROM ar_with_totals awt
JOIN projects p ON p.id = awt.project_id
JOIN entities e ON e.id = awt.entity_id
ORDER BY
  awt.retencion_verified ASC,
  (CURRENT_DATE - awt.invoice_date) DESC;

-- ============================================================
-- Step 20: Recreate views — v_budget_vs_actual (updated source)
-- ============================================================

CREATE OR REPLACE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  -- Actual spending per project per category from invoice_items
  -- Only project_cost type (not SG&A), only payable direction
  SELECT
    i.project_id,
    ii.category,
    i.currency,
    COALESCE(SUM(ii.subtotal), 0) AS actual_amount
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.direction = 'payable'
    AND i.cost_type = 'project_cost'
    AND i.project_id IS NOT NULL
  GROUP BY i.project_id, ii.category, i.currency
)
SELECT
  pb.project_id,
  p.project_code,
  p.name                AS project_name,
  pb.category,
  pb.budgeted_amount,
  pb.currency           AS budgeted_currency,
  COALESCE(ac.actual_amount, 0) AS actual_amount,
  pb.budgeted_amount - COALESCE(ac.actual_amount, 0) AS variance,
  ROUND(
    (COALESCE(ac.actual_amount, 0) / NULLIF(pb.budgeted_amount, 0)) * 100, 1
  )                     AS pct_used,
  pb.notes
FROM project_budgets pb
JOIN projects p ON p.id = pb.project_id
LEFT JOIN actual_costs ac
  ON ac.project_id = pb.project_id
  AND ac.category = pb.category
  AND ac.currency = pb.currency
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;
