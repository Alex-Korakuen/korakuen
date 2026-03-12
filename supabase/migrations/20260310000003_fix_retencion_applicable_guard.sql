-- Fix: Guard fn_retencion_amount with retencion_applicable boolean
-- Previously, fn_retencion_amount was called unconditionally — if retencion_applicable = false
-- but retencion_rate was non-NULL, balances would be incorrect.
-- Also updates v_partner_ledger to filter only active partners.
-- Rollback: Re-create views without the CASE WHEN guard / WHERE filter

-- Recreate v_ar_balances with retencion_applicable guard
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
    CASE WHEN ab.retencion_applicable
      THEN fn_retencion_amount(ab.subtotal, ab.igv_amount, ab.retencion_rate)
      ELSE 0
    END AS retencion_amount
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
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0) AS detraccion_paid,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0) AS retencion_paid,
  GREATEST(0,
    ac.gross_total - COALESCE(SUM(p.amount), 0)
    - GREATEST(0, ac.detraccion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0))
    - GREATEST(0, ac.retencion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'retencion'), 0))
  ) AS receivable,
  GREATEST(0, ac.detraccion_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'detraccion'), 0)) AS bdn_outstanding,
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

-- Recreate v_partner_ledger with is_active filter on project_partners
CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  SELECT
    ct.project_id,
    ct.partner_company_id,
    COALESCE(SUM(
      CASE WHEN ct.currency = 'USD'
        THEN ct.subtotal * ct.exchange_rate
        ELSE ct.subtotal
      END
    ), 0) AS contribution_amount_pen
  FROM v_cost_totals ct
  WHERE ct.project_id IS NOT NULL
    AND ct.cost_type = 'project_cost'
  GROUP BY ct.project_id, ct.partner_company_id
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
  ROUND(
    COALESCE(pc.contribution_amount_pen, 0)
    + (COALESCE(pi.total_income_pen, 0) - COALESCE(pt.total_project_costs_pen, 0))
      * (pp.profit_share_pct / 100), 2
  )                     AS should_receive_pen
FROM project_partners pp
JOIN projects p         ON p.id = pp.project_id
JOIN partner_companies pco ON pco.id = pp.partner_company_id
LEFT JOIN partner_costs pc ON pc.project_id = pp.project_id
                          AND pc.partner_company_id = pp.partner_company_id
LEFT JOIN project_totals pt ON pt.project_id = pp.project_id
LEFT JOIN project_income pi ON pi.project_id = pp.project_id
WHERE pp.is_active = TRUE
ORDER BY p.project_code, pco.name;
