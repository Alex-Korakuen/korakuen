# Database Schema

**Document version:** 4.0
**Date:** March 13, 2026
**Status:** Active — V1 unified invoice model deployed

---

## Overview

PostgreSQL database hosted on Supabase. All tables use UUID primary keys. Reference/master data tables use soft deletes via `is_active` boolean. Transaction tables (invoices, invoice_items, payments) and historical reference tables (quotes) are permanent records — never deleted or deactivated. The `project_partners` bridge table uses soft deletes to allow removal while preserving history. Exception: `entity_tags` uses hard deletes (rows deleted and recreated). Every table has `created_at` and `updated_at` timestamps.

**Table count:** 17 tables total across 7 layers.

```
Layer 1: partner_companies, bank_accounts, entities, exchange_rates, categories
Layer 2: tags, entity_tags, entity_contacts, projects
Layer 3: project_partners, quotes
Layer 4: invoices, invoice_items
Layer 5: payments
Layer 6: loans, loan_schedule
Layer 7: project_budgets
```

---

## Conventions

- **Primary keys:** UUID, system generated
- **Soft deletes:** `is_active BOOLEAN DEFAULT true` on reference/master data tables (partner_companies, bank_accounts, entities, entity_contacts, tags, projects, categories, project_budgets) and the `project_partners` bridge table. Transaction tables (invoices, invoice_items, payments, loans, loan_schedule) and historical reference tables (quotes) are permanent — never soft-deleted
- **Timestamps:** `created_at` auto-set on insert, `updated_at` auto-updated on any change
- **Currency:** always stored in natural currency (USD or PEN), never converted at storage
- **Exchange rate:** mandatory (NOT NULL) on all financial tables, stored per transaction at the historical rate. Enables application-layer conversion for reporting. Amounts never converted at storage
- **Nullable fields:** explicitly noted — absence of a value is valid business data (informality support)
- **Document codes:** follow format `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]` — see `07_file_storage.md`
- **Title and notes:** `title` is the record's subject/name (required). `notes` is optional free-form context. Never use `description` as a column name. Special identity fields (`name`, `legal_name`, `invoice_number`) keep their specific names

---

## Layer 1 — No Dependencies

### `partner_companies`
The three partner companies. Referenced on every financial transaction to identify who paid or who issued an invoice. Also referenced by bank accounts.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key, system generated |
| name | VARCHAR | NO | legal company name |
| ruc | VARCHAR(11) | NO | Peruvian company tax ID |
| owner_name | VARCHAR | NO | partner's full name |
| owner_document_type | VARCHAR | NO | RUC, DNI, CE, Pasaporte |
| owner_document_number | VARCHAR | NO | the actual ID number |
| email | VARCHAR | YES | partner contact email |
| phone | VARCHAR | YES | partner contact phone |
| bank_tracking_full | BOOLEAN | NO | true for Alex, false for other partners |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Rows:** 3 (one per partner). Rarely changes.

---

### `bank_accounts`
All bank accounts used for project transactions. Belongs to a partner company. Includes Banco de la Nación detracción accounts as a special type.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| partner_company_id | UUID | NO | references partner_companies |
| bank_name | VARCHAR | NO | BCP, Interbank, BBVA, Scotiabank, Banco de la Nación, etc. |
| account_number_last4 | VARCHAR(4) | NO | last 4 digits only for reference |
| label | VARCHAR | NO | unique human-readable label for import lookups (e.g., "BCP-1234") |
| account_type | VARCHAR | NO | checking, savings, detraccion |
| currency | VARCHAR(3) | NO | USD or PEN |
| is_detraccion_account | BOOLEAN | NO | true for Banco de la Nación detracción accounts |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** All partner accounts are tracked for project-related transactions. Partner account balances reflect only project activity in the system — not full personal banking. `bank_tracking_full` on `partner_companies` indicates whether full reconciliation against bank statements is expected.

---

