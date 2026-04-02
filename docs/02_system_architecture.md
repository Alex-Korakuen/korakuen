# System Architecture & Decisions

**Document version:** 3.0
**Date:** March 7, 2026
**Status:** Active

---

## 1. System Vision

A lightweight, structured management system that gives a small construction company real operational visibility from day one — without the overhead of a full ERP or CRM. The system prioritizes data quality and queryability over interface sophistication.

**Core principle:** The database is the product. The website is how data gets in and out — free, controlled, and built on technology we already know.

---

## 2. Technology Stack

| Layer | Tool | Notes |
|---|---|---|
| Database | PostgreSQL on Supabase | Free tier; production-grade; scalable |
| Database Management | Supabase CLI | Migrations, schema changes, and SQL execution via terminal |
| Data Entry | Website forms and modals | Interactive entry with RLS-enforced access |
| Website | Next.js on Vercel | Visualization + data entry; free hosting; no licensing costs |
| File Storage | SharePoint | External; referenced by naming convention only |
| Task Management | Todoist | External; not replicated in system |
| Communication | WhatsApp | External; no integration needed |

---

## 3. How the Tools Connect

```
[Supabase CLI]
       |
       | manages schema
       v
[PostgreSQL on Supabase] ←——— reads & writes ———→ [Next.js Website]
       |                                            (hosted on Vercel)
       | references via code
       v
[SharePoint file storage]
```

Schema changes (migrations, views, indexes) are applied via the Supabase CLI. Data entry and visualization happen through the website. RLS policies enforce access control. SharePoint is fully independent — the database holds a reference code, not a live link.

---

## 4. Key Architectural Decisions

### 4.1 Single Shared Database
All three partner companies share one database. Partners are regular rows in the `entities` table, identified by the `partner` tag via `entity_tags`. A `partner_id` field (FK to entities) on every relevant financial record identifies which partner is involved.

**Why single:** Shared projects are registered once. Partner balance calculations happen naturally from the data. The website provides per-page partner filters (URL-based search params) so users can scope data as needed. One source of truth for a collaborative operation.

**Tradeoff:** All partners see each other's data. Accepted — transparency is appropriate and desired given the collaboration structure.

---

### 4.2 Data Entry — Website
All data entry happens through the website's inline forms and modals. The website provides interactive forms for creating and managing records — entities, projects, bank accounts, invoices, payments, loans, and collections.

**Why Vercel instead of Power BI:** Power BI is expensive and requires licensing. Vercel hosting is free. Next.js is already known from the finance tracker project. A custom website gives full control over what is displayed and how, with no vendor dependency. Supabase has a native JavaScript client that makes read and write queries straightforward.

**What the website does:** Displays 8 sidebar pages — projects, entities & contacts, prices, invoices, payments, calendar, settlement, and financial position (plus a settings page for password change). Provides data entry forms for entities, projects, bank accounts, loans, payments, and collections. RLS policies restrict writes to admin users only — partners have read-only access.

---

### 4.3 Unified Invoice Model
All invoices — both payable (expenses) and receivable (income) — live in a single `invoices` table with a `direction` column (`'payable'` or `'receivable'`). Line items live in `invoice_items`, serving both directions.

**Why:** An invoice is an invoice — both directions share the same financial anatomy (entity, amount, currency, exchange rate, IGV, detraccion). One table means one set of views, symmetric queries, and simpler joins. Payments already link generically via `related_to = 'invoice'`.

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

**Cash vs banked:** Whether a payment has a `bank_account_id` indicates the payment channel. Payments without a bank account (e.g., retencion withheld by client) are distinguishable from banked transactions. The payment `title` field (defaults: Pago, Cobro, Detraccion, Retencion) and `operation_number` provide the banking trail.

---

### 4.6 Document Reference by Naming Convention
Files stored in SharePoint are referenced in the database by a standardized code (`PRY001-AP-001`), not by URL.

**Why:** URLs break if files move. Permanent IDs require Microsoft Graph API (significant complexity). A naming convention is resilient, zero-infrastructure, and instantly searchable in SharePoint.

---

### 4.7 Peruvian Tax Compliance Fields
Every transaction captures the full Peruvian tax reality from day one:

- **IGV (18%):** tracked separately on all invoices
- **Detracciones:** tracked on AR and AP, rate editable per transaction, Banco de la Nación as a special account type
- **Retenciones:** tracked on AR only — Korakuen is not a retention agent
- **Comprobante type:** Factura, Boleta, Recibo por Honorarios, Liquidación de Compra, Planilla de Jornales, or None — stored per transaction
- **Exchange rate:** mandatory (NOT NULL) on all financial tables, stored per transaction at the historical rate. Enables reliable currency conversion at the application layer. Amounts always stored in natural currency (USD or PEN) — never converted at storage

---

### 4.8 Bank Account Tracking
All three partners' bank accounts are tracked in the system. Every payment references a bank account, so all project-related cash movements are visible for all partners.

**Key distinction:** Partner account balances reflect only project transactions recorded in the system — not full personal banking activity. Partners use personal accounts for mixed personal and business expenses.

---

### 4.9 Partner Settlement — Computed in Application Layer
Partner contribution tracking and settlement calculations are computed in the application layer (`queries/settlement.ts`) from `v_invoice_totals` grouped by partner company. No standalone ledger table or view.

