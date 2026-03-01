# Database Schema

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Fully locked — ready for SQL generation

---

## Overview

PostgreSQL database hosted on Supabase. All tables use UUID primary keys. Soft deletes via `is_active` or `active` boolean — records are never hard deleted. Every table has `created_at` and `updated_at` timestamps.

**Table count:** 13 tables total across 5 layers.

```
Layer 1: partner_companies, bank_accounts, entities
Layer 2: tags, entity_tags, entity_contacts, projects
Layer 3: project_entities, valuations, quotes
Layer 4: costs, cost_items, ar_invoices
Layer 5: payments
```

---

## Conventions

- **Primary keys:** UUID, system generated
- **Soft deletes:** `is_active BOOLEAN DEFAULT true` on every table — never hard delete records
- **Timestamps:** `created_at` auto-set on insert, `updated_at` auto-updated on any change
- **Currency:** always stored in natural currency (USD or PEN), never converted at storage
- **Exchange rate:** stored as reference per transaction, never used for conversion at storage
- **Nullable fields:** explicitly noted — absence of a value is valid business data (informality support)
- **Document codes:** follow format `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]` — see `07-FileStorage.md`

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
| account_type | VARCHAR | NO | checking, savings, detraccion |
| currency | VARCHAR(3) | NO | USD or PEN |
| is_detraccion_account | BOOLEAN | NO | true for Banco de la Nación detracción accounts |
| is_active | BOOLEAN | NO | default true, soft delete |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** Full balance tracking for Alex's accounts. Reference only for partner accounts — balance derived from net project contributions.

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
| common_name | VARCHAR | YES | how you refer to them day to day |
| is_active | BOOLEAN | NO | default true, soft delete |
| notes | TEXT | YES | free text |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** Individual entities (DNI holders) follow Option B — they always have at least one `entity_contacts` record representing themselves, flagged as primary. This keeps phone/email consistent across all entity types.

---

## Layer 2 — Depends on Layer 1

### `tags`
Master list of all valid categorization tags. Referenced by `entity_tags`. Updatable anytime — adding a new tag here makes it available for assignment.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| name | VARCHAR | NO | unique, snake_case e.g. "cement_supplier" |
| description | VARCHAR | YES | explains what the tag means |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Initial tags to seed:**
- cement_supplier
- iron_supplier
- aggregates_supplier
- electrical_subcontractor
- civil_subcontractor
- equipment_rental
- legal_services
- accounting_services
- government_entity
- oxi_financing_company
- client
- general_supplier

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
| is_primary | BOOLEAN | NO | flags the main contact for this entity |
| is_active | BOOLEAN | NO | default true, soft delete |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Rule:** Every entity must have at least one contact record flagged `is_primary = true`. For individual entities, this record represents the individual themselves.

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
| created_at | TIMESTAMP | NO | auto set on insert |
| updated_at | TIMESTAMP | NO | auto updated on change |

**Note:** Project code is auto-generated sequentially (PRY001, PRY002...) at insert time. Never manually assigned, never reused even if a project is cancelled.

---

## Layer 3 — Locked

### `project_entities`
Bridge table linking entities to projects with a specific role. Answers "who participated in this project" and "which projects did this entity participate in." Role references the master `tags` table — no separate roles table needed.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| entity_id | UUID | NO | references entities |
| tag_id | UUID | NO | references tags — the role on this project |
| start_date | DATE | YES | when entity started on this project |
| end_date | DATE | YES | when entity finished on this project |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

---

### `valuations`
Monthly billing periods per project. Groups costs for invoicing. Each valuation eventually triggers one AR invoice. Total costs under a valuation are always derived dynamically from the costs table — never stored as a calculated field.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| valuation_number | INTEGER | NO | sequential per project — 1, 2, 3... |
| period_month | INTEGER | NO | 1-12 |
| period_year | INTEGER | NO | e.g. 2026 |
| status | VARCHAR | NO | open, closed |
| billed_value | NUMERIC(15,2) | YES | amount actually invoiced — may differ from total costs |
| billed_currency | VARCHAR(3) | YES | USD or PEN |
| date_closed | DATE | YES | populated when status changes to closed |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Note:** `ar_invoice_id` is not stored here — the AR invoice references the valuation instead, avoiding a circular dependency.

