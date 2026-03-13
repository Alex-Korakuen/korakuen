# V1 Migration Plan — Unified Invoice Model

**Document version:** 1.1
**Date:** March 12, 2026
**Status:** Phases 1-3 complete, Phase 4 skipped, Phases 5-6 pending
**Parent document:** `docs/15_v1_restructure.md`

---

## Overview

This document is the implementation plan for the V1 restructure. It covers all six phases — database, types, queries, CLI, website, and cleanup. Phase 1 (database) is complete and deployed. Later phases are outlined at task level and will be detailed when we get to them.

---

## Phase 1: Database Migration — COMPLETE

**Migration file:** `supabase/migrations/20260312000002_v1_unified_invoices.sql`
**Status:** Deployed to production

### What was done

Single migration, single transaction, 20 steps:

1. Created `invoices` table with `direction` column (`'payable'` | `'receivable'`), `title` column kept
2. Created `invoice_items` table (replaces `cost_items`)
3. Created triggers (`trg_invoices_updated_at`, `trg_invoice_items_updated_at`)
4. Created indexes (`idx_invoices_project_id`, `_entity_id`, `_partner_company_id`, `_direction`, `idx_invoice_items_invoice_id`)
5. Created RLS policies (SELECT/INSERT/UPDATE on both tables)
6. Migrated payable invoices from `costs` (UUIDs preserved)
7. Migrated invoice items from `cost_items` (`cost_id` → `invoice_id`, UUIDs preserved)
8. Migrated receivable invoices from `ar_invoices` (UUIDs preserved)
9. Created synthetic line items for AR invoices (one `invoice_item` per AR invoice with `subtotal` as amount)
10. Updated `payments.related_to`: `'cost'` and `'ar_invoice'` → `'invoice'`
11. Renamed `quotes.linked_cost_id` → `linked_invoice_id`
12. Dropped old views: `v_cost_totals`, `v_cost_balances`, `v_ar_balances`, `v_ap_calendar`, `v_entity_transactions`, `v_igv_position`, `v_retencion_dashboard`, `v_budget_vs_actual`
13. Dropped `fn_create_cost_with_items()` RPC function
14. Dropped old tables: `cost_items`, `costs`, `ar_invoices` (CASCADE removes triggers, indexes, FKs, RLS)
15. Created `fn_create_invoice_with_items()` RPC function
16. Created `v_invoice_totals` view (replaces `v_cost_totals`)
17. Created `v_invoice_balances` view (replaces `v_cost_balances` + `v_ar_balances`)
18. Created `v_obligation_calendar` view (replaces `v_ap_calendar`, adds `direction` column)
19. Recreated `v_igv_position` (simplified — queries `v_invoice_totals` with direction filter)
20. Recreated `v_retencion_dashboard` (simplified — queries `v_invoice_totals WHERE direction = 'receivable'`)
21. Recreated `v_budget_vs_actual` (sources from `invoice_items` + `invoices`)

### Column mappings (reference)

**costs → invoices (direction = 'payable'):**

| costs column | invoices column | Notes |
|---|---|---|
| `id` | `id` | Preserved (UUID) |
| *(new)* | `direction` | `'payable'` |
| `partner_company_id` | `partner_company_id` | Direct copy |
| `project_id` | `project_id` | Direct copy |
| `entity_id` | `entity_id` | Direct copy (nullable) |
| `quote_id` | `quote_id` | Direct copy (nullable) |
| `purchase_order_id` | `purchase_order_id` | Direct copy (nullable) |
| `cost_type` | `cost_type` | Direct copy |
| `title` | `title` | Direct copy |
| `comprobante_number` | `invoice_number` | **Renamed** |
| `document_ref` | `document_ref` | Direct copy |
| `comprobante_type` | `comprobante_type` | Direct copy |
| `date` | `invoice_date` | **Renamed** |
| `due_date` | `due_date` | Direct copy |
| `currency` | `currency` | Direct copy |
| `exchange_rate` | `exchange_rate` | Direct copy |
| `igv_rate` | `igv_rate` | Direct copy |
| `detraccion_rate` | `detraccion_rate` | Direct copy |
| *(n/a)* | `retencion_applicable` | `false` (default) |
| *(n/a)* | `retencion_rate` | `NULL` |
| *(n/a)* | `retencion_verified` | `false` (default) |
| `payment_method` | `payment_method` | Direct copy |
| `notes` | `notes` | Direct copy |

**ar_invoices → invoices (direction = 'receivable'):**

