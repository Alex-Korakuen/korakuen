# TODO — Korakuen

## Restore partner_id NOT NULL on invoices

Migrated quote-invoices may have NULL `partner_id` (from the quotes merge migration `20260403000001`).

1. Check for invoices with NULL partner_id and assign the correct partner via the website
2. Run follow-up migration: `ALTER TABLE invoices ALTER COLUMN partner_id SET NOT NULL;`

## Atomic direct-transaction payment import (audit #21)

`importPayments` direct-transaction path (`import-actions.ts` ~line 650) manually sequences
`invoices` insert → `invoice_items` insert → `payments` insert with best-effort manual rollback.
Not truly atomic — if the cleanup DELETE also fails, orphan rows remain.

**Fix:** extend the existing `fn_create_invoice_with_items` RPC to accept an optional payment,
or add `fn_create_invoice_with_items_and_payment`. Replace the manual sequencing with a single RPC call.
Requires a new migration + regenerated types.

## Fix `related_id` nullable type (audit LOW)

`actions.ts:957` uses `null as unknown as string` to unlink payments from deactivated invoices:
```ts
.update({ related_id: null as unknown as string })
```

The column actually accepts null at the DB level, but `database.types.ts` types it as `string`.

**Fix:** run `supabase gen types typescript` to regenerate `database.types.ts` so `related_id`
is `string | null`, then drop the double cast.

## Smoke test refactored flows (post-audit)

Sprint 2 tightened inline-edit exchange-rate validation from `0 < rate ≤ 20` to the stricter
import range `EXCHANGE_RATE_MIN=2.5` / `EXCHANGE_RATE_MAX=6.0`. Historical rates outside this
range will now reject on inline edit. Verify:

- [ ] Inline edit of exchange_rate on invoices/payments — confirm rejection behavior is desired
- [ ] Soft-delete flows: entity, invoice, payment via new `softDeleteRecord` helper
- [ ] Quote accept/reject via new `transitionQuoteStatus` helper (see `actions.ts:624`)
- [ ] Partner allocation editor in both create-project modal and project detail inline edit

If 2.5-6.0 is too strict, widen the constants in `constants.ts`.
