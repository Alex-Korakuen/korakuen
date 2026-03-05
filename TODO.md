# TODO — Korakuen Improvements

Updated March 5, 2026.

---

## To Investigate

### Partner Balances — Review Calculation Logic

The Partner Balances page calculates who owes whom based on contribution % vs actual payments received. Needs validation:

- [ ] Confirm balance formula: `income_share - actually_received` — does this match how partners actually agree to settle?
- [ ] AR payments include all `payment_type` values (regular, detraccion, retencion). Detraccion goes to Banco de la Nacion (restricted use) and retencion is withheld by the client — should these count as "actually received", or only regular bank payments?
- [ ] Balance section converts USD at current rate while contributions use transaction-date rates. This is a deliberate choice but creates a conceptual mismatch — verify this reflects how the partners think about it

---

## Known Issues

### ~~SG&A "Other" Misrouted in Cash Flow~~ [FIXED]

Fixed: `mapCategory()` now receives `cost_type` and routes SG&A "other" correctly.

### Cost Import — Headers Without Items Warning [LOW]

The cost import is a two-step workflow (import headers, then import items). No validation ensures imported headers get corresponding items. Orphaned headers show zero totals — not corrupt, but confusing. Fix: add a post-import warning that checks for costs with no items.

### ~~P&L Profit Share Used Blended All-Time Ratios~~ [FIXED]

Fixed: Alex's profit share now weights each project's profit by Alex's per-project `contribution_pct` from `v_partner_ledger`, then splits SGA proportionally by period cost share. Previously used a single blended ratio across all projects and time periods.

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

1. **Partner balance currency** — PEN. All contributions converted to PEN at transaction-date rates. Balances calculated in PEN.
2. **Buy vs sell rate per transaction type** — Mid-rate for everything in the management system. The `buy_rate` and `sell_rate` columns exist in the table for the external accountant to reference if needed for SUNAT-compliant filings, but the CLI and website default to `mid_rate`.
