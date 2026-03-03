# Project Roadmap

**Document version:** 4.0
**Date:** March 2, 2026
**Status:** Active

---

## Phase 1: Foundation (Complete)

**Goal:** Design and validate the complete data model and prepare all documentation before writing any code.

- [x] Define business context and requirements
- [x] Define system architecture and tool stack
- [x] Define all modules and their attributes
- [x] Define visualization website views
- [x] Define SharePoint structure and naming convention
- [x] Lock all architectural decisions
- [x] Design database schema — all 13 tables fully defined
- [x] Review and validate schema
- [x] Write coding standards
- [x] Write environment setup guide
- [x] Write development execution roadmap
- [x] Write CLAUDE.md master context file
- [x] Write skills reference document
- [x] Full documentation audit and consistency check
- [x] Build all six skill files (Task 1.5)

---

## Phase 2: Database (Complete)

**Goal:** A working, populated database on Supabase.

- [x] Write SQL to create all tables
- [x] Set up Supabase project
- [x] Apply schema to Supabase
- [x] Define indexes for common query patterns
- [x] Create seed data for testing (sample project, entities, costs)
- [x] Validate data model with real examples from the business

---

## Phase 3: Data Entry (CLI) (Complete)

**Goal:** Menu-driven Python CLI for all data entry and import operations. Single entry point via `python main.py`.

- [x] Setup: `main.py` + shared libs (`lib/db.py`, `lib/helpers.py`, `lib/import_helpers.py`)
- [x] `modules/projects.py` — add single + import from Excel
- [x] `modules/entities.py` — add entity, contact, tag, assignments + import
- [x] `modules/costs.py` — add cost (header + line items) + import costs/cost_items
- [x] `modules/quotes.py` — add single + import from Excel
- [x] `modules/valuations.py` — add single + import from Excel
- [x] `modules/ar_invoices.py` — add single + import from Excel
- [x] `modules/payments.py` — register payment, verify retencion
- [x] ~~`modules/views.py`~~ — retired; read-only dashboards moved to website
- [x] Integration test of full menu flow

---

## Phase 3.5: Schema & CLI Extensions (Complete)

**Goal:** Add planned tables and fields before website development begins. Extends the CLI with loans module and updates existing modules.

- [x] Add `city`, `region` to entities table + update CLI + regenerate templates
- [x] Add `payment_method` to costs table + expand comprobante_type values in CLI
- [x] Add loans tables (3) + CLI `modules/loans.py`
- [x] Add `project_budgets` table + budget entry in CLI projects.py
- [x] Create planned views: `v_loan_balances`, `v_budget_vs_actual`
- [x] Update `v_ap_calendar` with loan_schedule UNION

---

## Phase 4: Visualization Website (V0 — Read Only)

**Goal:** Simple read-only Next.js website on Vercel showing all key views.

- [ ] Set up Next.js project connected to Supabase
- [ ] Deploy to Vercel
- [ ] Build AP Payment Calendar view (with loan section for Alex)
- [ ] Build Project Cost Summary view (with Budget vs Actual section)
- [ ] Build AR Outstanding & Collections view
- [ ] Build Partner Contribution & Balances view
- [ ] Build Entity Transaction History view (with city/region filters)
- [ ] Build Company P&L view (with personal position section for Alex)
- [ ] Build Cash Flow view (past actuals + future forecast)
- [ ] Build IGV Net Position view
- [ ] Build Bank Account Balances view
- [ ] Build Retencion Dashboard
- [ ] Build Unit Price History view (lower priority)
- [ ] Build Quote vs Actual Comparison view (lower priority)

---

## Phase 5: Excel In/Out + Full Web Application (V1)

**Goal:** Add accounting export, data entry forms, and role-based access. CLI becomes optional fallback.

- [ ] Accounting export — 5-tab Excel for external accountant (costs, AR, payments made, payments received, summary)
- [ ] Add Supabase Auth with roles (Admin/Partner)
- [ ] Add data entry forms for all modules
- [ ] Mobile browser optimization
- [ ] Retire CLI as primary entry method (keep as fallback)

---

## Phase 6: Mobile + Automation (V2)

**Goal:** Native mobile and automated workflows. Define scope when V1 is stable.

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

*Update this document as phases are completed and decisions are made.*
