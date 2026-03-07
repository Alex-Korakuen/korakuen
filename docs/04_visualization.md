# Visualization Website Specifications

**Document version:** 5.0
**Date:** March 2, 2026
**Status:** Active — V0 scope (read-only)

---

## Overview

The visualization layer is a **read-only Next.js website hosted on Vercel**, connected directly to the Supabase PostgreSQL database. It displays browse pages for core data and dashboard views derived from data entered via CLI scripts.

**V0 scope: read-only with basic authentication.** No forms, no data entry. Supabase Auth with email/password — one login per partner company (3 accounts). All pages require authentication since the site is on the public internet and exposes real financial data. In V1 the same website gains data entry forms and per-user role-based access.

**Why not Power BI:** Power BI requires paid licensing and Microsoft ecosystem dependency. Vercel is free. Next.js is already known from the personal finance tracker project. A custom website gives full control with no vendor lock-in.

**Dual-view architecture:** Alex's login sees company-level data (cross-project aggregation, private loan obligations) on applicable pages. Partner logins see project-scoped views only — no cross-project data, no private information. Same pages, not separate routes. The UX mechanism (toggle, selector, role-based rendering) will be designed during Phase 4 implementation. SQL views already support both modes via filter parameters.

**Reporting currency:** All consolidated views (P&L, Financial Position, Cash Flow) include a reporting currency selector (PEN default, USD option). Transactions in the other currency are converted at display time using the stored `exchange_rate` field on each transaction. Converted amounts are visually marked (lighter text or asterisk) to indicate conversion. Transactions missing an exchange rate are flagged for the user to correct via CLI. Storage rule unchanged — amounts always stored in natural currency, never converted at storage time.

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

Dashboards
  AP Calendar
  AR Outstanding
  Cash Flow
  Partner Balances
  P&L
  Financial Position
