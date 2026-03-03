-- Fix: Remove is_active filter on partner_companies JOIN in v_bank_balances.
-- Consistent with other financial views (v_partner_ledger, v_entity_transactions, etc.)
-- that preserve financial history regardless of partner/entity active status.
-- Bank accounts still filtered by ba.is_active = true.

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
WHERE ba.is_active = true
GROUP BY
  ba.id,
  ba.partner_company_id,
  pc.name,
  ba.bank_name,
  ba.account_number_last4,
  ba.account_type,
  ba.currency,
  ba.is_detraccion_account;
