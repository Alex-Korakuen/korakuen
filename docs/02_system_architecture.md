# System Architecture & Decisions

**Document version:** 3.0
**Date:** March 7, 2026
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
| Data Entry | Python CLI scripts + website forms | CLI for bulk/import; website for interactive entry |
| Website | Next.js on Vercel | Visualization + data entry; free hosting; no licensing costs |
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

Schema changes (migrations, views, indexes) are applied via the Supabase CLI. Data entry happens through both Python CLI scripts and the website's inline forms. Both write paths use RLS policies for access control. SharePoint is fully independent — the database holds a reference code, not a live link.

---

## 4. Key Architectural Decisions

### 4.1 Single Shared Database
All three partner companies share one database with a `partner_company` field on every relevant financial record.

**Why single:** Shared projects are registered once. Partner balance calculations happen naturally from the data. The visualization website can show both consolidated and per-company views. One source of truth for a collaborative operation.

**Tradeoff:** All partners see each other's data. Accepted — transparency is appropriate and desired given the collaboration structure.

---

### 4.2 Dual Data Entry — CLI and Website
Data entry happens through both Python CLI scripts and the website's inline forms and modals. The CLI is used for bulk imports (Excel); the website provides interactive forms for creating and managing individual records.

**Why CLI for bulk entry:** A CLI script per operation is 30-50 lines of Python and takes an afternoon to write. Ideal for initial data loads and Excel imports.

**Why Vercel instead of Power BI:** Power BI is expensive and requires licensing. Vercel hosting is free. Next.js is already known from the finance tracker project. A custom website gives full control over what is displayed and how, with no vendor dependency. Supabase has a native JavaScript client that makes read and write queries straightforward.

**What the website does:** Displays 7 pages — AP calendar, AR outstanding, cash flow, financial position, projects, entities & contacts, and prices. Provides data entry forms for entities, projects, bank accounts, loans, payments, and collections. RLS policies enforce authenticated access for all writes.

---

### 4.3 Separate Tables for Income and Expenses
AR invoices (income) and Costs (expenses) live in separate tables despite both being financial transactions.

**Why:** They have fundamentally different fields, lifecycles, and purposes. Costs are granular daily transactions with quantity, unit price, category, and bank account. AR invoices are high-level billing documents tied to projects with collection records. Separate tables keeps the data clean, enables straightforward cash flow reporting, and makes partner settlement calculations (profit = income - project costs) unambiguous.

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

### 4.8 Bank Account Tracking
All three partners' bank accounts are tracked in the system. Every cost and payment references a bank account, so all project-related transactions are visible for all partners.

**Key distinction:** Partner account balances reflect only project transactions recorded in the system — not full personal banking activity. Partners use personal accounts for mixed personal and business expenses. The `bank_tracking_full` flag on `partner_companies` (true for Alex, false for others) indicates whether full reconciliation against bank statements is expected. Alex's accounts can be fully reconciled; partner accounts show project-level activity only.

---

### 4.9 Partner Settlement — Computed in Application Layer
Partner contribution tracking and settlement calculations are computed in the application layer (`queries.ts`) from `v_cost_totals` grouped by partner company. No standalone ledger table or view.

**Why:** All the data already exists in the costs and payments tables. A separate ledger table would duplicate data and create consistency risk. Settlement is displayed within the project detail view on the website.

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
The `costs` table includes a nullable `purchase_order_id` field reserved for a future Purchase Orders module. Currently always null — costs reference quotes directly via `quote_id`. When POs are introduced, the flow shifts from `quote → cost` to `quote → purchase_order → cost` using the existing field. No schema migration needed on `costs` when this happens.

**Current flow:** `quote_id` filled, `purchase_order_id` null
**Future flow:** `purchase_order_id` filled, `quote_id` null or on the PO record
**Rule:** At most one of these fields is filled per cost record.

---

### 4.12 Universal Partner Filter
All data is visible to all users — no role-based visibility restrictions. A global partner filter in the sidebar lets users toggle which partner companies' data to display. The filter persists across all 8 pages via a cookie (`partner_filter`).

**How it works:** Partner toggle buttons in the sidebar. Toggling partners marks the filter as dirty; clicking Apply sets the cookie and refreshes the page. Server components read the cookie to scope queries. When no filter is applied, all data is shown.

**Why universal:** Transparency is appropriate for this partnership structure. Every partner can see loans, financial position, and all transactions. The filter is for focus, not for access control.

---

### 4.13 Loans Module
Tracks loans taken by any partner to fund project contributions. Every loan has a `partner_company_id` identifying which partner borrowed the money.

**Business rule:** 10% return on loans. The borrower keeps the spread between the agreed return rate and what they actually pay the lender.

2 tables (`loans`, `loan_schedule`) with repayments tracked in the universal `payments` table (`related_to = 'loan_schedule'`). Loan obligations appear in `v_ap_calendar` as a second UNION source. Loan balances and status are derived in `v_loan_balances`. All loan data is visible to everyone via the universal partner filter.

---

### 4.14 Cash-Basis Financial Reporting
The system operates on a cash basis. There is no accrual-based P&L.

**Cash Flow:** Actual cash movements through bank accounts. Computed in `queries.ts` (too complex for a single SQL view). Past months show actual payments; future months show forecasted in/out based on due dates on costs, AR invoices, and loan schedule.

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
    ap-calendar/        → default landing page after login
    ar-outstanding/     → AR aging and collections
    ...                 → all other dashboard and browse pages
    settings/password/  → change password (within sidebar layout)
```

### 5.2 Authentication — Invite-Only
No open registration. Alex invites users via the Supabase Dashboard (Authentication > Users > Invite). The invited user receives an email, clicks the link, lands on `/auth/callback` which exchanges the token, then redirects to `/auth/set-password` where they choose a password.

Middleware (`src/middleware.ts`) protects all routes: unauthenticated users are redirected to `/login`. Authenticated users accessing `/login` are redirected to `/ap-calendar`. The auth callback and set-password pages are excluded from protection.

### 5.3 User Metadata
Identity is stored in Supabase user metadata (set via SQL after invite):

| Field | Type | Purpose |
|---|---|---|
| `partner_company_id` | UUID | Links user to their partner_company record |
| `display_name` | string | Name shown in header |
| `password_set` | boolean | Set to `true` when user completes set-password flow |

`auth.ts` exposes helpers: `getCurrentUser()`, `getPartnerName()`. Data visibility is controlled by the global partner filter (cookie-based), not by user role.

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
