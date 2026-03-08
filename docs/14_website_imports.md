# Website Data Entry Requirements

**Document version:** 1.0
**Date:** March 7, 2026
**Status:** Draft

---

## Overview

Move all data entry from the CLI to the website. The CLI becomes obsolete — all partners can create and import data directly.

**Two input patterns based on complexity:**

| Pattern | When to use | Examples |
|---|---|---|
| **Excel import** | Bulk data, many fields, line items | Costs + cost items, entities, quotes, AR invoices |
| **Inline UI** | Few fields, simple records, contextual actions | Payments, loan repayments, bank accounts, loans, project partners, project entities, budgets |

**Shared Excel import UX flow:**
1. User clicks "Import" button
2. File upload dialog (accepts .xlsx only)
3. Server parses Excel, validates all rows
4. Preview table shows parsed data — errors highlighted in red with messages
5. User reviews, confirms
6. Server inserts valid rows, returns success count + any row-level errors
7. Template download link available next to the import button ("Download template")

**Shared inline UI patterns:**
- Small modals for standalone records (loans, bank accounts)
- Inline forms within detail panels (project partners, project entities, budgets)
- Action buttons within row modals (payments, loan repayments)

---

## Page-by-Page Requirements

### 1. Projects (Browse)

**Location:** Next to the status filter dropdown.

#### Create Project — Inline modal
A project has few fields. No Excel import needed — single-record modal.

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | |
| Project type | select | yes | Subcontractor, OxI |
| Status | select | yes | Prospect, Active, Completed, Cancelled |
| Client | entity picker | no | Search existing entities |
| Contract value | number | no | |
| Currency | select | conditional | Required if contract_value provided. USD or PEN |
| Exchange rate | number | yes | Auto-suggest from exchange_rates table for today |
| Start date | date | no | |
| Expected end date | date | no | |
| Location | text | no | Region in Peru |
| Notes | textarea | no | |

Project code (PRY001, PRY002...) is auto-generated — not user input.

#### Project Partners — Inline form in project detail
Within the right panel detail view, under a "Partners" section.

| Field | Type | Required | Notes |
|---|---|---|---|
| Partner company | select | yes | Dropdown of 3 partner companies |
| Profit share % | number | yes | Must total 100% across all partners on the project |

UI: Small table with add/remove rows. Validation: profit shares must sum to 100% before save.

#### Project Entities — Inline form in project detail
Within the right panel detail view, under an "Assigned Entities" section.

| Field | Type | Required | Notes |
|---|---|---|---|
| Entity | entity picker | yes | Search existing entities |
| Role | text | yes | Role on this specific project |

UI: Small table with add/remove rows.

#### Project Budgets — Inline form in project detail
Within the right panel detail view, under the "Cost Summary & Budget" section.

| Field | Type | Required | Notes |
|---|---|---|---|
| Category | select | yes | Cost categories (from categories table when built, hardcoded until then) |
| Budgeted amount | number | yes | In project currency |

UI: Editable cells in the existing budget vs actual table. User fills in the "Budget" column directly.

---

### 2. Entities & Contacts (Browse)

**Location:** Next to the search bar.

#### Import Entities — Excel import
Bulk creation of entities. Matches existing `entities.xlsx` template.

**Template columns:**

| Column | Required | Notes |
|---|---|---|
| entity_type | yes | company or individual |
| document_type | yes | RUC, DNI, CE, Pasaporte |
| document_number | yes | Unique — duplicate check against existing records |
| legal_name | yes | Razon social (company) or full name (individual) |
| common_name | no | Short/trade name |
| city | no | |
| region | no | Peruvian department |
| notes | no | |

**Validation:**
- document_number uniqueness (against DB + within file)
- entity_type and document_type consistency (company → RUC, individual → DNI/CE/Pasaporte)
- No duplicate legal_name warning (soft — different entities can share names)

#### Create Entity — Inline modal
For creating a single entity quickly without Excel.

Same fields as the template, presented as a form.

#### Entity Tags — Dropdown management
Wherever tags appear (entity detail panel, entity list badges), add a multi-select dropdown to manage them.

- Source: existing `tags` table (25 pre-seeded tags)
- UI: Dropdown with checkboxes. Selecting/deselecting immediately adds/removes `entity_tags` rows
- No tag creation from UI — tags are master data managed in Supabase Dashboard

