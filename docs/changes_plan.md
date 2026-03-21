# UI & Architecture Changes

**Document version:** 3.0
**Date:** March 20, 2026
**Status:** Approved for implementation

---

## Overview

Six changes stemming from a review of the system's daily use cases. The core findings were:

1. Partner settlement is a cross-project concept and needs its own dedicated view
2. The project detail view is doing too much — settlement does not belong there
3. The global partner filter reflects a multi-user workflow that does not match reality
4. Partners regularly make transactions without formal invoices — the system needs a lightweight path for this in either direction (costs paid and revenue received) without breaking the existing architecture
5. Intercompany invoices (settlement transfers between partners) must be excluded from project economics to avoid distorting profit calculations
6. Partner revenue from clients needs to be trackable — not just partner costs

---

## Change 1 — New Page: Settlement Dashboard

### Location in sidebar

Add under **Dashboards**, between Calendar and Financial Position:

```
Dashboards
  Calendar
  Settlement        ← new
  Financial Pos.
```

### Purpose

Answer the daily question: *how are we sitting on partner settlements across all active projects?* This page replaces the settlement table that currently lives inside the project detail view.

### Layout

**Toolbar (top of page)**

- Label: `Projects`
- Filter chips — one per active project, plus an `All active` chip
  - Default state: all chips active (`All active` highlighted)
  - Clicking a single project chip deselects the others and shows that project only
  - Clicking multiple project chips aggregates those projects
  - At least one chip must always remain active
- Toggle on the right: `Active only` / `Include completed` (default: active only)

**Summary strip**

Four cells, always reflecting the current chip selection:

| Cell | Content |
|---|---|
| Projects | Count of selected projects |
| Income collected | Sum of AR payments received |
| Total costs | Sum of project costs (SGA excluded) |
| Total profit | Income − costs |

**Partner table**

One consistent table structure regardless of how many projects are selected. Columns:

| Column | Single project | Multiple projects |
|---|---|---|
| Partner | Name + "you" tag on Korakuen | Same |
| Share | % pill (e.g. `20%`) | `—` (meaningless across projects) |
| Costs paid | Amount | Sum across selected projects |
| Profit share | Amount | Sum across selected projects |
| Should receive | Amount | Sum across selected projects |
| Balance | Colored badge (+/−) | Colored badge (+/−) |

Total row at the bottom of the table. Balance column shows `—` in the total row.

**Balance color coding**

- Positive (partner is owed money): green badge `#1a7a4a` on `#edf7f2`
- Negative (partner has received more than their share): red badge `#c0392b` on `#fdf2f1`
- Zero (settled): faint `—`

### Impact on settlement logic

The calculation is the same logic extracted from `getProjectDetail`, with one addition — intercompany exclusion (see Change 5):

- **Costs** — sum of `v_invoice_totals` where `direction = payable`, `cost_type = project_cost` (excludes `intercompany` and `sga`), grouped by `partner_company_id`
- **Revenue** — sum of `payments` joined to receivable `invoices` where `cost_type != 'intercompany'`, grouped by `partner_company_id`

### New query needed

`getSettlementDashboard(projectIds: string[]): Promise<SettlementDashboardData>`

- Accepts an array of project IDs (from chip selection)
- Returns: summary totals + per-partner rows with costs, profit share, should receive, balance
- All amounts in PEN (convert USD at stored exchange rates)
- Excludes SGA and intercompany invoices from cost and revenue calculations

---

## Change 2 — Modified Page: Project Detail ✓ DONE (`03ebe73`)

### What changes

The **Partners & Settlement** panel is removed entirely from the project detail view.

Partners are folded into the header metadata area as read-only chips.

### New header metadata layout

The project header card has two sections:

**Metadata grid (5 columns)**

| Client | Contract value | Start date | Expected end | Location |

**Partners row (below the grid, full width)**

- Label: `Partners`
- One chip per partner: shows name + share % pill
- Korakuen chip uses green tint to identify "you"
- Read-only — partner management stays in edit mode only

