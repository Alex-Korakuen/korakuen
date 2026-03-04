# System Architecture & Decisions

**Document version:** 3.0
**Date:** March 2, 2026
**Status:** Active

---

## 1. System Vision

A lightweight, structured management system that gives a small construction company real operational visibility from day one — without the overhead of a full ERP or CRM. The system prioritizes data quality and queryability over interface sophistication.

**Core principle:** The database is the product. The CLI is the data entry mechanism. The visualization website is where the value is consumed — free, controlled, and built on technology we already know.

---

## 2. Technology Stack

| Layer | Tool | Notes |
|---|---|---|
| Database | PostgreSQL on Supabase | Free tier; production-grade; scalable |
| Database Management | Supabase CLI | Migrations, schema changes, and SQL execution via terminal |
| Data Entry | Python CLI scripts | Simple terminal scripts; one per operation; no UI complexity |
| Visualization | Next.js on Vercel | Simple read-only website; free hosting; no licensing costs |
| File Storage | SharePoint | External; referenced by naming convention only |
| Task Management | Todoist | External; not replicated in system |
| Communication | WhatsApp | External; no integration needed |

---

## 3. How the Tools Connect

```
[Supabase CLI]                [Python CLI Scripts]
       |                              |
       | manages schema               | writes data
       v                              v
[PostgreSQL on Supabase] ——— read by ———> [Next.js Visualization Website]
       |                                         (hosted on Vercel)
       | references via code
       v
[SharePoint file storage]
```

Schema changes (migrations, views, indexes) are applied via the Supabase CLI. The Python CLI scripts are the only write path for business data. The Vercel website is read-only — it queries the database and displays data. SharePoint is fully independent — the database holds a reference code, not a live link.

---

## 4. Key Architectural Decisions

### 4.1 Single Shared Database
All three partner companies share one database with a `partner_company` field on every relevant financial record.

**Why single:** Shared projects are registered once. Partner balance calculations happen naturally from the data. The visualization website can show both consolidated and per-company views. One source of truth for a collaborative operation.

**Tradeoff:** All partners see each other's data. Accepted — transparency is appropriate and desired given the collaboration structure.

---

### 4.2 CLI for Data Entry, Vercel Website for Visualization
Data entry happens exclusively through Python terminal scripts. Visualization happens through a simple read-only Next.js website hosted on Vercel.

**Why CLI for entry:** A UI adds enormous complexity. A CLI script per operation is 30-50 lines of Python and takes an afternoon to write. No frontend framework, no styling, no state management.

**Why Vercel instead of Power BI:** Power BI is expensive and requires licensing. Vercel hosting is free. Next.js is already known from the finance tracker project. A custom website gives full control over what is displayed and how, with no vendor dependency. Supabase has a native JavaScript client that makes read queries straightforward.

**What the website does:** Displays dashboards and views — AP calendar, project cost summaries, partner balances, contact transaction history. Read only. No forms, no data entry.

**Future path:** The same Next.js website naturally evolves into a full application with data entry forms in V1, without rebuilding anything. The read-only website is the foundation of the future full app.

---

### 4.3 Separate Tables for Income and Expenses
AR invoices (income) and Costs (expenses) live in separate tables despite both being financial transactions.

**Why:** They have fundamentally different fields, lifecycles, and purposes. Costs are granular daily transactions with quantity, unit price, category, and bank account. AR invoices are high-level billing documents tied to valuations with collection records. Mixing them makes the P&L calculation messy and error-prone. Separate tables keeps the data clean and the P&L unambiguous.

---

### 4.4 Two-Level Entity Structure for Contacts
External parties are stored as **Entities** (the legal entity — company or person) with optional associated **Contacts** (people within that entity). Transactions reference the Entity, never the Contact directly.

**Why:** In Peru, you do business with both companies (RUC) and individuals (DNI). The legal and tax identity is always the Entity. The Contact is just a relationship aid. Storing RUC and Razón Social on the Entity once and referencing it from transactions avoids duplication and inconsistency.

---

### 4.5 Full Informality Support
Transactions support three states:

- Fully formal: entity assigned, comprobante recorded, document in SharePoint
- Partially formal: entity assigned, no comprobante or document
- Fully informal: no entity, no comprobante, no document

All nullable. No transaction is blocked from being registered due to missing formal information. This reflects Peruvian construction reality.