**Why:** All the data already exists in the invoices and payments tables. A separate ledger table would duplicate data and create consistency risk. Settlement is displayed on the dedicated Settlement dashboard page (`/settlement`), which aggregates balances across selected projects. Intercompany invoices (`cost_type = 'intercompany'`) are excluded from settlement totals to prevent distorting project economics.

**Direct transactions:** Partners' informal cash payments are recorded via auto-generated invoices (`is_auto_generated = true`, `comprobante_type = 'none'`) with an immediate payment — the system creates both records in one step. These can be promoted to formal invoices later when the comprobante arrives.

---

### 4.10 SG&A Two-Level Categorization
Expenses are categorized at two levels — Type (Project Cost vs SG&A) and Category (specific subcategory within each type). Project field is nullable — null project means SG&A.

**SG&A Categories:**
- Software & Licenses
- Partner Compensation
- Professional Services (accountant, lawyer, legal)
- Other

---

### 4.11 Purchase Order Extensibility Hook
The `invoices` table includes a nullable `purchase_order_id` field reserved for a future Purchase Orders module. Currently always null — payable invoices reference quotes directly via `quote_id`. When POs are introduced, the flow shifts from `quote → invoice` to `quote → purchase_order → invoice` using the existing field. No schema migration needed on `invoices` when this happens.

**Current flow:** `quote_id` filled, `purchase_order_id` null
**Future flow:** `purchase_order_id` filled, `quote_id` null or on the PO record
**Rule:** At most one of these fields is filled per invoice record.

---

### 4.12 Multi-User Architecture with Role-Based Write Access
All data is visible to all authenticated users — no row-level read filtering. Write access is restricted to admin users via RLS `is_admin()` check on all write policies — partners have read-only access. The website provides per-page partner filters (URL-based search params on invoices, payments, and other pages) so users can scope data by partner.

**Intentional data asymmetry:** Korakuen (Alex's company) has full formal invoice registration, bank reconciliation, and SUNAT-compliant records. Other partner companies have lightweight tracking — amounts, dates, and categories sufficient for settlement math. Each partner handles their own formal accounting externally.

---

### 4.13 Loans Module
Tracks loans taken by any partner to fund project contributions. Every loan has a `partner_id` (FK to entities) identifying which partner borrowed the money.

**Business rule:** 10% return on loans. The borrower keeps the spread between the agreed return rate and what they actually pay the lender.

2 tables (`loans`, `loan_schedule`) with repayments tracked in the universal `payments` table (`related_to = 'loan_schedule'`). Loan obligations appear in `v_obligation_calendar` as a second UNION source. Loan balances and status are derived in `v_loan_balances`. All loan data is visible to everyone.

---

### 4.14 Cash-Basis Financial Reporting
The system operates on a cash basis. There is no accrual-based P&L.

**Cash Flow:** Actual cash movements through bank accounts. Computed in `queries/financial-position.ts` (too complex for a single SQL view). Past months show actual payments; future months show forecasted in/out based on due dates on invoices and loan schedule.

**Financial Position:** Point-in-time balance sheet showing assets (cash, AR, tax credits) vs liabilities (AP, tax liabilities, loans).

Loan obligations appear in the cash flow (as outflows) and in Financial Position (as liabilities).

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
    calendar/           → default landing page after login (AP/AR obligations)
    invoices/           → unified invoice ledger (payable + receivable + loans)
    payments/           → all cash movements
    financial-position/ → balance sheet view
    projects/           → project browse + detail
    entities/           → entity & contact browse + detail
    prices/             → quote browse + price analytics
    settings/password/  → change password (within sidebar layout)
```

### 5.2 Authentication — Invite-Only
No open registration. Alex invites users via the Supabase Dashboard (Authentication > Users > Invite). The invited user receives an email, clicks the link, lands on `/auth/callback` which exchanges the token, then redirects to `/auth/set-password` where they choose a password.

Middleware (`src/middleware.ts`) protects all routes: unauthenticated users are redirected to `/login`. Authenticated users accessing `/login` are redirected to `/calendar`. The auth callback and set-password pages are excluded from protection.

### 5.3 User Metadata
Identity is stored in Supabase user metadata (set via SQL after invite):

| Field | Type | Purpose |
|---|---|---|
| `display_name` | string | Name shown in header |
| `password_set` | boolean | Set to `true` when user completes set-password flow |

**Note:** `app_metadata.role` (set to `'admin'` for Alex) controls write access via the `is_admin()` RLS function. `user_metadata.partner_id` was planned but is not used in application code — partner filtering is handled via URL search params per page, not user identity.

`auth.ts` exposes helpers: `getCurrentUser()`, `getPartnerName()`, `isAdmin()`. Write access requires admin role — partners are read-only.

### 5.4 Supabase Clients
Two client factories, both typed against auto-generated `database.types.ts`:

- **Server** (`lib/supabase/server.ts`): Uses `@supabase/ssr` with cookie handling for Server Components and Route Handlers. Created per-request.
- **Client** (`lib/supabase/client.ts`): Uses `@supabase/ssr` browser client for client components (`'use client'`). Used in auth forms.

Both use the anon key. RLS policies control both read and write access for authenticated users.

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
