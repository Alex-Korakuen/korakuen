# Development Roadmap

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active — Phase 1 complete, Phase 2 in progress

---

## How to Use This Document

This is the execution roadmap for Claude Code. Each task is specific, ordered by dependency, and has clear completion criteria. Work through tasks in order — never skip ahead. Mark tasks complete as they are finished.

**Rule:** Discuss approach before writing any code. If a task has questions, raise them before starting.

---

## Phase 1: Schema & Documentation (Complete)

All design decisions locked. 13 tables defined. Documentation complete.

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

## Phase 1.5: Build Skills

**Goal:** All five skill files built and tested before any code is written. Skills ensure every generated artifact is consistent and follows project conventions from the first line.

**Skills live in:** `/skills/`
**Reference document:** `docs/12_skills.md`

### Task 1.5.1 — sql_schema skill
**Output:** `skills/sql_schema.md`
**Test:** Run the skill once to generate `database/migrations/001_initial_schema.sql`. Verify output follows all conventions before proceeding.

### Task 1.5.2 — sql_views skill
**Output:** `skills/sql_views.md`
**Test:** Generate one view (`v_cost_totals`). Verify SQL is correct and follows conventions.

### Task 1.5.3 — cli_script skill
**Output:** `skills/cli_script.md`
**Test:** Generate one script (`add_project.py`). Verify structure matches template exactly.

### Task 1.5.4 — ts_types skill
**Output:** `skills/ts_types.md`
**Test:** Run the Supabase type generation command and produce a sample `types.ts`. Verify enum types match schema values.

### Task 1.5.5 — codebase_audit skill
**Output:** `skills/codebase_audit.md`
**Test:** Run a dry audit pass on the empty project structure. Should return no findings (nothing to audit yet) without errors.

### Task 1.5.6 — Delete temporary skills reference document
**Action:** Delete `docs/12_skills.md`
**Condition:** All five skill files exist in `/skills/` and have been tested
**Why:** `12_skills.md` is a build-time document. Once the skills exist, it becomes dead documentation. The skill files are the reference going forward.

**Phase 1.5 is complete when:** All five skill files exist in `/skills/`, each has been tested at least once, and `docs/12_skills.md` has been deleted.

---

## Phase 2: Database

**Goal:** Working PostgreSQL schema on Supabase with seed data. No application code yet.

### Task 2.1 — Generate SQL schema
**Depends on:** Phase 1 complete
**Input:** `08_schema.md`
**Output:** `database/migrations/001_initial_schema.sql`

Generate CREATE TABLE statements for all 13 tables in dependency order:
1. `partner_companies`
2. `bank_accounts`
3. `entities`
4. `tags`
5. `entity_tags`
6. `entity_contacts`
7. `projects`
8. `project_entities`
9. `valuations`
10. `quotes`
11. `costs`
12. `cost_items`
13. `ar_invoices`
14. `payments`

Each table must include:
- UUID primary key with `gen_random_uuid()`
- All fields with correct types and nullable constraints
- Foreign key constraints with appropriate ON DELETE behavior
- `created_at` and `updated_at` with auto-update trigger
- Inline comments on non-obvious fields

**Done when:** SQL file runs without errors in Supabase SQL Editor and all 13 tables appear in Table Editor.

---

### Task 2.2 — Generate database views
**Depends on:** Task 2.1
**Input:** `08_schema.md` views section, `04_visualization.md`
**Output:** `database/views/` — one file per view

Views to create:
- `v_cost_totals` — subtotal, igv, detraccion, total per cost from cost_items
- `v_cost_balances` — amount_paid, outstanding, payment_status per cost
- `v_ar_balances` — amount_paid, outstanding, payment_status per AR invoice
- `v_ap_calendar` — unpaid/partial costs sorted by due date with days remaining
- `v_partner_ledger` — contributions, stakes, income distribution per project
- `v_entity_transactions` — all transactions per entity per project (costs + AR)
- `v_bank_balances` — running balance per bank account
- `v_project_pl` — income, costs, gross profit per project
- `v_company_pl` — consolidated P&L including SG&A
- `v_settlement_dashboard` — internal settlement invoices and status

