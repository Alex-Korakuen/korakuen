# Development Roadmap

**Document version:** 3.0
**Date:** March 2, 2026
**Status:** Active — Phase 4 complete. Next: Phase 5 (when business revenue justifies).

---

## How to Use This Document

This is the execution roadmap for Claude Code. Each task is specific, ordered by dependency, and has clear completion criteria. Work through tasks in order — never skip ahead. Mark tasks complete as they are finished.

**Rule:** Discuss approach before writing any code. If a task has questions, raise them before starting.

---

## Phase 1: Schema & Documentation (Complete)

All design decisions locked. 18 tables defined (14 original + 4 added in Phase 3.5). Documentation complete.

- [x] Business context document
- [x] System architecture document
- [x] Module specifications document
- [x] Visualization website specifications
- [x] File storage structure
- [x] Tech evolution roadmap
- [x] Strategic roadmap (consolidated into this document)
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

**8 Phase 2 migrations applied (22 total across all phases).** Supabase project linked (project ID in `.env` as `SUPABASE_PROJECT_ID`). Two environments provisioned: testing + production.

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
- `requirements.txt` with `supabase`, `python-dotenv`, `pandas`, `openpyxl`

Main menu structure:
```
=== Korakuen Management System ===

1. Projects
2. Entities & Contacts
3. Costs
4. Quotes
5. AR Invoices
6. Payments
7. Loans
8. Exchange Rates
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
- Step 1 — Header: project (optional, list active), bank_account (list by partner), entity (optional, search), quote (optional, list accepted quotes for project), cost_type, date, title, igv_rate, detraccion_rate (optional), currency, exchange_rate, comprobante_type (optional), comprobante_number (optional), document_ref (optional), due_date (optional), notes (optional)
- Step 2 — Line items: loop adding items until user says done. Each line: title, category (show options), quantity (optional), unit_of_measure (optional), unit_price (optional), subtotal, notes. Displays running total. Confirms full summary before insert (header + all lines).

**Import costs:** Reads costs.xlsx, validates, resolves FK lookups (project_code, entity_document_number, bank_name+last4), batch inserts headers. Import order: 4th — depends on projects, entities, bank_accounts.

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

### Task 3.6 — ar_invoices.py
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

**Add AR invoice:** project (list active), bank_account, entity (client — search), partner_company (list), invoice_number, invoice_date, due_date, subtotal, igv_rate, detraccion_rate (optional), retencion_applicable, retencion_rate (if applicable), currency, exchange_rate, document_ref, notes.

Displays calculated breakdown before confirming:
```
Subtotal:        S/ 100,000
IGV (18%):       S/  18,000
Gross:           S/ 118,000
Detraccion (4%): S/   4,720
Retencion (3%):  S/   3,540
Net receivable:  S/ 109,740
```

**Import AR invoices:** Reads .xlsx, validates, resolves all FK lookups. Import order: 5th — depends on projects, entities, bank_accounts, partner_companies.

---

### Task 3.7 — payments.py
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

### Task 3.8 — views.py (Retired)
**Status:** Retired — `views.py` deleted. Read-only dashboards moved exclusively to the website.

The CLI views module (AP Payment Calendar, Partner Balances, Retencion Dashboard) was built as a transitional tool during Phase 3. With Phase 4 (website) underway, CLI views have been retired. The database views they read from (`v_ap_calendar`, `v_partner_ledger`, `v_retencion_dashboard`) remain in place — they are the data source for the website.

See Tasks 4.5, 4.6, 4.8 for the website implementations that replace these.

---

### Task 3.9 — Integration test
**Depends on:** Tasks 3.2-3.8
**Test:** Full menu flow — navigate every menu path, add one record per module, verify back navigation, verify clean exit.

**Done when:** All menu paths accessible, all single-entry functions insert records successfully, all import functions accept and process .xlsx files, screen clears between every menu transition.

---

## Phase 3.5: Schema & CLI Extensions (Complete)

**Goal:** Add planned tables and fields before website development begins. Extends the database with loans module and project budgets, and updates existing tables and CLI modules.

**Status:** All tasks complete. 4 new migrations, 2 new views, 2 updated views, 1 new CLI module, 3 updated CLI modules, templates regenerated.

---

### Task 3.10 — Entity location fields [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, updated `cli/modules/entities.py`, updated templates

- [x] Migration: `20260302000001_entity_location_fields.sql` — `ALTER TABLE entities ADD COLUMN city VARCHAR, ADD COLUMN region VARCHAR`
- [x] Update `cli/modules/entities.py` — add city/region prompts to add-entity flow, update summary, insert data dict, and `_build_entity_record()`
- [x] Update `imports/generate_templates.py` — add city, region columns to entities template
- [x] Regenerate `imports/templates/entities.xlsx` — run `cd imports && python generate_templates.py`

**Done when:** Entities can be created with optional city/region via CLI and import.

---

### Task 3.11 — Informal payment support [COMPLETE]
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

### Task 3.12 — Loans module (schema) [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, view SQL

- [x] Migration: `20260302000003_loans_tables.sql` — CREATE TABLE `loans`, `loan_schedule`, `loan_payments` with deferred FK for loan_schedule.actual_payment_id
- [x] Create `supabase/views/v_loan_balances.sql` — borrowed, total owed, paid, outstanding per loan
- [x] Update `supabase/views/v_ap_calendar.sql` — add UNION ALL with loan_schedule for upcoming loan payments (type = 'loan_payment')

**Done when:** All 3 loan tables created, v_loan_balances returns correct data, v_ap_calendar includes loan obligations.

---

### Task 3.13 — Loans module (CLI) [COMPLETE]
**Depends on:** Task 3.12
**Output:** `cli/modules/loans.py`, updated `cli/main.py`

- [x] Create `cli/modules/loans.py` with 3 operations: add_loan, add_schedule, register_repayment
- [x] Update `cli/main.py` — add menu item 8 (Loans), import loans module

**Done when:** Full loan lifecycle works — create loan, schedule payments, register repayments. Balance views are on the website (Financial Position, AP Calendar).

---

### Task 3.14 — Project budgets [COMPLETE]
**Depends on:** Phase 3 complete
**Output:** Migration SQL, view SQL, updated `cli/modules/projects.py`

- [x] Migration: `20260302000004_project_budgets.sql` — CREATE TABLE `project_budgets` with unique constraint on (project_id, category)
- [x] Create `supabase/views/v_budget_vs_actual.sql` — budgeted vs actual per project per category with variance and pct_used
- [x] Update `cli/modules/projects.py` — add menu option 3 "Set project budget" with overwrite support, per-category amounts, summary with totals

**Done when:** Budgets can be set per project, v_budget_vs_actual returns correct comparison data.

---

## Phase 4: Visualization Website

**Goal:** Read-only Next.js website on Vercel with invite-only authentication. 9 pages total: 3 browse pages for core data plus 6 dashboard/analytics views. Each page includes filters where applicable.

**Status:** Phase 4 complete. All 31 migrations applied to remote. Production live at `https://korakuen.vercel.app`.

