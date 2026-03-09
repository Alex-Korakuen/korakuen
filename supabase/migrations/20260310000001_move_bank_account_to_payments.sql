-- Migration: Move bank_account_id from costs/ar_invoices to payments-only
-- Rationale: Invoices (AP and AR) are documents, not cash movements.
--            Only payments move money through bank accounts.
--            Partner identity on costs now stored explicitly via partner_company_id
--            (matching how ar_invoices already works).

-- ============================================================
-- Step 1: Add partner_company_id to costs
-- ============================================================

ALTER TABLE costs
  ADD COLUMN partner_company_id UUID;

-- Populate from existing bank_account -> partner_company relationship
UPDATE costs c
SET partner_company_id = ba.partner_company_id
FROM bank_accounts ba
WHERE ba.id = c.bank_account_id;

-- Now make it NOT NULL and add FK
ALTER TABLE costs
  ALTER COLUMN partner_company_id SET NOT NULL;

ALTER TABLE costs
  ADD CONSTRAINT fk_costs_partner_companies
    FOREIGN KEY (partner_company_id)
    REFERENCES partner_companies(id)
    ON DELETE RESTRICT;

CREATE INDEX idx_costs_partner_company_id ON costs(partner_company_id);

-- ============================================================
-- Step 2: Drop dependent views (must drop before column drop)
-- ============================================================

-- Views depending on costs.bank_account_id (via v_cost_totals chain):
DROP VIEW IF EXISTS v_partner_ledger CASCADE;
DROP VIEW IF EXISTS v_ap_calendar CASCADE;
DROP VIEW IF EXISTS v_entity_transactions CASCADE;
DROP VIEW IF EXISTS v_igv_position CASCADE;
DROP VIEW IF EXISTS v_cost_balances CASCADE;
DROP VIEW IF EXISTS v_cost_totals CASCADE;

-- Views depending on ar_invoices.bank_account_id:
DROP VIEW IF EXISTS v_ar_balances CASCADE;

-- ============================================================
-- Step 3: Drop bank_account_id from costs
-- ============================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_costs_bank_account_id;

-- Drop the FK constraint
ALTER TABLE costs
  DROP CONSTRAINT IF EXISTS fk_costs_bank_accounts;

ALTER TABLE costs
  DROP COLUMN bank_account_id;

-- ============================================================
-- Step 4: Drop bank_account_id from ar_invoices
-- ============================================================

-- Drop the FK constraint
ALTER TABLE ar_invoices
  DROP CONSTRAINT IF EXISTS fk_ar_invoices_bank_accounts;

ALTER TABLE ar_invoices
  DROP COLUMN bank_account_id;

-- ============================================================
-- Step 4: Recreate affected views
-- ============================================================

-- v_cost_totals: replace bank_account_id with partner_company_id
CREATE OR REPLACE VIEW v_cost_totals
WITH (security_invoker = on)
AS
WITH item_sums AS (
  SELECT
    c.id                  AS cost_id,
    c.project_id,
    c.partner_company_id,
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
    c.partner_company_id,
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
    fn_igv_amount(subtotal, igv_rate) AS igv_amount
  FROM item_sums
)
SELECT
  cost_id,
  project_id,
  partner_company_id,
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
  subtotal + igv_amount                                     AS total,
  fn_detraccion_amount(subtotal, igv_amount, detraccion_rate) AS detraccion_amount
FROM with_igv;

-- v_cost_balances: replace bank_account_id with partner_company_id
CREATE OR REPLACE VIEW v_cost_balances
WITH (security_invoker = on)
AS
SELECT
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.partner_company_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.exchange_rate,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ct.total - COALESCE(SUM(p.amount), 0) AS outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
    WHEN COALESCE(SUM(p.amount), 0) >= ct.total THEN 'paid'
    ELSE 'partial'
  END AS payment_status
FROM v_cost_totals ct
LEFT JOIN payments p
  ON p.related_id = ct.cost_id
  AND p.related_to = 'cost'
GROUP BY
  ct.cost_id,
  ct.project_id,
  ct.entity_id,
  ct.partner_company_id,
  ct.cost_type,
  ct.date,
  ct.title,
  ct.currency,
  ct.exchange_rate,
  ct.due_date,
  ct.document_ref,
  ct.subtotal,
  ct.igv_amount,
  ct.total,
  ct.detraccion_amount;

