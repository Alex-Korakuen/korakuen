-- View: v_igv_position
-- Purpose: Shows IGV collected (from receivable invoices) vs IGV paid (on payable invoices),
--          and net IGV position per currency. Point-in-time snapshot.
-- Source tables: v_invoice_totals
-- Used by: Financial Position page (Tax Credits / Tax Liabilities sections)

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