**Comprobante types** cover the full spectrum of Peruvian document reality: `factura`, `boleta`, `recibo_por_honorarios`, `liquidacion_de_compra`, `planilla_jornales`, `none`. The type tells the accountant why IGV is zero — no special boolean flag needed. `igv_rate = 0` naturally excludes informal costs from IGV tax credits.

**Payment method** (`bank_transfer`, `cash`, `check`) on costs indicates the payment channel. Cash payments are the informal economy indicator — useful for the accountant to understand what portion of costs have no banking trail.

---

### 4.6 Document Reference by Naming Convention
Files stored in SharePoint are referenced in the database by a standardized code (`PRY001-AP-001`), not by URL.

**Why:** URLs break if files move. Permanent IDs require Microsoft Graph API (significant complexity). A naming convention is resilient, zero-infrastructure, and instantly searchable in SharePoint.

---

### 4.7 Peruvian Tax Compliance Fields
Every transaction captures the full Peruvian tax reality from day one:

- **IGV (18%):** tracked separately on all costs and invoices
- **Detracciones:** tracked on AR and AP, rate editable per transaction, Banco de la Nación as a special account type
- **Retenciones:** tracked on AR only — Korakuen is not a retention agent
- **Comprobante type:** Factura, Boleta, Recibo por Honorarios, Liquidación de Compra, Planilla de Jornales, or None — stored per transaction
- **Exchange rate:** mandatory (NOT NULL) on all financial tables, stored per transaction at the historical rate. Enables reliable currency conversion at the application layer. Amounts always stored in natural currency (USD or PEN) — never converted at storage

---

### 4.8 Asymmetric Bank Account Tracking
Alex's bank accounts are tracked fully — every transaction in and out, reconcilable against bank statements. Partner bank accounts are tracked only as net positions — the system knows what each partner has paid out on behalf of projects, but does not track their internal account movements.

**Why:** Partners use personal accounts for mixed personal and business expenses. Full tracking would require invasive visibility into personal finances. Net position tracking gives sufficient data for partner settlements while respecting privacy.

---