#### Entity Contacts — Inline form in entity detail
Within the right panel detail view, under a "Contacts" section.

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | text | yes | Contact person name |
| Phone | text | no | |
| Email | text | no | |
| Role | text | no | Role at the entity |

UI: Small table with add/remove rows.

---

### 3. Prices (Browse)

**Location:** Next to the search/filter bar.

#### Import Quotes — Excel import
Bulk creation of quotes received from suppliers. Matches existing `quotes.xlsx` template.

**Template columns:**

| Column | Required | Notes |
|---|---|---|
| date | yes | Date received |
| project_code | yes | Must match existing project (e.g., PRY001) |
| entity_document_number | yes | RUC/DNI — must match existing entity |
| title | yes | Scope or item quoted |
| quantity | no | |
| unit_of_measure | no | |
| unit_price | no | |
| subtotal | yes | |
| igv_amount | no | |
| total | yes | |
| currency | yes | USD or PEN |
| exchange_rate | yes | |
| status | yes | pending, accepted, rejected |
| document_ref | no | e.g., PRY001-QT-001 |
| notes | no | |

**Validation:**
- project_code must exist in projects table
- entity_document_number must exist in entities table
- Currency must be USD or PEN
- Status must be pending, accepted, or rejected
- If quantity and unit_price provided, subtotal should equal quantity x unit_price

---

### 4. AP Calendar (Dashboard)

**Location:** Top-right area, next to filters.

#### Import Costs — Excel import (two-step)
The most complex import. Costs have headers + line items.

**Current approach (CLI):** Two separate imports — headers first, then items matched by a temporary reference. This is fragile and confusing.

**New approach:** Single Excel file with denormalized rows. Each row is a cost item. Header fields repeat on every row — the system groups rows by a `group_key` column to create one cost header with multiple items.

**Template columns:**

| Column | Scope | Required | Notes |
|---|---|---|---|
| group_key | grouping | yes | User-defined key to group items into one cost (e.g., 1, 2, 3 or "A", "B") |
| date | header | yes | Transaction date |
| cost_type | header | yes | project_cost or sga |
| project_code | header | conditional | Required if cost_type = project_cost. Null if SGA |
| bank_account_label | header | yes | Matches bank_accounts.label (e.g., "BCP-1234") |
| entity_document_number | header | no | RUC/DNI — nullable for informal purchases |
| igv_rate | header | yes | Default 0.18 |
| detraccion_rate | header | no | |
| currency | header | yes | USD or PEN |
| exchange_rate | header | yes | |
| comprobante_type | header | no | factura, boleta, recibo_por_honorarios, etc. |
| comprobante_number | header | no | e.g., F001-00234 |
| document_ref | header | no | e.g., PRY001-AP-001 |
| due_date | header | no | Feeds AP calendar |
| payment_method | header | no | bank_transfer, cash, check |
| item_title | item | yes | Line item description |
| category | item | yes | Cost category |
| quantity | item | no | |
| unit_of_measure | item | no | |
| unit_price | item | no | |
| subtotal | item | yes | quantity x unit_price, or entered directly |
| item_notes | item | no | |

**Validation:**
- group_key groups must have consistent header fields (same date, project, bank account, etc.)
- project_code must exist (when provided)
- bank_account_label must match an existing bank account
- entity_document_number must match an existing entity (when provided)
- category must be a valid cost category for the cost_type
- Each group must have at least one item row

**Grouping logic:** All rows with the same `group_key` value become one cost header + N cost items. Header fields are taken from the first row of each group (validated as consistent across the group).

#### Register Payment — Action within row modal
When a user clicks a cost row and opens the detail modal, an action button "Register Payment" appears.

| Field | Type | Required | Notes |
|---|---|---|---|
| Payment date | date | yes | |
| Amount | number | yes | Cannot exceed outstanding balance |
| Bank account | select | yes | Source account |
| Payment type | select | yes | regular, detraccion, retencion |
| Exchange rate | number | yes | Auto-suggest for today |
| Reference | text | no | Transfer number or check number |
| Notes | textarea | no | |

Payment currency matches the parent cost's currency — not selectable.

---

### 5. AR Outstanding (Dashboard)

**Location:** Top-right area, next to filters.

