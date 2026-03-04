# TODO — Website UI Improvements

Decided during review on March 4, 2026. All changes are frontend-only unless noted.

---

## 1. Layout: Move branding to sidebar, page title to header

- Move "KORAKUEN" text from header into sidebar header (currently empty on desktop)
- When sidebar collapsed, show "K" instead of "KORAKUEN"
- Header left side: show current page title (e.g., "Prices", "AP Calendar")
  - Derive from `usePathname()` or route mapping
- Remove the 1-line subtitle description from all 9 page components
- Touches: `sidebar.tsx`, `header.tsx`, all 9 page files (delete `<h1>` + `<p>`)

## 2. Unify AR and AP table columns

Both tables should share the same column structure for consistency.

**Unified columns:**
| Column | Notes |
|---|---|
| Due Date | Already on both |
| Days | `days_overdue` on AR, `days_remaining` on AP — keep existing color logic |
| Type | AP only — "Supplier" / "Loan". AR omits this column |
| Supplier / Client | `entity_name` on AP, `client_name` on AR |
| Project | `project_code` on both |
| Title | Already on AP. AR currently shows Invoice# here — use invoice description or number |
| Gross | Already on AR (`gross_total`). AP needs `total` from `v_ap_calendar` |
| Outstanding | Already on both |
| Cur. | Already on both |
| Invoice # | Already on AR. AP needs `document_ref` — **requires `v_ap_calendar` view update** |

**Columns removed from AR main table (moved to detail modal):**
- Inv. Date, Detraccion, Retencion, Net Receivable, Paid

**View update needed:** Add `document_ref` to `v_ap_calendar` (from `costs` table). Migration required.

## 3. Drop STATUS column (UI-only removal)

Remove the payment_status badge from:
- AP Calendar table
- AR Outstanding table
- Projects page → AR Invoices list

**Keep untouched:**
- `payment_status` in SQL views (`v_ar_balances`, `v_cost_balances`, `v_ap_calendar`) — used for filtering unpaid records
- `.in('payment_status', ['pending', 'partial'])` filters in `queries.ts` (Cash Flow, Financial Position, AP/AR pages)
- CLI `payments.py` display when selecting costs/invoices to pay

**Can delete after removal:**
- `formatPaymentStatus()` and `statusBadgeClass()` helper functions (verify no remaining usages first)

## 4. Projects: Merge Assigned Entities + Spending by Entity

Replace two separate sections with one unified table.

**Merged columns:**
| Column | Source |
|---|---|
| Entity Name | Both sections |
| Role | `project_entities` → `tags.name` |
| Total Spent | `v_cost_totals` grouped by `(entity_id, currency)` |
| # Invoices | Count of cost headers per group |

- Entities assigned but with no spending: show `—` for Total Spent and # Invoices
- Entities with spending but no formal assignment: show `—` for Role
- Entity with both PEN and USD costs: show as 2 separate rows, role repeated
- Join logic: outer join between `project_entities` and spending data (in query or client-side)

## 5. Entities: Transaction History — modal instead of expandable rows

- Replace inline expandable rows with a detail modal on row click
- Modal shows individual transactions: Date, Type (Cost/AR Invoice), Title, Amount
- Remove `# Txns` column from the summary table
- Keep remaining columns: Project, AP Total, AR Total, Net, Last Date, Currency
- Currency column stays — grouping by `(project_id, currency)` means each row is single-currency; entity with both PEN and USD on same project appears as 2 rows
