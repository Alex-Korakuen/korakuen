# TODO — Korakuen

## Restore partner_id NOT NULL on invoices

Migrated quote-invoices may have NULL `partner_id` (from the quotes merge migration `20260403000001`). 

1. Check for invoices with NULL partner_id and assign the correct partner via the website
2. Run follow-up migration: `ALTER TABLE invoices ALTER COLUMN partner_id SET NOT NULL;`

