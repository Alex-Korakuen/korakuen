# V1 Restructure — Unified Invoice Model & Interactive Navigation

**Document version:** 2.0
**Date:** March 12, 2026
**Status:** Proposal (not yet implemented)

---

## Motivation

V0 was built organically — costs and AR invoices as separate tables, dashboard pages that double as detail views, no click-through navigation between summary and backing data. It works, but the structure doesn't scale cleanly. This document defines the V1 restructure: a unified data model, cleaner page responsibilities, and an interactive drill-down navigation pattern.

---

## Core Tables

Five core tables drive the entire system:

| Table | Purpose |
|---|---|
| **projects** | Civil works contracts — the organizing unit for all financial activity |
| **entities** | Companies, people, government bodies — anyone Korakuen transacts with |
| **invoices** | All commercial documents — both payable (AP) and receivable (AR), unified |
| **payments** | All cash movements — linked to invoices and loans |
| **quotes** | Pre-transaction pricing documents — historical price analytics source |

Support tables remain: `partner_companies`, `bank_accounts`, `tags`, `entity_tags`, `entity_contacts`, `project_entities`, `project_partners`, `categories`, `exchange_rates`, `loans`, `loan_schedule`, `project_budgets`.

---

## The Unified Invoice

V0 has two separate tables (`costs` + `ar_invoices`) with different structures. V1 merges them into a single `invoices` table with a `direction` column.

### Why unify

- An invoice is an invoice — both directions have the same financial anatomy: entity, amount, currency, exchange_rate, IGV, detraccion, date, comprobante
- One table, one set of views, one CLI module
- Payments already link generically — this simplifies the relationship
- Queries become symmetric: same joins for AP and AR

### Key fields

```
invoices
  id                  UUID PK
  direction           'payable' | 'receivable'
  partner_company_id  FK → partner_companies
  project_id          FK → projects
  entity_id           FK → entities (nullable — informal purchases)
  quote_id            FK → quotes (nullable — only relevant for payables)
  purchase_order_id   FK (nullable — future PO module, always null in V1)

  invoice_number      text (nullable)
  document_ref        text (nullable — SharePoint naming convention)
  comprobante_type    enum (factura, boleta, recibo_honorarios, none)

  invoice_date        date
  due_date            date (nullable)

  currency            'PEN' | 'USD'
  exchange_rate       numeric NOT NULL

  igv_rate            numeric
  detraccion_rate     numeric (nullable)
  retencion_rate      numeric (nullable — only on receivables, Korakuen is not a retention agent)

  notes               text (nullable)
  is_active           boolean DEFAULT true (soft delete)
  created_at          timestamptz
  updated_at          timestamptz
```

### Line items — both directions

```
invoice_items
  id                  UUID PK
  invoice_id          FK → invoices
  category_id         FK → categories (nullable)
  title               text
  description         text (nullable)
  quantity            numeric
  unit_of_measure     text (nullable)
  unit_price          numeric
  is_active           boolean DEFAULT true
  created_at          timestamptz
  updated_at          timestamptz
```

Totals (subtotal, igv_amount, detraccion_amount, retencion_amount, total) are always derived via views — never stored. Same principle as V0.

### What changes from V0

| V0 | V1 |
|---|---|
| `costs` table | `invoices` where `direction = 'payable'` |
| `ar_invoices` table | `invoices` where `direction = 'receivable'` |
| `cost_items` table | `invoice_items` (serves both directions) |
| AR had no line items | AR now has line items (same structure) |
| Two CLI modules (costs, ar_invoices) | One CLI module (invoices) |
| Two sets of views | One set of views with direction filter |

---

## Loans — UI Merge, Not Database Merge

Loans remain separate tables (`loans`, `loan_schedule`) but appear alongside invoices in the UI. This gives users a unified view of all obligations without polluting the invoice schema.

### Why NOT merge at the database level

