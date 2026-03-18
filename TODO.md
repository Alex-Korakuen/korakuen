# TODO — Korakuen

Development is complete — only minor adjustments and feature additions remain.

---

## Investigate: Partner Removal Impact on Financial Data

When a partner is removed from a project, their historical invoices and payments remain in the database. Need to investigate:
- What happens to settlement calculations when a partner is removed but still has invoices linked?
- Should removal be blocked if the partner has financial data?
- Should removed partners still appear in the settlement view (read-only, no delete button)?
- Does `is_active = false` on `project_partners` properly exclude them from new calculations while preserving history?
---

## Website Features Needed

| # | Capability | Notes |
|---|---|---|
| 1 | Add/update exchange rate | Rates need daily entry — previously CLI-only, needs website form |
| 2 | Create new tag | Low priority — tags rarely created, can use Supabase Dashboard |

---

## Decisions Locked

| Decision | Resolution |
|---|---|
| Primary key for `exchange_rates` | UUID + UNIQUE(rate_date) — follows codebase convention |
| Fallback for missing dates | `WHERE rate_date <= $1 ORDER BY DESC LIMIT 1` — no `WITH RECURSIVE` |
| `mid_rate` column | Regular column computed in Python before insert — not `GENERATED ALWAYS AS` |
| Financial Position revaluation | **No.** Stays in natural currency (no conversion, no cross-currency totals) |
| FX gain/loss tracking | **No.** Too complex for this system |
| Partner balance currency | PEN. All contributions converted at transaction-date rates |
| Buy vs sell rate | Mid-rate for everything in the management system |
| Partner profit shares | Explicit per-project % in `project_partners` (must total 100%) |
| Settlement exchange rates | All amounts converted at transaction-date rates (stored on each payment record) |
