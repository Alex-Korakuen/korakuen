-- Migration: Create v_payments_enriched view
-- Enriches payments with entity name, project code, invoice number, and bank account name

CREATE VIEW v_payments_enriched
WITH (security_invoker = on)
AS

SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_company_id,
  p.bank_account_id,
  p.notes,
  i.invoice_number,
  i.project_id,
  pr.project_code,
  COALESCE(e.common_name, e.legal_name) AS entity_name,
  ba.bank_name
FROM payments p
JOIN invoices i ON i.id = p.related_id
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'invoice'

UNION ALL

SELECT
  p.id,
  p.payment_date,
  p.direction,
  p.payment_type,
  p.amount,
  p.currency,
  p.exchange_rate,
  p.related_to,
  p.related_id,
  p.partner_company_id,
  p.bank_account_id,
  p.notes,
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  ba.bank_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
WHERE p.related_to = 'loan_schedule'

ORDER BY payment_date DESC;
