-- View: v_settlement_dashboard
-- Purpose: Shows all internal settlement invoices between partner companies,
--          including computed amounts and payment status.
-- Source tables: v_ar_balances, projects, partner_companies, entities
-- Used by: Partner settlement dashboard, partner reconciliation page

CREATE OR REPLACE VIEW v_settlement_dashboard
WITH (security_invoker = on)
AS
SELECT
  ab.ar_invoice_id,
  ab.project_id,
  p.project_code,
  p.name                    AS project_name,
  ab.partner_company_id,
  pc.name                   AS issuing_partner_name,
  ab.entity_id,
  COALESCE(e.common_name, e.legal_name) AS receiving_entity_name,
  ab.invoice_number,
  ab.invoice_date,
  ab.due_date,
  ab.currency,
  ab.subtotal,
  ab.igv_amount,
  ab.gross_total,
  ab.detraccion_amount,
  ab.retencion_amount,
  ab.net_receivable,
  ab.amount_paid,
  ab.outstanding,
  ab.payment_status,
  ab.document_ref,
  ab.notes
FROM v_ar_balances ab
JOIN projects p             ON p.id = ab.project_id
JOIN partner_companies pc   ON pc.id = ab.partner_company_id
JOIN entities e             ON e.id = ab.entity_id
WHERE ab.is_internal_settlement = true
ORDER BY ab.invoice_date DESC;
