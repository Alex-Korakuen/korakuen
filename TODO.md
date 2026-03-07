# TODO — Korakuen Improvements

Updated March 6, 2026.

---

## Known Issues

### Cost Import — Headers Without Items Warning [LOW]

The cost import is a two-step workflow (import headers, then import items). No validation ensures imported headers get corresponding items. Orphaned headers show zero totals — not corrupt, but confusing. Fix: add a post-import warning that checks for costs with no items.

---

## Code Quality Fixes — March 6, 2026

### MEDIUM — Fixed

| # | Issue | Resolution |
|---|---|---|
| 5 | `_get_rate` duplicates `get_exchange_rate` validation | Added `prompt` parameter to `get_exchange_rate()` in helpers.py. Deleted `_get_rate` from exchange_rates.py. |
| 6 | Comprobante type enums hardcoded in 4+ places | Canonical constants (`COMPROBANTE_TYPES_ALL`, `COMPROBANTE_TYPES_AR`, `NO_IGV_CREDIT_TYPES`) in helpers.py. costs.py, ar_invoices.py, generate_templates.py import from there. |
| 7 | `convertAmount` private in 1960-line queries.ts | Moved to formatters.ts as exported function. queries.ts imports it. |
| 10 | IGV calculation formula repeated in 5 SQL views | Created `fn_igv_amount`, `fn_detraccion_amount`, `fn_retencion_amount` PostgreSQL functions (migration 20260306000002). Updated 5 views. |

### MEDIUM — Skipped (over-engineering)

| # | Issue | Reason |
|---|---|---|
| 8 | Duplicated filter state pattern (3 pages) | Each page has different filter shapes. `useState` with an object is trivially readable. A generic hook saves ~3 lines per component at the cost of indirection. |
| 9 | Duplicated modal loading/error state (3 pages) | Each page has different detail types, fetch functions, and cleanup. AP Calendar has branching cost-vs-loan fetch. 10 lines of straightforward async state per page is acceptable. |

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
3. **Partner profit shares** — Explicit per-project % stored in `project_partners` table (must total 100%). Income distribution uses agreed share, not cost contribution ratio.
4. **Settlement exchange rates** — All payment amounts converted at transaction-date rates (stored on each payment record). No current-rate conversion.