-- v_ar_balances: remove bank_account_id
CREATE OR REPLACE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
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
    ar.notes,
    fn_igv_amount(ar.subtotal, ar.igv_rate) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    fn_detraccion_amount(ab.subtotal, ab.igv_amount, ab.detraccion_rate) AS detraccion_amount,
    fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate) AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
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
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount,
  ac.gross_total - ac.detraccion_amount - ac.retencion_amount AS net_receivable,
  COALESCE(SUM(p.amount), 0) AS amount_paid,
  ac.gross_total - COALESCE(SUM(p.amount), 0) AS outstanding,
  GREATEST(0, ac.gross_total - COALESCE(SUM(p.amount), 0) - COALESCE(ac.detraccion_amount, 0)) AS receivable,
  LEAST(ac.gross_total - COALESCE(SUM(p.amount), 0), COALESCE(ac.detraccion_amount, 0)) AS bdn_outstanding,
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
  ac.notes,
  ac.igv_amount,
  ac.gross_total,
  ac.detraccion_amount,
  ac.retencion_amount;

-- v_ap_calendar: replace bank_account_id with partner_company_id
CREATE OR REPLACE VIEW v_ap_calendar
WITH (security_invoker = on)
AS

-- Part 1: Supplier invoices (existing cost-based obligations)
SELECT
  'supplier_invoice'::VARCHAR AS type,
  cb.cost_id,
  NULL::UUID             AS loan_id,
  cb.partner_company_id,
  cb.project_id,
  p.project_code,
  p.name              AS project_name,
  cb.entity_id,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  cb.cost_type,
  cb.date,
  cb.title,
  cb.currency,
  cb.exchange_rate,
  cb.document_ref,
  cb.due_date,
  (cb.due_date - CURRENT_DATE) AS days_remaining,
  cb.subtotal,
  cb.igv_amount,
  cb.total,
  cb.detraccion_amount,
  cb.amount_paid,
  cb.outstanding,
  GREATEST(0, cb.outstanding - COALESCE(cb.detraccion_amount, 0)) AS payable,
  LEAST(cb.outstanding, COALESCE(cb.detraccion_amount, 0)) AS bdn_outstanding,
  cb.payment_status
FROM v_cost_balances cb
LEFT JOIN projects p ON p.id = cb.project_id
LEFT JOIN entities e ON e.id = cb.entity_id
WHERE cb.due_date IS NOT NULL
  AND cb.payment_status IN ('pending', 'partial')

UNION ALL

-- Part 2: Loan repayment schedule
SELECT
  'loan_payment'::VARCHAR AS type,
  NULL::UUID             AS cost_id,
  ls.loan_id,
  l.partner_company_id,
  l.project_id,
  p.project_code,
  p.name                 AS project_name,
  NULL::UUID             AS entity_id,
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
  COALESCE(lp.amount, 0) AS amount_paid,
  ls.scheduled_amount - COALESCE(lp.amount, 0) AS outstanding,
  ls.scheduled_amount - COALESCE(lp.amount, 0) AS payable,
  0::NUMERIC(15,2) AS bdn_outstanding,
  CASE
    WHEN lp.amount IS NOT NULL AND lp.amount < ls.scheduled_amount THEN 'partial'
    ELSE 'pending'
  END                    AS payment_status
FROM loan_schedule ls
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN loan_payments lp ON lp.id = ls.actual_payment_id
LEFT JOIN projects p ON p.id = l.project_id
WHERE NOT ls.paid

ORDER BY due_date ASC;