- **Different data models.** Invoices have line items, IGV, detracción, comprobante. Loan schedule entries have principal/interest breakdown. Forcing both into one table means 8+ columns always null for loans and 2 columns always null for invoices.
- **Loan entries are generated, not received.** Creating a loan auto-generates N schedule entries. If those were invoices, restructuring a loan means deleting/recreating invoice records. Invoices shouldn't be that volatile.
- **Payments already handle both.** The `related_to` field on payments ('invoice' or 'loan_schedule') already works cleanly.

### How the UI merge works

The Invoices page queries both `invoices` and `loan_schedule` via a UNION, presenting them in one table with a type badge (Commercial / Loan). Aging buckets include both sources. Loan rows expand differently — showing principal/interest breakdown and loan agreement details instead of line items and comprobante info.

### Loan facts (corrected from earlier discussion)

- **Loans are usually project-specific.** `loans.project_id` is a real, commonly-used FK.
- **Lenders are always 3rd parties** (banks, financial institutions), never partner companies. Lenders are entities in the `entities` table.
- This means loan schedule entries have the same navigation fields as invoices: entity (the lender) and project. Click-through to entity detail and project detail works identically.

---

## Website — Page Structure

### Sidebar navigation

```
Browse
  Projects
  Entities & Contacts
  Prices
  Invoices
  Payments

Dashboards
  AP Calendar
  AR Calendar
  Cash Flow
  Financial Position
```

**8 pages total.** Invoices and Payments under Browse — they are detail/ledger pages you browse and filter. Dashboards are summary and planning views.

---

## The Time Axis Distinction: Invoices vs Calendars

The Invoices page and Calendar pages both show obligations, but they answer fundamentally different questions along different time axes.

### Invoices — backward-looking (aging)

**Question:** "How much exposure do I have, and how old is it?"

Aging measures days **past due date** — how overdue unpaid invoices are:

| Bucket | Meaning |
|---|---|
| Current | Not yet due |
| 1-30 days | A little late |
| 31-60 days | Getting concerning |
| 61-90 days | Problem |
| 90+ days | Serious problem |

Shows **everything** — paid, partial, unpaid, overdue. This is the full document ledger. You come here to review status, investigate, audit, and drill into detail.

### Calendars — forward-looking (urgency)

**Question:** "What do I need to pay/collect this week?"

Urgency measures days **until due date** — how soon action is needed:

| Bucket | Meaning |
|---|---|
| Overdue | Should have been paid already — act now |
| Due Today | Act now |
| This Week | Plan for it |
| Next 30 Days | On the horizon |

Shows **only unpaid items with action needed**, sorted by urgency. This is the action view. You come here Monday morning to prioritize your week.

### Overlap is intentional

An overdue invoice appears in **both views** — on the Invoices page in the 61-90 day aging bucket (measuring risk), and on the Calendar in the Overdue section (demanding action). Same data, different lens.

| | Invoices Page | Calendar Pages |
|---|---|---|
| Time axis | Backward (how overdue) | Forward (how soon) |
| Shows | Everything (paid + unpaid) | Only unpaid / actionable |
| KPI cards | Aging buckets (exposure risk) | Urgency buckets (action needed) |
| Purpose | Review, investigate, audit | Plan, prioritize, act |
| Includes loans | Yes (UI merge) | Yes (loan schedule entries) |
| Row interaction | Expand inline for detail | Link → Invoices page |

---

### Invoices Page (NEW)

**Business question:** What invoices exist, what's their status, and how old is my exposure?

**Layout:** Dashboard-first with drill-down table.

#### Top: Summary cards with aging buckets

Two card groups side by side — Payable (left) and Receivable (right). Payable card shows a Commercial/Loan subtotal breakdown.

```
┌── Payable ─────────────────────┐ ┌── Receivable ────────────┐
│ Total         S/ 47,200        │ │ Total       $ 57,000     │
│   Commercial  S/ 42,300        │ │                           │
│   Loans       S/  4,900        │ │ Current     $ 45,000 79% │
│                                │ │ 1-30 past   $      0  0% │
│ Current       S/ 28,000   59%  │ │ 31-60 past  $      0  0% │
│ 1-30 past     S/  5,200   11%  │ │ 61-90 past  $      0  0% │
│ 31-60 past    S/  9,900   21%  │ │ 90+ past    $ 12,000 21% │
│ 61-90 past    S/     0    0%   │ │                           │
│ 90+ past      S/  4,100    9%  │ │                           │
└────────────────────────────────┘ └───────────────────────────┘
```

