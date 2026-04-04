-- View: v_payments_enriched
-- Purpose: Enriches payments with entity name, partner name, project code, invoice number, and bank account label.
--          Uses UNION to handle invoice-related and loan_schedule-related payments separately.
-- Source tables: payments, invoices, entities, projects, loan_schedule, loans, bank_accounts
-- Used by: Payments page (browse)

CREATE OR REPLACE VIEW v_payments_enriched
WITH (security_invoker = on)
AS

-- Part 1: Payments related to invoices
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
  p.partner_id,
  p.bank_account_id,
  p.operation_number,
  p.document_ref,
  p.title,
  p.notes,
  -- Enriched from invoice
  i.invoice_number,
  i.project_id,
  pr.project_code,
  e.legal_name              AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  ba.label                   AS bank_label,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN invoices i ON i.id = p.related_id AND i.is_active = true
LEFT JOIN projects pr ON pr.id = i.project_id
LEFT JOIN entities e ON e.id = i.entity_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'invoice'
  AND p.is_active = true

UNION ALL

-- Part 2: Payments related to loan schedule entries
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
  p.partner_id,
  p.bank_account_id,
  p.operation_number,
  p.document_ref,
  p.title,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  ba.label                   AS bank_label,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN loan_schedule ls ON ls.id = p.related_id
JOIN loans l ON l.id = ls.loan_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'loan_schedule'
  AND p.is_active = true

UNION ALL

-- Part 3: Loan disbursement payments (inflow when loan is received)
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
  p.partner_id,
  p.bank_account_id,
  p.operation_number,
  p.document_ref,
  p.title,
  p.notes,
  -- No invoice number for loans
  NULL::VARCHAR AS invoice_number,
  l.project_id,
  pr.project_code,
  l.lender_name AS entity_name,
  -- Enriched from bank account
  ba.bank_name,
  ba.label                   AS bank_label,
  -- Enriched from partner
  pe.legal_name              AS partner_name
FROM payments p
JOIN loans l ON l.id = p.related_id
LEFT JOIN projects pr ON pr.id = l.project_id
LEFT JOIN bank_accounts ba ON ba.id = p.bank_account_id
LEFT JOIN entities pe ON pe.id = p.partner_id
WHERE p.related_to = 'loan'
  AND p.is_active = true

ORDER BY payment_date DESC;
