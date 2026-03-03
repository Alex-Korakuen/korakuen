# Development Roadmap

**Document version:** 3.0
**Date:** March 2, 2026
**Status:** Active — Phase 3.5 complete. Phase 4 next.

---

## How to Use This Document

This is the execution roadmap for Claude Code. Each task is specific, ordered by dependency, and has clear completion criteria. Work through tasks in order — never skip ahead. Mark tasks complete as they are finished.

**Rule:** Discuss approach before writing any code. If a task has questions, raise them before starting.

---

## Phase 1: Schema & Documentation (Complete)

All design decisions locked. 17 tables defined (13 original + 4 added in Phase 3.5). Documentation complete.

- [x] Business context document
- [x] System architecture document
- [x] Module specifications document
- [x] Visualization website specifications
- [x] File storage structure
- [x] Tech evolution roadmap
- [x] Strategic roadmap
- [x] Database schema — all 13 tables fully defined
- [x] Coding standards
- [x] Environment setup guide
- [x] Development roadmap (this document)
- [x] CLAUDE.md

---

## Phase 1.5: Build Skills (Complete)

All six skill files built. `docs/12_skills.md` deleted.

- [x] `skills/sql_schema.md`
- [x] `skills/sql_views.md`
- [x] `skills/cli_script.md`
- [x] `skills/import_script.md`
- [x] `skills/ts_types.md`
- [x] `skills/codebase_audit.md`
- [x] Delete `docs/12_skills.md`

---

## Phase 2: Database (Complete)

**Goal:** Working PostgreSQL schema on Supabase with seed data. No application code yet.

- [x] Task 2.1 — Generate SQL schema → `supabase/migrations/20260301000001_initial_schema.sql`
- [x] Task 2.2 — Generate database views → `supabase/migrations/20260301000004_views.sql`
- [x] Task 2.3 — Generate indexes → `supabase/migrations/20260301000002_indexes.sql`
- [x] Task 2.3b — Add is_active to tags and projects → `supabase/migrations/20260301000003_add_is_active.sql`
- [x] Task 2.4 — Seed data → `supabase/migrations/20260301000005_seed_data.sql` (tags, partner companies, bank accounts)
- [x] Task 2.5 — Validate schema — all migrations applied to remote database
- [x] Task 2.6 — Fix views security invoker → `supabase/migrations/20260301000007_views_security_invoker.sql`
- [x] Task 2.7 — Fix function search_path → `supabase/migrations/20260301000008_fix_function_search_path.sql`
- [x] Task 2.8 — Add notes to v_cost_totals → `supabase/migrations/20260301000009_v_cost_totals_add_notes.sql`

**All 8 migrations applied.** Supabase project linked (project ID in `.env` as `SUPABASE_PROJECT_ID`). Two environments provisioned: testing + production.

---

## Phase 3: CLI Application (Complete)

**Goal:** Menu-driven Python CLI for all data entry and import operations. Single entry point via `python main.py`.

**Status:** All modules built, tested, and verified. Integration test passed.

### Task 3.1 — Project setup
**Depends on:** Phase 2 complete
**Output:** `cli/main.py`, `cli/modules/__init__.py`, `cli/lib/db.py`, `cli/lib/helpers.py`, `cli/lib/import_helpers.py`, `cli/requirements.txt`

Create:
- `main.py` — single entry point with main menu loop (navigation only, no business logic)
- `modules/__init__.py` — empty init
- `lib/__init__.py` — empty init
- `lib/db.py` — shared Supabase client setup
- `lib/helpers.py` — shared input helpers (get_input, get_optional_input, confirm, list_choices, clear_screen)
- `lib/import_helpers.py` — shared import validation and error highlighting utilities
- `requirements.txt` with `supabase`, `python-dotenv`, `rich`, `pandas`, `openpyxl`

Main menu structure:
```
=== Korakuen Management System ===

1. Projects
2. Entities & Contacts
3. Costs
4. Quotes
5. Valuations
6. AR Invoices
7. Payments
8. Loans
0. Exit

Select option:
```

**Done when:** `python main.py` displays the menu and exits cleanly on "0".

---

### Task 3.2 — projects.py
**Depends on:** Task 3.1
**Output:** `cli/modules/projects.py`