Each bucket is clickable — filters the table below to show only invoices in that aging range and direction.

Dual currency display: PEN primary, USD secondary (shown only when > 0), consistent with V0 pattern.

#### Middle: Filter bar

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌─────────────────┐
│ Dir: ▼ │ │ Type ▼ │ │ Status▼│ │Project▼│ │Per.▼ │ │ Search entity...│
└────────┘ └────────┘ └────────┘ └────────┘ └──────┘ └─────────────────┘
```

Direction filter: All / Payable / Receivable.
Type filter: All / Commercial / Loan.
Status filter: All / Pending / Partial / Paid / Overdue.

#### Bottom: Invoice table (unified with loan entries)

```
┌───────────────────────────────────────────────────────────────────┐
│ Dir│ Type │ Date   │ Entity/Lender  │ Project│ Total   │ Balance │
│────│──────│────────│────────────────│────────│─────────│─────────│
│ AP │  📄  │ Mar 10 │ Ferretería...  │ PRY001 │ S/5,200 │ S/2,080 │
│ AP │  🏦  │ Mar 15 │ BCP            │ PRY002 │ S/1,200 │ S/1,200 │
│ AR │  📄  │ Mar 08 │ Mun. Lima      │ PRY002 │ $12,000 │ $12,000 │
│ AP │  📄  │ Mar 05 │ Juan Pérez     │ PRY001 │ S/800   │ S/0     │
│ AP │  🏦  │ Mar 20 │ Scotiabank     │ PRY001 │ S/2,500 │ S/2,500 │
└───────────────────────────────────────────────────────────────────┘
```

#### Row click: Inline expand

Clicking a row expands it inline. **Commercial invoices** show line items + payment history:

```
┌─────────────────────────────────────────────────────────────┐
│  ▼ Ferretería Central — Factura F001-00234                  │
│                                                             │
│  Line Items                       Payment History           │
│  ┌──────────────┬────────┐       ┌──────────┬──────────┐   │
│  │ Cemento      │ S/3,000│       │ Mar 12   │ S/3,120  │   │
│  │ Fierro       │ S/1,200│       │          │          │   │
│  │ +IGV         │ S/756  │       │          │          │   │
│  │ -Detracción  │ S/-520 │       │ Pending  │ S/2,080  │   │
│  └──────────────┴────────┘       └──────────┴──────────┘   │
│                                                             │
│  Comprobante: Factura F001-00234                            │
│  Document ref: PRY001-AP-005                                │
│  Notes: Delivered to site March 8                           │
└─────────────────────────────────────────────────────────────┘
```

**Loan entries** show principal/interest breakdown + loan agreement details:

```
┌─────────────────────────────────────────────────────────────┐
│  ▼ BCP Term Loan — PRY002 (Entry 3 of 12)                  │
│                                                             │
│  Breakdown                        Payment History           │
│  ┌──────────────┬────────┐       ┌──────────┬──────────┐   │
│  │ Principal    │ S/1,000│       │          │          │   │
│  │ Interest     │ S/200  │       │ Pending  │ S/1,200  │   │
│  └──────────────┴────────┘       └──────────┴──────────┘   │
│                                                             │
│  Loan: S/ 12,000 @ 10% — 12 monthly installments           │
│  Lender: BCP  │  Total remaining: S/ 9,600                  │
│  Project: PRY002 — Av. Los Héroes                           │
└─────────────────────────────────────────────────────────────┘
```

---

### Payments Page (NEW)

**Business question:** What cash actually moved, when, and for what?

**Layout:** Filter bar + table. Simpler than invoices — payments are flat records, no line items.

#### Top: Summary cards

```
┌── This Month ───────────────────────────────────────────────┐
│  Inflows    S/ 35,200  │  Outflows   S/ 28,400  │  Net +6,800│
└─────────────────────────────────────────────────────────────┘
```

#### Filter bar

```
┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
│Direction▼│ │ Type ▼ │ │Project▼│ │ Period ▼ │ │Search...  │
└──────────┘ └────────┘ └────────┘ └──────────┘ └───────────┘
```

Direction: All / Inbound / Outbound.
Type: All / Regular / Detracción / Retención.

#### Table

```
┌────────────────────────────────────────────────────────────────┐
│ Date   │ Dir │ Entity        │ Project│ Invoice    │ Amount   │
│────────│─────│───────────────│────────│────────────│──────────│
│ Mar 12 │ Out │ Ferretería... │ PRY001 │ F001-00234 │ S/3,120  │
│ Mar 10 │ In  │ Mun. Lima     │ PRY002 │ E001-00012 │ $15,000  │
│ Mar 08 │ Out │ Banco Nación  │ PRY001 │ F001-00234 │ S/520    │
│ Mar 05 │ Out │ BCP (Loan)    │ PRY002 │ —          │ S/2,500  │
└────────────────────────────────────────────────────────────────┘
```

Row click expands to show: bank account used, payment method, linked invoice or loan detail, notes.

---

### AP Calendar (Simplified — Forward-Looking)

**Business question:** What do I need to pay, and when? (action view)

**Not a detail view.** Pure timing/urgency view of upcoming payment obligations.

#### Top: Urgency cards

```
┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐
│ OVERDUE  │ │  TODAY   │ │ THIS WEEK │ │ NEXT 30 DAYS │
│ S/6,700  │ │ S/3,120  │ │ S/8,500   │ │ S/26,480     │
│ 4 items  │ │ 1 item   │ │ 4 items   │ │ 8 items      │
└──────────┘ └──────────┘ └───────────┘ └──────────────┘
```

Buckets are non-overlapping: Overdue (past due), Today, This Week (tomorrow–end of week), Next 30 Days (after this week–30 days out).

#### Timeline grouped by urgency

```
── OVERDUE ──────────────────────────────────────────────
Mar 5  │ 📄 Cementos Lima      │ PRY003 │ S/16,420 │ 7d late
Mar 1  │ 📄 Transp. Huancayo   │ PRY001 │ S/2,300  │ 11d late
Feb 20 │ 🏦 Loan: BCP          │ PRY002 │ S/2,500  │ 20d late

