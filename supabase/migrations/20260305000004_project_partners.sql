-- ============================================================
-- Migration: project_partners table + updated v_partner_ledger
-- Date: 2026-03-05
-- Purpose: Add explicit per-project profit share percentages
--          for partner companies, and update v_partner_ledger
--          to use profit_share_pct instead of contribution-based %.
-- ============================================================

-- === TABLE: project_partners ===
-- Stores agreed profit share percentage per partner per project.
-- Shares must total 100% per project (enforced at application level).

CREATE TABLE project_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  partner_company_id UUID NOT NULL,
  profit_share_pct NUMERIC(5,2) NOT NULL,             -- e.g. 40.00 = 40%
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_project_partners_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_project_partners_partner_companies
    FOREIGN KEY (partner_company_id)
    REFERENCES partner_companies(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_project_partners_project_partner
    UNIQUE (project_id, partner_company_id),

  CONSTRAINT chk_project_partners_pct_range
    CHECK (profit_share_pct > 0 AND profit_share_pct <= 100)
);

CREATE TRIGGER trg_project_partners_updated_at
  BEFORE UPDATE ON project_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- === VIEW: v_partner_ledger (updated) ===
-- Now uses profit_share_pct from project_partners for income distribution
-- instead of deriving it from cost contribution ratios.

DROP VIEW IF EXISTS v_partner_ledger;

CREATE OR REPLACE VIEW v_partner_ledger
WITH (security_invoker = on)
AS
WITH partner_costs AS (
  -- Each partner's total cost contribution per project, converted to PEN
  -- USD amounts use the stored transaction-date exchange_rate on each cost
  SELECT
    ct.project_id,
    ba.partner_company_id,
    COALESCE(SUM(
      CASE WHEN ct.currency = 'USD'
        THEN ct.subtotal * ct.exchange_rate  -- transaction-date conversion
        ELSE ct.subtotal                     -- PEN passes through
      END
    ), 0) AS contribution_amount_pen
  FROM v_cost_totals ct
  JOIN bank_accounts ba ON ba.id = ct.bank_account_id
  WHERE ct.project_id IS NOT NULL
  GROUP BY ct.project_id, ba.partner_company_id
),
project_totals AS (
  -- Total costs per project in PEN (for contribution percentage calculation)
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
  ROUND(
    COALESCE(pi.total_income_pen, 0) * (pp.profit_share_pct / 100), 2
  )                     AS income_share_pen
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