### `entities`
Every external party Korakuen does business with — companies and individuals. The contacts module. Registered once, referenced everywhere. Phone, email, and address live in `entity_contacts`, not here.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| entity_type | VARCHAR | NO | company or individual |
| document_type | VARCHAR | NO | RUC, DNI, CE, Pasaporte |
| document_number | VARCHAR | NO | the actual ID number |
| legal_name | VARCHAR | NO | razón social or full legal name |
| city | VARCHAR | YES | e.g. "Arequipa" — enables geographic filtering |
| region | VARCHAR | YES | e.g. "Arequipa" — Peruvian department |
| is_active | BOOLEAN | NO | default true, soft delete |
| notes | TEXT | YES | free text |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** Individual entities (DNI holders) always have at least one `entity_contacts` record representing themselves (the individual person). This keeps phone/email consistent across all entity types.

---

### `exchange_rates`
Daily SUNAT USD/PEN exchange rates. Lookup/reference table — not FK'd to any financial table. Financial tables store their own `exchange_rate` at transaction time; this table provides suggested rates during data entry and enables reporting conversions.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| rate_date | DATE | NO | unique — one row per day |
| buy_rate | NUMERIC(10,4) | NO | SUNAT buy rate (banco compra) |
| sell_rate | NUMERIC(10,4) | NO | SUNAT sell rate (banco venta) |
| mid_rate | NUMERIC(10,4) | NO | (buy + sell) / 2 |
| source | VARCHAR(50) | NO | default 'SUNAT' |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**No `is_active`** — exchange rates are historical facts, never deactivated.

### `categories`
Invoice item categories. Referenced by `invoice_items.category` and `project_budgets.category` via FK. Each category belongs to exactly one `cost_type`. The `name` field is the natural primary key (not UUID).

| Field | Type | Nullable | Notes |
|---|---|---|---|
| name | VARCHAR(50) | NO | primary key — e.g. 'materials', 'other_sga' |
| cost_type | VARCHAR(20) | NO | 'project_cost' or 'sga' |
| label | VARCHAR(100) | NO | display name — e.g. 'Materials', 'Other' |
| sort_order | INTEGER | NO | controls menu/display ordering |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Note:** SGA's "other" uses `name = 'other_sga'` to keep primary keys unique. Its `label` is "Other".

---

## Layer 2 — Depends on Layer 1

### `tags`
Master list of all valid categorization tags. Referenced by `entity_tags`. Updatable anytime — adding a new tag here makes it available for assignment.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| name | VARCHAR | NO | unique, snake_case e.g. "cement_supplier" |
| notes | TEXT | YES | free-form context about the tag |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Tags:** See "Tags — Master List (Updated)" section below for the full 25-tag seed list.

---

### `entity_tags`
Bridge table linking entities to tags. Many-to-many — one entity can have multiple tags, one tag can apply to multiple entities. This is why a bridge table is needed rather than a column on entities.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| entity_id | UUID | NO | references entities |
| tag_id | UUID | NO | references tags |
| created_at | TIMESTAMP | NO | auto set on insert |

**No updated_at** — if a tag assignment changes, the row is deleted and recreated.

**Usage:** Adding a tag = insert a row. Removing a tag = delete the row. Finding all cement suppliers = query where tag_id = cement_supplier's id.

---

### `entity_contacts`
People associated with an entity. For company entities: representatives, salespeople, project managers. For individual entities: the individual themselves (flagged as primary). Phone, email, and address for all entities live here.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| entity_id | UUID | NO | references entities |
| full_name | VARCHAR | NO | contact person's full name |
| role | VARCHAR | YES | e.g. "Sales Manager", "Project Manager" |
| phone | VARCHAR | YES | |
| email | VARCHAR | YES | |
| is_active | BOOLEAN | NO | default true, soft delete |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

---