Example chip appearance:
```
[ Empresa A  20% ]  [ Empresa B  50% ]  [ Korakuen (you)  30% ]
```

Optional: small `View settlement →` link on the right of the partners row that deep-links to the Settlement dashboard pre-filtered to that project.

### What remains in the project detail

1. **Header card** — metadata grid + partners row
2. **Two-column section**
   - Left: Costs & Budget (budget vs actual by category, unchanged)
   - Right: Entities & Suppliers (spending per entity, unchanged)
3. **Notes** (if present)

### What is removed

- The full settlement table (costs contributed, revenue received, profit, should receive, balance per partner)
- The "Add partner" inline form from this view
- The partner detail modal (cost/revenue drill-down per partner)

---

## Change 3 — Remove Global Partner Filter ✓ DONE (`c227784`)

### What changes

The global partner filter (the dropdown/toggle in the sidebar that scopes all pages to a specific partner company) is removed from the UI entirely.

### Reasoning

The partner filter was designed for a multi-user workflow where each partner logs in independently and views their own data. In practice the system has one primary user (Alex) who manages data for the entire collaboration. The filter adds cognitive overhead on every page load with no real benefit.

### What stays unchanged

`partner_company_id` remains on all invoice and payment records — it is still required for:
- Settlement calculations (which partner paid which costs)
- Accountant exports (which legal entity issued or received each document)
- Bank account attribution

The field stays in the data model. Only the UI filter is removed.

### Bank reconciliation

`bank_tracking_full = true` on Korakuen's partner company record — full reconciliation against bank statements is expected for Alex's accounts only. Other partners' accounts are referenced in the system only when recording that they paid a project cost. This is already the current behavior and does not change.

### Intentional data asymmetry between partner companies

The system deliberately treats partner companies differently in terms of data completeness. This is by design, not a limitation.

**Korakuen (Alex)**
- Full formal invoice registration — comprobante type, entity, IGV, document ref, exchange rate
- Full payment tracking with bank account attribution
- Full bank reconciliation against statements (`bank_tracking_full = true`)
- SUNAT-compliant records for Korakuen's own tax obligations

**Other partner companies**
- Transactions registered via "Register direct transaction" in most cases — amount, date, category, project
- No comprobante required, no entity required, no IGV tracking
- Bank accounts referenced only to attribute which partner paid a cost — no full reconciliation
- Formal invoices can be registered if the partner provides them, but there is no expectation or obligation to do so

**Why this is correct**

Each partner company is a separate legal entity responsible for its own SUNAT compliance and formal accounting. That is handled by each partner's own external accountant using their own tools (Alegra, Contasis, etc.). This system is not their accounting system.

This system's responsibility for other partners' transactions is narrow and specific: record enough information to make settlement math work correctly. Nothing more.

The `partner_company_id` field on every transaction is sufficient for that purpose regardless of how much or how little detail surrounds it.

### Files affected

- `src/components/sidebar.tsx` — remove `PartnerFilter` component
- `src/lib/partner-filter-context.tsx` — can be deleted
- `src/lib/partner-filter-server.ts` — can be deleted
- `src/lib/partner-filter-utils.ts` — can be deleted
- `src/app/(app)/layout.tsx` — remove `PartnerFilterProvider`
- All page queries that accept `partnerIds` as a filter parameter — remove that parameter, queries fetch all data

---

## Change 4 — New Feature: Direct Transaction Registration

### Purpose

Partners frequently make transactions without formal comprobantes — paying suppliers in cash, or receiving client payments directly. The system needs a lightweight path to record these in either direction, without blocking on a formal invoice, while preserving the existing architecture.

### Approach

A "Register direct transaction" modal — a simplified form that in a single submit action:

1. Auto-generates an invoice with `comprobante_type = none`
2. Immediately registers a payment against it, marking it as fully paid

The user never sees the invoice creation step. Under the hood the data model is identical to a normal invoice + payment — all existing queries, settlement logic, and accountant exports work without modification.

### Form fields

