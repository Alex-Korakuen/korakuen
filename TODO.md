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

## Fix Partner Ledger Settlement Logic

The `v_partner_ledger` view currently calculates `income_share_pen = total_income × profit_share_pct`, which distributes the **entire income** by %. The correct formula is to distribute **profit** (income - project costs) by %. SG&A costs are excluded — they belong to the individual partner.

### Correct settlement formula
- Project profit = project income - project costs (where `cost_type = 'project_cost'`)
- Each partner's profit share = profit × `profit_share_pct`
- Settlement = profit_share - costs_they_actually_paid
- Each partner receives from income pool: costs_paid + profit × their %

### Tasks

- [ ] Rewrite `v_partner_ledger` SQL view to use profit-based distribution
- [ ] Filter costs to `cost_type = 'project_cost'` only (exclude SG&A)
- [ ] Add `profit_share_pen` and `settlement_pen` columns to the view
- [ ] Update Partner Balances page (`queries.ts` + component) to use new columns
- [ ] Test with real data to verify settlements net to zero across partners

---

## Categories Table

Cost item categories are currently hardcoded as string lists in 6 places (CLI, website, import templates, docs, skills). Move categories to a database table so they're managed from one place and cascade automatically.

### Tasks

- [x] Create `categories` table with `name`, `cost_type` (project_cost / sga), `label`, `is_active`, timestamps
- [x] Write seed migration with current 10 categories
- [x] Add FK from `cost_items.category` and `project_budgets.category` to `categories.name`
- [x] Update CLI `costs.py` to read categories from database instead of hardcoded lists
- [x] Update website `constants.ts` to query categories from database
- [x] Update import template generation to read from database
- [x] Remove hardcoded category lists from skills and docs (reference "whatever's in the table")

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