**Done when:** All views run without errors and return expected columns.

---

### Task 2.3 — Generate indexes
**Depends on:** Task 2.1
**Output:** `database/migrations/002_indexes.sql`

Index every foreign key column and every column used in common filters:
- `costs.project_id`
- `costs.entity_id`
- `costs.bank_account_id`
- `costs.valuation_id`
- `cost_items.cost_id`
- `ar_invoices.project_id`
- `ar_invoices.entity_id`
- `ar_invoices.valuation_id`
- `payments.related_id`
- `payments.bank_account_id`
- `entity_tags.entity_id`
- `entity_tags.tag_id`
- `project_entities.project_id`
- `project_entities.entity_id`

**Done when:** Migration runs without errors.

---

### Task 2.4 — Seed data
**Depends on:** Task 2.1
**Output:** `database/seeds/`

Files:
- `001_tags.sql` — full initial tag list from schema document
- `002_partner_companies.sql` — three partner companies (use placeholder names until real data confirmed)
- `003_bank_accounts.sql` — known bank accounts per partner

**Done when:** Seed data inserted successfully and visible in Supabase Table Editor.

---

### Task 2.5 — Validate schema with real examples
**Depends on:** Tasks 2.1–2.4
**No code output — validation only**

Insert one complete real-world example manually through Supabase Table Editor:
1. One project
2. Two entities (one supplier company, one individual worker)
3. One cost with two line items (different categories)
4. One valuation
5. One AR invoice with IGV and detraccion
6. Two payments against the AR invoice (regular + detraccion)

Verify all views return correct data for this example.

**Done when:** All views return correct, expected data for the test scenario.

---

## Phase 3: CLI Scripts

**Goal:** Python scripts for all data entry operations. One script per operation.

### Task 3.1 — Project setup
**Depends on:** Phase 2 complete
**Output:** `cli/requirements.txt`, `cli/.env.example`, `cli/lib/db.py`

Create:
- `requirements.txt` with `supabase`, `python-dotenv`, `rich`
- `.env.example` with empty variable template
- `lib/db.py` — shared Supabase client setup used by all scripts
- `lib/helpers.py` — shared input helpers (get_input, confirm, list_choices)

**Done when:** `python -c "from lib.db import supabase"` runs without error.

---

### Task 3.2 — add_tag.py
**Depends on:** Task 3.1
**Output:** `cli/add_tag.py`

Inputs: name, description (optional)
Validates: name is unique
Confirms before insert

---

### Task 3.3 — add_entity.py
**Depends on:** Task 3.1
**Output:** `cli/add_entity.py`

Inputs: entity_type, document_type, document_number, legal_name, common_name (optional), notes (optional)
After insert: prompt to add primary contact (name, role, phone, email)
Prompt to add tags (show available tags, allow multiple selection)

---

### Task 3.4 — add_project.py
**Depends on:** Task 3.1
**Output:** `cli/add_project.py`

