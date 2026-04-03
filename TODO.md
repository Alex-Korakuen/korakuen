# TODO — Korakuen

## Restore partner_id NOT NULL on invoices

Migrated quote-invoices may have NULL `partner_id` (from the quotes merge migration `20260403000001`). 

1. Check for invoices with NULL partner_id and assign the correct partner via the website
2. Run follow-up migration: `ALTER TABLE invoices ALTER COLUMN partner_id SET NOT NULL;`

## Exclude intercompany receivables from project-level settlement

`projects.ts` (project detail partner settlements) does NOT filter out `cost_type = 'intercompany'` on receivables, but `settlement.ts` (global settlement dashboard) does. This produces inconsistent partner balances between the two views.

**Fix:** Add `.neq('cost_type', 'intercompany')` filter to the receivables query in `getProjectDetail()` (~line 302) and `getProjectsCardData()` (~line 58–62) in `website/src/lib/queries/projects.ts`, matching the pattern in `settlement.ts:78`.
