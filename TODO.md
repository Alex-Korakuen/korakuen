# TODO — Korakuen

Development is complete — only minor adjustments and feature additions remain.

---

## Website Data Entry

Move all data entry from CLI to website. Excel imports, inline forms, and action modals — all partners can create and manage data directly. See `docs/14_website_imports.md` for full spec.

### Done

- [x] Add RLS INSERT/UPDATE policies for all writable tables
- [x] Entities create modal
- [x] Entity tags dropdown management (inline)
- [x] Entity contacts inline form (entity detail panel)
- [x] Register Payment inline form (AP Calendar detail — Payment History section)
- [x] Register Collection inline form (AR Outstanding detail — Payment History section)
- [x] Create Project modal
- [x] Project budgets inline form (project detail)
- [x] Create Bank Account modal (Financial Position)
- [x] Create Loan modal + loan schedule inline form (Financial Position / AP Calendar detail)
- [x] Register Loan Repayment form (AP Calendar loan detail)

### Remaining

- [ ] Design import UI (file upload component, preview/validation step, confirmation)
- [ ] Implement server-side Excel parsing (SheetJS + zod validation)
- [ ] Entities import (bulk from Excel)
- [ ] Quotes import (Prices page)
- [ ] Costs import (AP Calendar — single-file grouped format)
- [ ] AR invoices import (AR Outstanding)

---

## Investigate: Partner Removal Impact on Financial Data

When a partner is removed from a project, their historical costs and AR payments remain in the database. Need to investigate:
- What happens to settlement calculations when a partner is removed but still has costs/revenue linked?
- Should removal be blocked if the partner has financial data?
- Should removed partners still appear in the settlement view (read-only, no delete button)?
- Does `is_active = false` on `project_partners` properly exclude them from new calculations while preserving history?

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