---

### `quotes`
Quotes received from suppliers and subcontractors before committing to a purchase. Accepted quotes link to the cost record they generated, enabling quote vs actual price comparison.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| entity_id | UUID | NO | references entities |
| date_received | DATE | NO | |
| description | TEXT | NO | what was quoted |
| quantity | NUMERIC(15,4) | YES | |
| unit_of_measure | VARCHAR | YES | meters, units, hours, kg, etc. |
| unit_price | NUMERIC(15,4) | YES | |
| subtotal | NUMERIC(15,2) | NO | |
| igv_amount | NUMERIC(15,2) | YES | |
| total | NUMERIC(15,2) | NO | |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | YES | reference only |
| status | VARCHAR | NO | pending, accepted, rejected |
| linked_cost_id | UUID | YES | references costs — populated when accepted |
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

*Tags are addable anytime via CLI. Nothing is locked — the list grows with operational experience.*

---

## Layer 4 — Locked

### `costs` (header)
One row per invoice or cash movement. Holds all financial context, tax, and document fields. Totals and payment status are never stored — always derived via database views.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | YES | references projects — null if SG&A |
| valuation_id | UUID | YES | references valuations — null if SG&A or untagged |
| bank_account_id | UUID | NO | references bank_accounts — partner derived from this |
| entity_id | UUID | YES | references entities — null if informal/unassigned |
| quote_id | UUID | YES | references quotes — null if no prior quote |
| purchase_order_id | UUID | YES | reserved for future PO module — null in V0, will reference purchase_orders table |
| cost_type | VARCHAR | NO | project_cost or sga |
| date | DATE | NO | when the expense occurred |
| description | TEXT | NO | overall invoice or expense description |
| igv_rate | NUMERIC(5,2) | NO | default 18, editable per invoice |
| detraccion_rate | NUMERIC(5,2) | YES | percentage, editable per invoice, null if not applicable |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | YES | reference only — amounts never converted at storage |
| comprobante_type | VARCHAR | YES | factura, boleta, recibo_por_honorarios |
| comprobante_number | VARCHAR | YES | e.g. F001-00234 |
| document_ref | VARCHAR | YES | e.g. PRY001-AP-001 — links to SharePoint PDF |
| due_date | DATE | YES | feeds AP payment calendar |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Derived via database views (never stored):**
- `subtotal` — SUM of all cost_items subtotals
- `igv_amount` — subtotal × igv_rate
- `detraccion_amount` — (subtotal + igv_amount) × detraccion_rate
- `total` — subtotal + igv_amount
- `amount_paid` — SUM of payments against this cost
- `outstanding` — total - amount_paid
- `payment_status` — unpaid / partial / paid

---

### `cost_items` (line items)
One or many rows per cost. Holds the detail of what was purchased. Category lives here — not on the header — enabling cost analysis by category across mixed invoices.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| cost_id | UUID | NO | references costs |
| description | TEXT | NO | line item description |
| category | VARCHAR | NO | see categories below |
| quantity | NUMERIC(15,4) | YES | null for lump sum lines |
| unit_of_measure | VARCHAR | YES | meters, units, hours, kg, days, etc. |
| unit_price | NUMERIC(15,4) | YES | null for lump sum lines |
| subtotal | NUMERIC(15,2) | NO | quantity × unit_price or entered directly |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Categories — Project Cost:**
- materials
- labor
- subcontractor
- equipment_rental
- permits_regulatory
- other

**Categories — SG&A:**
- software_licenses
- partner_compensation
- business_development
- professional_services
- office_admin
- other

**Query pattern:**
- Header info (who, when, account, document) → query `costs`
- Detail info (what, quantity, unit price, category) → query `cost_items`
- Category breakdown per project → `cost_items` JOIN `costs`

