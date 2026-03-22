# Skill: SQL Views Generator

**Trigger:** Any time a database view needs to be written or modified.

**Input:**
- `docs/08_schema.md` — table structures and views section
- `docs/03_module_specifications.md` — business rules for what each view represents

**Output:** One SQL file per view in `supabase/views/`, named `v_[view_name].sql`.

---

## Views — Current State (10 Views, V1)

| File | View Name | Purpose |
|---|---|---|
| `v_invoice_totals.sql` | `v_invoice_totals` | Derives subtotal, igv_amount, detraccion_amount, retencion_amount, total per invoice from invoice_items (both directions) |
| `v_invoice_balances.sql` | `v_invoice_balances` | amount_paid, outstanding, payment_status per invoice with detraccion/retencion payment splits |
| `v_invoices_with_loans.sql` | `v_invoices_with_loans` | UNION of commercial invoices + loan schedule entries with aging buckets — all statuses (Invoices browse page) |
| `v_obligation_calendar.sql` | `v_obligation_calendar` | Unpaid/partial invoices and loan schedule entries sorted by due date with days_remaining (Calendar page) |
| `v_payments_enriched.sql` | `v_payments_enriched` | Payments enriched with entity name, project code, invoice number, bank name (Payments browse page) |
| `v_bank_balances.sql` | `v_bank_balances` | Calculated balance per bank account from payment movements |
| `v_loan_balances.sql` | `v_loan_balances` | Borrowed, total owed, paid, outstanding, derived status per loan |
| `v_budget_vs_actual.sql` | `v_budget_vs_actual` | Budgeted vs actual per project per category |
| `v_igv_position.sql` | `v_igv_position` | IGV collected vs IGV paid, net position per currency |
| `v_retencion_dashboard.sql` | `v_retencion_dashboard` | Retencion tracking and verification status per receivable invoice |

---

## Rules

### Naming

All views prefixed with `v_` in SQL. Referenced without the `v_` prefix in application code.

### Header Comment — Every View

```sql
-- View: v_invoice_totals
-- Purpose: Derives subtotal, igv_amount, detraccion_amount, retencion_amount, total per invoice from invoice_items
-- Source tables: invoices, invoice_items
-- Used by: Invoices page, Calendar page, Financial Position
CREATE OR REPLACE VIEW v_invoice_totals AS
```

### Never Store Derived Data

Views only SELECT and compute. No INSERT, UPDATE, or materialized views.

### SQL Functions for Tax Calculations

V1 uses SQL functions (`fn_igv_amount`, `fn_detraccion_amount`, `fn_retencion_amount`) for tax computations. Views call these functions rather than duplicating formulas:

```sql
fn_igv_amount(subtotal, igv_rate)
fn_detraccion_amount(subtotal, igv_amount, detraccion_rate)
fn_retencion_amount(subtotal, igv_amount, retencion_rate, retencion_applicable)
```

### Payment Status Logic — Always Use This Pattern

```sql
CASE
  WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
  WHEN COALESCE(SUM(p.amount), 0) >= total THEN 'paid'
  ELSE 'partial'
END AS payment_status
```

### Days Remaining for Calendar

```sql
(due_date - CURRENT_DATE) AS days_remaining
```

### Aging Buckets (Invoices Page)

```sql
CASE
  WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN 'current'
  WHEN (CURRENT_DATE - due_date) <= 30 THEN '1-30'
  WHEN (CURRENT_DATE - due_date) <= 60 THEN '31-60'
  WHEN (CURRENT_DATE - due_date) <= 90 THEN '61-90'
  ELSE '90+'
END AS aging_bucket
```

### Null Safety

Always use `COALESCE` for aggregated amounts that could be null when no payments or line items exist:

```sql
COALESCE(SUM(p.amount), 0) AS amount_paid
```

### Active Records Only

Views should filter `is_active = true` on joined reference/master data tables (bank_accounts, entities, entity_contacts, tags, projects). Transaction tables (invoices, invoice_items, payments) and historical reference tables (quotes) are permanent records — never filter them by `is_active`.

**Exception — financial/historical views:** Views that report on financial history intentionally skip `is_active` filters on joined reference tables. Deactivating a project or entity must not hide its historical transactions from reports. Filtering in these views should be handled at the application layer via optional toggles, not forced in SQL.

### Currency Awareness

Views never convert between currencies. When a view aggregates amounts, it should either:
- Group by currency (preferred for summaries)
- Only aggregate same-currency records
- Include currency as a column so the consumer knows what they're looking at

