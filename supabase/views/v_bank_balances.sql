-- View: v_bank_balances
-- Purpose: Shows the calculated balance per bank account based on all payment movements.
--          Inbound payments add to balance, outbound payments subtract.
-- Source tables: payments, bank_accounts, partner_companies
-- Used by: Bank account dashboard, treasury overview

CREATE OR REPLACE VIEW v_bank_balances
WITH (security_invoker = on)
AS
SELECT
  ba.id                 AS bank_account_id,
  ba.partner_company_id,
  pc.name               AS partner_name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active,
  COALESCE(
    SUM(
      CASE
        WHEN p.direction = 'inbound' THEN p.amount
        ELSE -p.amount
      END
    ), 0
  )                     AS balance,
  COUNT(p.id)           AS transaction_count
FROM bank_accounts ba
JOIN partner_companies pc ON pc.id = ba.partner_company_id
LEFT JOIN payments p ON p.bank_account_id = ba.id
GROUP BY
  ba.id,
  ba.partner_company_id,
  pc.name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account,
  ba.is_active
HAVING ba.is_active = true
    OR COALESCE(SUM(CASE WHEN p.direction = 'inbound' THEN p.amount ELSE -p.amount END), 0) <> 0;