---

### `ar_invoices`
Invoices sent to clients. One per valuation. Subtotal entered directly — no line items table since AR invoices are simple (1-2 lines per valuation). Totals and payment status derived via views.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| project_id | UUID | NO | references projects |
| valuation_id | UUID | NO | references valuations |
| bank_account_id | UUID | NO | references bank_accounts — regular receipt account |
| entity_id | UUID | NO | references entities — the client |
| partner_company_id | UUID | NO | references partner_companies — who issued invoice |
| invoice_number | VARCHAR | NO | own numbering from Alegra/Contasis |
| comprobante_type | VARCHAR | NO | always factura for construction AR |
| invoice_date | DATE | NO | |
| due_date | DATE | YES | |
| subtotal | NUMERIC(15,2) | NO | entered directly from valuation billed value |
| igv_rate | NUMERIC(5,2) | NO | default 18 |
| detraccion_rate | NUMERIC(5,2) | YES | editable, null if not applicable |
| retencion_applicable | BOOLEAN | NO | default false |
| retencion_rate | NUMERIC(5,2) | YES | default 3 if applicable — Korakuen is NOT a retencion agent |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | YES | reference only |
| document_ref | VARCHAR | YES | e.g. PRY001-AR-001 |
| is_internal_settlement | BOOLEAN | NO | default false — true when invoicing a partner company |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Derived via database views (never stored):**
- `igv_amount` — subtotal × igv_rate
- `gross_total` — subtotal + igv_amount
- `detraccion_amount` — gross_total × detraccion_rate
- `retencion_amount` — gross_total × retencion_rate
- `net_receivable` — gross_total - detraccion_amount - retencion_amount
- `amount_paid` — SUM of payments against this invoice
- `outstanding` — net_receivable - amount_paid
- `payment_status` — unpaid / partial / paid

---

### Database Views — Layer 4

| View | Source | Purpose |
|---|---|---|
| `cost_totals` | cost_items | subtotal, igv, detraccion, total per cost |
| `cost_balances` | costs + payments | amount_paid, outstanding, payment_status per cost |
| `ar_balances` | ar_invoices + payments | amount_paid, outstanding, payment_status per AR invoice |

---

## Layer 5 — Locked

### `payments`
The unified payments table. Every actual movement of money — both inbound and outbound — lives here. Multiple payments can reference the same cost or AR invoice, supporting partial payments, detracción splits, and retención withholdings.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | UUID | NO | primary key |
| related_to | VARCHAR | NO | cost or ar_invoice |
| related_id | UUID | NO | the specific cost or AR invoice ID |
| direction | VARCHAR | NO | inbound or outbound |
| payment_type | VARCHAR | NO | regular, detraccion, retencion |
| payment_date | DATE | NO | when payment was made or received |
| amount | NUMERIC(15,2) | NO | in natural currency |
| currency | VARCHAR(3) | NO | USD or PEN |
| exchange_rate | NUMERIC(10,4) | YES | reference only |
| bank_account_id | UUID | YES | nullable — retencion never hits an account |
| partner_company_id | UUID | NO | which partner's account was involved — required because retencion has no bank account |
| notes | TEXT | YES | |
| created_at | TIMESTAMP | NO | auto |
| updated_at | TIMESTAMP | NO | auto |

**Payment examples:**

Paying a supplier invoice of S/ 11,800:
```
row 1: outbound | cost_id | detraccion | S/    590 | Banco de la Nación
row 2: outbound | cost_id | regular    | S/ 11,210 | BCP account
```

Client pays your AR invoice of S/ 118,000:
```
row 1: inbound | ar_invoice_id | detraccion | S/   4,720 | Banco de la Nación
row 2: inbound | ar_invoice_id | retencion  | S/   3,540 | null — withheld by client, paid to SUNAT
row 3: inbound | ar_invoice_id | regular    | S/ 109,740 | Interbank account
```

