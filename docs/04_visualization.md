# Visualization Website Specifications

**Document version:** 5.1
**Date:** March 13, 2026
**Status:** Active

---

## Overview

The visualization and data entry layer is a **Next.js website hosted on Vercel**, connected directly to the Supabase PostgreSQL database. It displays browse pages and dashboard views, and provides data entry forms for creating and managing records.

Supabase Auth with email/password — one login per partner company (3 accounts). All pages require authentication since the site is on the public internet and exposes real financial data. RLS policies enforce read and write access for authenticated users.

**Why not Power BI:** Power BI requires paid licensing and Microsoft ecosystem dependency. Vercel is free. Next.js is already known from the personal finance tracker project. A custom website gives full control with no vendor lock-in.

**Universal partner filter:** A global partner filter in the sidebar lets users toggle which partner companies' data to display across all 7 pages. The filter persists via a cookie (`partner_filter`). All data is visible to everyone — no role-based visibility restrictions. The filter is for focus, not access control.

**Reporting currency:** Consolidated views (Financial Position) include a reporting currency selector (PEN default, USD option). Transactions in the other currency are converted at display time using the stored `exchange_rate` field on each transaction. Converted amounts are visually marked (lighter text or asterisk) to indicate conversion. Storage rule unchanged — amounts always stored in natural currency, never converted at storage time.

---

## Layout & Navigation

Collapsible sidebar navigation, header with partner name, responsive shell.

- Sidebar collapses to icons on small screens, becomes hamburger menu on mobile
- Minimalist design — clean, calm, functional
- Muted color palette with colored indicators only where they convey meaning (payment status, aging)
- Default landing page after login: AP Payment Calendar

**Sidebar structure:**
```
Browse
  Projects
  Entities & Contacts
  Prices
  Invoices
  Payments

Dashboards
  Calendar
  Financial Position
```

**7 pages total.** Each answers one distinct business question. No redundancy. Settings (password change) is accessed via the header, not the sidebar.

---

## Browse Pages

### Projects

**Business question:** How is this project going?

**Layout:** Split-panel. Left panel: project list. Right panel: selected project detail.

**Left panel — list:** Table of all projects. Columns: project_code, name, status, contract_value. Filterable by status. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Right panel — detail** (loads on row click):
- Project header info (code, name, type, status, client, contract value, dates, location)
- Assigned entities section: table of entities and their roles on this project. Each entity row links to that entity's detail in the Entities page
- Spending by entity section: table of all entities with payable invoices on this project, showing total spent per entity and invoice count. Answers "who did we spend money with and how much?" Data from invoices (direction = 'payable') grouped by entity_id where project_id matches
- Cost summary & budget section (merged): single table showing category, budgeted amount (if budget exists), actual amount, % used (if budget exists), % of contract (if contract_value exists). When no budget data exists, shows only actual amounts and % of contract. Color coded when budget exists: red >100%, yellow >90%, green ≤90%
- Receivable invoices issued for this project
- Project notes at the bottom (from projects.notes field) — displayed when not null

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

**Data source:** Projects table, invoices + invoice_items, project_budgets

---

### Entities & Contacts

**Business question:** Who is this entity? How do I contact them? How much business have we done?

**Layout:** Split-panel. Left panel: entity list. Right panel: selected entity detail.

**Left panel — list:** Table of all entities. Search by legal_name or document_number. Columns: legal_name, document_number, tags. Filterable by tag, entity_type, city, region. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Location filters:** City and region dropdowns enable filtering suppliers by geography. Practical when starting projects in new regions — quickly find entities near the project location. Projects already have a `location` field; entities now have `city` and `region` for consistent geographic filtering.

**Right panel — detail** (loads on row click):
- Entity header (legal_name, document_type, document_number, tags)
- Contacts list (name, role, phone, email)
- Transaction history per project: table showing each project this entity is linked to, with total AP, total AR, net amount, transaction count, and "last transaction" date. Each project row links to that project's detail in the Projects page. Click a project row to expand and see individual invoice records for that entity on that project

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

**Data source:** Entities, entity_contacts, entity_tags, tags, invoices (via v_invoice_balances view)

---

### Prices

**Business question:** What did I pay for this item last time?

**Layout:** Single page. Search-driven reference view.

