-- ============================================================
-- Migration: Merge partner_companies into entities
-- Date: 2026-03-22
-- Purpose: Eliminate partner_companies table. The 3 partner companies
--          become regular entities tagged 'partner' via entity_tags.
--          All partner_company_id columns renamed to partner_id,
--          FK retargeted to entities. bank_tracking_full and owner
--          fields eliminated (unused in application code).
-- ============================================================

-- ============================================================
-- Step 1: Create partner entities and tag them
-- ============================================================

-- Create 'partner' tag
INSERT INTO tags (name, notes)
VALUES ('partner', 'Identifies the three partner companies that own Korakuen')
ON CONFLICT (name) DO NOTHING;

-- Copy each partner company into entities (skip if already exists by RUC)
INSERT INTO entities (entity_type, document_type, document_number, legal_name)
SELECT 'company', 'RUC', pc.ruc, pc.name
FROM partner_companies pc
WHERE NOT EXISTS (
  SELECT 1 FROM entities e
  WHERE e.document_number = pc.ruc AND e.document_type = 'RUC'
);

-- Tag them as partners
INSERT INTO entity_tags (entity_id, tag_id)
SELECT e.id, t.id
FROM entities e
JOIN partner_companies pc ON e.document_number = pc.ruc AND e.document_type = 'RUC'
CROSS JOIN tags t
WHERE t.name = 'partner'
AND NOT EXISTS (
  SELECT 1 FROM entity_tags et
  WHERE et.entity_id = e.id AND et.tag_id = t.id
);

-- Preserve owner info as entity_contacts (role = 'Owner')
INSERT INTO entity_contacts (entity_id, full_name, role, phone, email)
SELECT e.id, pc.owner_name, 'Owner', pc.phone, pc.email
FROM partner_companies pc
JOIN entities e ON e.document_number = pc.ruc AND e.document_type = 'RUC'
WHERE pc.owner_name IS NOT NULL;


-- ============================================================
-- Step 2: Build temporary mapping (old partner_companies.id → new entities.id)
-- ============================================================

CREATE TEMPORARY TABLE partner_entity_map AS
SELECT pc.id AS old_id, e.id AS new_id
FROM partner_companies pc
JOIN entities e ON e.document_number = pc.ruc AND e.document_type = 'RUC';


-- ============================================================
-- Step 3: Drop dependent views (reverse dependency order)
-- ============================================================

DROP VIEW IF EXISTS v_obligation_calendar;
DROP VIEW IF EXISTS v_invoices_with_loans;
DROP VIEW IF EXISTS v_invoice_balances;
DROP VIEW IF EXISTS v_igv_position;
DROP VIEW IF EXISTS v_retencion_dashboard;
DROP VIEW IF EXISTS v_invoice_totals;
DROP VIEW IF EXISTS v_payments_enriched;
DROP VIEW IF EXISTS v_bank_balances;
DROP VIEW IF EXISTS v_loan_balances;


-- ============================================================
-- Step 4: Drop fn_create_invoice_with_items
-- ============================================================

DROP FUNCTION IF EXISTS fn_create_invoice_with_items(JSONB, JSONB);


-- ============================================================
-- Step 5: Retarget FK columns on all 5 tables
-- ============================================================

-- --- bank_accounts ---
ALTER TABLE bank_accounts DROP CONSTRAINT fk_bank_accounts_partner_companies;
UPDATE bank_accounts SET partner_company_id = m.new_id
FROM partner_entity_map m WHERE partner_company_id = m.old_id;
ALTER TABLE bank_accounts RENAME COLUMN partner_company_id TO partner_id;
ALTER TABLE bank_accounts
  ADD CONSTRAINT fk_bank_accounts_partner
  FOREIGN KEY (partner_id) REFERENCES entities(id) ON DELETE RESTRICT;