- [x] Tasks 4.1–4.3 — Project setup, authentication, layout & navigation
- [x] Task 4.4 — Verify Vercel deployment
- [x] Task 4.5 — AP Payment Calendar
- [x] Task 4.6 — AR Outstanding & Collections
- [x] Task 4.7 — Cash Flow
- [x] Task 4.8 — Partner Contribution & Balances
- [x] Task 4.9 — Company P&L
- [x] Task 4.10 — Financial Position
- [x] Task 4.11 — Projects browse
- [x] Task 4.12 — Entities browse
- [x] Task 4.13 — Prices browse

---

### Infrastructure

### Task 4.1 — Project setup [COMPLETE]
**Depends on:** Phase 3.5 complete, migrations applied to remote
**Output:** Supabase client, TypeScript types, formatters, query helpers

- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create `src/lib/supabase/server.ts` (server-side client with SSR cookie handling)
- Create `src/lib/supabase/client.ts` (browser-side client)
- Generate `src/lib/database.types.ts` via `supabase gen types typescript`
- Create `src/lib/types.ts` (human-friendly type aliases and enums matching schema)
- Create `src/lib/queries.ts` (reusable server-side query functions)
- Create `src/lib/formatters.ts` (PEN/USD currency formatting, date formatting)

**Done when:** `npm run build` passes, all types resolve, Supabase client connects.

---

### Task 4.2 — Authentication (invite-only) [COMPLETE]
**Depends on:** Task 4.1
**Output:** Login page, auth callback, set-password page, change-password page, middleware

- Create `src/middleware.ts` — redirects unauthenticated users to `/login`, refreshes session cookies
- Create `src/app/login/page.tsx` — polished email/password login form
- Create `src/app/auth/callback/route.ts` — handles invite email token exchange
- Create `src/app/auth/set-password/page.tsx` — invited users set initial password
- Create `src/app/settings/password/page.tsx` — change password (accessible from header dropdown)
- Create `src/lib/auth.ts` — helpers: `getCurrentUser()`, `isCompanyView()`, `getPartnerName()`

Auth flow: Alex invites users via Supabase Dashboard → user clicks email link → sets password → logs in. No open registration.

**Done when:** Unauthenticated users redirected to login. Login works with email/password. Invite flow works end-to-end. Password change works.

---

### Task 4.3 — Layout and navigation [COMPLETE]
**Depends on:** Task 4.2
**Output:** Sidebar, header, placeholder pages, root redirect

