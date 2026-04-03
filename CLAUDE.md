# CLAUDE.md — Korakuen Management System

This file is the entry point for Claude Code. Read this first. Then read the specific document relevant to your current task before writing any code.

---

## What This System Is

A custom management system for **Korakuen**, a small Peruvian construction company founded February 2026. Three partner companies collaborate on civil works projects (roads, sidewalks, small police modules) under both subcontractor and OxI (Obras por Impuesto) frameworks.

The system replaces spreadsheets with a structured database. It gives the partners real operational visibility — cost tracking, invoice management, payment calendars, partner contribution balances — without the complexity of an ERP.

**This is not a prototype.** The database is production infrastructure. Every decision in these documents was deliberate. Do not change architectural decisions without explicit discussion.

---

## Core Principle

**The database is the product. The website is how data gets in and out.**

- Data entry: Website
- Data storage: PostgreSQL on Supabase
- Data visualization: Next.js website on Vercel
- File storage: SharePoint (external, referenced by naming convention only)

---

## Technology Stack

| Layer | Tool |
|---|---|
| Database | PostgreSQL on Supabase |
| Database management | Supabase CLI (migrations, views, SQL execution) |
| Website | Next.js + TypeScript on Vercel |
| Package manager | npm |

---

## Repository Structure

```
korakuen/
├── skills/                 → Claude Code skill files (read before performing each task)
│   ├── sql_schema.md
│   ├── sql_views.md
│   ├── ts_types.md
│   └── codebase_audit.md
├── supabase/
│   ├── migrations/         → timestamped SQL migration files (Supabase CLI format)
│   ├── views/              → individual SQL view definitions (combined into migration for deploy)
│   └── seeds/              → initial data SQL
├── website/                → Next.js website (data entry + visualization)
│   ├── src/app/            → pages and routes
│   ├── src/components/     → reusable components
│   └── src/lib/            → Supabase client, types, queries
└── docs/                   → all documentation
```

---

## Database — 15 Tables

```
Layer 1: bank_accounts, entities, exchange_rates, categories
Layer 2: tags, entity_tags, entity_contacts, projects
Layer 3: project_partners
Layer 4: invoices, invoice_items
Layer 5: payments
Layer 6: loans, loan_schedule
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

- **Peruvian tax reality:** Every financial transaction has IGV (18%), potentially detraccion (varies %), potentially retencion (3% on receivable only — Korakuen is NOT a retencion agent)
- **Unified invoice model:** `invoices` table with `direction` column (`'payable'` or `'receivable'`) replaces separate costs/AR tables. `invoice_items` holds line items. Category lives on invoice_items, not the header
- **Informality is normal:** entity_id, comprobante fields, and document_ref are all nullable on invoices and payments — cash purchases and informal suppliers are valid
- **Partner identity:** The three partner companies are regular rows in `entities`, identified by the `partner` tag via `entity_tags`. All financial tables (invoices, payments, loans) have explicit `partner_id` (FK to entities). Bank accounts belong only on payments (cash movements), not on invoices
- **Quotes are invoices:** Quotes are stored as invoices with `quote_status` (pending/accepted/rejected) and `invoice_items.quote_date`. No separate quotes table. `purchase_order_id` on invoices is reserved for a future Purchase Orders module — always null
- **No stored totals:** subtotal, igv_amount, total on invoices are derived from invoice_items via `v_invoice_totals`. Payment status derived from payments via `v_invoice_balances`
- **Tags are universal:** one `tags` table serves entity categorization, project roles, and partner identification (the `partner` tag marks the three partner companies in `entities`)
- **Project code drives everything:** PRY001, PRY002... — auto-sequential, used in all SharePoint filenames

---

## Skills

Before performing any of these tasks, read the corresponding skill file first.

| Task | Skill File |
|---|---|
| Write CREATE TABLE SQL | `skills/sql_schema.md` |
| Write database view SQL | `skills/sql_views.md` |
| Generate or update TypeScript types | `skills/ts_types.md` |
| Audit the codebase | `skills/codebase_audit.md` |

Skills live in `/skills/`. Read the full skill file before starting — they contain specific patterns, rules, and code examples that must be followed exactly.

---

## Document Map

Read these documents for context on specific tasks:

| Task | Read First |
|---|---|
| Any database work | `docs/08_schema.md` |
| Understanding business context | `docs/01_business_context.md` |
| Understanding architecture decisions | `docs/02_system_architecture.md` |
| Understanding module behavior | `docs/03_module_specifications.md` |
| Building website views | `docs/04_visualization.md` |
| Understanding file/document references | `docs/07_file_storage.md` |
| Knowing what to build next | `TODO.md` |
| Understanding tech evolution (V0→V1→V2) | `docs/06_tech_evolution.md` |

---

## Behavior Rules for Claude Code

### Always do:
- Read the relevant document before starting any task
- Discuss approach before writing code
- Follow naming conventions in `docs/10_coding_standards.md` exactly
- Show a summary and ask for confirmation before any database insert
- Write comments on non-obvious code
- Update `TODO.md` task status when tasks complete

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

**Development complete.** Database (15 tables, 10 views) and website (8 sidebar pages + project detail, entity detail, and settings routes) are built and deployed. The `quotes` table was merged into `invoices` + `invoice_items` — quotes are now invoices with `quote_status` and `invoice_items.quote_date`. Production live at `https://korakuen.vercel.app`. V1 unified invoice model deployed — `costs`, `cost_items`, `ar_invoices` replaced by `invoices` + `invoice_items`. CLI removed — all data entry through the website.

**Role-based write access.** Alex is the admin (`app_metadata.role = 'admin'`) — full read/write. Partners have read-only access enforced via RLS `is_admin()` check on all write policies. All data is visible to everyone — no row-level read filtering. Partners are regular entities tagged with `partner` via `entity_tags` — no separate partner_companies table. `partner_id` on invoices and payments identifies which partner incurred the cost or received the revenue.

**Settlement dashboard.** Dedicated `/settlement` page aggregates partner balances across projects. Project detail shows partners as read-only chips; settlement math lives in its own page. Intercompany invoices (`cost_type = 'intercompany'`) are excluded from settlement totals to avoid distorting project economics.

**Direct transactions.** Partners' informal cash payments (no comprobante) are recorded via the payments import — leaving `invoice_document_ref` blank auto-generates an invoice + payment in one step. Supports both outflow (costs) and inflow (revenue). Can be promoted to a formal invoice later when the comprobante arrives.

**Loans are partner-owned.** Every loan has a `partner_id` (FK to entities). Business rule: 10% return on loans, borrower keeps the spread between agreed return and what they pay the lender.

See `TODO.md` for remaining work.

---

*This file is updated when major phases complete or the stack changes. All detailed decisions live in the numbered docs — this file is the entry point only.*