---

## View-Specific Business Rules

### v_invoice_totals
- Source: `invoices` LEFT JOIN `invoice_items`
- Two-stage CTE: `item_sums` aggregates invoice_items per invoice, `with_igv` adds igv_amount
- Computes subtotal (SUM of invoice_items.subtotal), igv_amount, total, detraccion_amount, retencion_amount using SQL functions
- Works for both `direction = 'payable'` and `direction = 'receivable'`

### v_invoice_balances
- Source: `v_invoice_totals` LEFT JOIN `payments` (where `related_to = 'invoice'`)
- Shows amount_paid, outstanding, payment_status per invoice
- Tracks detraccion_paid and retencion_paid separately (split by payment_type)
- Computes `payable_or_receivable` (outstanding minus unpaid detraccion/retencion portions)
- Computes `bdn_outstanding` (Banco de la Nación balance — detraccion amounts not yet deposited)
- Must use LEFT JOIN — invoices with zero payments must still appear

### v_invoices_with_loans
- Source: `v_invoice_balances` UNION `loan_schedule` (with LATERAL join for payment aggregation)
- Shows ALL statuses (paid, partial, pending) — no filtering on payment status
- Type column: `'commercial'` or `'loan'`
- Includes aging_bucket and days_overdue for sorting and bucketing
- Used by the Invoices browse page

### v_obligation_calendar
- Source: `v_invoice_balances` UNION `loan_schedule` (with LATERAL join for payment aggregation)
- Filters: only items with payment_status IN ('pending', 'partial') — action view
- Sorted by due_date ASC (most urgent first)
- Includes days_remaining calculated from due_date
- Both directions (AP + AR) — Calendar page filters by direction at query time

### v_payments_enriched
- Source: `payments` UNION (invoice-related payments JOIN invoices/entities/projects, loan-related payments JOIN loan_schedule/loans/entities)
- Two-part UNION handles different join paths for invoice vs loan payments
- Enriches with entity_name, project_code, invoice_number, bank_name
- Ordered by payment_date DESC

### v_bank_balances
- Source: `payments` grouped by bank_account_id, joined to `bank_accounts` and `entities`
- Inbound payments add to balance, outbound payments subtract
- Shows active accounts OR accounts with non-zero balances

### v_loan_balances
- Source: `loans` LEFT JOIN `loan_schedule` LEFT JOIN `payments` (where `related_to = 'loan_schedule'`)
- Three CTEs: `loan_totals` (computes total_owed from return_type/rate), `loan_paid` (aggregates payments), `schedule_stats` (counts entries)
- Status derived: active (no payments), partially_paid, settled
- Return amount calculated from `return_type`: percentage applies `agreed_return_rate` to `amount`, fixed uses `agreed_return_amount`
- Exposes `partner_id` for partner filter
- Loans are permanent records — no `is_active` filter

### v_budget_vs_actual
- Source: `project_budgets` LEFT JOIN `invoice_items` + `invoices` (grouped by category)
- Only includes payable invoices where `cost_type = 'project_cost'`
- Compares budgeted_amount vs actual (SUM of invoice_items.subtotal) per project per category
- Includes variance (budgeted - actual) and pct_used

### v_igv_position
- Source: `v_invoice_totals`
- UNION approach: IGV collected (from receivable invoices) vs IGV paid (from payable invoices)
- Net position = IGV paid - IGV collected, grouped by currency
- Positive = net credit (credito fiscal), negative = net liability to SUNAT

### v_retencion_dashboard
- Source: `v_invoice_totals` WHERE `direction = 'receivable'` AND `retencion_applicable = true`, JOIN `projects`, JOIN `entities`
- Two CTEs: `ar_base` filters to applicable invoices, `ar_with_totals` adds computed amounts via SQL functions
- Shows retencion_verified status, days_since_invoice
- Ordered by `retencion_verified ASC` (unverified first), then `days_since_invoice DESC` (oldest unverified at top)

---

## Verification

After generating each view:

1. The header comment accurately describes purpose and source tables
2. All column references match actual table/column names from the schema
3. NULL safety is handled with COALESCE where aggregation could produce NULL
4. LEFT JOINs are used where records without related data must still appear
5. The view runs without errors via `supabase db execute --file`
6. Currency is never converted — always preserved as-is
7. SQL functions (fn_igv_amount, fn_detraccion_amount, fn_retencion_amount) are used for tax calculations — no inline formulas
