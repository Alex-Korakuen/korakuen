-- ============================================================
-- Fix: Add soft-delete support to project_partners
-- Migration: 20260308000004
-- Date: 2026-03-08
-- Purpose: Convention requires soft deletes only. project_partners
--          was using hard delete. Add is_active column and replace
--          unique constraint with partial unique index on active rows.
-- ============================================================

-- Add is_active column (all existing rows are active)
ALTER TABLE project_partners
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Drop the old unique constraint
ALTER TABLE project_partners
  DROP CONSTRAINT uq_project_partners_project_partner;

-- Partial unique index: only one active row per (project, partner) pair
CREATE UNIQUE INDEX uq_project_partners_active
  ON project_partners (project_id, partner_company_id)
  WHERE is_active = TRUE;

-- Update v_partner_ledger to filter on active partner shares only
DROP VIEW IF EXISTS v_partner_ledger;

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
    AND ct.cost_type = 'project_cost'
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