| Field | Required | Notes |
|---|---|---|
| Partner | Yes | Which partner made/received the transaction |
| Direction | Yes | Outflow (cost) or Inflow (revenue) |
| Project | Yes | Which project this belongs to |
| Amount | Yes | |
| Currency | Yes | USD or PEN |
| Date | Yes | Transaction date |
| Category | Yes | Materials, Labor, Subcontractor, etc. (outflow only) |
| Notes | No | Description of the transaction |

### Auto-generated invoice fields

| Field | Outflow (cost) | Inflow (revenue) |
|---|---|---|
| `direction` | `payable` | `receivable` |
| `cost_type` | `project_cost` | `null` |
| `comprobante_type` | `none` | `none` |
| `title` | `"Direct transaction — {date}"` | `"Direct transaction — {date}"` |
| `igv_rate` | `0` | `0` |
| `entity_id` | `null` | `null` |
| `invoice_number` | `null` | `null` |
| `is_auto_generated` | `true` | `true` |
| `payment_status` | `paid` (immediately) | `paid` (immediately) |

### Promoting to a formal invoice

When a comprobante arrives after the fact, the auto-generated invoice can be edited in place via the existing `updateInvoice` action. Fields to fill in:

- `comprobante_type` — set to `factura`, `boleta`, etc.
- `entity_id` — assign the supplier/client once RUC is known
- `invoice_number` — fill in the comprobante number
- `document_ref` — assign the SharePoint reference code
- `igv_rate` — update if IGV applies

No deletion or duplicate records required. The invoice is promoted from informal to formal in place. `is_auto_generated` can remain `true` as a historical marker — it has no effect on any calculation.

### Impact on settlement logic

Zero impact. The auto-generated invoice has the appropriate `direction` and `partner_company_id` set to the partner who made or received the transaction. It immediately appears in `v_invoice_totals` and is picked up by the settlement calculation automatically — identical to a manually registered formal invoice.

This covers both the common case (a partner pays a supplier directly — outflow) and the less frequent case (a client pays a partner directly — inflow). Settlement picks up both sides through the existing `v_invoice_totals` view with no additional query changes beyond the intercompany exclusion in Change 5.

### Where this lives in the UI

A `+ Direct transaction` button available on:
- The Calendar page (top right, alongside other actions)
- The Invoices page (top right, alongside Import)

Opens a modal. No new page required.

### Schema change needed

Add `is_auto_generated BOOLEAN DEFAULT false` to the `invoices` table. Nullable fields (`entity_id`, `invoice_number`, etc.) already exist — no other schema changes required.

---

## Change 5 — Intercompany Invoice Tagging

### Problem

Intercompany invoices (e.g. Partner B invoicing Partner A to redistribute profit) are regular documents for all purposes — they appear in the invoices list, count toward AP/AR on the calendar, carry full comprobante/IGV/entity metadata, and are included in accountant exports. The only exception is settlement aggregation: they must be excluded from the cost and revenue totals used to compute partner balances, otherwise project profit gets distorted.

### Example

Project PRY001 has real revenue of S/ 100,000 and real costs of S/ 70,000 (profit S/ 30,000). Partner B invoices Partner A for S/ 75,000 to redistribute profit. Without intercompany tagging, the settlement query sees:

- Revenue: S/ 100,000 + S/ 75,000 = S/ 175,000 (inflated)
- Costs: S/ 70,000 + S/ 75,000 = S/ 145,000 (inflated)
- Profit: S/ 30,000 (correct by coincidence, but revenue and cost figures are wrong)

With intercompany tagging, the settlement query filters them out and sees the real numbers.

### Fix

Add `intercompany` as a valid `cost_type` value. The settlement query (Change 1) adds a single `WHERE cost_type != 'intercompany'` filter on both the cost and revenue sides. No other logic changes.

### Schema change needed

Alter the `cost_type` check constraint on `invoice_items` to accept `'intercompany'` in addition to `'project_cost'` and `'sga'`. This is a single migration.

### Where intercompany invoices appear vs. are excluded