Browse/search historical pricing from both invoice_items and quotes. Search by item title. Results table columns: date, source (invoice/quote), supplier, project, item title, quantity, unit_of_measure, unit_price, currency. Filterable by category, entity, project, date range, tag (entity's tags). Searchable by title.

This is the reference view for looking up historical pricing when estimating new work or negotiating with suppliers. No automatic aggregation or comparison — the user scans results and makes their own judgment.

**Data source:** invoice_items table (quantity and unit_price fields), quotes table, joined to entities and entity_tags for tag filtering

---

## Dashboard Views

### AP Payment Calendar

**Business question:** What do I need to pay, and when?

**Priority:** Highest — most critical daily operational view. Default landing page after login.

**Tabs:** Main | Taxes

**Main tab:**

**Top:** Summary cards (Overdue, Due Today, This Week, Next 30 Days) showing count and dual-currency totals per bucket — PEN amount (primary) and USD amount (secondary, shown only when > 0). Cards are clickable — clicking a card filters the table below to that bucket. Buckets are non-overlapping: Overdue (past due), Today (due today only), This Week (tomorrow through end of week), Next 30 Days (after this week through 30 days out).

**Bottom:** Sortable table. Columns: due_date, days until due, type, supplier, project, title, outstanding amount, currency, payment status. Default sort: due date ascending (most urgent first). Row urgency indicated by colored left border (red=overdue, orange=today, yellow=this week, neutral=future).

**Filters:** project, supplier, currency, title search.

**Row click:** Opens modal showing full invoice details — invoice items, payment history, document_ref, bank account, comprobante info.

**Loan obligations:** `v_obligation_calendar` includes loan_schedule entries as a second UNION source with type = 'loan_payment'. All users see both supplier invoices and loan payment obligations. Same color coding for urgency. Click loan row to open modal with loan details, schedule, and repayment history. Filterable by partner via the global partner filter.

**Taxes tab:**

Detraccion deposits pending — outbound detracciones that need to be deposited to suppliers' Banco de la Nacion accounts. Table columns: supplier, invoice title, project, detraccion amount, deposit status (paid/pending). Answers: "which detraccion deposits am I behind on?"

**Data source:** Invoices table filtered to unpaid/partial status, sorted by due date (via v_obligation_calendar, v_invoice_balances views). Loan obligations from loan_schedule. Detracciones from payments where direction = outbound, payment_type = detraccion.

---

### AR Outstanding & Collections

**Business question:** What do I have pending to collect, and how overdue is it?

**Priority:** High

**Tabs:** Main | Taxes

**Main tab:**

**Top:** Aging bucket cards (Current 0-30, 31-60, 61-90, 90+ days overdue) with dual-currency totals — PEN amount (primary) and USD amount (secondary, shown only when > 0). Clickable to filter table. Aging is days past due_date.

**Bottom:** Invoice detail table. Columns: invoice_number, project, client, invoice_date, due_date, gross, detraccion, retencion, net_receivable, paid, outstanding, days_overdue. Color-coded age column. Total row at bottom.

Net receivable shown prominently — in Peru with detraccion and retencion, the actual cash expected is significantly less than invoice face value.

**Filters:** project, client entity, partner company, currency, aging bucket.

**Row click:** Opens modal showing invoice details + payment history (dates, amounts, payment types — regular/detraccion/retencion) + retencion verification status.

**Taxes tab:**

Two sections:

1. **Retenciones:** Has the client paid the 3% retencion to SUNAT? Table of AR invoices where retencion_applicable = true. Columns: project, client, invoice_number, invoice_date, days_since_invoice, retencion_amount, verification_status (verified/unverified). Sorted: unverified first, then by oldest. Color-coded by age for unverified items. Filterable by project, client, status.

2. **Detracciones:** Has the client deposited to our Banco de la Nacion? Table showing inbound detraccion payments — received vs expected. Columns: project, client, invoice_number, detraccion_amount, received/pending. Data from payments where direction = inbound, payment_type = detraccion.

**Data source:** Invoices (direction = 'receivable') and Payments tables (via v_invoice_balances, v_retencion_dashboard views). Detracciones from payments where direction = inbound, payment_type = detraccion.

---

### Financial Position

**Business question:** What do we own vs what do we owe? What's our financial health?

**Priority:** Medium

**Point-in-time snapshot** — shows current balances, not a period range.

**Reporting currency selector:** PEN (default) or USD. All amounts converted at stored exchange rates. Converted amounts visually marked.

**Assets section:**

- Cash in Bank: card per account showing bank_name, last4, account_type, currency, calculated balance. Banco de la Nacion detraccion account flagged with note that balance is for tax payments only. Click any account card to expand recent transactions below (date, direction, entity, amount). Partner accounts shown as net contribution position only.
- Accounts Receivable: total outstanding AR invoices.
- Tax Credits: IGV Paid (credito fiscal from invoices with igv_rate > 0), Retenciones Unverified (withheld by clients, pending SUNAT verification).
- Total Assets.

**Liabilities section:**

- Accounts Payable: total outstanding payable invoices.
- Tax Liabilities: IGV Collected (debito fiscal from receivable invoices with igv_rate > 0).
- Loans: each loan with outstanding balance from `v_loan_balances`.
- Total Liabilities.

**Net Position:** Total Assets minus Total Liabilities.

**Disclaimer:** System-calculated balances, not bank-reconciled.

**Data source:** v_bank_balances (cash), v_invoice_balances (AR + AP outstanding), v_igv_position (IGV split), v_retencion_dashboard (retenciones unverified), v_loan_balances (loans). Filterable by partner via global partner filter.

---

## Technical Notes

- Next.js app hosted on Vercel free tier
- Reads from Supabase PostgreSQL via Supabase JavaScript client
- Authentication — Supabase Auth with email/password, invite-only (3 accounts)
- Universal partner filter (cookie-based) controls data scope across all pages — no role-based visibility
- Reporting currency: consolidated views include a currency selector (PEN default). Transactions in the other currency converted at display time using stored exchange_rate. Converted amounts visually marked
- All views are filterable and sortable
- Consistent interaction patterns: split-panel for browse pages, summary cards + table for dashboards, tabs for sub-sections, modals for row detail
- Design principles: minimalist, clean, functional — inspired by Todoist and Notion

---

*Views are defined in `supabase/views/`. Add new view ideas here as operational needs emerge.*
