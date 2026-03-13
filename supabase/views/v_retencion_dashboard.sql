-- View: v_retencion_dashboard
-- Purpose: Tracks receivable invoices where retencion is applicable, showing verification status
--          and days since invoice to highlight aged unverified retenciones
-- Source tables: v_invoice_totals, projects, entities
-- Used by: Retencion dashboard, retencion verification workflow

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