### `projects`
Every construction project. The anchor for all financial data. Project code drives the SharePoint document naming convention.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_code | VARCHAR | NO | unique, auto sequential e.g. PRY001 |
| name | VARCHAR | NO | project name |
| project_type | VARCHAR | NO | subcontractor or oxi |
| status | VARCHAR | NO | prospect, active, completed, cancelled |
| client_entity_id | UUID | YES | references entities — nullable for prospects |
| contract_value | NUMERIC(15,2) | YES | total value client will pay |
| contract_currency | VARCHAR(3) | YES | USD or PEN |
| start_date | DATE | YES | |
| expected_end_date | DATE | YES | |
| actual_end_date | DATE | YES | populated on completion |
| location | VARCHAR | YES | region or city in Peru |
| notes | TEXT | YES | |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** Project code is auto-generated sequentially (PRY001, PRY002...) at insert time. Never manually assigned, never reused even if a project is cancelled.

---

## Layer 3 — Locked

### `project_partners`
Stores the agreed profit share percentage per partner company per project. Each partner's share is set explicitly and must total 100% per project (enforced at application level). Settlement logic (profit distribution) is computed in the application layer using `v_invoice_totals` — each partner's profit = (project income - project costs) × their profit_share_pct.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| partner_company_id | UUID | NO | references partner_companies |
| profit_share_pct | NUMERIC(5,2) | NO | e.g. 40.00 = 40%, must be > 0 and <= 100 |
| is_active | BOOLEAN | NO | default TRUE — soft delete |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

Partial UNIQUE index on (project_id, partner_company_id) WHERE is_active = TRUE.

---

### `quotes`
Quotes received from suppliers and subcontractors before committing to a purchase. Accepted quotes link to the invoice record they generated, enabling quote vs actual price comparison.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| entity_id | UUID | NO | references entities |
| date_received | DATE | NO | |
| title | TEXT | NO | what was quoted |
| quantity | NUMERIC(15,4) | YES | |
| unit_of_measure | VARCHAR | YES | meters, units, hours, kg, etc. |
| unit_price | NUMERIC(15,4) | YES | |
| subtotal | NUMERIC(15,2) | NO | |
| igv_amount | NUMERIC(15,2) | YES | |
| total | NUMERIC(15,2) | NO | |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | NO | PEN per USD at transaction date, default 3.70 |
| status | VARCHAR | NO | pending, accepted, rejected |
| linked_invoice_id | UUID | YES | application-level reference to invoices (no FK constraint — avoids circular dependency with invoices.quote_id). Populated when accepted |
| document_ref | VARCHAR | YES | e.g. PRY001-QT-001 |
| notes | TEXT | YES | reason for rejection or other context |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

---

## Tags — Master List (Updated)

The `tags` table serves as a single master list for all categorization needs — entity tags, project roles, and any future classification. No separate roles table. The initial seed list reflects standard Peruvian small civil works practice:

**Materials Suppliers**
- Concrete Supplier
- Metal Supplier
- Wood Supplier
- Aggregates Supplier
- Cement Supplier
- Brick Supplier
- Paint Supplier
- Electrical Materials Supplier
- Plumbing Materials Supplier
- General Materials Supplier

**Subcontractors by trade**
- Electrical Subcontractor
- Plumbing Subcontractor
- Civil Works Subcontractor
- Carpentry Subcontractor
- Steel Works Subcontractor

**Equipment**
- Equipment Rental
- Transport / Logistics

**Services**
- Legal Services
- Accounting Services
- Engineering Services
- Topography Services

**Other**
- Government Supervisor
- OxI Financing Company
- Client
- General Supplier

*Tags are addable anytime via Supabase Dashboard. Nothing is locked — the list grows with operational experience.*

---

## Layer 4 — V1 Unified Invoice Model