Inputs: name, project_type, status, client (search entities), contract_value, contract_currency, start_date, location, notes
Auto-generates: project_code (next sequential PRY###)
Confirms before insert

---

### Task 3.5 — add_quote.py
**Depends on:** Task 3.1
**Output:** `cli/add_quote.py`

Inputs: project (list active projects), entity (search entities), date_received, description, quantity, unit_of_measure, unit_price, igv_rate, currency, exchange_rate, document_ref, notes
Calculates and displays: subtotal, igv_amount, total before confirming

---

### Task 3.6 — add_valuation.py
**Depends on:** Task 3.1
**Output:** `cli/add_valuation.py`

Inputs: project (list active projects), period_month, period_year, billed_value, billed_currency, notes
Auto-generates: valuation_number (next sequential for that project)
Confirms before insert

---

### Task 3.7 — add_cost.py
**Depends on:** Task 3.1
**Output:** `cli/add_cost.py`

Most complex script. Two-step process:

**Step 1 — Header:**
Inputs: project (optional, list active), valuation (optional, list open for project), bank_account (list by partner), entity (optional, search), quote (optional, list accepted quotes for project), cost_type, date, description, igv_rate, detraccion_rate (optional), currency, exchange_rate, comprobante_type (optional), comprobante_number (optional), document_ref (optional), due_date (optional)

**Step 2 — Line items:**
Loop: add line items until user says done
Each line: description, category (show options), quantity (optional), unit_of_measure (optional), unit_price (optional), subtotal, notes

Displays running total after each line item.
Confirms full summary before insert (header + all lines).

---

### Task 3.8 — add_ar_invoice.py
**Depends on:** Task 3.1
**Output:** `cli/add_ar_invoice.py`

Inputs: project (list active), valuation (list closed valuations without AR invoice), bank_account, entity (client — search), partner_company (list), invoice_number, invoice_date, due_date, subtotal, igv_rate, detraccion_rate (optional), retencion_applicable, retencion_rate (if applicable), currency, exchange_rate, document_ref, is_internal_settlement, notes

Displays calculated breakdown before confirming:
```
Subtotal:        S/ 100,000
IGV (18%):       S/  18,000
Gross:           S/ 118,000
Detraccion (4%): S/   4,720
Retencion (3%):  S/   3,540
Net receivable:  S/ 109,740
```

---

### Task 3.9 — register_payment.py
**Depends on:** Task 3.1
**Output:** `cli/register_payment.py`

Inputs: related_to (cost or ar_invoice), search and select the specific record, direction (auto-derived from related_to type), payment_type (regular/detraccion/retencion), payment_date, amount, currency, exchange_rate, bank_account (nullable for retencion), partner_company, notes

Shows current outstanding balance before and after payment.

---

### Task 3.10 — view_ap_calendar.py
**Depends on:** Task 3.1
**Output:** `cli/view_ap_calendar.py`

Reads from `v_ap_calendar` view.
Displays upcoming unpaid/partial costs sorted by due date.
Color codes: overdue (red), today (orange), this week (yellow), future (green).
Filters: optional project filter.

---

### Task 3.11 — view_partner_balances.py
**Depends on:** Task 3.1
**Output:** `cli/view_partner_balances.py`

Reads from `v_partner_ledger` view.
Displays partner contributions and income distribution per project.
Optional: filter by project.

---

## Phase 4: Visualization Website

**Goal:** Read-only Next.js website on Vercel. All views from `04_visualization.md`.

**Start only after Phase 3 is complete and real data has been entered through CLI scripts.**

### Task 4.1 — Project setup
Next.js app, Supabase client, TypeScript types from schema, Vercel deployment.

### Task 4.2 — Layout and navigation
Sidebar navigation, header, responsive shell. Minimalist design — clean, calm, functional.

### Task 4.3 — AP Payment Calendar
### Task 4.4 — Project Cost Summary
### Task 4.5 — AR Outstanding
### Task 4.6 — Partner Ledger
### Task 4.7 — Entity Transaction History
### Task 4.8 — Company P&L
### Task 4.9 — Bank Account Balances
### Task 4.10 — Unit Price History (lower priority)
### Task 4.11 — Quote vs Actual Comparison (lower priority)

---

## Phase 5: Full Web Application (V1)

**Start only when business revenue justifies development investment or non-technical users need data entry.**

- Add Supabase Auth
- Add data entry forms for all operations
- Mobile browser optimization
- Retire CLI scripts as primary method (keep as fallback)

---

## Blocked Tasks

| Task | Blocked By |
|---|---|
| Seed real partner company data | Partner company names and RUCs not yet confirmed |
| Confirm detraccion rates | Need to confirm applicable rates with accountant |
| SUNAT field requirements | Need to consult external accountant |

---

*Update completion status as tasks are finished. Add new tasks as they are identified.*
