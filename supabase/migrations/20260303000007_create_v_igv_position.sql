-- Migration: Create v_igv_position view
-- Shows IGV collected vs IGV paid per currency for Financial Position page

CREATE OR REPLACE VIEW v_igv_position
WITH (security_invoker = on)
AS
WITH igv_collected AS (
  SELECT
    ar.currency,
    COALESCE(SUM(ROUND(ar.subtotal * (ar.igv_rate / 100), 2)), 0) AS igv_collected
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

-- Grant RLS-compatible access
GRANT SELECT ON v_igv_position TO authenticated;
