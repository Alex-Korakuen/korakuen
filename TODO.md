# TODO — Korakuen Improvements

Updated March 5, 2026.

---

## To Investigate

### Settlements — Review Business Logic

The current settlement model treats partner settlements as AR invoices (`is_internal_settlement = true`). This is elegant (reuses AR + payment infrastructure, and partners do issue facturas to each other), but needs validation:

- [ ] Confirm settlement balance formula: `income_share - actually_received` — does this match how partners actually agree to settle?
- [ ] AR payments in `getPartnerLedger` include all `payment_type` values (regular, detraccion, retencion). Detraccion goes to Banco de la Nacion (restricted use) and retencion is withheld by the client — should these count as "actually received" for settlement purposes, or only regular bank payments?
- [ ] Settlement section converts USD at current rate ("settlements happen in the present") while contributions use transaction-date rates. This is a deliberate choice but creates a conceptual mismatch — verify this reflects how the partners think about it
- [ ] No structured mechanism for partial settlements during execution (the handbook says "weekly balancing attempts during execution") — is the current invoice-based settlement flow sufficient, or do partners need a lighter-weight way to record interim balancing?

### Valuations — Review Necessity

Valuations (monthly billing periods) are standard in Peruvian construction and are modeled in the database, but their role in the system has been reduced:

- [ ] Valuations were removed from the Projects page display ("kept as dormant infrastructure"). Costs are grouped by date, not by valuation period. Is this still the right call, or do the partners actually think in terms of valuations when reviewing project spending?
- [ ] AR invoices reference `valuation_id` — this is the primary linkage. But if a project doesn't use monthly valuations (e.g., a simple subcontractor job with a single final invoice), the current flow still forces selecting a valuation. Is this friction justified?
- [ ] The interactive AR entry prevents duplicate invoices per valuation, but the import path does not check this. Partially addressed by planned unique invoice number constraints (see Known Issues) — but the valuation-level check is a separate business rule
- [ ] `billed_value` on valuations can differ from both the sum of costs and the AR invoice amount for that period. Is this field actually being used, or is it redundant with the AR invoice subtotal?

---

## Known Issues

### ~~SG&A "Other" Misrouted in Cash Flow~~ [FIXED]

Fixed: `mapCategory()` now receives `cost_type` and routes SG&A "other" correctly.

### Cost Import — Headers Without Items Warning [LOW]

The cost import is a two-step workflow (import headers, then import items). No validation ensures imported headers get corresponding items. Orphaned headers show zero totals — not corrupt, but confusing. Fix: add a post-import warning that checks for costs with no items.

### ~~Unique Invoice Number Constraints~~ [FIXED]

Fixed: Migration `20260305000001` adds:
- `UNIQUE (partner_company_id, invoice_number)` on `ar_invoices`
- Partial unique index `UNIQUE (entity_id, comprobante_number)` on `costs` (where both non-null)

Import validation added for both AR invoices and costs (against DB + within-file duplicates).

---

## Decisions Locked

These were discussed and decided on March 4, 2026:

| Decision | Resolution |
|---|---|
| Primary key for `exchange_rates` | UUID + UNIQUE(rate_date) — follows codebase convention |
| Fallback for missing dates | `WHERE rate_date <= $1 ORDER BY DESC LIMIT 1` — no `WITH RECURSIVE` |
| `mid_rate` column | Regular column computed in Python before insert — not `GENERATED ALWAYS AS` |
| Financial Position revaluation | **No.** Stays in natural currency (no conversion, no cross-currency totals) |
| FX gain/loss tracking | **No.** Too complex for this system. Open USD shown at today's rate on AP/AR summary cards is sufficient |
| CSV bulk import of rates | Deferred — bundled with Excel import feature work |
| Existing SQL views | No changes needed — all read from transaction snapshots |
| Stored transaction rates | Never overwritten — snapshot at entry time is the source of truth |

## Business Decisions Locked

1. **Partner settlement currency** — PEN. All contributions converted to PEN at transaction-date rates. Settlements calculated and paid in PEN.
2. **Buy vs sell rate per transaction type** — Mid-rate for everything in the management system. The `buy_rate` and `sell_rate` columns exist in the table for the external accountant to reference if needed for SUNAT-compliant filings, but the CLI and website default to `mid_rate`.