-- --- project_partners ---
ALTER TABLE project_partners DROP CONSTRAINT fk_project_partners_partner_companies;
DROP INDEX IF EXISTS uq_project_partners_active;
UPDATE project_partners SET partner_company_id = m.new_id
FROM partner_entity_map m WHERE partner_company_id = m.old_id;
ALTER TABLE project_partners RENAME COLUMN partner_company_id TO partner_id;
ALTER TABLE project_partners
  ADD CONSTRAINT fk_project_partners_partner
  FOREIGN KEY (partner_id) REFERENCES entities(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_project_partners_active
  ON project_partners (project_id, partner_id)
  WHERE is_active = TRUE;

-- --- invoices ---
-- FK was created inline; find and drop the actual constraint name dynamically
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'invoices'::regclass
    AND contype = 'f'
    AND EXISTS (
      SELECT 1 FROM unnest(conkey) AS k
      JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k
      WHERE a.attname = 'partner_company_id'
    );
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;
DROP INDEX IF EXISTS idx_invoices_partner_company_id;
UPDATE invoices SET partner_company_id = m.new_id
FROM partner_entity_map m WHERE partner_company_id = m.old_id;
ALTER TABLE invoices RENAME COLUMN partner_company_id TO partner_id;
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_partner
  FOREIGN KEY (partner_id) REFERENCES entities(id) ON DELETE RESTRICT;
CREATE INDEX idx_invoices_partner_id ON invoices(partner_id);

-- --- payments ---
ALTER TABLE payments DROP CONSTRAINT fk_payments_partner_companies;
UPDATE payments SET partner_company_id = m.new_id
FROM partner_entity_map m WHERE partner_company_id = m.old_id;
ALTER TABLE payments RENAME COLUMN partner_company_id TO partner_id;
ALTER TABLE payments
  ADD CONSTRAINT fk_payments_partner
  FOREIGN KEY (partner_id) REFERENCES entities(id) ON DELETE RESTRICT;

-- --- loans ---
ALTER TABLE loans DROP CONSTRAINT fk_loans_partner_companies;
UPDATE loans SET partner_company_id = m.new_id
FROM partner_entity_map m WHERE partner_company_id = m.old_id;
ALTER TABLE loans RENAME COLUMN partner_company_id TO partner_id;
ALTER TABLE loans
  ADD CONSTRAINT fk_loans_partner
  FOREIGN KEY (partner_id) REFERENCES entities(id) ON DELETE RESTRICT;


-- ============================================================
-- Step 6: Drop partner_companies table
-- ============================================================

DROP TRIGGER IF EXISTS trg_partner_companies_updated_at ON partner_companies;
DROP TABLE partner_companies;


-- ============================================================
-- Step 7: Recreate views with partner_id
-- ============================================================

-- --- v_invoice_totals ---
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
    i.payment_method,
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


-- --- v_invoice_balances ---
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
  it.payment_method,
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
  it.currency, it.exchange_rate, it.comprobante_type, it.payment_method,
  it.document_ref, it.notes, it.subtotal, it.igv_amount, it.total,
  it.detraccion_amount, it.retencion_amount;


-- --- v_obligation_calendar ---
CREATE OR REPLACE VIEW v_obligation_calendar
WITH (security_invoker = on)
AS

-- Part 1: Commercial invoices (both payable and receivable)
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

-- Part 2: Loan repayment schedule (always payable direction)
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


-- --- v_invoices_with_loans ---
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
LEFT JOIN projects p ON p.id = l.project_id

ORDER BY due_date DESC NULLS LAST;


-- --- v_payments_enriched ---
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
  p.notes,
  i.invoice_number,
  i.project_id,
  pr.project_code,
  e.legal_name              AS entity_name,
  ba.bank_name
FROM payments p
JOIN invoices i ON i.id = p.related_id AND i.is_active = true
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
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
  p.notes,
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  ba.bank_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
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
  p.notes,
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  ba.bank_name
FROM payments p
JOIN loans l ON l.id = p.related_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'loan'
  AND p.is_active = true

ORDER BY payment_date DESC;


-- --- v_bank_balances ---
CREATE OR REPLACE VIEW v_bank_balances
WITH (security_invoker = on)
AS
SELECT
  ba.id                 AS bank_account_id,
  ba.partner_id,
  e.legal_name          AS partner_name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active,
  COALESCE(
    SUM(
      CASE
        WHEN p.direction = 'inbound' THEN p.amount
        ELSE -p.amount
      END
    ), 0
  )                     AS balance,
  COUNT(p.id)           AS transaction_count
FROM bank_accounts ba
JOIN entities e ON e.id = ba.partner_id
LEFT JOIN payments p ON p.bank_account_id = ba.id AND p.is_active = true
GROUP BY
  ba.id,
  ba.partner_id,
  e.legal_name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active
HAVING ba.is_active = true
    OR COALESCE(SUM(CASE WHEN p.direction = 'inbound' THEN p.amount ELSE -p.amount END), 0) <> 0;


-- --- v_loan_balances ---
CREATE OR REPLACE VIEW v_loan_balances
WITH (security_invoker = on)
AS
WITH loan_totals AS (
  SELECT
    l.id AS loan_id,
    l.lender_name,
    l.lender_contact,
    l.amount AS principal,
    l.currency,
    l.exchange_rate,
    l.date_borrowed,
    l.project_id,
    l.partner_id,
    l.purpose,
    l.return_type,
    l.agreed_return_rate,
    l.agreed_return_amount,
    l.due_date,
    CASE
      WHEN l.return_type = 'percentage' THEN
        l.amount + ROUND(l.amount * COALESCE(l.agreed_return_rate, 0) / 100, 2)
      WHEN l.return_type = 'fixed' THEN
        l.amount + COALESCE(l.agreed_return_amount, 0)
      ELSE l.amount
    END AS total_owed
  FROM loans l
),
loan_paid AS (
  SELECT
    ls.loan_id,
    COALESCE(SUM(p.amount), 0) AS total_paid
  FROM loan_schedule ls
  JOIN payments p ON p.related_to = 'loan_schedule' AND p.related_id = ls.id AND p.is_active = true
  GROUP BY ls.loan_id
),
schedule_stats AS (
  SELECT
    ls.loan_id,
    COUNT(*) AS scheduled_payments_count,
    COUNT(*) FILTER (
      WHERE COALESCE(ps.paid_amount, 0) >= ls.scheduled_amount
    ) AS paid_schedule_count
  FROM loan_schedule ls
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM payments p
    WHERE p.related_to = 'loan_schedule'
      AND p.related_id = ls.id
      AND p.is_active = true
  ) ps ON true
  GROUP BY ls.loan_id
)
SELECT
  lt.loan_id,
  lt.lender_name,
  lt.lender_contact,
  lt.principal,
  lt.currency,
  lt.exchange_rate,
  lt.date_borrowed,
  lt.project_id,
  lt.partner_id,
  lt.purpose,
  lt.total_owed,
  COALESCE(lp.total_paid, 0) AS total_paid,
  lt.total_owed - COALESCE(lp.total_paid, 0) AS outstanding,
  CASE
    WHEN COALESCE(lp.total_paid, 0) = 0 THEN 'active'
    WHEN lt.total_owed - COALESCE(lp.total_paid, 0) <= 0 THEN 'settled'
    ELSE 'partially_paid'
  END AS status,
  lt.due_date,
  COALESCE(ss.scheduled_payments_count, 0) AS scheduled_payments_count,
  COALESCE(ss.paid_schedule_count, 0) AS paid_schedule_count
FROM loan_totals lt
LEFT JOIN loan_paid lp ON lp.loan_id = lt.loan_id
LEFT JOIN schedule_stats ss ON ss.loan_id = lt.loan_id;


-- ============================================================
-- Step 8: Recreate v_igv_position and v_retencion_dashboard (depend on v_invoice_totals)
-- ============================================================

-- --- v_igv_position ---
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


-- --- v_retencion_dashboard ---
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


-- ============================================================
-- Step 9: Recreate fn_create_invoice_with_items with partner_id
-- ============================================================

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
    retencion_rate, comprobante_type, payment_method, document_ref,
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


-- ============================================================
-- End of migration
-- ============================================================
