# TODO — Korakuen



## Investigate: Partner Removal Impact on Financial Data

When a partner is removed from a project, their historical invoices and payments remain in the database. Need to investigate:
- What happens to settlement calculations when a partner is removed but still has invoices linked?
- Should removal be blocked if the partner has financial data?
- Should removed partners still appear in the settlement view (read-only, no delete button)?
- Does `is_active = false` on `project_partners` properly exclude them from new calculations while preserving history?
---

## RLS Policies: Partner-Scoped Write Access

`supabase/migrations/20260309000001_rls_write_policies.sql` — all write policies use `WITH CHECK (true)` with no per-partner scoping. Any authenticated user can edit invoices, payments, loans across all partners. Acceptable for now given small trusted user base, but a risk if the user base grows.

**Fix:** Implement partner-scoped RLS policies that restrict writes to records matching the user's `partner_company_id`. Requires a user→partner mapping (e.g. via `auth.users` metadata or a lookup table).

---

## Requirements Coverage Assessment (updated March 19, 2026)

### Summary

| Function | Rating | Coverage |
|---|---|---|
| Payment management | Mostly Complete | ~93% |
| Invoice management | Mostly Complete | ~91% |
| Calendar management | Mostly Complete | ~85% |
| Quote management | Partial | ~35% |
| Project management | Complete | ~97% |
| Entity management | Complete | ~95% |

### Payment Management — Mostly Complete

**Works:** Register payments inline from invoice detail (regular, detraccion, retencion). Register loan repayments. Payments page with full filtering. Payment totals and net position (PEN/USD). Bulk CSV import. Cross-currency support. Payment edit and soft-delete.

**Gaps:**
- No notes field in inline registration form (workaround: edit payment after creation to add notes)
- Exchange rate entry form missing (Supabase Dashboard workaround)

### Invoice Management — Mostly Complete

**Works:** Detail view with line items, IGV, detraccion, retencion, payment history. Invoice list with 6 filter types + aging analysis. Payment status tracking. Inline payment registration. Bulk Excel import (payable and receivable). Invoice editing (all fields except direction, partner, currency, project). Invoice soft-delete with cascading payment deactivation.

**Gaps:**
- No single-invoice creation form — all invoices must be bulk-imported

### Calendar Management — Mostly Complete

**Works:** Unified view combining AP obligations, AR collections, and loan repayments. Time-bucketed display (Overdue → Later). Dual-currency totals per bucket and grand total. Urgency color-coding. Partner filter integration.

**Gaps:**
- No direction filter toggle in UI (API supports it)
- No inline detail modal (redirects to Invoices page)
- No net cash flow projection view

### Quote Management — Partial

**Works:** Database schema supports quotes. Bulk import via Excel on Prices page. Quotes display mixed into Prices page alongside invoice items. Quote-to-invoice linking at import time.

**Gaps:**
- No quote creation form — can only import via Excel
- No dedicated Quotes page — quotes buried in Prices page
- No quote status management UI (can't accept/reject through website)
- No quote detail view
- No quote section on project or entity detail pages

### Project Management — Complete

**Works:** Project creation with auto-generated codes (PRY001...). Project list with status filtering. Full detail view: partners, entities/suppliers, budget vs. actual. Partner settlement calculations. Budget management with inline editing. Project detail editing (name, status, contract value, start date, expected end date, actual end date, location, notes). Actual end date capture with helper text. Partner profit share inline editing.

**Gaps:**
- None

### Entity Management — Complete

**Works:** Entity creation modal with validation (RUC/DNI, duplicate check). Entity list with search and multi-filter. Contact management (add/edit/remove). Tag management. Financial data per entity (payables/receivables by project). Entity editing (legal name, common name, city, region, notes — document type/number locked). Soft-delete/deactivate with confirmation modal and impact warning. Contact inline editing.

**Gaps:**
- None

### Cross-Cutting Gaps

Two patterns repeat across areas:

1. **Creation limited to import** — Invoices and quotes can only be created via bulk Excel import. No single-record creation forms.
2. **Exchange rate entry** — Needed for payment registration and invoice import. Currently requires Supabase Dashboard.

---

