-- Migration: Remove is_internal_settlement from ar_invoices
-- Reason: Partners never invoice each other. The flag was always false
--         and added unnecessary complexity to data entry and queries.

-- 1. Drop the settlement dashboard view (depends on v_ar_balances)
DROP VIEW IF EXISTS v_settlement_dashboard;

-- 2. Drop and recreate v_ar_balances without is_internal_settlement
-- (CREATE OR REPLACE cannot drop columns from a view)
DROP VIEW IF EXISTS v_ar_balances;
CREATE VIEW v_ar_balances
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.bank_account_id,
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
    ROUND(ar.subtotal * (ar.igv_rate / 100), 2) AS igv_amount
  FROM ar_invoices ar
),
ar_computed AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    ROUND(
      (ab.subtotal + ab.igv_amount) * COALESCE(ab.detraccion_rate, 0) / 100, 2
    )                           AS detraccion_amount,
    ROUND(
      CASE
        WHEN ab.retencion_applicable
          THEN (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100
        ELSE 0
      END, 2
    )                           AS retencion_amount
  FROM ar_base ab
)
SELECT
  ac.ar_invoice_id,
  ac.project_id,
  ac.bank_account_id,
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
  ac.bank_account_id,
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

-- 3. Recreate v_partner_ledger without the is_internal_settlement filter
CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  SELECT
    ct.project_id,
    ba.partner_company_id,
    COALESCE(SUM(
      CASE WHEN ct.currency = 'USD'
        THEN ct.subtotal * ct.exchange_rate
        ELSE ct.subtotal
      END
    ), 0) AS contribution_amount_pen
  FROM v_cost_totals ct
  JOIN bank_accounts ba ON ba.id = ct.bank_account_id
  WHERE ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ba.partner_company_id
),
project_totals AS (
  SELECT
    project_id,
    SUM(contribution_amount_pen) AS total_project_costs_pen
  FROM partner_costs
  GROUP BY project_id
),
project_income AS (
  SELECT
    ar.project_id,
    COALESCE(SUM(
      CASE WHEN ar.currency = 'USD'
        THEN ar.subtotal * ar.exchange_rate
        ELSE ar.subtotal
      END
    ), 0) AS total_income_pen
  FROM ar_invoices ar
  GROUP BY ar.project_id
)
SELECT
  pc.project_id,
  p.project_code,
  p.name                AS project_name,
  pc.partner_company_id,
  pco.name              AS partner_name,
  pc.contribution_amount_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND((pc.contribution_amount_pen / pt.total_project_costs_pen) * 100, 2)
    ELSE 0
  END                   AS contribution_pct,
  COALESCE(pi.total_income_pen, 0) AS project_income_pen,
  CASE
    WHEN pt.total_project_costs_pen > 0
      THEN ROUND(
        COALESCE(pi.total_income_pen, 0)
        * (pc.contribution_amount_pen / pt.total_project_costs_pen), 2
      )
    ELSE 0
  END                   AS income_share_pen
FROM partner_costs pc
JOIN projects p         ON p.id = pc.project_id
JOIN partner_companies pco ON pco.id = pc.partner_company_id
JOIN project_totals pt  ON pt.project_id = pc.project_id
LEFT JOIN project_income pi ON pi.project_id = pc.project_id
ORDER BY p.project_code, pco.name;

-- 4. Drop the column
ALTER TABLE ar_invoices DROP COLUMN is_internal_settlement;
