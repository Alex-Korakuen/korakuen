-- View: v_retencion_dashboard
-- Purpose: Tracks AR invoices where retencion is applicable, showing verification status
--          and days since invoice to highlight aged unverified retenciones
-- Source tables: ar_invoices, projects, entities
-- Used by: Retencion dashboard page, retencion verification workflow

CREATE OR REPLACE VIEW v_retencion_dashboard
WITH (security_invoker = on)
AS
WITH ar_base AS (
  SELECT
    ar.id                 AS ar_invoice_id,
    ar.project_id,
    ar.entity_id,
    ar.invoice_number,
    ar.invoice_date,
    ar.due_date,
    ar.subtotal,
    ar.igv_rate,
    ar.retencion_rate,
    ar.currency,
    ar.retencion_verified,
    ROUND(ar.subtotal * (ar.igv_rate / 100), 2) AS igv_amount
  FROM ar_invoices ar
  WHERE ar.retencion_applicable = true
),
ar_with_totals AS (
  SELECT
    ab.*,
    ab.subtotal + ab.igv_amount AS gross_total,
    ROUND(
      (ab.subtotal + ab.igv_amount) * COALESCE(ab.retencion_rate, 0) / 100, 2
    ) AS retencion_amount
  FROM ar_base ab
)
SELECT
  awt.ar_invoice_id,
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