Submenu:
```
=== Projects ===

1. Add project
2. Import projects from Excel
3. Back

Select option:
```

**Add project:** name, project_type, status, client (search entities), contract_value, contract_currency, start_date, location, notes. Auto-generates project_code (next sequential PRY###). Confirms before insert.

**Import projects:** Reads .xlsx template, validates all rows, batch inserts. Depends on entities existing for client lookup. Prompts: `Enter path to Excel file (or drag file into terminal):`

---

### Task 3.3 — entities.py
**Depends on:** Task 3.1
**Output:** `cli/modules/entities.py`

Submenu:
```
=== Entities & Contacts ===

1. Add entity
2. Add contact to entity
3. Add tag
4. Assign tag to entity
5. Assign entity to project
6. Import entities from Excel
7. Back

Select option:
```

**Add entity:** entity_type, document_type, document_number, legal_name, common_name (optional), notes (optional). After insert, prompts to add primary contact (name, role, phone, email). Prompts to add tags (show available, allow multiple selection).

**Add contact:** Search/select entity, then name, role, phone, email.

**Add tag:** name, notes (optional). Validates name is unique.

**Assign tag:** Search entity, show available tags, allow multiple selection.

**Assign entity to project:** Search entity, select project, enter role.

**Import entities:** Reads .xlsx, validates (entity_type enum, document_type enum, document_number format), batch inserts. Import order: 1st — no dependencies.

---

### Task 3.4 — costs.py
**Depends on:** Task 3.1
**Output:** `cli/modules/costs.py`

Submenu:
```
=== Costs ===

1. Add cost
2. Import costs from Excel
3. Import cost items from Excel
4. Back

Select option:
```

**Add cost:** Most complex operation. Two-step process:
- Step 1 — Header: project (optional, list active), valuation (optional, list open for project), bank_account (list by partner), entity (optional, search), quote (optional, list accepted quotes for project), cost_type, date, title, igv_rate, detraccion_rate (optional), currency, exchange_rate, comprobante_type (optional), comprobante_number (optional), document_ref (optional), due_date (optional), notes (optional)
- Step 2 — Line items: loop adding items until user says done. Each line: title, category (show options), quantity (optional), unit_of_measure (optional), unit_price (optional), subtotal, notes. Displays running total. Confirms full summary before insert (header + all lines).

**Import costs:** Reads costs.xlsx, validates, resolves FK lookups (project_code, entity_document_number, bank_name+last4), batch inserts headers. Import order: 4th — depends on projects, valuations, entities, bank_accounts.

**Import cost items:** Reads cost_items.xlsx, validates (cost must exist by document_ref), batch inserts. Import order: 5th — depends on costs.

---

### Task 3.5 — quotes.py
**Depends on:** Task 3.1
**Output:** `cli/modules/quotes.py`

Submenu:
```
=== Quotes ===

1. Add quote
2. Import quotes from Excel
3. Back

Select option:
```

**Add quote:** project (list active), entity (search), date_received, title, quantity, unit_of_measure, unit_price, igv_rate, currency, exchange_rate, document_ref, notes. Calculates and displays subtotal, igv_amount, total before confirming.

**Import quotes:** Reads .xlsx, validates, resolves project_code and entity_document_number lookups. Import order: 3rd — depends on projects and entities.

---

### Task 3.6 — valuations.py
**Depends on:** Task 3.1
**Output:** `cli/modules/valuations.py`

Submenu:
```
=== Valuations ===

1. Add valuation
2. Import valuations from Excel
3. Back

Select option:
```

**Add valuation:** project (list active), period_month, period_year, billed_value, billed_currency, notes. Auto-generates valuation_number (next sequential for that project). Confirms before insert.

**Import valuations:** Reads .xlsx, validates, resolves project_code lookup. Import order: 3rd — depends on projects.

---

### Task 3.7 — ar_invoices.py
**Depends on:** Task 3.1
**Output:** `cli/modules/ar_invoices.py`

Submenu:
```
=== AR Invoices ===

1. Add AR invoice
2. Import AR invoices from Excel
3. Back

Select option:
```

**Add AR invoice:** project (list active), valuation (list closed valuations without AR invoice), bank_account, entity (client — search), partner_company (list), invoice_number, invoice_date, due_date, subtotal, igv_rate, detraccion_rate (optional), retencion_applicable, retencion_rate (if applicable), currency, exchange_rate, document_ref, is_internal_settlement, notes.

Displays calculated breakdown before confirming:
```
Subtotal:        S/ 100,000
IGV (18%):       S/  18,000
Gross:           S/ 118,000
Detraccion (4%): S/   4,720
Retencion (3%):  S/   3,540
Net receivable:  S/ 109,740
```

**Import AR invoices:** Reads .xlsx, validates, resolves all FK lookups. Import order: 5th — depends on projects, valuations, entities, bank_accounts, partner_companies.

---

### Task 3.8 — payments.py
**Depends on:** Task 3.1
**Output:** `cli/modules/payments.py`

Submenu:
```
=== Payments ===

1. Register payment
2. Verify retencion
3. Back

Select option:
```

**Register payment:** related_to (cost or ar_invoice), search and select the specific record, direction (auto-derived from related_to type), payment_type (regular/detraccion/retencion), payment_date, amount, currency, exchange_rate, bank_account (nullable for retencion), partner_company, notes. Shows current outstanding balance before and after payment.

**Verify retencion:** Search and select an AR invoice with retencion_applicable = true. Displays invoice details, retencion amount, current retencion_verified status. Sets retencion_verified = true. Confirms before update.

No import — payments are always registered individually.

---

### Task 3.9 — views.py (Retired)
**Status:** Retired — `views.py` deleted. Read-only dashboards moved exclusively to the website.

The CLI views module (AP Payment Calendar, Partner Balances, Retencion Dashboard) was built as a transitional tool during Phase 3. With Phase 4 (website) underway, CLI views have been retired. The database views they read from (`v_ap_calendar`, `v_partner_ledger`, `v_retencion_dashboard`) remain in place — they are the data source for the website.

See Tasks 4.7, 4.9, 4.12 for the website implementations that replace these.

---

### Task 3.10 — Integration test
**Depends on:** Tasks 3.2-3.9
**Test:** Full menu flow — navigate every menu path, add one record per module, verify back navigation, verify clean exit.

**Done when:** All menu paths accessible, all single-entry functions insert records successfully, all import functions accept and process .xlsx files, screen clears between every menu transition.

---

## Phase 3.5: Schema & CLI Extensions (Complete)

**Goal:** Add planned tables and fields before website development begins. Extends the database with loans module and project budgets, and updates existing tables and CLI modules.

**Status:** All tasks complete. 4 new migrations, 2 new views, 2 updated views, 1 new CLI module, 3 updated CLI modules, templates regenerated.

---

### Task 3.11 — Entity location fields [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, updated `cli/modules/entities.py`, updated templates

- [x] Migration: `20260302000001_entity_location_fields.sql` — `ALTER TABLE entities ADD COLUMN city VARCHAR, ADD COLUMN region VARCHAR`
- [x] Update `cli/modules/entities.py` — add city/region prompts to add-entity flow, update summary, insert data dict, and `_build_entity_record()`
- [x] Update `imports/generate_templates.py` — add city, region columns to entities template
- [x] Regenerate `imports/templates/entities.xlsx` — run `cd imports && python generate_templates.py`

**Done when:** Entities can be created with optional city/region via CLI and import.

---

### Task 3.12 — Informal payment support [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, updated `cli/modules/costs.py`, updated templates

- [x] Migration: `20260302000002_informal_payment_support.sql` — `ALTER TABLE costs ADD COLUMN payment_method VARCHAR(50)`
- [x] Update `cli/modules/costs.py` — add payment_method prompt (bank_transfer, cash, check), expand comprobante_type validation to 6 values (factura, boleta, recibo_por_honorarios, liquidacion_de_compra, planilla_jornales, none)
- [x] Update import validation in costs.py for new comprobante_type values and payment_method enum
- [x] Update `imports/generate_templates.py` — add payment_method column to costs template, update comprobante_type allowed values
- [x] Update `supabase/views/v_cost_totals.sql` — pass through payment_method in SELECT, GROUP BY, and final SELECT
- [x] Regenerate `imports/templates/costs.xlsx` — run `cd imports && python generate_templates.py`

**Done when:** Costs can be created with payment_method and all 6 comprobante_type values via CLI and import.

---

### Task 3.13 — Loans module (schema) [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, view SQL

- [x] Migration: `20260302000003_loans_tables.sql` — CREATE TABLE `loans`, `loan_schedule`, `loan_payments` with deferred FK for loan_schedule.actual_payment_id
- [x] Create `supabase/views/v_loan_balances.sql` — borrowed, total owed, paid, outstanding per loan
- [x] Update `supabase/views/v_ap_calendar.sql` — add UNION ALL with loan_schedule for upcoming loan payments (type = 'loan_payment')

**Done when:** All 3 loan tables created, v_loan_balances returns correct data, v_ap_calendar includes loan obligations.

---

### Task 3.14 — Loans module (CLI) [COMPLETE]
**Depends on:** Task 3.13
**Output:** `cli/modules/loans.py`, updated `cli/main.py`

- [x] Create `cli/modules/loans.py` with 4 operations: add_loan, add_schedule, register_repayment, view_balances
- [x] Update `cli/main.py` — add menu item 8 (Loans), import loans module

**Done when:** Full loan lifecycle works — create loan, schedule payments, register repayments, view balances.

---

### Task 3.15 — Project budgets [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, view SQL, updated `cli/modules/projects.py`

- [x] Migration: `20260302000004_project_budgets.sql` — CREATE TABLE `project_budgets` with unique constraint on (project_id, category)
- [x] Create `supabase/views/v_budget_vs_actual.sql` — budgeted vs actual per project per category with variance and pct_used
- [x] Update `cli/modules/projects.py` — add menu option 3 "Set project budget" with overwrite support, per-category amounts, summary with totals

**Done when:** Budgets can be set per project, v_budget_vs_actual returns correct comparison data.

---

## Phase 4: Visualization Website

**Goal:** Read-only Next.js website on Vercel with basic authentication. Browse pages for core data (projects, entities, quotes) plus dashboard/analytics views. Each page includes filters where applicable.

**Start only after Phase 3 is complete and real data has been entered through CLI scripts.**

---

### Task 4.1 — Project setup
Next.js app, Supabase client, TypeScript types from schema, Vercel deployment.

### Task 4.2 — Authentication
Supabase Auth with email/password. One login per partner company (3 accounts). Login page, session check wrapper, protected routes. All pages require authentication.

### Task 4.3 — Layout and navigation
Collapsible sidebar navigation, header with partner name, responsive shell. Sidebar collapses to icons on small screens, becomes hamburger menu on mobile. Minimalist design — clean, calm, functional. Muted color palette with colored indicators only where they convey meaning (payment status, aging).

---

### Browse Pages — Core Data

### Task 4.4 — Projects
Split-panel layout. Left panel: project list. Right panel: selected project detail.

**Left panel — list:** Table of all projects. Columns: project_code, name, status, contract_value. Filterable by status. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Right panel — detail** (loads on row click):
- Project header info (code, name, type, status, client, contract value, dates, location)
- Assigned entities section: table of entities and their roles on this project. Each entity row links to that entity's detail in the Entities page (Task 4.5)
- Valuations list (period, status, billed value)
- Cost summary by category (materials, labor, subcontractor, etc.) — with contract value vs total costs and remaining margin when contract_value is not null
- Budget vs Actual section: when `project_budgets` data exists, shows budgeted vs actual per category with variance and % used. Color coded: red >100%, yellow >90%, green ≤90%. Gracefully absent when no budget data exists
- AR invoices issued for this project

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

### Task 4.5 — Entities & Contacts
Split-panel layout. Left panel: entity list. Right panel: selected entity detail.

**Left panel — list:** Table of all entities. Search by legal_name, common_name, or document_number. Columns: legal_name, common_name, document_number, tags. Filterable by tag, entity_type, city, region. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Right panel — detail** (loads on row click):
- Entity header (legal_name, common_name, document_type, document_number, tags)
- Contacts list (name, role, phone, email, primary flag)
- Transaction history per project: table showing each project this entity is linked to, with total AP, total AR, net amount, transaction count, and "last transaction" date. Each project row links to that project's detail in the Projects page (Task 4.4). Click a project row to expand and see individual cost/AR records for that entity on that project

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

### Task 4.6 — Quotes
Single page: list view. Browse/search all quotes. Columns: project, entity, title, quantity, unit_of_measure, unit_price, total, currency, status, date_received. Filterable by project, entity, status. Searchable by title. This is the reference view for looking up historical pricing when estimating new work.

**Row click:** Opens modal with full quote details including document_ref and notes.

---

### Dashboard Views — Analytics

### Task 4.7 — AP Payment Calendar
**Default landing page after login.** Answers: "What do I need to pay, and when?"

**Top:** Summary cards (Overdue, Due Today, This Week, Next 30 Days) showing count and total per bucket. Cards are clickable — clicking a card filters the table below to that bucket.

**Bottom:** Sortable table. Columns: due_date, days until due, supplier, project, title, amount, currency, payment status. Default sort: due date ascending (most urgent first). Row urgency indicated by colored left border (red=overdue, orange=today, yellow=this week, neutral=future).

**Filters:** project, supplier, currency, title search.

**Row click:** Opens modal showing full cost details — cost items, payment history, document_ref, bank account, comprobante info.

**Loan obligations (Alex-only):** `v_ap_calendar` includes loan_schedule entries with type = 'loan_payment'. Alex sees both supplier invoices and loan obligations. Partners see supplier invoices only.

### Task 4.8 — AR Outstanding & Collections
Answers: "What do I have pending to collect, and how overdue is it?"

**Top:** Aging bucket cards (Current 0-30, 31-60, 61-90, 90+ days overdue). Clickable to filter table. Aging is days past due_date.

**Bottom:** Invoice detail table. Columns: invoice_number, project, client, invoice_date, due_date, gross, detraccion, retencion, net_receivable, paid, outstanding, days_overdue. Color-coded age column. Total row at bottom.

**Filters:** project, client entity, partner company, currency, aging bucket.

**Row click:** Opens modal showing invoice details + payment history (dates, amounts, payment types — regular/detraccion/retencion) + retencion verification status.

**Note:** Net receivable shown prominently — in Peru with detraccion and retencion, the actual cash expected is significantly less than invoice face value.

### Task 4.9 — Partner Contribution & Balances
Answers: "Who has contributed what to this project, and what is each partner's current stake?"

**Always requires a project selection — no "all projects" aggregate view.** Project selector at top.

**Contributions section:** Table showing each partner's contributed amount and share percentage, with visual proportion bars. Total costs at bottom. Clicking a partner's contribution amount expands to show the list of costs that make up that number.

**Income section:** Total invoiced, total collected, outstanding for the selected project.

**Net position section:** Gross profit (from collected income), each partner's profit share based on contribution proportion.

### Task 4.10 — Company P&L
Answers: "What is the overall financial picture of Korakuen?"

**Period selector:** Month picker or custom date range. Default: current month. Options for YTD and full year.

**Income:** Shows "AR Invoiced" as a single total. Clickable to expand per-project breakdown showing each project's invoiced amount and the total. Uses parentheses for costs (standard financial presentation).

**Project Costs:** Total across all projects. Clickable to expand into category breakdown (materials, labor, subcontractor, equipment, permits, other).

**Gross Profit:** Income minus project costs, with margin percentage.

**SG&A:** Flat list of SG&A categories (software_licenses, partner_compensation, business_development, professional_services, office_admin, other) with amounts.

**Net Profit:** Gross profit minus total SG&A, with net margin percentage.

**Personal position (Alex-only):** Below Net Profit, separated by visual divider. Shows Alex's profit share, loan obligations, and net-after-obligations. Combines `v_partner_ledger` + `v_loan_balances`. Never visible to partners.

### Task 4.11 — Bank Account Balances
Answers: "What is the current balance of each bank account?"

**Alex's accounts:** Card per account showing bank_name, last4, account_type, currency, calculated balance. Banco de la Nación detraccion account flagged visually with note that balance is for tax payments only.

**Partner accounts:** Shown as net contribution position only (not full balance tracking). Clearly separated from Alex's accounts.

**Account detail:** Click a card to see recent transactions table (date, direction, related entity, amount, running balance). Disclaimer: system-calculated balance, not bank-reconciled.

**Filters:** date range.

### Task 4.12 — Retencion Dashboard
Answers: "Has the client actually paid our retencion to SUNAT?"

Table of AR invoices where retencion_applicable = true. Columns: project_code, client, invoice_number, invoice_date, due_date, days_since_invoice, gross_total, retencion_amount, verification_status. Sorted: unverified first, then by oldest invoice. Color-coded by age for unverified items.

**Filters:** project, client, verification status.

---

### Lower Priority Views

### Task 4.13 — Unit Price History
Answers: "What have I historically paid for specific materials or services?"

Search-driven view. Search by item title → see table of every cost_item matching that title with unit prices over time, by supplier. Price trend line chart. Supplier comparison for the same item.

**Filters:** category, entity, project, date range.

Grows in value as data accumulates — will be sparse initially but compounds over time.

### Task 4.14 — Quote vs Actual Comparison
Answers: "Did the final cost match the quote I accepted?"

Select a project → see all accepted quotes side by side with their linked costs. Columns: quoted quantity, unit_price, total vs actual cost quantity, unit_price, total. Variance column in absolute and percentage terms. Color-code variances exceeding 10%.

**Filters:** project, entity, category.

---

### New Dashboard Views

### Task 4.15 — Cash Flow
**Depends on:** Task 4.1
Answers: "How much cash actually moved, and what's expected in coming months?"

- Create `supabase/views/v_cash_flow.sql` — actual cash movements (from payments) + forecast (from due dates on unpaid costs, AR invoices, loan_schedule)
- Build website page with monthly time series table
- Past months show actual cash in/out; future months show forecast
- Visual separator between actual and forecast rows
- Cash shortfall warning when cumulative goes negative
- Company view (Alex-only) includes loan outflows in forecast

**Scope selector:** All Projects or single project. **Period:** Year picker.

### Task 4.16 — IGV Net Position
**Depends on:** Task 4.1
Answers: "What is our net IGV payable to SUNAT this period?"

- Create `supabase/views/v_igv_position.sql` — IGV collected (from AR where igv_rate > 0) minus IGV paid (from costs where igv_rate > 0) = net payable
- Build website page with period selector and YTD toggle
- Selected period: IGV Collected, IGV Paid, Net IGV Payable
- YTD cumulative section
- Monthly breakdown table

**Note:** Informal costs (igv_rate = 0) naturally contribute nothing — no special filtering needed.

### Task 4.17 — Budget vs Actual in Project detail
**Depends on:** Task 4.4 (Projects page)
Enhances project detail page to show budget vs actual section when `project_budgets` data exists.

- Query `v_budget_vs_actual` for selected project
- Show budgeted vs actual per category with variance and % used
- Color coded: red >100%, yellow >90%, green ≤90%
- Only rendered when budget data exists; gracefully absent otherwise

### Task 4.18 — Personal Position section (Alex-only)
**Depends on:** Task 4.10 (Company P&L)
Adds section below P&L showing Alex's profit share minus loan obligations.

- Render below Net Profit, separated by visual divider
- Shows: Alex's profit share (from `v_partner_ledger`), loan obligations (from `v_loan_balances`), net after obligations
- Only rendered when logged-in user is Alex (company-level view)
- No separate SQL view needed — combines existing views at presentation layer

---

## Phase 5: Excel In/Out + Full Web Application (V1)

**Start only when business revenue justifies development investment or non-technical users need data entry.**

- Accounting export — 5-tab Excel for external accountant (costs, AR, payments made, payments received, summary)
- Per-user accounts and role-based access (expand beyond one login per partner)
- Add data entry forms for all modules
- Mobile browser optimization
- Retire CLI as primary entry method (keep as fallback)

---

## Blocked Tasks

| Task | Blocked By |
|---|---|
| Seed real partner company data | Partner company names and RUCs not yet confirmed |
| Confirm detraccion rates | Need to confirm applicable rates with accountant |
| SUNAT field requirements | Need to consult external accountant |

---

*Update completion status as tasks are finished. Add new tasks as they are identified.*
