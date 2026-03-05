# CLAUDE.md — Korakuen Management System

This file is the entry point for Claude Code. Read this first. Then read the specific document relevant to your current task before writing any code.

---

## What This System Is

A custom management system for **Korakuen**, a small Peruvian construction company founded February 2026. Three partner companies collaborate on civil works projects (roads, sidewalks, small police modules) under both subcontractor and OxI (Obras por Impuesto) frameworks.

The system replaces spreadsheets with a structured database. It gives the partners real operational visibility — cost tracking, invoice management, payment calendars, partner contribution balances — without the complexity of an ERP.

**This is not a prototype.** The database is production infrastructure. Every decision in these documents was deliberate. Do not change architectural decisions without explicit discussion.

---

## Core Principle

**The database is the product. The CLI is how data gets in. The website is how data gets read.**

- Data entry: Python CLI application — menu-driven, single entry point (`python main.py`)
- Data storage: PostgreSQL on Supabase
- Data visualization: Next.js website on Vercel (read-only in V0)
- File storage: SharePoint (external, referenced by naming convention only)

---

## Technology Stack

| Layer | Tool |
|---|---|
| Database | PostgreSQL on Supabase |
| Database management | Supabase CLI (migrations, views, SQL execution) |
| CLI application | Python 3.11+ |
| Website | Next.js + TypeScript on Vercel |
| Package manager (Python) | pip + virtualenv |
| Package manager (JS) | npm |

---

## Repository Structure

```
korakuen/
├── skills/                 → Claude Code skill files (read before performing each task)
│   ├── sql_schema.md
│   ├── sql_views.md
│   ├── cli_script.md
│   ├── import_script.md
│   ├── ts_types.md
│   └── codebase_audit.md
├── cli/                    → Python CLI application
│   ├── main.py             → single entry point (python main.py)
│   ├── modules/            → one module per entity type
│   │   ├── projects.py
│   │   ├── entities.py
│   │   ├── costs.py
│   │   ├── quotes.py
│   │   ├── ar_invoices.py
│   │   ├── payments.py
│   │   ├── loans.py          → private loans module (Phase 3.5)
│   │   └── exchange_rates.py → SUNAT daily exchange rates (Phase 5)
│   ├── lib/
│   │   ├── db.py           → shared Supabase client
│   │   ├── helpers.py      → shared input helpers
│   │   └── import_helpers.py → shared import validation
│   └── requirements.txt
├── supabase/
│   ├── migrations/         → timestamped SQL migration files (Supabase CLI format)
│   ├── views/              → individual SQL view definitions (combined into migration for deploy)
│   └── seeds/              → initial data SQL
├── website/                → Next.js visualization website
│   ├── app/                → pages and routes
│   ├── components/         → reusable components
│   └── lib/                → Supabase client, types, queries
├── imports/                → Excel templates for bulk data import
│   ├── generate_templates.py → script to create .xlsx templates
│   └── templates/          → one .xlsx template per entity type
└── docs/                   → all documentation
```

---

## Database — 18 Tables

```
Layer 1: partner_companies, bank_accounts, entities, exchange_rates
Layer 2: tags, entity_tags, entity_contacts, projects
Layer 3: project_entities, quotes
Layer 4: costs, cost_items, ar_invoices
Layer 5: payments
Layer 6 (private): loans, loan_schedule, loan_payments
Layer 7: project_budgets
```

**Never add, remove, or modify tables without reading `docs/08_schema.md` first and getting explicit approval.**

Key facts:
- All primary keys are UUID
- All tables have `created_at` and `updated_at`
- Soft deletes only — never hard delete any record
- Amounts always stored in natural currency (USD or PEN) — never converted at storage
- Exchange rate mandatory (NOT NULL) on all financial tables — stored at historical rate per transaction, enables application-layer conversion
- IGV, detraccion, and retencion tracked separately on all financial records
- Totals and payment balances are always derived via views — never stored
- No business logic triggers — all derived data computed at query time (only `updated_at` auto-timestamp triggers exist)

---

## Critical Business Rules

- **Peruvian tax reality:** Every financial transaction has IGV (18%), potentially detraccion (varies %), potentially retencion (3% on AR only — Korakuen is NOT a retencion agent)
- **Informality is normal:** entity_id, comprobante fields, and document_ref are all nullable on costs — cash purchases and informal suppliers are valid
- **Partner asymmetry:** Alex's bank accounts are fully tracked. Partner bank accounts are reference only — partner identity is derived from bank_account on costs, explicit on ar_invoices and payments
- **Costs have line items:** `costs` is the header, `cost_items` holds detail. Category lives on cost_items, not the header
- **PO module hook:** `costs` has both `quote_id` and `purchase_order_id` fields — both nullable. Currently `quote_id` is used directly. `purchase_order_id` is reserved for a future Purchase Orders module — always null in V0
- **No stored totals:** subtotal, igv_amount, total on costs are derived from cost_items via `v_cost_totals`. Payment status derived from payments via `v_cost_balances` and `v_ar_balances`
- **Tags are universal:** one `tags` table serves both entity categorization and project roles
- **Project code drives everything:** PRY001, PRY002... — auto-sequential, used in all SharePoint filenames

---

## Skills

Before performing any of these tasks, read the corresponding skill file first.