#### Import AR Invoices — Excel import
Bulk creation of AR invoices issued to clients. Matches existing `ar_invoices.xlsx` template.

**Template columns:**

| Column | Required | Notes |
|---|---|---|
| project_code | yes | Must match existing project |
| partner_company_ruc | yes | Which partner issued the invoice |
| bank_account_label | yes | Regular receipt account |
| client_document_number | yes | Client entity RUC — must exist in entities |
| invoice_number | yes | Own numbering (from Alegra/Contasis) |
| comprobante_type | yes | factura |
| invoice_date | yes | |
| due_date | no | |
| subtotal | yes | Invoice subtotal |
| igv_rate | yes | Default 0.18 |
| detraccion_rate | no | |
| retencion_applicable | yes | true/false |
| retencion_rate | conditional | Required if retencion_applicable = true. Default 0.03 |
| currency | yes | USD or PEN |
| exchange_rate | yes | |
| document_ref | no | e.g., PRY001-AR-001 |
| notes | no | |

**Validation:**
- project_code must exist
- partner_company_ruc must match one of the 3 partner companies
- bank_account_label must match an existing bank account owned by the specified partner
- client_document_number must match an existing entity
- invoice_number uniqueness check
- If retencion_applicable = true, retencion_rate must be provided

#### Register Collection — Action within row modal
When a user clicks an AR invoice row and opens the detail modal, an action button "Register Collection" appears.

| Field | Type | Required | Notes |
|---|---|---|---|
| Payment date | date | yes | |
| Amount | number | yes | Cannot exceed outstanding balance |
| Bank account | select | yes | Receiving account |
| Payment type | select | yes | regular, detraccion, retencion |
| Exchange rate | number | yes | Auto-suggest for today |
| Reference | text | no | |
| Notes | textarea | no | |

Payment currency matches the parent AR invoice's currency.

---

### 6. Financial Position (Dashboard)

**Location:** Within the relevant sections (Assets for bank accounts, Liabilities for loans).

#### Create Bank Account — Inline modal
Small modal triggered from the "Cash in Bank" section. Few fields.

| Field | Type | Required | Notes |
|---|---|---|---|
| Partner company | select | yes | Which partner owns this account |
| Bank name | text | yes | BCP, Interbank, BBVA, etc. |
| Account number (last 4) | text | yes | 4 digits |
| Label | text | yes | Unique human-readable label (e.g., "BCP-1234") |
| Account type | select | yes | checking, savings, detraccion |
| Currency | select | yes | USD or PEN |
| Is detraccion account | toggle | yes | Auto-set true if account_type = detraccion |

**Validation:**
- Label uniqueness against existing bank accounts

#### Create Loan — Inline modal
Modal triggered from the "Loans" section in Liabilities.

| Field | Type | Required | Notes |
|---|---|---|---|
| Partner company | select | yes | Which partner borrowed |
| Lender name | text | yes | |
| Lender contact | text | no | Phone or email |
| Amount | number | yes | Principal borrowed |
| Currency | select | yes | USD or PEN |
| Exchange rate | number | yes | Auto-suggest for today |
| Date borrowed | date | yes | |
| Project | project picker | no | Which project this funded |
| Purpose | text | yes | |
| Return type | select | yes | percentage or fixed |
| Agreed return rate % | number | conditional | Required if return_type = percentage |
| Agreed return amount | number | conditional | Required if return_type = fixed |
| Due date | date | no | Overall repayment deadline |
| Notes | textarea | no | |

#### Create Loan Schedule — Inline form within loan detail
After creating a loan, user can add scheduled repayment entries.

| Field | Type | Required | Notes |
|---|---|---|---|
| Scheduled date | date | yes | |
| Scheduled amount | number | yes | |
| Exchange rate | number | yes | |

UI: Small table with add/remove rows within a loan detail modal or expandable section.

#### Register Loan Repayment — Action within AP Calendar
Loan schedule entries appear in AP Calendar as `type = 'loan_payment'`. Clicking a loan row opens a modal with loan details + "Register Repayment" button.

| Field | Type | Required | Notes |
|---|---|---|---|
| Payment date | date | yes | |
| Amount | number | yes | |
| Currency | select | yes | USD or PEN |
| Exchange rate | number | yes | |
| Source | select | no | project_settlement, personal_funds, other |
| Settlement reference | text | no | e.g., PRY001-Settlement-1 |
| Notes | textarea | no | |