### 4.9 Valuations as a Standalone Table
Monthly billing periods (Valuation #1, #2, etc.) are a proper table, not just a text tag on costs.

**Why:** A valuation has its own attributes — period, status, billed value, linked AR invoice. Storing it as a table makes these queryable and links cleanly to AR. A text tag would be unstructured and unqueryable.

---

### 4.10 Partner Ledger as a View, Not a Table
Partner contribution tracking and settlement calculations are database views derived from the costs table filtered by partner company via bank_account. No standalone ledger table.

**Why:** All the data already exists in the costs table. A separate ledger table would duplicate data and create consistency risk. The view is always up to date because it reads directly from the source. The partner ledger is displayed on the visualization website as a dashboard.

---

### 4.11 SG&A Two-Level Categorization
Expenses are categorized at two levels — Type (Project Cost vs SG&A) and Category (specific subcategory within each type). Project field is nullable — null project means SG&A.

**SG&A Categories:**
- Software & Licenses
- Partner Compensation
- Business Development (meals, travel, entertainment)
- Professional Services (accountant, lawyer, legal)
- Office & Admin
- Other

---

### 4.12 Purchase Order Extensibility Hook
The `costs` table includes a nullable `purchase_order_id` field reserved for a future Purchase Orders module. Currently always null — costs reference quotes directly via `quote_id`. When POs are introduced, the flow shifts from `quote → cost` to `quote → purchase_order → cost` using the existing field. No schema migration needed on `costs` when this happens.

**Current flow:** `quote_id` filled, `purchase_order_id` null
**Future flow:** `purchase_order_id` filled, `quote_id` null or on the PO record
**Rule:** At most one of these fields is filled per cost record.

---

### 4.13 Dual-View Architecture
The system serves two audiences with different needs. Every applicable page has two modes:

**Company View (Alex only):** Cross-project aggregation, Korakuen's portion only, includes private data (loans, financing costs). Answers "How is my business doing?"

**Project View (all partners + Alex):** One project at a time, all partners combined, no private data. Answers "How is this project doing?"

Same pages, same underlying data — the difference is a filter parameter. P&L is computed in `queries.ts` (period-filtered, multi-table aggregation with currency conversion) rather than via SQL views. The SQL views `v_project_pl` and `v_company_pl` exist for simple queries but the website computes P&L directly for full flexibility. UX mechanism (toggle, selector, etc.) to be designed during Phase 4 website implementation. In V1, role-based auth ensures partners only see project-scoped views.

---

### 4.14 Loans Module (Private)
A private module to track Alex's personal debt obligations — money borrowed from friends, family, or informal lenders to fund project contributions.

**Key principle:** All capital contributed to a project counts as own capital regardless of source. The partnership never sees loan data. Profit split is proportional to capital contributed. What each partner does with their profit share is their own business.

3 tables (`loans`, `loan_schedule`, `loan_payments`) isolated from business `payments`. Loan obligations appear in `v_ap_calendar` as a second UNION source (Alex-only). Personal position (profit share minus loan obligations) shown below the P&L on the website — never part of the P&L itself.

Privacy: CLI-only in V0 (automatic — only Alex runs the CLI). Admin-only in V1 (role-based auth).

---

### 4.15 P&L vs Cash Flow — Two Financial Statements
The system provides two distinct financial views:

**P&L (accrual basis):** Revenue and costs when invoiced/recorded, regardless of whether cash has moved. Computed in `queries.ts` with period filtering and currency conversion (SQL views `v_company_pl`/`v_project_pl` exist for simple queries). Shows business profitability.

**Cash Flow (cash basis):** Actual cash movements through bank accounts. Computed in `queries.ts` (too complex for a single SQL view). Past months show actual payments; future months show forecasted in/out based on due dates on costs, AR invoices, and loan schedule. Shows cash position.

Loan obligations are NOT on the P&L — they are personal, not business expenses. They appear in the personal position section below the P&L (Alex-only) and in the cash flow forecast (as outflows, Alex-only).

---

## 5. Website Architecture (Phase 4)

### 5.1 Route Groups and Layout
The Next.js website uses a route group `(app)/` for all authenticated pages. Pages inside this group share a sidebar + header layout. Auth-related pages (`/login`, `/auth/callback`, `/auth/set-password`) sit outside the route group and render without the sidebar.

```
src/app/
  login/                → no sidebar, centered card layout
  auth/callback/        → token exchange (route handler, no UI)
  auth/set-password/    → no sidebar, centered card layout
  (app)/                → shared sidebar + header layout
    ap-calendar/        → default landing page after login
    ar-outstanding/     → AR aging and collections
    ...                 → all other dashboard and browse pages
    settings/password/  → change password (within sidebar layout)
```

### 5.2 Authentication — Invite-Only
No open registration. Alex invites users via the Supabase Dashboard (Authentication > Users > Invite). The invited user receives an email, clicks the link, lands on `/auth/callback` which exchanges the token, then redirects to `/auth/set-password` where they choose a password.

Middleware (`src/middleware.ts`) protects all routes: unauthenticated users are redirected to `/login`. Authenticated users accessing `/login` are redirected to `/ap-calendar`. The auth callback and set-password pages are excluded from protection.

### 5.3 User Metadata
Role and identity are stored in Supabase user metadata (set via SQL after invite):

| Field | Type | Purpose |
|---|---|---|
| `is_company_view` | boolean | `true` = Alex (sees everything including loans). `false`/absent = partner view |
| `partner_company_id` | UUID | Links user to their partner_company record for data scoping |
| `display_name` | string | Name shown in header |
| `password_set` | boolean | Set to `true` when user completes set-password flow |

`auth.ts` exposes helpers: `getCurrentUser()`, `isCompanyView()`, `getPartnerName()`, `getPartnerCompanyId()`.

### 5.4 Supabase Clients
Two client factories, both typed against auto-generated `database.types.ts`:

- **Server** (`lib/supabase/server.ts`): Uses `@supabase/ssr` with cookie handling for Server Components and Route Handlers. Created per-request.
- **Client** (`lib/supabase/client.ts`): Uses `@supabase/ssr` browser client for client components (`'use client'`). Used in auth forms.

Both use the anon key — the website is read-only in V0, and RLS policies control access.

---



| Out of Scope | Handled By |
|---|---|
| SUNAT-compliant electronic invoicing | Alegra / Contasis + accountant |
| Formal tax accounting | External accountant |
| Payroll | External accountant |
| File storage | SharePoint |
| Task management | Todoist |
| Team communication | WhatsApp |
| Automatic reminders or notifications | Not in scope for V0 |
| Mobile native access | Not in scope for V0 |

---

## 6. Versioning Strategy

The database is the permanent foundation. Every other layer evolves without touching the schema.

See `06_tech_evolution.md` for the full V0 → V1 → V2 roadmap.

**Critical point:** Supabase is production-grade PostgreSQL infrastructure. The database built in V0 is the same database the final application will use. Nothing gets thrown away.

---

*This document records architectural decisions and their rationale. Update when significant technical decisions are made or revised.*