| View | Sees intercompany? |
|---|---|
| Invoices page | Yes — real payable/receivable |
| Payments page | Yes — real cash movement |
| Calendar | Yes — real due date |
| Financial Position | Yes — affects bank balances |
| **Settlement dashboard** | **No — excluded** |

---

## Change 6 — Partner Revenue Tracking via Direct Transaction

### Problem

Project revenue can land in any partner's account — the client might pay Partner B directly. The system needs to track this for settlement: "Partner B received S/ 100,000 from the client for PRY001."

### Solution

This is fully covered by Change 4 (Direct Transaction) with the `direction = Inflow` option. When the client pays a partner directly:

1. User opens the Direct Transaction modal
2. Selects: Partner B, Inflow, Project PRY001, Amount, Date
3. System auto-generates a receivable invoice with `partner_company_id = Partner B`, immediately marked as paid

The settlement query picks this up as Partner B's revenue via `v_invoice_totals` where `direction = 'receivable'`, grouped by `partner_company_id`.

### No additional schema or query changes

Everything is handled by Changes 4 and 5. This change exists only to document the use case and confirm it is covered.

---

## Summary of files affected

### Already done

| File | Change | Commit |
|---|---|---|
| `src/app/(app)/projects/[id]/project-detail-view.tsx` | Remove settlement panel, add partner chips to header | `03ebe73` |
| `src/components/sidebar.tsx` | Remove PartnerFilter component | `c227784` |
| `src/app/(app)/layout.tsx` | Remove PartnerFilterProvider | `c227784` |
| `src/lib/partner-filter-context.tsx` | Deleted | `c227784` |
| `src/lib/partner-filter-server.ts` | Deleted | `c227784` |
| `src/lib/partner-filter-utils.ts` | Deleted | `c227784` |
| `src/lib/queries/calendar.ts` | Remove partnerIds parameter | `c227784` |
| `src/lib/queries/invoices.ts` | Remove partnerFilter parameter | `c227784` |
| `src/lib/queries/payments.ts` | Remove partnerFilter parameter | `c227784` |
| `src/lib/queries/financial-position.ts` | Remove partnerIds parameter | `c227784` |
| `src/app/(app)/invoices/page.tsx` | Remove getPartnerFilter | `c227784` |
| `src/app/(app)/payments/page.tsx` | Remove getPartnerFilter | `c227784` |
| `src/app/(app)/calendar/page.tsx` | Remove getPartnerFilter | `c227784` |
| `src/app/(app)/financial-position/page.tsx` | Remove getPartnerFilter | `c227784` |

### Remaining

| File | Change | For |
|---|---|---|
| `src/components/sidebar.tsx` | Add Settlement to nav | Change 1 |
| `src/app/(app)/settlement/page.tsx` | New page — create | Change 1 |
| `src/app/(app)/settlement/settlement-client.tsx` | New client component — create | Change 1 |
| `src/lib/queries/settlement.ts` | New query file — `getSettlementDashboard` | Change 1 |
| `src/lib/queries/projects.ts` | Add intercompany exclusion to settlement logic | Change 5 |
| `src/lib/queries/index.ts` | Export new settlement query | Change 1 |
| `src/lib/types.ts` | Add `SettlementDashboardData` type, add `is_auto_generated` to invoice types | Changes 1, 4 |
| `src/lib/actions.ts` | Add `registerDirectTransaction` server action | Change 4 |
| `src/app/(app)/calendar/calendar-client.tsx` | Add `+ Direct transaction` button | Change 4 |
| `src/app/(app)/invoices/invoices-client.tsx` | Add `+ Direct transaction` button | Change 4 |
| `src/components/ui/direct-transaction-modal.tsx` | New modal component — create | Change 4 |
| `supabase/migrations/` | Add `is_auto_generated` to `invoices`, add `intercompany` to `cost_type` constraint | Changes 4, 5 |

---

## Out of scope for this change

- Changes to how formal invoices are registered — existing flow untouched
- Mobile layout — deferred to V2 as per tech evolution strategy
- Automatic detection of duplicate transactions — operational process, not a system concern
- Multi-user access control — deferred, current single-user model remains