---

## Pages with NO data entry

| Page | Reason |
|---|---|
| Cash Flow | Pure derived view — reads from costs, AR invoices, payments, loan_schedule |
| Partner Balances | Pure derived view — reads from costs, AR invoices, payments, project_partners |

---

## Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Excel parsing library | xlsx (SheetJS CE) | Most popular, server-side Node, no native deps |
| Mutation pattern | Next.js Server Actions | Matches existing server-side data fetching pattern |
| Template delivery | Static files in `public/templates/` | Simple, cacheable, no generation |
| Upload size limit | 5MB | Covers thousands of rows in .xlsx |
| Cost insert | Reuse `fn_create_cost_with_items()` RPC | Already atomic (header + items in one call) |
| Form validation | zod schemas | Type-safe, composable, works on server |

---

## Prerequisites — RLS Insert Policies

The website is currently read-only. Before any writes work, INSERT (and where needed, UPDATE) RLS policies must be added for authenticated users on every table that receives website writes:

- entities, entity_tags, entity_contacts
- projects, project_partners, project_entities, project_budgets
- quotes
- costs, cost_items
- ar_invoices
- payments
- loans, loan_schedule, loan_payments
- bank_accounts

---

## Not included

| Item | Reason |
|---|---|
| Exchange rates | Managed via Supabase Dashboard — simple single-row inserts |
| Categories management | Managed via Supabase Dashboard — rarely changes |
| Edit/update existing records | Deferred. Create-only in this phase |
| Soft-delete from UI | Deferred. Use Supabase Dashboard to deactivate records |

---

## Summary: Import matrix

| Data | Input method | Location | Template exists |
|---|---|---|---|
| Projects | Modal | Projects page | yes (but modal preferred) |
| Project partners | Inline form | Projects detail panel | no (not needed) |
| Project entities | Inline form | Projects detail panel | no (not needed) |
| Project budgets | Inline form | Projects detail panel | no (not needed) |
| Entities | Excel import + modal | Entities page | yes |
| Quotes | Excel import | Prices page | yes |
| Costs + items | Excel import (single file) | AP Calendar | yes (will be redesigned) |
| AR invoices | Excel import | AR Outstanding | yes |
| Payments (AP) | Modal action | AP Calendar row detail | no (not needed) |
| Collections (AR) | Modal action | AR Outstanding row detail | no (not needed) |
| Bank accounts | Modal | Financial Position | no (not needed) |
| Loans | Modal | Financial Position | no (not needed) |
| Loan schedule | Inline form | Loan detail | no (not needed) |
| Loan repayments | Modal action | AP Calendar row detail | no (not needed) |
| Entity tags | Dropdown (inline) | Entities detail panel | no (not needed) |
| Entity contacts | Inline form | Entities detail panel | no (not needed) |

---

## Implementation Phases

Small UIs first — establish mutation patterns before tackling complex Excel imports.

### Phase 0 — Prerequisites
- RLS INSERT/UPDATE policies for all writable tables (single migration)
- Install `xlsx` (SheetJS) + `zod` dependencies

### Phase 1 — Simplest inline UIs (establish Server Action mutation patterns)
- Entity tags dropdown (toggling entity_tags rows — simplest possible write)
- Entity contacts inline form (4 fields, add/remove rows)
- Create Bank Account modal (6 fields, standalone)

### Phase 2 — Create modals with lookups
- Create Entity modal (8 fields, standalone)
- Create Project modal (10 fields, entity picker for client)
- Project partners inline form (2 fields, sum-to-100% validation)
- Project entities inline form (2 fields, entity picker)
- Project budgets inline form (2 fields, editable cells in existing table)

### Phase 3 — Action modals (contextual, need parent record)
- Register Payment (AP Calendar cost detail modal)
- Register Collection (AR Outstanding invoice detail modal)
- Create Loan modal + loan schedule inline form
- Register Loan Repayment (AP Calendar loan detail modal)

### Phase 4 — Excel imports (shared upload/preview infrastructure first)
- Shared import UI: file upload component, preview table, error display, confirm flow
- Entities import
- Quotes import
- AR invoices import
- Costs import (most complex — grouped rows)

---

*This document defines the scope. Implementation details (components, API routes, validation logic) will be defined per feature during build.*
