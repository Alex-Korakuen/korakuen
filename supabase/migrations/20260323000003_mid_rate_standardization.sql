-- ============================================================
-- Korakuen Management System — Mid-Rate Standardization
-- Migration: 20260323000003
-- Date: 2026-03-23
-- ============================================================
-- Standardize all exchange rates to mid_rate. Previously, imported
-- records used sell_rate. This migration:
-- 1. Corrects existing USD invoices/payments that stored sell_rate
-- 2. Updates v_budget_vs_actual to convert USD actuals to PEN

-- === 1. Correct invoices that stored sell_rate instead of mid_rate ===
UPDATE invoices i
SET exchange_rate = er.mid_rate
FROM exchange_rates er
WHERE i.currency = 'USD'
  AND er.rate_date = i.invoice_date
  AND i.exchange_rate = er.sell_rate
  AND i.exchange_rate != er.mid_rate;

-- === 2. Correct payments that stored sell_rate instead of mid_rate ===
UPDATE payments p
SET exchange_rate = er.mid_rate
FROM exchange_rates er
WHERE p.currency = 'USD'
  AND er.rate_date = p.payment_date
  AND p.exchange_rate = er.sell_rate
  AND p.exchange_rate != er.mid_rate;

-- === 3. Recreate v_budget_vs_actual — convert USD actuals to PEN ===
CREATE OR REPLACE VIEW v_budget_vs_actual
WITH (security_invoker = on)
AS
WITH actual_costs AS (
  -- Actual spending per project per category from invoice_items
  -- Only project_cost type (not SG&A), only payable direction
  -- USD amounts converted to PEN using stored mid-rate exchange_rate
  SELECT
    i.project_id,
    ii.category,
    COALESCE(SUM(
      CASE WHEN i.currency = 'USD' THEN ii.subtotal * i.exchange_rate
           ELSE ii.subtotal
      END
    ), 0) AS actual_amount
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.direction = 'payable'
    AND i.cost_type = 'project_cost'
    AND i.project_id IS NOT NULL
    AND i.is_active = true
  GROUP BY i.project_id, ii.category
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
WHERE pb.is_active = true
ORDER BY p.project_code, pb.category;