| ar_invoices column | invoices column | Notes |
|---|---|---|
| `id` | `id` | Preserved (UUID) |
| *(new)* | `direction` | `'receivable'` |
| `partner_company_id` | `partner_company_id` | Direct copy |
| `project_id` | `project_id` | Direct copy |
| `entity_id` | `entity_id` | Direct copy |
| *(n/a)* | `quote_id` | `NULL` |
| *(n/a)* | `purchase_order_id` | `NULL` |
| *(n/a)* | `cost_type` | `NULL` |
| *(n/a)* | `title` | `NULL` |
| `invoice_number` | `invoice_number` | Direct copy |
| `document_ref` | `document_ref` | Direct copy |
| `comprobante_type` | `comprobante_type` | Direct copy |
| `invoice_date` | `invoice_date` | Direct copy |
| `due_date` | `due_date` | Direct copy |
| `currency` | `currency` | Direct copy |
| `exchange_rate` | `exchange_rate` | Direct copy |
| `igv_rate` | `igv_rate` | Direct copy |
| `detraccion_rate` | `detraccion_rate` | Direct copy |
| `retencion_applicable` | `retencion_applicable` | Direct copy |
| `retencion_rate` | `retencion_rate` | Direct copy |
| `retencion_verified` | `retencion_verified` | Direct copy |
| *(n/a)* | `payment_method` | `NULL` |
| `notes` | `notes` | Direct copy |

**cost_items → invoice_items:**

| cost_items column | invoice_items column | Notes |
|---|---|---|
| `id` | `id` | Preserved (UUID) |
| `cost_id` | `invoice_id` | **Renamed** — same UUID value |
| `title` | `title` | Direct copy |
| `category` | `category` | Direct copy |
| `quantity` | `quantity` | Direct copy |
| `unit_of_measure` | `unit_of_measure` | Direct copy |
| `unit_price` | `unit_price` | Direct copy |
| `subtotal` | `subtotal` | Direct copy |
| `notes` | `notes` | Direct copy |

### Decisions made

- **`title` kept on `invoices`** — used in AP Calendar display, entity transactions, and search. Populated from `costs.title` for payables, `NULL` for receivables.
- **Synthetic line items** created for AR invoices during migration (one item per invoice with `subtotal` as amount).

### View inventory (post-migration)

8 views total (was 10):

| View | Status | Source |
|---|---|---|
| `v_invoice_totals` | **New** (replaces `v_cost_totals`) | `invoices` + `invoice_items` |
| `v_invoice_balances` | **New** (replaces `v_cost_balances` + `v_ar_balances`) | `v_invoice_totals` + `payments` |
| `v_obligation_calendar` | **New** (replaces `v_ap_calendar`) | `v_invoice_balances` + `loan_schedule` |
| `v_igv_position` | **Simplified** | `v_invoice_totals` with direction filter |
| `v_retencion_dashboard` | **Simplified** | `v_invoice_totals WHERE direction = 'receivable'` |
| `v_budget_vs_actual` | **Updated** | `invoice_items` + `invoices WHERE direction = 'payable'` |
| `v_bank_balances` | Unchanged | `payments` + `bank_accounts` |
| `v_loan_balances` | Unchanged | `loans` + `loan_schedule` + `payments` |

### What was removed

- 3 tables: `costs`, `cost_items`, `ar_invoices`
- 5 views: `v_cost_totals`, `v_cost_balances`, `v_ar_balances`, `v_ap_calendar`, `v_entity_transactions`
- 1 RPC function: `fn_create_cost_with_items()`
- Old indexes, triggers, FK constraints, RLS policies on dropped tables
- 5 view files from `supabase/views/`

### Key field name changes for downstream code

| Old reference | New reference |
|---|---|
| `costs` table | `invoices WHERE direction = 'payable'` |
| `ar_invoices` table | `invoices WHERE direction = 'receivable'` |
| `cost_items` table | `invoice_items` |
| `cost_id` (on cost_items) | `invoice_id` (on invoice_items) |
| `costs.date` | `invoices.invoice_date` |
| `costs.comprobante_number` | `invoices.invoice_number` |
| `payments.related_to = 'cost'` | `payments.related_to = 'invoice'` |
| `payments.related_to = 'ar_invoice'` | `payments.related_to = 'invoice'` |
| `quotes.linked_cost_id` | `quotes.linked_invoice_id` |
| `v_cost_totals.cost_id` | `v_invoice_totals.invoice_id` |
| `v_cost_balances.cost_id` | `v_invoice_balances.invoice_id` |
| `v_ar_balances.ar_invoice_id` | `v_invoice_balances.invoice_id` |
| `v_ap_calendar` | `v_obligation_calendar` |
| `v_retencion_dashboard.ar_invoice_id` | `v_retencion_dashboard.invoice_id` |
| `fn_create_cost_with_items()` | `fn_create_invoice_with_items()` |

