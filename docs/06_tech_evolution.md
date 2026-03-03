# Technology Evolution Strategy

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Active

---

## Philosophy

The system is built in versions. Each version uses the same database — only the interface and tooling evolve. No data migration, no rebuilding from scratch, no throwaway work. Every hour invested in V0 carries forward permanently.

```
V0 ──────────────── V1 ──────────────── V2
CLI + read-only     Full web app        Mobile + automation
website             with data entry
     |                    |                    |
     └────────────────────┴────────────────────┘
              PostgreSQL on Supabase
              (same database throughout)
```

---

## V0 — Foundation (Current)

**Status:** In development
**Goal:** Get clean, structured data flowing from day one. Prove the data model works in practice. Build the visualization foundation.

### Stack
- PostgreSQL on Supabase (database)
- Python CLI scripts (data entry only)
- Next.js on Vercel (read-only visualization website)
- SharePoint (file storage, external)
- Todoist (task management, external)
- WhatsApp (communication, external)

### What it looks like
Data entry happens by running Python terminal commands. The Vercel website is read-only — it displays dashboards and views but has no forms or data entry. The website is the beginning of what will become the full application in V1.

### Why Vercel instead of Power BI
Power BI requires paid licensing and a Microsoft ecosystem dependency. Vercel hosting is free. Next.js is already known from the personal finance tracker project. A custom website gives full control over display and behavior with no vendor lock-in. The Supabase JavaScript client makes read queries simple and direct.

### Visualization website — V0 scope (read-only)
- AP payment calendar — day-by-day upcoming payment obligations
- Project cost summary — total spend by category per project
- AR outstanding — invoices sent and collection status
- Partner contribution view — who has paid what per project
- Contact transaction history — all transactions per entity per project
- Company P&L — income vs expenses vs SG&A

### Strengths
- Extremely fast to build
- Zero data entry UI complexity
- Forces clean data discipline from day one
- Free hosting and no licensing costs
- Visualization website is the foundation of the future full app

### Limitations
- Terminal only for data entry — not friendly for non-technical users
- No mobile access for data entry
- No file upload integration
- Read-only website cannot enter or modify data

### When to move to V1
Move when any of the following is true:
- A non-technical team member needs to enter data
- Data entry volume makes CLI scripts feel slow or painful
- You need to enter data away from a computer
- Business revenue justifies development investment

---

## V1 — Full Web Application

**Status:** Future
**Goal:** Add data entry to the existing website. The read-only V0 website becomes a full application.

### Stack
- PostgreSQL on Supabase (same database, no migration)
- Next.js on Vercel (same website, adds forms and data entry)
- Supabase JavaScript client (native integration)
- Supabase Auth (authentication per partner company)
- SharePoint (retained for file storage)

### Why this transition is smooth
The V0 website is already built in Next.js on Vercel connected to Supabase. Adding data entry means adding form pages to the existing application — not rebuilding anything. The database schema does not change. All historical data is retained. The CLI scripts can remain available as a fallback.

### New capabilities vs V0
- Web-based data entry — forms for costs, invoices, quotes, entities, projects
- Proper authentication per partner company via Supabase Auth
- Mobile browser access — usable on site from a phone
- Real-time data — multiple partners entering data simultaneously
- Inline validation and error handling
- Optional: file upload to SharePoint via Microsoft Graph API

### What stays the same
- Entire database schema
- All historical data
- All visualization dashboards from V0
- SharePoint file storage and naming convention
- CLI scripts (retained as fallback)

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