### `invoices`
Unified table for all invoices — both payable (costs) and receivable (AR). The `direction` column distinguishes between the two. Totals and payment status are never stored — always derived via database views.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| direction | VARCHAR | NO | `'payable'` or `'receivable'` |
| partner_company_id | UUID | NO | references partner_companies — who incurred (payable) or issued (receivable) |
| project_id | UUID | YES | references projects — null if SG&A (payable only) |
| entity_id | UUID | YES | references entities — null if informal/unassigned (payable), always set (receivable) |
| quote_id | UUID | YES | references quotes — null if no prior quote (payable only) |
| purchase_order_id | UUID | YES | reserved for future PO module — always null for now |
| cost_type | VARCHAR | YES | `'project_cost'` or `'sga'` — payable only, null for receivable |
| title | TEXT | YES | invoice or expense title — payable only, null for receivable |
| invoice_number | VARCHAR(100) | YES | comprobante number (payable) or own numbering (receivable) |
| document_ref | VARCHAR(100) | YES | e.g. PRY001-AP-001 or PRY001-AR-001 |
| comprobante_type | VARCHAR(50) | YES | factura, boleta, recibo_por_honorarios, liquidacion_de_compra, planilla_jornales, none |
| invoice_date | DATE | NO | when the invoice was issued |
| due_date | DATE | YES | feeds payment calendar |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | NO | PEN per USD at transaction date |
| igv_rate | NUMERIC(5,2) | NO | default 18, editable per invoice |
| detraccion_rate | NUMERIC(5,2) | YES | percentage, null if not applicable |
| retencion_applicable | BOOLEAN | NO | default false — receivable only |
| retencion_rate | NUMERIC(5,2) | YES | default 3 if applicable — receivable only |
| retencion_verified | BOOLEAN | NO | default false — receivable only |
| payment_method | VARCHAR | YES | bank_transfer, cash, check — payable only |
| notes | TEXT | YES | free-form context |
| created_at | TIMESTAMPTZ | NO | auto |
| updated_at | TIMESTAMPTZ | NO | auto |

**Derived via database views (never stored):**
- `subtotal` — SUM of all invoice_items subtotals
- `igv_amount` — subtotal × igv_rate / 100
- `detraccion_amount` — (subtotal + igv_amount) × detraccion_rate / 100
- `retencion_amount` — (subtotal + igv_amount) × retencion_rate / 100 (receivable only, when retencion_applicable)
- `total` / `gross_total` — subtotal + igv_amount
- `amount_paid` — SUM of payments against this invoice
- `outstanding` — total - amount_paid
- `payment_status` — pending / partial / paid

---

### `invoice_items` (line items)
One or many rows per invoice. Holds the detail of what was purchased or invoiced. Category lives here — not on the header — enabling cost analysis by category across mixed invoices.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| invoice_id | UUID | NO | references invoices (CASCADE on delete) |
| title | TEXT | NO | line item name |
| category | VARCHAR(50) | YES | FK to categories.name — payable items always have category, receivable synthetic items may not |
| quantity | NUMERIC(15,4) | YES | null for lump sum lines |
| unit_of_measure | VARCHAR | YES | meters, units, hours, kg, days, etc. |
| unit_price | NUMERIC(15,4) | YES | null for lump sum lines |
| subtotal | NUMERIC(15,2) | NO | quantity × unit_price or entered directly |
| notes | TEXT | YES | |
| created_at | TIMESTAMPTZ | NO | auto |
| updated_at | TIMESTAMPTZ | NO | auto |

**Categories** are managed in the `categories` table (Layer 1). See that table for the full list.

**Query pattern:**
- Header info (who, when, document, direction) → query `invoices`
- Detail info (what, quantity, unit price, category) → query `invoice_items`
- Category breakdown per project → `invoice_items` JOIN `invoices`

**Note:** Receivable invoices have synthetic single-item rows (created during V1 migration) with `subtotal` as the amount.

---

### Database Views — Layer 4

These views derive the financial totals for invoices. See "Database Views — Complete List" section below for all 10 views.

| View | Source | Purpose |
|---|---|---|
| `v_invoice_totals` | invoices + invoice_items | subtotal, igv, detraccion, total per invoice (both directions) |
| `v_invoice_balances` | v_invoice_totals + payments | amount_paid, outstanding, payment_status per invoice |
| `v_obligation_calendar` | v_invoice_balances + loan_schedule | unpaid/partial obligations sorted by due date |

---

## Layer 5 — Locked