---

## Phase 2: TypeScript Types — COMPLETE

**Files:** `website/src/lib/database.types.ts`, `website/src/lib/types.ts`

### What was done

**`database.types.ts`** — manually patched to match V1 schema (will be regenerated via Supabase CLI in Phase 6):

- Removed table definitions: `ar_invoices`, `cost_items`, `costs`
- Added table definitions: `invoices` (with `direction`, `title`, all fields), `invoice_items`
- Removed view definitions: `v_ap_calendar`, `v_ar_balances`, `v_cost_balances`, `v_cost_totals`, `v_entity_transactions`
- Added view definitions: `v_invoice_balances` (34 columns), `v_invoice_totals` (28 columns), `v_obligation_calendar` (27 columns)
- Updated: `quotes.linked_cost_id` → `linked_invoice_id`, `v_retencion_dashboard.ar_invoice_id` → `invoice_id`
- Updated: `fn_create_cost_with_items` → `fn_create_invoice_with_items`

**`types.ts`** — full V1 type replacement:

| Removed | Added |
|---|---|
| `Cost`, `CostItem`, `ArInvoice` | `Invoice`, `InvoiceItem` |
| `ApCalendarRow` | `ObligationCalendarRow` |
| `CostBalanceRow`, `ArBalanceRow` | `InvoiceBalanceRow` |
| `CostDetailData`, `ArInvoiceDetailData` | `InvoiceDetailData` |
| `ArOutstandingRow` | `InvoicesPageRow` |
| `ArOutstandingBucketCounts`, `ArOutstandingBucketId` | `InvoiceAgingBuckets`, `InvoiceAgingBucketId` |
| `ApCalendarBucketId`, `ApCalendarBucketCounts` | `CalendarBucketId`, `CalendarBucketCounts` |
| `PartnerCostDetail` | `PartnerPayableDetail` (field: `cost_id` → `invoice_id`) |
| `PartnerRevenueDetail` | `PartnerReceivableDetail` |
| — | `InvoiceDirection` enum |
| — | `PaymentsPageRow`, `PaymentsSummary` |

Updated: `PriceHistoryRow.source` from `'cost' | 'quote'` → `'invoice' | 'quote'`

Kept unchanged: `LoanScheduleEntry`, `LoanDetailData`, `BucketValue`, all Cash Flow / Financial Position / Project / Entity types.

### Current state

Phase 2 complete. Types deployed alongside Phase 3 code changes.

---

## Phase 3: Server Queries + Actions — COMPLETE

**Files:** `website/src/lib/queries.ts`, `website/src/lib/actions.ts`, all page components
**Status:** Deployed with Phase 2

### What was done

**queries.ts** — full rewrite of all query functions:

| Old Function | New Function |
|---|---|
| `getCostDetail()` | `getInvoiceDetail()` (direction-agnostic) |
| `getArInvoiceDetail()` | *(merged into `getInvoiceDetail`)* |
| `getApCalendar()` | `getObligationCalendar()` (urgency buckets, both directions, `direction` filter param) |
| `getArOutstanding()` | Kept name, queries `v_invoice_balances WHERE direction = 'receivable'` with local `ArOutstandingRow` type |
| `getPartnerCostDetails()` | `getPartnerPayableDetails()` |
| `getPartnerRevenueDetails()` | `getPartnerReceivableDetails()` |
| `getFinancialPosition()` | Updated to use `v_invoice_balances` with direction filter |
| `getEntityDetail()` | Updated to use `v_invoice_balances` with direction filter |
| `getCashFlow()` | Updated all cost/AR references to invoice references |
| `getProjectDetail()` | Updated to use `v_invoice_totals` |
| `getPriceHistory()` | Updated `cost_items` → `invoice_items`, `costs` → `invoices` |
| `getPriceFilterOptions()` | Updated `cost_items` → `invoice_items` |
| `getClientsForFilter()` | Queries `invoices WHERE direction = 'receivable'` |
| `getBankTransactions()` | Queries `invoices` table (unified) |

**actions.ts** — updated server actions:

- `fetchCostDetail()` → `fetchInvoiceDetail()`
- `fetchArInvoiceDetail()` → removed (merged into above)
- `fetchPartnerCosts()` → `fetchPartnerPayables()`
- `fetchPartnerRevenue()` → `fetchPartnerReceivables()`
- `registerPayment()` → `related_to: 'invoice' | 'loan_schedule'`, validates against `v_invoice_balances`

