# TODO — Korakuen

Development is complete — only minor adjustments and feature additions remain.

---

## Website Data Entry

Move all data entry from CLI to website. Excel imports, inline forms, and action modals — all partners can create and manage data directly. See `docs/14_website_imports.md` for full spec.

### Tasks

- [ ] Add RLS INSERT/UPDATE policies for all writable tables
- [ ] Design import UI (file upload component, preview/validation step, confirmation)
- [ ] Implement server-side Excel parsing (SheetJS + zod validation)
- [ ] Entities import + create modal
- [ ] Entity tags dropdown management (inline, wherever tags appear)
- [ ] Entity contacts inline form (entity detail panel)
- [ ] Quotes import (Prices page)
- [ ] Costs import (AP Calendar — single-file grouped format)
- [ ] AR invoices import (AR Outstanding)
- [ ] Register Payment modal (AP Calendar row detail)
- [ ] Register Collection modal (AR Outstanding row detail)
- [ ] Create Project modal + inline forms (partners, entities, budgets)
- [ ] Create Bank Account modal (Financial Position)
- [ ] Create Loan modal + loan schedule inline form (Financial Position)
- [ ] Register Loan Repayment modal (AP Calendar row detail)

---

## Fix Partner Ledger Settlement Logic

The `v_partner_ledger` view currently calculates `income_share_pen = total_income × profit_share_pct`, which distributes the **entire income** by %. The correct formula is to distribute **profit** (income - project costs) by %. SG&A costs are excluded — they belong to the individual partner.

### Correct settlement formula
- Project profit = project income - project costs (where `cost_type = 'project_cost'`)
- Each partner's profit share = profit × `profit_share_pct`
- Settlement = profit_share - costs_they_actually_paid
- Each partner receives from income pool: costs_paid + profit × their %

### Tasks

- [x] Rewrite `v_partner_ledger` SQL view to use profit-based distribution
- [x] Filter costs to `cost_type = 'project_cost'` only (exclude SG&A)
- [x] Add `profit_share_pen` and `should_receive_pen` columns to the view
- [x] Update Partner Balances page (`queries.ts` + component) to use new columns
- [ ] Test with real data to verify settlements net to zero across partners


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