### `payments`
The unified payments table. Every actual movement of money — both inbound and outbound — lives here. Multiple payments can reference the same cost or AR invoice, supporting partial payments, detracción splits, and retención withholdings.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| related_to | VARCHAR | NO | invoice, loan_schedule, or loan (disbursement) |
| related_id | UUID | NO | the specific invoice or loan_schedule entry ID |
| direction | VARCHAR | NO | inbound or outbound |
| payment_type | VARCHAR | NO | regular, detraccion, retencion |
| payment_date | DATE | NO | when payment was made or received |
| amount | NUMERIC(15,2) | NO | in natural currency |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | NO | PEN per USD at transaction date, default 3.70 |
| bank_account_id | UUID | YES | nullable — retencion never hits an account |
| partner_company_id | UUID | NO | which partner's account was involved — required because retencion has no bank account |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Payment examples:**

Paying a supplier invoice of S/ 11,800:
```
row 1: outbound | invoice | detraccion | S/    590 | Banco de la Nación
row 2: outbound | invoice | regular    | S/ 11,210 | BCP account
```

Client pays your AR invoice of S/ 118,000:
```
row 1: inbound | invoice | detraccion | S/   4,720 | Banco de la Nación
row 2: inbound | invoice | retencion  | S/   3,540 | null — withheld by client, paid to SUNAT
row 3: inbound | invoice | regular    | S/ 109,740 | Interbank account
```

Repaying a loan schedule entry of S/ 5,000:
```
row 1: outbound | loan_schedule | regular | S/ 5,000 | BCP account
```

---

## Layer 6 — Loans

### `loans`
Financing arrangements — money borrowed from friends, family, or informal lenders to fund project contributions. Each loan belongs to a partner company. Business rule: 10% return on loans, borrower keeps the spread.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| partner_company_id | UUID | NO | references partner_companies — which partner borrowed |
| lender_name | VARCHAR | NO | who borrowed from |
| lender_contact | VARCHAR | YES | phone or email |
| amount | NUMERIC(15,2) | NO | principal borrowed |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | NO | PEN per USD at transaction date, default 3.70 |
| date_borrowed | DATE | NO | |
| project_id | UUID | YES | references projects — which project this funded, if any |
| purpose | TEXT | NO | freeform description |
| agreed_return_rate | NUMERIC(5,2) | YES | e.g. 8.00 (percent) |
| agreed_return_amount | NUMERIC(15,2) | YES | if fixed amount instead of % |
| return_type | VARCHAR | NO | percentage or fixed |
| due_date | DATE | YES | overall repayment deadline |
| entity_id | UUID | YES | references entities — the lender |
| notes | TEXT | YES | freeform |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**No `is_active`** — loans are permanent financial records, same as invoices and payments.

---

### `loan_schedule`
Agreed repayment schedule for a loan. Optional — not all loans have a structured schedule.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| loan_id | UUID | NO | references loans |
| scheduled_date | DATE | NO | agreed payment date |
| scheduled_amount | NUMERIC(15,2) | NO | amount due on this date |
| exchange_rate | NUMERIC(10,4) | NO | PEN per USD at transaction date, default 3.70 |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Feeds `v_obligation_calendar`** as a second UNION source (type = 'loan'). Payment status per entry is derived from `SUM(payments) WHERE related_to = 'loan_schedule'`.

**Repayments** are tracked in the universal `payments` table with `related_to = 'loan_schedule'` and `related_id = loan_schedule.id`. This follows the same pattern as invoice payments.

---

## Layer 7 — Project Budgets

### `project_budgets`
Budget targets per project per category. Compared against actual invoices from `v_invoice_totals` in the `v_budget_vs_actual` view. Budget is set when a project starts and can be updated — changes should be noted.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| category | VARCHAR | NO | FK to categories.name (project_cost categories only) |
| budgeted_amount | NUMERIC(15,2) | NO | |
| currency | VARCHAR(3) | NO | USD or PEN |
| is_active | BOOLEAN | NO | default true, soft delete |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Category values** reference `categories.name` via FK — only project_cost categories are used for budgets.

---

## Complete Table List — Final

**17 tables total:**

```
Layer 1 (no dependencies):
  partner_companies
  bank_accounts
  entities
  exchange_rates
  categories

Layer 2 (depends on Layer 1):
  tags
  entity_tags
  entity_contacts
  projects

Layer 3 (depends on Layer 1 + 2):
  project_partners
  quotes

Layer 4 (depends on Layer 3):
  invoices
  invoice_items

Layer 5 (child records):
  payments

Layer 6 (loans):
  loans
  loan_schedule

Layer 7 (project extensions):
  project_budgets
```

