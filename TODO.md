# TODO — Korakuen

Development is complete — only minor adjustments and feature additions remain.

---

## Excel Import on Website

Add Excel import features directly to the website. Currently, bulk data import is done via CLI scripts reading Excel templates. Move this capability to the web interface so all partners can import data.

### Tasks

- [ ] Design import UI (file upload component, preview/validation step, confirmation)
- [ ] Implement server-side Excel parsing (reuse validation logic from `cli/lib/import_helpers.py`)
- [ ] Costs import page
- [ ] AR invoices import page
- [ ] Payments import page
- [ ] Entities import page
- [ ] Exchange rates import page

---

## Known Issues

### Cost Import — Headers Without Items Warning [LOW]

The cost import is a two-step workflow (import headers, then import items). No validation ensures imported headers get corresponding items. Orphaned headers show zero totals — not corrupt, but confusing. Fix: add a post-import warning that checks for costs with no items.

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

---

*This file replaces `docs/09_dev_roadmap.md`. Update as tasks complete.*
