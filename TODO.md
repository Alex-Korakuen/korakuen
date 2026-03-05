# TODO — Korakuen Improvements

Decided during review on March 4, 2026. Updated March 4, 2026.


## PENDING — Exchange Rates & Functional Currency (PEN)

Decided March 4, 2026. The system adopts PEN as the functional currency for reporting. A master exchange rate table provides SUNAT rates for historical snapshotting at data entry time. No revaluation of stored transaction rates — the rate on each record remains the source of truth.

### 6. Master `exchange_rates` table

**New table in Layer 1.** Stores daily SUNAT buy/sell rates. Does not FK to any financial table — purely a lookup/reference table.

**Schema:**
- `id` UUID primary key (per codebase convention)
- `rate_date` DATE, UNIQUE — one rate per calendar day
- `buy_rate` NUMERIC(10,4) NOT NULL — SUNAT "Compra"
- `sell_rate` NUMERIC(10,4) NOT NULL — SUNAT "Venta"
- `mid_rate` NUMERIC(10,4) NOT NULL — computed as `(buy_rate + sell_rate) / 2` in Python before insert (not a generated column)
- `source` VARCHAR(50) DEFAULT 'SUNAT'
- `created_at`, `updated_at` per convention
- RLS: SELECT for all authenticated users, INSERT/UPDATE for service role only

**Fallback logic for missing dates (weekends/holidays):**
```sql
SELECT mid_rate FROM exchange_rates
WHERE rate_date <= $target_date
ORDER BY rate_date DESC LIMIT 1;
```
Simple subquery, O(log n) with the UNIQUE index. No `WITH RECURSIVE`.

**Bulk import:** Deferred — will be built alongside the Excel import features for all modules. Until then, rates entered via CLI single-entry or direct SQL.

**Tasks:**
- [ ] Write migration: CREATE TABLE, RLS policy, `updated_at` trigger
- [ ] Add `ExchangeRate` type to `types.ts`
- [ ] Regenerate `database.types.ts`
- [ ] Create CLI module `exchange_rates.py` (menu item 9: add single rate, list recent rates)
- [ ] Add menu item to `main.py`

### 7. CLI rate suggestion at data entry

**Modify `get_exchange_rate()` in `helpers.py`** to accept an optional `transaction_date` parameter. When provided, query the `exchange_rates` table using the fallback logic and suggest the `mid_rate`. User can press Enter to accept or type a custom rate to override.

If no rate exists in the table (empty table, or date is before earliest rate), fall through to manual entry with no suggestion — no crash, no error.

**Call sites to update (7 total across 5 modules):**
- [ ] `helpers.py` — modify `get_exchange_rate()` signature and body
- [ ] `costs.py` — pass `date` to `get_exchange_rate()` (1 call site)
- [ ] `ar_invoices.py` — pass `date` to `get_exchange_rate()` (1 call site)
- [ ] `payments.py` — pass `date` to `get_exchange_rate()` (1 call site)
- [ ] `loans.py` — pass `date` to `get_exchange_rate()` (3 call sites)
- [ ] `quotes.py` — pass `date` to `get_exchange_rate()` (1 call site)

### 8. PEN-only P&L

Remove the currency selector from the P&L page. All amounts displayed in PEN, converted at the transaction-date `exchange_rate` stored on each record (existing `convertAmount()` behavior, hardcoded to PEN).

- [ ] Remove currency selector from P&L filter strip
- [ ] Hardcode `reportingCurrency = 'PEN'` in P&L queries
- [ ] Update footnote: "USD transactions converted at historical transaction-date exchange rate"

### 9. PEN-only Cash Flow

Remove the currency selector. All amounts in PEN. The cash shortfall warning finally works correctly in a single currency.

- [ ] Remove currency selector from Cash Flow filter strip
- [ ] Hardcode `reportingCurrency = 'PEN'`
- [ ] Add footnote distinguishing actual months (transaction-date rates) from forecast months (current rate from `exchange_rates` table)
- [ ] Forecast months: use latest rate from `exchange_rates` instead of a hardcoded fallback

### 10. AP Calendar & AR Outstanding — PEN aggregate with natural currency detail

Summary cards show a PEN total as the primary number, with USD exposure shown as a secondary muted line. Table rows stay in natural currency (USD invoices show USD, PEN invoices show PEN) — Alex needs to know the actual currency of each obligation.

Open USD transactions in summary cards are converted at today's rate from the `exchange_rates` table. This is what it would cost to cover them today — not a revaluation of the stored record, just a display conversion for the summary total.

**AP Calendar:**
- [ ] Modify SummaryCard to show PEN total (primary) with USD subtotal (secondary, muted)
- [ ] Convert open USD amounts at latest rate from `exchange_rates` for summary only
- [ ] Add rate indicator below cards: "USD totals converted at [rate] as of [date]"
- [ ] Table rows: keep natural currency, no change
- [ ] Keep currency filter (relabel if needed — it filters rows, not reporting currency)

**AR Outstanding:**
- [ ] Same SummaryCard changes as AP Calendar
- [ ] Same rate indicator
- [ ] Table rows: keep natural currency
- [ ] Footer total rows: keep separate PEN/USD totals

### 11. Partner Balances — transaction-date PEN for contributions

Contributions section converts USD costs to PEN at the `exchange_rate` stored on each cost record (transaction-date rate). This reflects the actual economic cost at the time of payment. Settlement section uses current rate from `exchange_rates` since settlements happen in the present.

- [ ] Convert contributions to PEN using stored transaction-date rates
- [ ] Label: "Contributions (in PEN at transaction-date rates)"
- [ ] Settlement section: convert at current rate, label with rate and date
- [ ] Cost detail modal: show original currency amounts alongside PEN

### 12. Rate indicator strip component

Reusable component for any page that displays converted amounts. Shows the exchange rate used and its effective date. Compact one-line strip below page header.

```
Exchange rate: USD/PEN 3.82 (as of 2026-03-03)
```

- [ ] Build `RateIndicator` component
- [ ] Use on: Cash Flow, P&L, AP Calendar, AR Outstanding, Partner Balances

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

---

## Business Decisions Locked

1. **Partner settlement currency** — PEN. All contributions converted to PEN at transaction-date rates. Settlements calculated and paid in PEN.
2. **Buy vs sell rate per transaction type** — Mid-rate for everything in the management system. The `buy_rate` and `sell_rate` columns exist in the table for the external accountant to reference if needed for SUNAT-compliant filings, but the CLI and website default to `mid_rate`.