**Page components** — all updated to use new types and function names:

- AP Calendar: `ObligationCalendarRow`, `CalendarBucketCounts`, `fetchInvoiceDetail`, `type === 'commercial'`/`'loan'`
- AR Outstanding: `ArOutstandingRow` (from queries.ts), `InvoiceDetailData`, `InvoiceAgingBuckets`, `row.invoice_id`
- Project partner settlement: `fetchPartnerPayables`/`fetchPartnerReceivables`, `PartnerPayableDetail`/`PartnerReceivableDetail`
- Financial Position: `ObligationCalendarRow` (loan stub), `type: 'loan'`
- Payment forms: `relatedTo: 'invoice'`, button label from `direction` not `relatedTo`
- Prices: `source === 'invoice'` (was `'cost'`)

---

## Phase 4: CLI Module Update — SKIPPED

**Status:** Skipped — CLI will be deprecated in favor of website-based data entry.

The CLI (`cli/modules/costs.py`, `cli/modules/ar_invoices.py`) still references old table names (`costs`, `ar_invoices`, `cost_items`). Since these tables no longer exist, the CLI cost/AR modules are non-functional. This is acceptable because:

1. All production data entry has moved to the website
2. The CLI will be retired as website data entry features are completed
3. The effort to update CLI modules is not justified given the planned deprecation

The CLI's `payments.py` module also references `related_to = 'cost'` and `'ar_invoice'` which would need updating if the CLI were to remain in use.

---

## Phase 5: Website Pages (outline)

### New pages
- **Invoices** (`/invoices`) — aging summary cards, filter bar, unified table with loan entries, inline expand
- **Payments** (`/payments`) — summary cards, filter bar, table, inline expand

### Simplified pages
- **AP Calendar** — remove detail modals, remove Taxes tab, rows link to Invoices page
- **AR Calendar** (rename from AR Outstanding, `/ar-outstanding` → `/ar-calendar`) — same simplification

### Enhanced pages
- **Cash Flow** — clickable cells link to Payments page
- **Financial Position** — clickable totals link to Invoices/Payments pages

### Updated components
- Sidebar: add Invoices + Payments to Browse, rename AR Outstanding → AR Calendar
- Project/Entity detail panels: links point to Invoices/Payments pages

### Components to remove
- `ap-calendar-detail.tsx`
- `loan-detail-content.tsx`
- `loan-schedule-form.tsx`
- `register-loan-repayment-form.tsx`
- `ar-outstanding-detail.tsx`
- Tax tab components on both calendars

---

## Phase 6: Cleanup (outline)

### Delete files
- `cli/modules/costs.py`
- `cli/modules/ar_invoices.py`

### Update docs
- `docs/08_schema.md` — new table structure (19 → 17 tables)
- `CLAUDE.md` — table count, table list, module list
- `TODO.md` — update remaining work items

### Update skills
- `skills/sql_schema.md`, `skills/cli_script.md`, `skills/import_script.md`, `skills/ts_types.md`

### Update import templates
- `imports/generate_templates.py` — merge cost + AR templates into invoices template

### Regenerate
- `database.types.ts` via Supabase CLI

---

## Dependency Graph

```
Phase 1 (DB migration)  ✅ COMPLETE
  └── Phase 2 (TS types) ✅ COMPLETE
       └── Phase 3 (queries + components) ✅ COMPLETE
            ├── Phase 4 (CLI)    ⏭️ SKIPPED (CLI deprecation planned)
            └── Phase 5 (website) ── can be incremental
                 └── Phase 6 (cleanup + docs)
```

Phases 1-3 are complete. Phase 5 (new website pages) can proceed incrementally. Phase 6 follows everything.

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Data migration loses records | Verify row counts before and after. ✅ Migration ran in single transaction. |
| `payments.related_id` breaks | UUIDs preserved. ✅ Verified by successful migration. |
| AR invoices gain line items | Synthetic single-item rows created during migration. ✅ Done. |
| Atomic deploy required (Phases 2-3) | ✅ Deployed together. All code changes merged. |
| URL redirect (`/ar-outstanding` → `/ar-calendar`) | Next.js `redirects` in `next.config.js` |
| Website broken until Phases 2-3 complete | ✅ Resolved. Phases 2-3 complete, website functional. |
| CLI non-functional after migration | Phase 4 skipped — CLI deprecation planned. |

---

*This document will be updated as each phase completes.*