── TODAY ────────────────────────────────────────────────
Mar 12 │ 📄 Ferretería Central │ PRY001 │ S/3,120  │ due today

── THIS WEEK ────────────────────────────────────────────
Mar 14 │ 📄 Aceros Arequipa    │ PRY002 │ S/4,800  │ in 2 days
Mar 15 │ 🏦 Loan: Scotiabank   │ PRY001 │ S/1,200  │ in 3 days
Mar 16 │ 📄 Grifo Central      │ PRY001 │ S/950    │ in 4 days
Mar 17 │ 📄 Juan Pérez         │ PRY001 │ S/1,550  │ in 5 days

── NEXT 30 DAYS ─────────────────────────────────────────
Mar 20 │ ...
```

**Row click:** Navigates to the Invoices page with filters pre-applied (direction=payable, that item highlighted). For loan entries, navigates to the loan's expand in the Invoices page.

Includes both commercial invoices and loan schedule entries — unified view of "all cash that needs to go out."

**No Taxes tab.** Tax-related payments (detracción deposits, retención payments) are entries in the Payments page, filterable by type. See "What Gets Removed" section.

---

### AR Calendar (Simplified — Forward-Looking)

**Business question:** What's expected to come in, and when? (action view)

Same structure as AP Calendar but for receivables. Urgency cards + timeline of expected collections. Each item links to the Invoices page with filters pre-applied (direction=receivable).

**No Taxes tab.** Retención verification and detracción receipt tracking are payment status questions — they belong on the Payments page filtered by type, not on a calendar tab.

---

### Cash Flow (Enhanced with drill-down)

Same structure as V0 — monthly time series with Cash In / Cash Out / Net sections. Year picker, project scope selector, reporting currency.

**New:** Every cell in the table is a clickable link. Clicking a cell navigates to the Payments page with filters pre-applied for that period, direction, and category.

Example: clicking the "Materials" row under "March" in Cash Out navigates to:
`/payments?period=2026-03&direction=outbound&category=materials`

---

### Financial Position (Enhanced with drill-down)

Same structure as V0 — point-in-time balance sheet.

**New:** Each line item links to its backing data:
- Accounts Receivable total → Invoices page filtered to `direction=receivable&status=pending`
- Accounts Payable total → Invoices page filtered to `direction=payable&status=pending`
- Bank account balance → Payments page filtered to that bank account
- Loan balance → Invoices page filtered to `type=loan`

Condensed aging summary (just numbers, no bar chart) shown for AR and AP lines — the Invoices page is the canonical home for full aging detail.

---

### Unchanged Pages

**Projects, Entities & Contacts, Prices** — no structural changes. Projects and Entities detail panels continue to show financial summaries with links that now point to the Invoices and Payments pages instead of AP Calendar / AR Outstanding.

---

## Interactive Drill-Down Pattern

The core UX principle: **every aggregated number is a link to its proof.**

```
Dashboard layer (Cash Flow, Calendars, Financial Position)
  → Document layer (Invoices, Payments)
    → Detail expand (line items, payment history)
      → Entity / Project detail (Browse pages)