- Replace `src/app/layout.tsx` — root layout with conditional sidebar/header for authenticated routes
- Replace `src/app/page.tsx` — redirect `/` to `/ap-calendar`
- Replace `src/app/globals.css` — Korakuen design system (muted palette, urgency colors)
- Create `src/components/sidebar.tsx` — collapsible sidebar with 9-page navigation in 2 groups (Browse + Dashboards)
- Create `src/components/header.tsx` — "KORAKUEN" branding + partner name + dropdown (Change Password, Sign Out)
- Create stub `page.tsx` for each route so navigation works

Sidebar structure:
- Browse: Projects, Entities, Prices
- Dashboards: AP Calendar, AR Outstanding, Cash Flow, Partner Balances, P&L, Financial Position

Design: minimalist, clean, functional — inspired by Todoist/Notion. Collapsible sidebar, hamburger menu on mobile.

**Done when:** All 9 navigation items render, clicking navigates to correct route, sidebar collapses, header shows partner name, sign out works.

---

### Task 4.4 — Verify Vercel deployment [COMPLETE]
**Depends on:** Task 4.3
**Output:** Working production deployment

Vercel project already connected (auto-deploys on push to main).

- Verify `npm run build` passes
- Ensure env vars set in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Configure Supabase Dashboard: set `SITE_URL` to Vercel production URL, add redirect URLs
- Push to main → auto-deploy

**Done when:** Production URL loads, auth flow works, sidebar renders.

---

### Dashboard Pages

### Task 4.5 — AP Payment Calendar [COMPLETE]
**Depends on:** Task 4.3
**Default landing page after login.** Answers: "What do I need to pay, and when?"

**Tabs:** Main | Taxes

**Main tab:**
- Summary cards: Overdue, Due Today, This Week, Next 30 Days (non-overlapping buckets, clickable to filter table)
- Sortable table: due_date, days, type, supplier, project, title, outstanding, currency, status
- Row urgency: colored left border (red=overdue, orange=today, yellow=this week, neutral=future)
- Filters: project, supplier, currency, title search
- Row click: opens modal with cost items, payment history, comprobante info
- Loan obligations (Alex-only): `v_ap_calendar` includes loan_schedule entries. Partners see supplier invoices only.

**Taxes tab:**
- Detraccion deposits pending table: supplier, project, invoice title, detraccion amount, deposit status

**Data source:** `v_ap_calendar`, `v_cost_balances`

**Done when:** Real data displays, cards filter correctly, table sorts, modal shows detail, Alex sees loans, partners don't.

---

### Task 4.6 — AR Outstanding & Collections [COMPLETE]
**Depends on:** Task 4.3
Answers: "What do I have pending to collect, and how overdue is it?"

**Tabs:** Main | Taxes

**Main tab:** 4 aging bucket SummaryCards (Current 0-30, 31-60, 61-90, 90+ days), clickable as filters. Sortable invoice table with columns: invoice#, project, client, dates, days overdue, gross, detraccion, retencion, net receivable, paid, outstanding, status. Color-coded aging column. Total row. Row click opens modal with invoice breakdown + payment history + retencion status. Filters: project, client, partner, currency.

**Taxes tab:** Two sections — Retenciones table from `v_retencion_dashboard` with age color coding and filters (project, client, status). Detracciones table showing expected vs received detraccion deposits with pending amounts.

**Data source:** `v_ar_balances`, `v_retencion_dashboard`, `payments`
**Files:** `ar-outstanding/page.tsx`, `ar-outstanding-client.tsx`, `helpers.ts`, `actions.ts`

---

### Task 4.7 — Cash Flow [COMPLETE]
**Depends on:** Task 4.3
Answers: "How much cash actually moved, and what's expected in coming months?"

Cash flow computed in application layer (queries.ts) instead of SQL view — the multi-table aggregation with category breakdown and currency conversion is too complex for a single database view.

- Monthly time series (12 months per year) with actual/forecast separator
- Scope selector: All Projects or single project. Year picker. Currency selector (PEN/USD with conversion).
- Cash In + Cash Out broken down by cost category (Materials, Labor, Subcontractor, Equipment, Other)
- Net and Cumulative columns. Red for negative, green for positive.
- Cash shortfall warning banner when cumulative goes negative in forecast months
- Alex-only: Loan outflows column in Cash Out
- URL-based params for server-side data refetch on filter change

**Data source:** `payments` (actual), `v_cost_balances` + `cost_items` (forecast out), `v_ar_balances` (forecast in), `loan_schedule` (Alex-only forecast)
**Files:** `cash-flow/page.tsx`, `cash-flow-wrapper.tsx`, `cash-flow-client.tsx`, `helpers.ts`

---