-- fn_create_cost_with_items: replace bank_account_id with partner_company_id
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
    cost_type, partner_company_id, date, title, igv_rate, currency,
    exchange_rate, project_id, entity_id, quote_id,
    detraccion_rate, comprobante_type, comprobante_number,
    payment_method, document_ref, due_date, notes
  )
  VALUES (
    header_data->>'cost_type',
    (header_data->>'partner_company_id')::UUID,
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

-- v_partner_ledger: use costs.partner_company_id directly instead of joining bank_accounts
CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  -- Each partner's total project cost contribution per project, converted to PEN
  -- Only project_cost type — SG&A excluded from settlement calculation
  SELECT
    ct.project_id,
    ct.partner_company_id,
    COALESCE(SUM(
      CASE WHEN ct.currency = 'USD'
        THEN ct.subtotal * ct.exchange_rate  -- transaction-date conversion
        ELSE ct.subtotal                     -- PEN passes through
      END
    ), 0) AS contribution_amount_pen
  FROM v_cost_totals ct
  WHERE ct.project_id IS NOT NULL
    AND ct.cost_type = 'project_cost'
  GROUP BY ct.project_id, ct.partner_company_id
),
project_totals AS (
  -- Total project costs in PEN (for contribution percentage calculation)
  SELECT
    project_id,
    SUM(contribution_amount_pen) AS total_project_costs_pen
  FROM partner_costs
  GROUP BY project_id
),
project_income AS (
  -- Total AR income per project, converted to PEN at transaction-date rate
  SELECT
    ar.project_id,
    COALESCE(SUM(
      CASE WHEN ar.currency = 'USD'
        THEN ar.subtotal * ar.exchange_rate  -- transaction-date conversion
        ELSE ar.subtotal                     -- PEN passes through
      END
    ), 0) AS total_income_pen
  FROM ar_invoices ar
  GROUP BY ar.project_id
)
SELECT
  pp.project_id,
  p.project_code,
  p.name                AS project_name,
  pp.partner_company_id,
  pco.name              AS partner_name,
  pp.profit_share_pct,
  COALESCE(pc.contribution_amount_pen, 0) AS contribution_amount_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND((COALESCE(pc.contribution_amount_pen, 0) / pt.total_project_costs_pen) * 100, 2)
    ELSE 0
  END                   AS contribution_pct,
  COALESCE(pi.total_income_pen, 0) AS project_income_pen,
  COALESCE(pt.total_project_costs_pen, 0) AS project_costs_pen,
  COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0) AS project_profit_pen,
  ROUND(
    (COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0))
    * (pp.profit_share_pct / 100), 2
  )                     AS profit_share_pen,
  -- What this partner should receive from the income pool:
  -- their costs back + their share of profit
  ROUND(
    COALESCE(pc.contribution_amount_pen, 0)
    + (COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0))
      * (pp.profit_share_pct / 100), 2
  )                     AS should_receive_pen
FROM project_partners pp
-- No is_active filter on projects/partner_companies: financial history must remain
-- visible even after deactivation. Filtering handled at the application layer.
JOIN projects p         ON p.id = pp.project_id
JOIN partner_companies pco ON pco.id = pp.partner_company_id
LEFT JOIN partner_costs pc ON pc.project_id = pp.project_id
                          AND pc.partner_company_id = pp.partner_company_id
LEFT JOIN project_totals pt ON pt.project_id = pp.project_id
LEFT JOIN project_income pi ON pi.project_id = pp.project_id
ORDER BY p.project_code, pco.name;

-- v_entity_transactions: depends on v_cost_totals (unchanged, just needs recreation)
CREATE OR REPLACE VIEW v_entity_transactions
WITH (security_invoker = on)
AS

-- Costs (expenses associated with an entity)
-- No is_active filter on entities/projects: financial history must remain visible
-- even after deactivation. Filtering handled at the application layer.
SELECT
  ct.entity_id,
  e.legal_name          AS entity_name,
  ct.project_id,
  p.project_code,
  p.name                AS project_name,
  'cost'                AS transaction_type,
  ct.date,
  ct.title,
  NULL                  AS invoice_number,
  ct.currency,
  ct.subtotal           AS amount,
  ct.total              AS total_with_igv,
  ct.document_ref,
  ct.cost_id            AS transaction_id
FROM v_cost_totals ct
JOIN entities e ON e.id = ct.entity_id
LEFT JOIN projects p ON p.id = ct.project_id
WHERE ct.entity_id IS NOT NULL

UNION ALL

-- AR Invoices (income from an entity)
SELECT
  ar.entity_id,
  e.legal_name          AS entity_name,
  ar.project_id,
  p.project_code,
  p.name                AS project_name,
  'ar_invoice'          AS transaction_type,
  ar.invoice_date       AS date,
  COALESCE(ar.notes, 'Invoice ' || ar.invoice_number) AS title,
  ar.invoice_number,
  ar.currency,
  ar.subtotal           AS amount,
  ar.subtotal + fn_igv_amount(ar.subtotal, ar.igv_rate) AS total_with_igv,
  ar.document_ref,
  ar.id                 AS transaction_id
FROM ar_invoices ar
JOIN entities e ON e.id = ar.entity_id
LEFT JOIN projects p ON p.id = ar.project_id

ORDER BY date DESC;

-- v_igv_position: depends on v_cost_totals (unchanged, just needs recreation)
CREATE OR REPLACE VIEW v_igv_position
WITH (security_invoker = on)
AS
WITH igv_collected AS (
  SELECT
    ar.currency,
    COALESCE(SUM(fn_igv_amount(ar.subtotal, ar.igv_rate)), 0) AS igv_collected
  FROM ar_invoices ar
  GROUP BY ar.currency
),
igv_paid AS (
  SELECT
    ct.currency,
    COALESCE(SUM(ct.igv_amount), 0) AS igv_paid
  FROM v_cost_totals ct
  WHERE ct.igv_amount > 0
  GROUP BY ct.currency
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
