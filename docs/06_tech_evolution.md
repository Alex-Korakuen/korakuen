# Technology Evolution Strategy

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Active

---

## Philosophy

The system is built in versions. Each version uses the same database — only the interface and tooling evolve. No data migration, no rebuilding from scratch, no throwaway work. Every hour invested in V0 carries forward permanently.

```
V0 ────────── V1 (Current) ────────── V2
Foundation    Website                   Mobile + automation
(data model)  (visualization +               |
     |         data entry)                   |
     |              |                        |
     └──────────────┴────────────────────────┘
              PostgreSQL on Supabase
              (same database throughout)
```

---

## V0 — Foundation

**Status:** Complete
**Goal:** Get clean, structured data flowing from day one. Prove the data model works in practice.

### Stack
- PostgreSQL on Supabase (database)
- Next.js on Vercel (visualization + data entry website)
- SharePoint (file storage, external)
- Todoist (task management, external)
- WhatsApp (communication, external)

### What it looks like
The website provides dashboards, browse pages, and inline data entry forms. Partners create entities, projects, bank accounts, loans, and register payments directly through the website.

### Why Vercel instead of Power BI
Power BI requires paid licensing and a Microsoft ecosystem dependency. Vercel hosting is free. Next.js is already known from the personal finance tracker project. A custom website gives full control over display and behavior with no vendor lock-in. The Supabase JavaScript client makes read queries simple and direct.

### Website — 8 sidebar pages + detail/settings routes
- Projects — project detail with budget, invoices, and partner settlement
- Entities & contacts — supplier/client directory with transaction history
- Prices — historical unit price reference
- Invoices — unified AP/AR invoices with aging buckets
- Payments — payment history with period summaries
- Calendar — upcoming payment obligations (invoices + loan schedule)
- Settlement — partner contribution balances across projects
- Financial position — bank balances, outstanding, IGV, retenciones

### Website data entry
- Entity CRUD, tags, and contacts
- Project creation and budget management
- Bank account creation
- Loan creation with payment schedule
- Payment and collection registration (AP and AR)
- Loan repayment registration

### Strengths
- Partners can enter and view data directly
- Forces clean data discipline from day one
- Free hosting and no licensing costs
- RLS policies enforce authenticated access

### Limitations
- No mobile-native experience
- No file upload integration
- No bulk import from Excel (data entry is record-by-record via website forms)

---

## V1 — Website (Current)

**Status:** Complete — production live at `https://korakuen.vercel.app`
**Goal:** Full visualization and data entry website. Unified invoice model. All partner data visible with global filter.

### Stack
- PostgreSQL on Supabase (database — 15 tables, 10 views)
- Next.js on Vercel (visualization + data entry website)
- SharePoint (file storage, external)

### What changed from V0
- Website replaces CLI as the sole data entry interface
- Unified invoice model — `costs`, `cost_items`, `ar_invoices` merged into `invoices` + `invoice_items` with `direction` column
- Loan simplification — `loan_payments` table dropped, repayments go through universal `payments` table
- `project_entities` table dropped — entity-project relationships inferred from invoices
- `quotes` table merged into `invoices` + `invoice_items` — quotes tracked via `invoices.quote_status` and `invoice_items.quote_date`
- Per-page partner filters (URL-based search params) replace dual-view model
- 8 sidebar pages + settings page

### When to move to V2
Move when any of the following is true:
- Native mobile access needed on construction sites
- Push notifications needed for payment reminders
- Automation needs exceed what the web app provides

---

## V2 — Mobile + Automation

**Status:** Future
**Goal:** Native mobile experience and automated workflows.

### Stack
- PostgreSQL on Supabase (same database)
- Next.js on Vercel (same web app from V1)
- React Native or native iOS app (mobile client)
- Supabase Edge Functions (serverless automation)

### New capabilities vs V1
- Native iOS/Android app optimized for on-site use
- Push notifications — payment due, invoice overdue
- Camera integration — photograph a receipt on site, attach directly to an invoice record
- Automated AP due date reminders
- Potential WhatsApp integration for alerts

---

## What Never Changes

Regardless of version, these are permanent decisions:

- **PostgreSQL on Supabase** — no migration planned ever
- **Single shared database** — one source of truth for all three partners
- **Amounts in natural currency** — USD or PEN, never converted at storage
- **Exchange rate per transaction** — stored as reference for display
- **IGV tracked separately** — on every financial transaction
- **Detracciones tracked on AR and AP; retenciones tracked on AR only**
- **Partner company field** — on every financial record
- **Document reference codes** — linking database records to SharePoint files
- **Full informality support** — nullable entity, comprobante, and document fields

---

## Development Principles

- **Schema first.** Never build interface before the data model is validated.
- **Don't overbuild.** Each version solves only problems that actually exist at that stage.
- **Design matters.** The website should follow minimalist design principles — clean, calm, functional. Inspired by Todoist and Notion.
- **Document decisions.** Every significant choice gets recorded before any code is written.
- **Free stack where possible.** Vercel free tier, Supabase free tier, no paid licensing dependencies.

---

*Update this document when version timelines become clearer or new capabilities are identified.*