| Task | Skill File |
|---|---|
| Write CREATE TABLE SQL | `skills/sql_schema.md` |
| Write database view SQL | `skills/sql_views.md` |
| Write a Python CLI module | `skills/cli_script.md` |
| Write import functions within a CLI module | `skills/import_script.md` |
| Generate or update TypeScript types | `skills/ts_types.md` |
| Audit the codebase | `skills/codebase_audit.md` |

Skills live in `/skills/`. Read the full skill file before starting — they contain specific patterns, rules, and code examples that must be followed exactly.

---

## Document Map

Read these documents for context on specific tasks:

| Task | Read First |
|---|---|
| Any database work | `docs/08_schema.md` |
| Writing CLI modules | `docs/10_coding_standards.md` + `docs/11_environment_setup.md` |
| Understanding business context | `docs/01_business_context.md` |
| Understanding architecture decisions | `docs/02_system_architecture.md` |
| Understanding module behavior | `docs/03_module_specifications.md` |
| Building website views | `docs/04_visualization.md` + `docs/13_view_prototypes.md` |
| Understanding file/document references | `docs/07_file_storage.md` |
| Knowing what to build next | `docs/09_dev_roadmap.md` |
| Understanding tech evolution (V0→V1→V2) | `docs/06_tech_evolution.md` |
| Writing import functions | `skills/import_script.md` + `docs/10_coding_standards.md` |
| Understanding what skills to build and how | `skills/` directory (12_skills.md deleted — skills are the reference) |

---

## Behavior Rules for Claude Code

### Always do:
- Read the relevant document before starting any task
- Discuss approach before writing code
- Follow naming conventions in `docs/10_coding_standards.md` exactly
- Show a summary and ask for confirmation before any database insert
- Write comments on non-obvious code
- Update `docs/09_dev_roadmap.md` task status when tasks complete

### Never do without explicit approval:
- Modify the database schema
- Drop or truncate any table
- Edit migration files that have already been applied
- Change the document reference naming convention (`PRY001-AP-001`)
- Add external dependencies without discussion
- Push to `main` branch
- Store credentials in any committed file
- Convert currency amounts at storage time

### When in doubt:
- Ask before building
- Refer to the schema document — it is the source of truth
- Prefer simpler solutions over clever ones
- If a task seems to conflict with a documented decision, raise it before proceeding

---

## Peruvian Context Glossary

| Term | Meaning |
|---|---|
| IGV | Impuesto General a las Ventas — Peru's 18% VAT |
| Detraccion | SPOT system — client withholds % and deposits to supplier's Banco de la Nación account |
| Retencion | Client withholds 3% and pays to SUNAT — only applies when client is a designated retention agent |
| Banco de la Nación | State bank — receives detraccion deposits, balance can only be used for tax payments |
| Comprobante de pago | Formal payment document — factura, boleta, or recibo por honorarios |
| Factura | VAT invoice between registered businesses — gives IGV credit |
| Boleta | Consumer receipt — no IGV credit |
| Recibo por Honorarios | Invoice for professional services by individuals |
| RUC | Registro Único de Contribuyentes — 11-digit Peruvian company tax ID |
| DNI | Documento Nacional de Identidad — 8-digit Peruvian personal ID |
| OxI | Obras por Impuesto — Law 29230 framework where private companies execute public works for tax credits |
| SUNAT | Superintendencia Nacional de Aduanas y de Administración Tributaria — Peru's tax authority |
| ProInversión | Government agency administering the OxI framework |
| CIPRL / CIPGN | Tax credit certificates issued upon OxI project completion |

---

## Current Status

**Phase 3 complete — CLI Application.** All data entry modules built and tested (entities, projects, quotes, costs, ar_invoices, payments). Database live with 8 Phase 2 migrations. CLI connects via service role key. Views module retired — read-only dashboards moved exclusively to the website.

**Phase 3.5 complete — Schema & CLI Extensions.** Four new tables (loans, loan_schedule, loan_payments, project_budgets) in 4 migrations. Two new fields on existing tables (city/region on entities, payment_method on costs). Expanded comprobante_type to 6 values. New loans CLI module (menu item 8). Budget entry added to projects module. Two new views (`v_loan_balances`, `v_budget_vs_actual`), two updated views (`v_cost_totals` with payment_method, `v_ap_calendar` with loan UNION). All Excel templates regenerated. `v_cash_flow` skipped as SQL view — computed in `queries.ts` instead.

**Phase 4 complete — Visualization Website.** All 13 tasks complete (4.1–4.13): project setup, auth, layout, Vercel deployment, AP Calendar, AR Outstanding, Cash Flow, Partner Balances, P&L, Financial Position, Projects browse, Entities browse, Prices browse. 13 views deployed (including `v_igv_position`; `v_settlement_dashboard` removed). 24 migrations applied to remote. Production live at `https://korakuen.vercel.app`.

**Phase 5 in progress — PEN Functional Currency.** New `exchange_rates` table with daily SUNAT USD/PEN rates. New exchange_rates CLI module (menu item 8). CLI suggests current exchange rate during data entry. Dashboards converted to PEN functional currency: P&L and Cash Flow report in PEN only, AP Calendar and AR Outstanding show PEN aggregate summary cards, Partner Balances uses transaction-date PEN conversion. `v_partner_ledger` view rewritten (one row per partner per project, all in PEN). Valuations table removed (dormant infrastructure, never displayed on website).

See `docs/09_dev_roadmap.md` for full task list and completion status.

---

*This file is updated when major phases complete or the stack changes. All detailed decisions live in the numbered docs — this file is the entry point only.*
