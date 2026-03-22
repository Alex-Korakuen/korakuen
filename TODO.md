# TODO — Korakuen

## Investigate: Partner Removal Impact on Financial Data

When a partner is removed from a project, their historical invoices and payments remain in the database. Need to investigate:
- What happens to settlement calculations when a partner is removed but still has invoices linked?
- Should removal be blocked if the partner has financial data?
- Should removed partners still appear in the settlement view (read-only, no delete button)?
- Does `is_active = false` on `project_partners` properly exclude them from new calculations while preserving history?

---

## Feature Gaps

### Cross-Cutting
- Exchange rate entry form (currently requires Supabase Dashboard — blocks payment registration and invoice import)
- Single invoice creation form (all formal invoices must be bulk-imported)

### Quote Management (~35% coverage)
- Quote creation form
- Dedicated Quotes page (currently buried in Prices page)
- Quote status management UI (accept/reject)
- Quote detail view
- Quote section on project and entity detail pages

### Calendar Polish
- Direction filter toggle in UI (API supports it)
- Inline detail modal (currently redirects to Invoices page)
- Net cash flow projection view

### Payment Polish
- Notes field in inline registration form (workaround: edit after creation)
