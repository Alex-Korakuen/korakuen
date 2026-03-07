-- View: v_entity_transactions
-- Purpose: Unified view of all transactions (costs and AR invoices) per entity,
--          enabling a complete transaction history for any entity across projects.
-- Source tables: v_cost_totals, ar_invoices, entities, projects
-- Used by: Entity detail page, entity transaction history

CREATE OR REPLACE VIEW v_entity_transactions
WITH (security_invoker = on)
AS

-- Costs (expenses associated with an entity)
-- No is_active filter on entities/projects: financial history must remain visible
-- even after deactivation. Filtering handled at the application layer.
SELECT
  ct.entity_id,
  e.legal_name          AS entity_name,
  ct.project_id,
  p.project_code,
  p.name                AS project_name,
  'cost'                AS transaction_type,
  ct.date,
  ct.title,
  NULL                  AS invoice_number,
  ct.currency,
  ct.subtotal           AS amount,
  ct.total              AS total_with_igv,
  ct.document_ref,
  ct.cost_id            AS transaction_id
FROM v_cost_totals ct
JOIN entities e ON e.id = ct.entity_id
LEFT JOIN projects p ON p.id = ct.project_id
WHERE ct.entity_id IS NOT NULL

UNION ALL

-- AR Invoices (income from an entity)
SELECT
  ar.entity_id,
  e.legal_name          AS entity_name,
  ar.project_id,
  p.project_code,
  p.name                AS project_name,
  'ar_invoice'          AS transaction_type,
  ar.invoice_date       AS date,
  COALESCE(ar.notes, 'Invoice ' || ar.invoice_number) AS title,
  ar.invoice_number,
  ar.currency,
  ar.subtotal           AS amount,
  ar.subtotal + fn_igv_amount(ar.subtotal, ar.igv_rate) AS total_with_igv,
  ar.document_ref,
  ar.id                 AS transaction_id
FROM ar_invoices ar
JOIN entities e ON e.id = ar.entity_id
LEFT JOIN projects p ON p.id = ar.project_id

ORDER BY date DESC;