---

## Partner Settlements — No Separate Table

Partner settlements are formal invoices between partner companies — not a separate module. Each partner company is registered as an entity in the `entities` table (they have their own RUC). When it's time to settle, one partner issues an AR invoice to another partner using the normal `ar_invoices` flow.

The `ar_invoices` table has one additional field to identify internal settlements:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| is_internal_settlement | BOOLEAN | NO | default false — true when invoicing a partner company |

Payment of the settlement flows through the `payments` table as normal.

**The partner settlement dashboard** on the visualization website derives everything from existing data:
- `costs` grouped by `bank_account_id` → partner contributions
- `ar_invoices` + `payments` → income collected
- `ar_invoices` filtered by `is_internal_settlement = true` → settlement invoices and status

No extra table. No extra module. One dashboard view.

---

## Complete Table List — Final

**13 tables total:**

```
Layer 1 (no dependencies):
  partner_companies
  bank_accounts
  entities

Layer 2 (depends on Layer 1):
  tags
  entity_tags
  entity_contacts
  projects

Layer 3 (depends on Layer 2):
  project_entities
  valuations
  quotes

Layer 4 (depends on Layer 3):
  costs
  cost_items
  ar_invoices

Layer 5 (child records):
  payments
```

---

## Database Views — Complete List

| View | Source Tables | Purpose |
|---|---|---|
| `cost_totals` | cost_items | subtotal, igv, detraccion, total per cost |
| `cost_balances` | costs + payments | amount_paid, outstanding, payment_status per cost |
| `ar_balances` | ar_invoices + payments | amount_paid, outstanding, payment_status per AR invoice |
| `ap_calendar` | costs + cost_balances | unpaid/partial costs sorted by due date |
| `partner_ledger` | costs + ar_invoices + payments | contributions, stakes, income distribution per project |
| `entity_transactions` | costs + ar_invoices filtered by entity | all transactions per entity per project |
| `bank_balances` | payments grouped by bank_account | running balance per account |
| `project_pl` | ar_invoices + costs per project | income, costs, gross profit per project |
| `company_pl` | all projects + SG&A costs | consolidated P&L including SG&A |
| `settlement_dashboard` | ar_invoices (is_internal_settlement=true) | partner settlement invoices and status |

---

## Key Design Rules — Summary

- **Never store what can be derived.** Totals, balances, and payment status are always calculated via views.
- **Never hard delete.** All tables use soft deletes via `is_active BOOLEAN DEFAULT true`.
- **Informality is supported everywhere.** entity_id, comprobante fields, and document_ref are nullable on costs.
- **Currency is never converted at storage.** Always stored in natural currency (USD or PEN). Exchange rate is a reference field only.
- **IGV, detraccion, and retencion are tracked separately** on every relevant transaction from day one.
- **Partner is derived from bank_account** on costs. Partner is explicit on ar_invoices and payments.
- **Tags serve all classification needs** — entity categorization and project roles use the same master list.
- **Partner settlements are AR invoices** flagged with is_internal_settlement = true. No separate table.

---

*Schema is fully locked. Next step: write SQL CREATE TABLE statements for all 13 tables and views.*

---

## Views (Derived, No Extra Tables)

| View | Source Tables | Purpose |
|---|---|---|
| AP Payment Calendar | costs + payments | Upcoming payment obligations by due date |
| Partner Ledger | costs grouped by partner_company | Contribution and ownership stake per project |
| Company P&L | ar_invoices + costs | Income vs expenses vs SG&A |
| Entity Transaction History | costs + ar_invoices filtered by entity | All transactions per entity per project |
| Bank Account Balances | payments grouped by bank_account | Running balance per account |
| Quote vs Actual | quotes joined to costs | Quoted price vs actual cost comparison |
| Unit Price History | costs filtered by quantity/unit_price | Historical unit prices by item and supplier |

---

*This document is updated layer by layer as schema decisions are locked. Do not write SQL until all layers are defined and validated.*
