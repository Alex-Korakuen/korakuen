# Skill: SQL Views Generator

**Trigger:** Any time a database view needs to be written or modified.

**Input:**
- `docs/08_schema.md` — table structures and views section
- `docs/03_module_specifications.md` — business rules for what each view represents

**Output:** One SQL file per view in `supabase/views/`, named `v_[view_name].sql`.

---

## Views to Generate

| File | View Name | Purpose |
|---|---|---|
| `v_cost_totals.sql` | `v_cost_totals` | Derives subtotal, igv_amount, detraccion_amount, total per cost from cost_items |
| `v_cost_balances.sql` | `v_cost_balances` | amount_paid, outstanding, payment_status per cost |
| `v_ar_balances.sql` | `v_ar_balances` | amount_paid, outstanding, payment_status per AR invoice |
| `v_ap_calendar.sql` | `v_ap_calendar` | Unpaid/partial costs sorted by due date with days remaining |
| `v_partner_ledger.sql` | `v_partner_ledger` | Contributions, stakes, income distribution per project |
| `v_entity_transactions.sql` | `v_entity_transactions` | All transactions per entity per project (costs + AR) |
| `v_bank_balances.sql` | `v_bank_balances` | Running balance per bank account |
| `v_project_pl.sql` | `v_project_pl` | Income, costs, gross profit per project |
| `v_company_pl.sql` | `v_company_pl` | Consolidated P&L including SG&A |
| `v_retencion_dashboard.sql` | `v_retencion_dashboard` | Retencion tracking and verification status per AR invoice |

---

## Rules

### Naming

All views prefixed with `v_` in SQL. Referenced without the `v_` prefix in application code.

### Header Comment — Every View

```sql
-- View: v_cost_totals
-- Purpose: Derives subtotal, igv_amount, detraccion_amount, total per cost from cost_items
-- Source tables: costs, cost_items
-- Used by: AP calendar, project P&L, cost detail pages
CREATE OR REPLACE VIEW v_cost_totals AS
```

### Never Store Derived Data

Views only SELECT and compute. No INSERT, UPDATE, or materialized views.

### IGV Calculation

```sql
ROUND(subtotal * (igv_rate / 100), 2) AS igv_amount
```

### Detraccion Calculation (on costs)

Detraccion is applied to the total (subtotal + IGV):

```sql
ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2) AS detraccion_amount
```

### Detraccion and Retencion Calculation (on AR invoices)

PostgreSQL does not allow referencing a column alias in the same SELECT. Use CTEs to layer calculations (see `v_ar_balances.sql` for the full implementation):

```sql
-- CTE 1: compute igv_amount
ROUND(subtotal * (igv_rate / 100), 2) AS igv_amount

-- CTE 2: use igv_amount to compute gross_total, detraccion, retencion
subtotal + igv_amount AS gross_total,
ROUND((subtotal + igv_amount) * COALESCE(detraccion_rate, 0) / 100, 2) AS detraccion_amount,
ROUND(
  CASE WHEN retencion_applicable THEN (subtotal + igv_amount) * COALESCE(retencion_rate, 0) / 100
  ELSE 0 END, 2
) AS retencion_amount

-- Final SELECT: use all computed columns
gross_total - detraccion_amount - retencion_amount AS net_receivable
```

### Payment Status Logic — Always Use This Pattern

```sql
CASE
  WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
  WHEN COALESCE(SUM(p.amount), 0) >= total THEN 'paid'
  ELSE 'partial'
END AS payment_status
```

### Days Remaining for AP Calendar

```sql
(c.due_date - CURRENT_DATE) AS days_remaining
```

### Null Safety

Always use `COALESCE` for aggregated amounts that could be null when no payments or line items exist:

```sql
COALESCE(SUM(p.amount), 0) AS amount_paid
```

### Active Records Only

Views should filter `is_active = true` on joined reference/master data tables (partner_companies, bank_accounts, entities, entity_contacts, tags, projects). Transaction tables (costs, cost_items, ar_invoices, payments) and historical reference tables (quotes, project_entities) are permanent records and do not have `is_active` — never filter them.

**Exception — financial/historical views:** Views that report on financial history (e.g., `v_partner_ledger`, `v_project_pl`, `v_entity_transactions`) intentionally skip `is_active` filters on joined reference tables. Deactivating a project or entity must not hide its historical transactions from reports. Filtering in these views should be handled at the application layer via optional toggles, not forced in SQL.

### Currency Awareness

Views never convert between currencies. When a view aggregates amounts, it should either:
- Group by currency (preferred for summaries)
- Only aggregate same-currency records
- Include currency as a column so the consumer knows what they're looking at

---

## View-Specific Business Rules

### v_cost_totals
- Source: `costs` JOIN `cost_items`
- Aggregates `cost_items.subtotal` per cost to get the cost subtotal
- Computes igv_amount and total from the aggregated subtotal and the cost's igv_rate
- Computes detraccion_amount from total and the cost's detraccion_rate

### v_cost_balances
- Source: `v_cost_totals` LEFT JOIN `payments` (where `related_to = 'cost'`)
- Shows amount_paid, outstanding, payment_status per cost
- Must use LEFT JOIN — costs with zero payments must still appear

### v_ar_balances
- Source: `ar_invoices` LEFT JOIN `payments` (where `related_to = 'ar_invoice'`)
- Computes igv_amount, gross_total, detraccion_amount, retencion_amount, net_receivable
- Shows amount_paid, outstanding (against gross_total), payment_status
- Must use LEFT JOIN — AR invoices with zero payments must still appear

### v_ap_calendar
- Source: `v_cost_balances` (or costs + cost_totals + payments)
- Filters: only costs with `due_date IS NOT NULL` and payment_status IN ('pending', 'partial')
- Sorted by due_date ASC
- Includes days_remaining calculated from due_date

### v_partner_ledger
- Source: `costs` JOIN `bank_accounts` (to derive partner), `ar_invoices`, `payments`
- Groups expenses by partner_company (derived from bank_account on costs)
- Calculates each partner's contribution percentage
- Shows income distribution proportional to contribution

### v_entity_transactions
- Source: `costs` UNION ALL `ar_invoices`, filtered by entity_id
- Shows all transactions (both AP and AR) for a given entity across projects

### v_bank_balances
- Source: `payments` grouped by bank_account_id
- Inbound payments add to balance, outbound payments subtract
- Running balance per account

### v_project_pl
- Source: `ar_invoices` (income) and `costs` (expenses) per project
- Income minus expenses equals gross profit
- Only project_cost type expenses (not SG&A)

### v_company_pl
- Source: all `ar_invoices` (income), all `costs` (project + SG&A)
- Shows total income, project costs, SG&A, and net profit

### v_retencion_dashboard
- Source: `ar_invoices` WHERE `retencion_applicable = true`, JOIN `projects`, JOIN `entities`
- Shows project_code, client name, invoice_number, invoice_date, due_date, gross_total, retencion_amount, retencion_verified, days_since_invoice
- Ordered by `retencion_verified ASC` (unverified first), then `days_since_invoice DESC` (oldest unverified at top)
- Apply `is_active = true` filter on projects and entities

---

## Verification

After generating each view:

1. The header comment accurately describes purpose and source tables
2. All column references match actual table/column names from the schema
3. NULL safety is handled with COALESCE where aggregation could produce NULL
4. LEFT JOINs are used where records without related data must still appear
5. The view runs without errors via `supabase db execute --file`
6. Currency is never converted — always preserved as-is