```

### Navigation map

| Source page | Clickable element | Destination |
|---|---|---|
| Cash Flow cell | Monthly amount | Payments, filtered by period + direction + category |
| AP Calendar item | Due date/amount | Invoices, filtered to payable + that item |
| AR Calendar item | Expected date/amount | Invoices, filtered to receivable + that item |
| Financial Position: AR | Outstanding total | Invoices, filtered to receivable + pending |
| Financial Position: AP | Outstanding total | Invoices, filtered to payable + pending |
| Financial Position: Bank | Account balance | Payments, filtered by bank account |
| Financial Position: Loans | Loan balance | Invoices, filtered to type=loan |
| Invoices: aging bucket | Bucket amount | Invoices table, filtered to that aging range |
| Invoices: expanded row | Payment entry | Payments, filtered by that invoice |
| Invoices: expanded row | Entity name | Entities detail |
| Invoices: expanded row | Project code | Projects detail |
| Payments: expanded row | Invoice link | Invoices, scrolled to that invoice |
| Payments: expanded row | Entity name | Entities detail |

Implementation: URL query parameters carry filter state. Navigation uses Next.js `router.push()` with query params. Destination pages read query params on mount and apply as active filters.

---

## What Gets Removed

V1 eliminates redundancy created by the unified model. These components no longer serve a purpose:

### SQL Views

| V0 View | V1 Status |
|---|---|
| `v_cost_totals` | Replaced by `v_invoice_totals` (one view, direction column) |
| `v_cost_balances` | Replaced by `v_invoice_balances` (one view, direction column) |
| `v_ar_balances` | Replaced by `v_invoice_balances` (one view, direction column) |
| `v_ap_calendar` | Replaced by `v_obligation_calendar` (invoices + loan_schedule UNION, both directions) |
| `v_entity_transactions` | Dropped entirely — query `v_invoice_balances` grouped by entity instead |
| `v_igv_position` | Simplified — queries one `invoices` table instead of joining costs + AR |
| `v_bank_balances` | Stays as-is |
| `v_loan_balances` | Stays as-is |
| `v_retencion_dashboard` | Stays as-is (retención verification status is invoice metadata, not a payment question) |

5 views → 3 unified views. `v_igv_position` and `v_retencion_dashboard` simplify but stay.

### Website Components

- **AP Calendar detail modals** — removed. Calendar rows link to Invoices page.
- **AR Outstanding detail modals** — removed. Calendar rows link to Invoices page.
- **AP Calendar Taxes tab** — removed. Detracción deposit tracking moves to Payments page (filter by `type=detraccion&direction=outbound`).
- **AR Calendar Taxes tab** — removed. Retención payments and detracción receipts move to Payments page (filter by `type=retencion` or `type=detraccion&direction=inbound`).

### TypeScript Types

| V0 Type | V1 Status |
|---|---|
| `Cost` | Replaced by `Invoice` (with `direction` field) |
| `CostItem` | Replaced by `InvoiceItem` |
| `ArInvoice` | Replaced by `Invoice` (with `direction` field) |
| Separate cost/AR query functions | Replaced by unified `getInvoices(direction?)` |

### CLI Modules

| V0 Module | V1 Status |
|---|---|
| `cli/modules/costs.py` | Replaced by `cli/modules/invoices.py` |
| `cli/modules/ar_invoices.py` | Replaced by `cli/modules/invoices.py` |

One module handles both directions with a direction parameter.

---

## Migration Path (High-Level)

This section outlines the transition — detailed migration SQL and code changes are separate tasks.

### Database

1. Create `invoices` table with `direction` column
2. Create `invoice_items` table (replaces `cost_items`)
3. Migrate data from `costs` → `invoices` (direction = 'payable')
4. Migrate data from `cost_items` → `invoice_items`
5. Migrate data from `ar_invoices` → `invoices` (direction = 'receivable')
6. Update `payments.related_to` references
7. Update all views to point at new tables
8. Drop old tables after verification
9. No changes to `loans` or `loan_schedule` tables

### CLI

1. New unified `invoices` module replaces `costs` and `ar_invoices` modules
2. Import functions updated for new table structure
3. Menu restructured

### Website

1. Build Invoices page (new — with UNION query for loan schedule entries)
2. Build Payments page (new)
3. Simplify AP Calendar (remove detail, add navigation links)
4. Rename AR Outstanding → AR Calendar, simplify same way
5. Add drill-down links to Cash Flow cells
6. Add drill-down links to Financial Position lines
7. Update Projects/Entities detail panels to link to Invoices/Payments
8. Update TypeScript types
9. Remove old AP Calendar detail / AR Outstanding detail code

---

## Decisions to Lock

| Decision | Resolution |
|---|---|
| Unified invoice table | Single `invoices` table with `direction` column replaces `costs` + `ar_invoices` |
| Line items on both directions | `invoice_items` serves payable and receivable invoices |
| Loans — UI merge, not DB merge | `loans` + `loan_schedule` stay separate; Invoices page shows both via UNION query |
| Loan facts | Loans are usually project-specific; lenders are always 3rd party entities, never partners |
| Invoices vs Calendars | Different time axes — aging (backward, exposure risk) vs urgency (forward, action needed) |
| Aging buckets location | Invoices page summary cards (canonical), Financial Position (condensed) |
| Urgency buckets location | AP Calendar and AR Calendar pages |
| Payments page | Standalone page — all cash movements in one place |
| Tax tracking | No separate Taxes tabs on calendars — tax payments (detracción, retención) are Payments page filters |
| Views consolidation | 5 views → 3: `v_invoice_totals`, `v_invoice_balances`, `v_obligation_calendar` |
| `v_entity_transactions` | Dropped — replaced by querying `v_invoice_balances` grouped by entity |
| CLI modules | One `invoices.py` module replaces `costs.py` + `ar_invoices.py` |
| TypeScript types | `Invoice` + `InvoiceItem` replace `Cost`, `CostItem`, `ArInvoice` |
| Drill-down pattern | Every aggregated number links to its backing data via URL query params |
| Navigation method | URL query params, not modals — full page context, shareable, back button works |
| Quotes remain core | Price analytics from historical quotes is a primary use case |

---

*This document defines the V1 target architecture. Implementation is a separate set of tasks. Do not begin migration without explicit approval.*
