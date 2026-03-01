# Visualization Website Specifications

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Active — V0 scope (read-only)

---

## Overview

The visualization layer is a **read-only Next.js website hosted on Vercel**, connected directly to the Supabase PostgreSQL database. It displays dashboards and views derived from the data entered via CLI scripts.

**V0 scope: read-only only.** No forms, no data entry, no authentication required in V0 since all three partners have full access. In V1 the same website gains data entry forms and authentication.

**Why not Power BI:** Power BI requires paid licensing and Microsoft ecosystem dependency. Vercel is free. Next.js is already known from the personal finance tracker project. A custom website gives full control with no vendor lock-in.

---

## View 1: AP Payment Calendar

**Business question:** What do I need to pay, and when?

**Priority:** Highest — most critical daily operational view

**Description:** Day-by-day view of upcoming payment obligations across all active projects. Every cost with an outstanding payment (registered but not yet paid) organized by due date.

**What it shows:**
- Calendar or list view sorted by due date
- Each entry: supplier entity, project, amount, currency, days until due
- Color coding: overdue (red), due today (orange), due this week (yellow), future (green)
- Daily totals in PEN and USD separately
- Filters: by project, by partner company, by currency

**Data source:** Costs table filtered to unpaid status, sorted by due date

---

## View 2: Project Cost Summary

**Business question:** How much has each project cost, and what did I spend it on?

**Priority:** High

**Description:** Per-project breakdown of all registered costs by category, over time, against contract value.

**What it shows:**
- Total cost by category (materials, labor, subcontractor, equipment, overhead)
- Cumulative cost over time
- Contract value vs total costs to date — remaining margin
- Cost by valuation period
- Filters: by project, by category, by partner company, by date range

**Data source:** Costs table joined to Projects

---

## View 3: AR Outstanding & Collections

**Business question:** What do I have pending to collect, and how overdue is it?

**Priority:** High

**Description:** All outstanding AR invoices with aging analysis. Shows the gap between invoice date and current date, and tracks collection history.

**What it shows:**
- Aging buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days
- Total outstanding by client entity
- Net receivable after detracciones and retenciones
- Collection history per invoice
- Filters: by project, by client, by partner company, by currency

**Data source:** AR Invoices and Payments tables (via v_ar_balances view)

---

## View 4: Partner Contribution & Balances

**Business question:** Who has contributed what, what is each partner's current stake, and who owes what to whom?

**Priority:** High

**Description:** Real-time view of each partner's financial position across all active projects. Derived entirely from the Costs table — no separate ledger table.

**What it shows per project:**
```
PROJECT PRY001 — Punta Hermosa
Partner 1    S/ 100,000   18.87%
Partner 2    S/ 200,000   37.74%
Partner 3    S/ 230,000   43.40%
─────────────────────────────────
Total costs  S/ 530,000

Total income collected  S/ 600,000
Net profit              S/  70,000

Income distribution:
Partner 1    S/  13,208
Partner 2    S/  26,415
Partner 3    S/  30,377
```

**Data source:** Costs table grouped by bank_account → partner_company per project, Payments table (via v_partner_ledger view)

---

## View 5: Entity Transaction History

**Business question:** How much have I paid to or received from a specific entity, and on which projects?

**Priority:** High

**Description:** Per-entity financial history across all projects. Shows both expense (costs) and income (AR collections) linked to that entity. Clickable — drill into individual transactions.

**What it shows:**
```
Pepe's Iron Company (RUC: 20512345678)
─────────────────────────────────────
PRY001 - Punta Hermosa     S/ -15,000  (3 transactions)
PRY002 - Arequipa          S/  -8,000  (2 transactions)
─────────────────────────────────────
Total                      S/ -23,000
```

Click on any project row → see individual cost records for that entity on that project.

**Data source:** Costs and AR tables filtered by entity_id

---

## View 6: Company P&L

**Business question:** What is the overall financial picture of Korakuen?

**Priority:** Medium

**Description:** Consolidated profit and loss across all projects plus company-level SG&A.

**What it shows:**
```
INCOME
Total AR invoiced                S/ 1,200,000
Total AR collected               S/ 1,050,000
Outstanding collections          S/   150,000

PROJECT COSTS
Total across all projects        S/   900,000

GROSS PROFIT                     S/   300,000  (25%)

SG&A
Software & Licenses              S/     3,600
Partner Compensation             S/    24,000
Business Development             S/     8,400
Professional Services            S/     6,000
Other                            S/     3,000
Total SG&A                       S/    45,000

NET PROFIT                       S/   255,000  (21.25%)
```

**Data source:** AR, Costs (project), Costs (SG&A null project)

---

## View 7: Bank Account Balances

**Business question:** What is the current balance of each bank account?

**Priority:** Medium

**Description:** Running balance per bank account calculated from all inflows (AR collections) and outflows (costs). Alex's accounts only — partner accounts shown as net project contribution position.

**What it shows:**
- Current balance per account
- Recent transactions in/out
- Detraccion account balance (Banco de la Nación) shown separately
- Filters: by date range

**Data source:** Payments table grouped by bank_account_id (via v_bank_balances view)

---

## View 8: Unit Price History

**Business question:** What have I historically paid for specific materials or services?

**Priority:** Low — grows in value as data accumulates

**Description:** Historical unit price analysis by item, unit of measure, and supplier. Foundation for accurate future project estimation.

**What it shows:**
- Average unit price by description and unit
- Price trend over time for a specific item
- Supplier price comparison for the same item
- Filters: by category, by entity, by project, by date range

**Data source:** Costs table (quantity and unit_price fields), Quotes table

---

## View 9: Quote vs Actual Comparison

**Business question:** Did the final cost match the quote I accepted?

**Priority:** Low

**Description:** For costs that originated from a quote, compares the quoted price to the actual registered cost.

**What it shows:**
- Quoted quantity, unit price, total
- Actual cost quantity, unit price, total
- Variance in absolute and percentage terms
- Filters: by project, by entity, by category

**Data source:** Quotes joined to Costs via quote_reference field

---

## Technical Notes

- Next.js app hosted on Vercel free tier
- Reads from Supabase PostgreSQL via Supabase JavaScript client
- No authentication in V0 — all three partners access the same read-only URL
- Authentication added in V1 when data entry forms are introduced
- Currency display: amounts shown in natural currency; exchange rate reference displayed alongside
- All views are filterable and sortable
- Design principles: minimalist, clean, functional — inspired by Todoist and Notion

---

*Views will be refined once the database schema is finalized and first real data is available. Add new view ideas here as operational needs emerge.*