```

**9 pages total.** Each answers one distinct business question. No redundancy.

---

## Browse Pages

### Projects

**Business question:** How is this project going?

**Layout:** Split-panel. Left panel: project list. Right panel: selected project detail.

**Left panel — list:** Table of all projects. Columns: project_code, name, status, contract_value. Filterable by status. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Right panel — detail** (loads on row click):
- Project header info (code, name, type, status, client, contract value, dates, location)
- Assigned entities section: table of entities and their roles on this project. Each entity row links to that entity's detail in the Entities page
- Spending by entity section: table of all entities with costs on this project, showing total spent per entity and invoice count. Answers "who did we spend money with and how much?" Data from costs grouped by entity_id where project_id matches
- Cost summary & budget section (merged): single table showing category, budgeted amount (if budget exists), actual amount, % used (if budget exists), % of contract (if contract_value exists). When no budget data exists, shows only actual amounts and % of contract. Color coded when budget exists: red >100%, yellow >90%, green ≤90%
- AR invoices issued for this project
- Project notes at the bottom (from projects.notes field) — displayed when not null

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

**Data source:** Projects table, project_entities, costs + cost_items, ar_invoices, project_budgets

---

### Entities & Contacts

**Business question:** Who is this entity? How do I contact them? How much business have we done?

**Layout:** Split-panel. Left panel: entity list. Right panel: selected entity detail.

**Left panel — list:** Table of all entities. Search by legal_name, common_name, or document_number. Columns: legal_name, common_name, document_number, tags. Filterable by tag, entity_type, city, region. Clicking a row loads its detail in the right panel. Selected row highlighted.

**Location filters:** City and region dropdowns enable filtering suppliers by geography. Practical when starting projects in new regions — quickly find entities near the project location. Projects already have a `location` field; entities now have `city` and `region` for consistent geographic filtering.

**Right panel — detail** (loads on row click):
- Entity header (legal_name, common_name, document_type, document_number, tags)
- Contacts list (name, role, phone, email, primary flag)
- Transaction history per project: table showing each project this entity is linked to, with total AP, total AR, net amount, transaction count, and "last transaction" date. Each project row links to that project's detail in the Projects page. Click a project row to expand and see individual cost/AR records for that entity on that project

**Responsive:** On mobile, list and detail stack vertically. Selecting a row scrolls to detail. Back button returns to list.

**Data source:** Entities, entity_contacts, entity_tags, tags, costs, ar_invoices (via v_entity_transactions view)

---

### Prices

**Business question:** What did I pay for this item last time?

**Layout:** Single page. Search-driven reference view.

Browse/search historical pricing from both cost_items and quotes. Search by item title. Results table columns: date, source (cost/quote), supplier, project, item title, quantity, unit_of_measure, unit_price, currency. Filterable by category, entity, project, date range, tag (entity's tags). Searchable by title.

This is the reference view for looking up historical pricing when estimating new work or negotiating with suppliers. No automatic aggregation or comparison — the user scans results and makes their own judgment.

**Data source:** cost_items table (quantity and unit_price fields), quotes table, joined to entities and entity_tags for tag filtering

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

**Row click:** Opens modal showing full cost details — cost items, payment history, document_ref, bank account, comprobante info.

**Loan obligations (Alex-only):** `v_ap_calendar` includes loan_schedule entries as a second UNION source with type = 'loan_payment'. Alex sees both supplier invoices and loan payment obligations. Partners see supplier invoices only. Same color coding for urgency. Click loan row to open modal with loan details, schedule, and repayment history.

**Taxes tab:**

Detraccion deposits pending — outbound detracciones that need to be deposited to suppliers' Banco de la Nacion accounts. Table columns: supplier, invoice title, project, detraccion amount, deposit status (paid/pending). Answers: "which detraccion deposits am I behind on?"

**Data source:** Costs table filtered to unpaid/partial status, sorted by due date (via v_ap_calendar, v_cost_balances views). Loan obligations from loan_schedule (Alex-only). Detracciones from payments where direction = outbound, payment_type = detraccion.

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

**Data source:** AR Invoices and Payments tables (via v_ar_balances, v_retencion_dashboard views). Detracciones from payments where direction = inbound, payment_type = detraccion.

---

### Cash Flow

**Business question:** How much cash actually moved, and what's expected in coming months?

**Priority:** High

**Scope selector:** All Projects (default) or single project. Company view (Alex-only) includes loan outflows in forecast.

**Period selector:** Year picker. Default: current year. Shows all 12 months.

**Reporting currency selector:** PEN (default) or USD. Transactions in the other currency converted at stored exchange rate.

**Main table:** Monthly time series. Columns: Month, Cash In, Cash Out (broken down by cost category — materials, labor, subcontractor, equipment, other), Net, Cumulative. Past months show actual cash movements (from payments table). Future months show forecast based on due_date fields on unpaid costs, AR invoices, and loan_schedule (Alex-only).

**Visual separator** between actual (past) and forecast (future) months — lighter styling or dashed divider for forecast rows.

**Cash shortfall warning:** When cumulative goes negative in a future month, highlight with warning indicator. This is the primary planning value — seeing cash crunches before they happen.

**Color coding:** Red for negative net months, yellow for months below a threshold, green for positive.

**Data source:** Payments (actual), costs + ar_invoices + loan_schedule due dates (forecast) — computed in `queries.ts` (no SQL view)

---

### Partner Contribution & Balances

**Business question:** Who has contributed what to this project, and who owes whom?

**Priority:** High

**Always requires a project selection — no "all projects" aggregate view.** Project selector at top.

**Contributions section:** Table showing each partner's contributed amount and share percentage, with visual proportion bars. Total costs at bottom. Clicking a partner's contribution amount expands to show the list of costs that make up that number.

**Income section:** Total invoiced, total collected, outstanding for the selected project.

**Settlement section:** Calculates what each partner should receive (contribution % x total collected income) vs what they actually received (inbound payments to their bank accounts). Shows who owes whom and how much.

**Data source:** Costs table grouped by bank_account -> partner_company per project, AR invoices + Payments (via v_partner_ledger view)

---

### Company P&L

**Business question:** Are we making money?

**Priority:** Medium

**Period selector:** Year, quarter, or single month. Default: current year.
- Year selected (e.g. 2026): columns are JAN, FEB, MAR, ..., DEC + TOTAL
- Quarter selected (e.g. Q1 2026): columns are JAN, FEB, MAR + TOTAL
- Single month selected: single column (current behavior)

**Reporting currency selector:** PEN (default) or USD. Transactions in the other currency converted at stored exchange rate. Converted amounts visually marked.

**Income:** Shows "AR Invoiced" as a row. Clickable to expand per-project breakdown showing each project's invoiced amount.

**Project Costs:** Total across all projects. Clickable to expand into category breakdown (materials, labor, subcontractor, equipment, permits, other). Uses parentheses for costs (standard financial presentation).

**Gross Profit:** Income minus project costs, with margin percentage.

**SG&A:** Flat list of SG&A categories (software_licenses, partner_compensation, business_development, professional_services, office_admin, other) with amounts.

**Net Profit:** Gross profit minus total SG&A, with net margin percentage.

**Personal position section (Alex-only):** Below Net Profit, separated by a visual divider. Shows Alex's profit share (based on contribution proportion from `v_partner_ledger`), then lists loan obligations from `v_loan_balances`, ending with net-after-obligations. This section is never visible to partners — it combines business profit share with personal debt obligations.

**Data source:** AR invoices, Costs (project), Costs (SG&A — null project) — computed in `queries.ts` with period filtering and currency conversion. Personal position from v_partner_ledger + v_loan_balances (Alex-only).

---

### Financial Position

**Business question:** What do we own vs what do we owe? What's our financial health?

**Priority:** Medium

**Point-in-time snapshot** — shows current balances, not a period range.

**Reporting currency selector:** PEN (default) or USD. All amounts converted at stored exchange rates. Converted amounts visually marked.

**Assets section:**

- Cash in Bank: card per account showing bank_name, last4, account_type, currency, calculated balance. Banco de la Nacion detraccion account flagged with note that balance is for tax payments only. Click any account card to expand recent transactions below (date, direction, entity, amount). Partner accounts shown as net contribution position only.
- Accounts Receivable: total outstanding AR invoices.
- Tax Credits: IGV Paid (credito fiscal from costs with igv_rate > 0), Retenciones Unverified (withheld by clients, pending SUNAT verification).
- Total Assets.

**Liabilities section:**

- Accounts Payable: total outstanding costs.
- Tax Liabilities: IGV Collected (debito fiscal from AR invoices with igv_rate > 0).
- Loans (Alex-only): each loan with outstanding balance from `v_loan_balances`.
- Total Liabilities.

**Net Position:** Total Assets minus Total Liabilities.

**Disclaimer:** System-calculated balances, not bank-reconciled.

**Data source:** v_bank_balances (cash), v_ar_balances (AR outstanding), v_cost_balances (AP outstanding), v_igv_position (IGV split), v_retencion_dashboard (retenciones unverified), v_loan_balances (loans, Alex-only)

---

## Dropped Views

### ~~Settlement Dashboard~~ (Dropped)

Dropped — partner settlements are handled via the Settlement section within Partner Contribution & Balances page. No separate dashboard.

### ~~Bank Account Balances~~ (Merged)

Merged into Financial Position page. Bank account cards and transaction detail now live there.

### ~~Retencion Dashboard~~ (Merged)

Merged into AR Outstanding > Taxes tab. Retencion tracking now lives where you'd naturally look — inside the AR module.

### ~~IGV Net Position~~ (Merged)

IGV data split across Financial Position page (IGV Paid as asset / IGV Collected as liability) and available as a drillable detail within that page.

### ~~Unit Price History~~ (Renamed)

Renamed to "Prices." Simplified to search-only reference table. Supplier comparison and price trend chart dropped.

### ~~Quote vs Actual Comparison~~ (Dropped)

Dropped — for this business, quotes equal actuals. The comparison view added no value.

---

## Technical Notes

- Next.js app hosted on Vercel free tier
- Reads from Supabase PostgreSQL via Supabase JavaScript client
- Basic authentication in V0 — Supabase Auth with email/password, one login per partner company (3 accounts)
- Per-user role-based access added in V1 when data entry forms are introduced
- Reporting currency: consolidated views include a currency selector (PEN default). Transactions in the other currency converted at display time using stored exchange_rate. Converted amounts visually marked. Missing exchange rates flagged as warnings
- All views are filterable and sortable
- Consistent interaction patterns: split-panel for browse pages, summary cards + table for dashboards, tabs for sub-sections, modals for row detail
- Design principles: minimalist, clean, functional — inspired by Todoist and Notion

---

*Views are defined in `supabase/views/`. Add new view ideas here as operational needs emerge.*