### Task 4.8 — Partner Contribution & Balances [COMPLETE]
**Depends on:** Task 4.3
Answers: "Who has contributed what to this project, and who owes whom?"

- Project selector (required — no all-projects aggregate)
- Contributions table with proportion bars, clickable rows open cost detail modal
- Balance section: who owes whom based on contribution %

**Data source:** `v_partner_ledger`, `v_cost_totals`

---

### Task 4.9 — Company P&L [COMPLETE]
**Depends on:** Task 4.3
Answers: "Are we making money?"

- Multi-column time-series layout (Year=12 monthly cols + Total, Quarter=3 + Total, Month=1)
- Currency selector: PEN (default) or USD
- Income → Project Costs → Gross Profit → SG&A → Net Profit, with expandable category rows
- Personal position section (Alex-only): profit share minus loan obligations
- Computed in queries.ts (not SQL view — too complex for single view)

**Data source:** `ar_invoices`, `v_cost_totals`, `cost_items`, `v_partner_ledger`, `v_loan_balances`

---

### Task 4.10 — Financial Position [COMPLETE]
**Depends on:** Task 4.3
Answers: "What do we own vs what do we owe?"

- Created `v_igv_position` view + migration (20260303000007)
- Balance sheet layout: Assets (Cash in Bank, AR, Tax Credits) vs Liabilities (AP, Tax Liabilities, Loans)
- Bank account cards clickable → transaction history modal
- Net Position = Assets minus Liabilities
- Currency selector with conversion at default rate

**Data source:** `v_bank_balances`, `v_ar_balances`, `v_cost_balances`, `v_igv_position`, `v_retencion_dashboard`, `v_loan_balances`

---

### Browse Pages

### Task 4.11 — Projects
**Depends on:** Task 4.3
Split-panel: project list + selected project detail.

Detail shows: header info, assigned entities, spending by entity, costs & budget section (with color-coded budget vs actual when budget exists), AR invoices, project notes.

**Data source:** `projects`, `project_entities`, `costs + cost_items`, `ar_invoices`, `project_budgets`

---

### Task 4.12 — Entities & Contacts
**Depends on:** Task 4.3
Split-panel: entity list + selected entity detail.

Search by legal_name, common_name, document_number. Filter by tag, entity_type, city, region. Detail shows contacts and transaction history per project (expandable).

**Data source:** `entities`, `entity_contacts`, `entity_tags`, `tags`, `v_entity_transactions`

---

### Task 4.13 — Prices
**Depends on:** Task 4.3
Search-driven reference view for historical pricing.

Search by item title. Results combine cost_items and quotes. Filterable by category, entity, project, date range, tag.

**Data source:** `cost_items`, `quotes`, `entities`, `entity_tags`

---

## Post-Phase 4 Bugfixes

Fixes applied after Phase 4 audit.

- [x] **Issue 11 — v_partner_ledger income filter:** Fixed in migration `20260304000003`. Later simplified: `is_internal_settlement` column removed entirely (migration `20260305000003`) — partners never invoice each other.
- [x] **Issue 13 — Projects page mixed currency total:** Spending footer summed PEN and USD amounts together. Fixed: split footer into separate total rows per currency.
- [x] **Issue 14 — Cash Flow SG&A in project categories:** SG&A costs mapped to "other" and mixed with project costs in All Projects scope. Fixed: added dedicated SG&A category to `CategoryTotals` and Cash Flow UI.
- [x] **Issue 15 — Cash Flow loan forecast project filter:** Loan schedule forecast entries were not filtered by project. Fixed: added `project_id` to loan schedule join and project filter check.
- [x] **Migration fix — v_ar_balances column addition:** `CREATE OR REPLACE VIEW` can't add columns in PostgreSQL. Fixed migration `20260304000002` to `DROP VIEW` + `CREATE VIEW` with dependent view cascade. Migration applied.

Issues confirmed not bugs:
- **Issue 10 — CLI internal settlement validation:** Removed — `is_internal_settlement` column dropped (partners never invoice each other).
- **Issue 12 — AP/AR outstanding based on gross_total:** Working as designed — users record detraccion/retencion as separate payments.

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

## Open Decisions

| Decision | Status |
|---|---|
| Accountant field requirements for SUNAT | Pending — consult accountant |
| Detraccion rates by service type | Pending — confirm applicable rates |
| SharePoint setup | Pending — create site and folder structure |
| Partner company names for database | Pending |
| Dual-view UX mechanism (toggle, selector, etc.) | Deferred to Phase 4 implementation |
| Partner login — individual vs shared in V1 | Deferred to Phase 5 |
| Korakuen company ID — confirm which partner_companies record | Needed for company view filter |

---

*Update completion status as tasks are finished. Add new tasks as they are identified.*