---

## Database Views — Complete List

**Existing views (10 — built and deployed):**

| View | Source Tables | Purpose |
|---|---|---|
| `v_invoice_totals` | invoices + invoice_items | subtotal, igv, detraccion, retencion, total per invoice (both directions) |
| `v_invoice_balances` | v_invoice_totals + payments | amount_paid, outstanding, payment_status per invoice |
| `v_obligation_calendar` | v_invoice_balances + loan_schedule | unpaid/partial obligations (invoices + loans) sorted by due date |
| `v_invoices_with_loans` | v_invoice_balances + loan_schedule | all invoices + loan entries (all statuses) with aging buckets |
| `v_payments_enriched` | payments + invoices + loan_schedule + loans | payments with parent context (invoice/loan details) |
| `v_bank_balances` | payments grouped by bank_account | running balance per account |
| `v_igv_position` | v_invoice_totals | IGV collected vs paid, net position per currency |
| `v_retencion_dashboard` | v_invoice_totals (direction = 'receivable') | retencion tracking and verification status |
| `v_loan_balances` | loans + loan_schedule + payments | borrowed, total owed, paid, outstanding, derived status per loan |
| `v_budget_vs_actual` | project_budgets + invoice_items + invoices | budgeted vs actual per project per category |

**Skipped views (computed in application layer instead):**

| View | Reason |
|---|---|
| `v_cash_flow` | Multi-table aggregation with category breakdown and currency conversion too complex for a single SQL view. Computed in `queries.ts`. |
| `v_project_pl` / `v_company_pl` | P&L views existed early on but were dropped. The system operates on a cash basis — no accrual-based P&L page. |
| `v_partner_ledger` | Settlement logic is computed in application layer (`queries.ts`) using `v_invoice_totals` directly. Dropped in migration `20260312000001`. |

---

## Key Design Rules — Summary

- **Never store what can be derived.** Totals, balances, and payment status are always calculated via views.
- **Never hard delete reference data.** Reference/master tables (partner_companies, bank_accounts, entities, entity_contacts, tags, projects, categories, project_budgets) and the `project_partners` bridge table use `is_active` soft deletes. Transaction tables (invoices, invoice_items, payments, loans, loan_schedule) and historical reference tables (quotes) are permanent records — errors are corrected via reversing entries, never deletion.
- **Informality is supported everywhere.** entity_id, comprobante fields, and document_ref are nullable on invoices.
- **Currency is never converted at storage.** Always stored in natural currency (USD or PEN). Exchange rate is mandatory (NOT NULL) on all financial tables, stored at the historical rate per transaction. Conversion happens at the application layer for reporting. Payment currency must match the parent document currency.
- **IGV, detraccion, and retencion are tracked separately** on every relevant transaction from day one.
- **Partner is explicit** on invoices and payments via `partner_company_id`. Bank accounts belong only on payments (cash movements), not on invoices.
- **Tags serve all classification needs** — entity categorization and project roles use the same master list.
- **Partner balances are derived** from invoices (via `partner_company_id` and `direction`) + payments per project. No separate settlement table.

---

**Comprobante types — full list:**
- `factura` — VAT invoice, full IGV credit
- `boleta` — consumer receipt, igv_rate = 0, deductible
- `recibo_por_honorarios` — professional services invoice, igv_rate = 0, deductible
- `liquidacion_de_compra` — buying from individuals without RUC, IGV credit possible
- `planilla_jornales` — day labor register, igv_rate = 0, deductible with documentation
- `none` — truly informal, igv_rate = 0, non-deductible risk

The comprobante type tells the accountant why IGV is zero without affecting any calculations. `igv_rate = 0` naturally excludes informal costs from IGV credit — no special boolean or filter needed.

---

*Layers 1-7 locked. All migrations written in `supabase/migrations/` and views in `supabase/views/`.*
