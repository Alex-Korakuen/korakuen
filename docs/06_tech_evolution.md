# Technology Evolution Strategy

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Active

---

## Philosophy

The system is built in versions. Each version uses the same database — only the interface and tooling evolve. No data migration, no rebuilding from scratch, no throwaway work. Every hour invested in V0 carries forward permanently.

```
V0 ──────────────── V1 ──────────────── V2
CLI + website       Mobile + automation  Advanced features
(visualization +         |                    |
 data entry)             |                    |
     |                   |                    |
     └───────────────────┴────────────────────┘
              PostgreSQL on Supabase
              (same database throughout)
```

---

## V0 — Foundation (Current)

**Status:** Complete
**Goal:** Get clean, structured data flowing from day one. Prove the data model works in practice. Build the visualization foundation.

### Stack
- PostgreSQL on Supabase (database)
- Python CLI scripts (bulk imports from Excel)
- Next.js on Vercel (visualization + data entry website)
- SharePoint (file storage, external)
- Todoist (task management, external)
- WhatsApp (communication, external)

### What it looks like
The website provides dashboards, browse pages, and inline data entry forms. Partners create entities, projects, bank accounts, loans, and register payments directly through the website.

### Why Vercel instead of Power BI
Power BI requires paid licensing and a Microsoft ecosystem dependency. Vercel hosting is free. Next.js is already known from the personal finance tracker project. A custom website gives full control over display and behavior with no vendor lock-in. The Supabase JavaScript client makes read queries simple and direct.

### Website — 7 pages
- Projects — project detail with budget, invoices, and partner settlement
- Entities & contacts — supplier/client directory with transaction history
- Prices — historical unit price reference
- Invoices — unified AP/AR invoices with aging buckets
- Payments — payment history with period summaries
- Calendar — upcoming payment obligations (invoices + loan schedule)
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
- Bulk imports still require CLI + Excel

### When to move to V1
Move when any of the following is true:
- Native mobile access needed on construction sites
- Push notifications needed for payment reminders
- Automation needs exceed what the web app provides

---

## V1 — Mobile + Automation

**Status:** Future
**Goal:** Native mobile experience and automated workflows.

### Stack
- PostgreSQL on Supabase (same database)
- Next.js on Vercel (same web app from V0)
- React Native or native iOS app (mobile client)
- Supabase Edge Functions (serverless automation)

### New capabilities vs V0
- Native iOS/Android app optimized for on-site use
- Push notifications — payment due, invoice overdue, partner balance alerts
- Camera integration — photograph a receipt on site, attach directly to a cost record
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
