# Module Specifications

**Document version:** 2.1
**Date:** March 3, 2026
**Status:** Active — schema fully locked, see 08_schema.md

---

## Overview

The system is organized around a central costs/transactions table with supporting reference tables. The diagram below shows the relationships:

```
                    ENTITIES
                    (+ Contacts)
                        |
                        | referenced by all financial records
                        |
PROJECT ─────────────────────────────────────────────
   |              |              |              |
COSTS          QUOTES        VALUATIONS      AR INVOICES
+ COST_ITEMS (received)    (billing periods)  (income)
(expenses)        |              |              |
                  └──── links to COSTS when accepted
                                 |              |
                              PAYMENTS (unified — both AP and AR)
```

**Partner Ledger, AP Calendar, and Settlement Dashboard are views, not tables.** They are derived from the Costs, AR Invoices, and Payments tables and displayed on the visualization website.

---

## Module 1: Projects

**Purpose:** The anchor for all other data. Every cost, invoice, quote, and valuation belongs to a project. The project code drives the document naming convention throughout SharePoint.

**Business rules:**
- Every project gets a unique sequential code: PRY001, PRY002, PRY003...
- This code is used in all document filenames: `PRY001-AP-001.pdf`
- A project must exist before costs, quotes, valuations, or AR invoices can be registered against it
- Projects are never deleted — set to Cancelled if abandoned
- Contract value (what the client will pay total) is stored here — this is the revenue ceiling
- Contract value is editable as scope changes during execution

**Key attributes:**
- Project code (PRY001, PRY002... — system generated)
- Project name
- Project type: Subcontractor or OxI
- Status: Prospect, Active, Completed, Cancelled
- Client (references Entities)
- Contract value and currency
- Start date and expected end date
- Location / region in Peru
- Notes

**Connects to:** All other modules

---

## Module 2: Entities & Contacts

### 2.1 Entities (master table)
**Purpose:** The legal and tax identity of every external party Korakuen does business with. Registered once, referenced everywhere. Can be a formal company or an individual person.

**Business rules:**
- An entity is registered once and reused across all projects and transactions
- Entity type determines the identifier: companies have RUC, individuals have DNI
- The same entity can play different roles across different projects (supplier on one, subcontractor on another)
- Transactions reference entities — RUC and Razón Social are never stored directly on transaction records
- An entity can exist without any transactions — just being in the rolodex is valuable

**Entity types:**
- Company (Empresa) — has RUC and Razón Social
- Individual (Persona Natural) — has DNI and full name

**Key attributes:**
- Entity ID (system generated)
- Entity type: Company or Individual
- RUC (if company) or DNI (if individual)
- Razón Social (if company) or Full Name (if individual)
- City (nullable — e.g. "Arequipa", enables geographic filtering)
- Region (nullable — Peruvian department)
- Category tags (see 2.3)
- Notes

Contact details (phone, email, address) are stored in `entity_contacts`, not on the entity itself.

### 2.2 Contacts (associated people)
**Purpose:** People associated with an entity. The salesperson, project manager, or owner you actually deal with. Optional — not required to transact.

**Business rules:**
- A contact always belongs to an entity
- A contact is never the direct recipient of a transaction — the entity is
- Multiple contacts can exist per entity
- A contact can be associated with specific projects to track who participated

**Key attributes:**
- Contact ID
- Entity (references Entities)
- Full name
- Role / title
- Phone
- Email
- Notes

### 2.3 Entity Categorization (tags)
**Purpose:** Multi-tag classification system allowing flexible filtering. An entity can have multiple tags simultaneously.

**Example tags:**
- Cement supplier
- Iron supplier
- Aggregates supplier
- Electrical subcontractor
- Civil subcontractor
- Equipment rental
- Legal services
- Accounting services
- Government entity
- OxI financing company
- Client

**Business rules:**
- Tags are not exclusive — one entity can have many tags
- Tags are user-defined and can be extended as needed
- Filtering: "show me all entities tagged as cement suppliers"

### 2.4 Project-Entity Relationships
**Purpose:** Tracks which entities participated in which projects and in what role on that specific project.

**Example:** Pepe's Iron Company may be a general materials supplier (entity tag) but on PRY001 specifically they acted as the main steel subcontractor (project role).

**Key attributes:**
- Project (references Projects)
- Entity (references Entities)
- Role on this project (free text or predefined)

### 2.5 Informality Support
Transactions do not require an entity to be assigned. An unassigned transaction has a null entity_id. This supports:
- Informal suppliers with no RUC
- Small cash purchases
- Unknown payees
- Early registration before entity details are available

The visualization website shows "unassigned expenses" as a separate filterable category.

---

## Module 3: Costs (Expense Transactions)

**Purpose:** The central transaction table and institutional memory of the business. Every peso spent — on projects or on running the company — is registered here. Over time this becomes a historical unit price database for future estimation.

**Business rules:**
- Project field is nullable — null means SG&A (company-level expense, not tied to a project)
- Every cost records who paid it (which partner company) and from which bank account
- Quantity and unit price are required for material purchases — enables historical unit price analysis
- IGV is tracked separately on every cost
- Currency must be specified (USD or PEN) — never converted at storage
- Exchange rate mandatory (NOT NULL) — stored at transaction date for application-layer conversion
- Detracciones tracked when applicable — rate editable per transaction
- Entity field is nullable — supports fully informal/unassigned expenses
- Comprobante fields are nullable — supports expenses without formal invoices
- A cost can reference a quote (when the purchase was preceded by a quote)
- A cost is tagged to a valuation period when it belongs to a billable project period

**Cost Type (Level 1):**
- Project Cost — tagged to a specific project
- SG&A — company-level expense, no project

**Cost Category (Level 2) — Project Costs:**
- Materials
- Labor
- Subcontractor
- Equipment / Rental
- Permits / Regulatory
- Other

**Cost Category (Level 2) — SG&A:**
- Software & Licenses
- Partner Compensation
- Business Development (meals, travel, entertainment)
- Professional Services (accountant, lawyer, legal)
- Office & Admin
- Other

**Key attributes — `costs` header:**
- Cost ID (system generated)
- Date
- Cost type: Project Cost or SG&A
- Project (nullable — null if SG&A)
- Valuation (nullable — references Valuations table)
- Bank account paid from (references Bank Accounts — partner derived from this)
- Entity (nullable — references Entities)
- Quote reference (nullable — references Quotes if this cost originated from a quote)
- Purchase order reference (nullable — reserved for future PO module, always null in V0)
- IGV rate (default 18%, editable)
- Detraccion rate % (nullable, editable)
- Currency: USD or PEN
- Exchange rate (mandatory NOT NULL — stored at historical rate per transaction, enables application-layer conversion)
- Comprobante type (nullable): Factura, Boleta, Recibo por Honorarios, Liquidación de Compra, Planilla de Jornales, None
- Comprobante number (nullable, e.g. F001-00234)
- Document reference code (nullable, e.g. PRY001-AP-001)
- Due date (nullable — feeds AP calendar)
- Payment method (nullable): bank_transfer, cash, check — indicates payment channel

**Key attributes — `cost_items` (line items, one or many per cost):**
- Line item title
- Category (Level 2 — see above)
- Quantity (nullable)
- Unit of measure (nullable)
- Unit price (nullable)
- Subtotal (quantity × unit price or entered directly)
- Notes (nullable)

**Derived via database views (never stored on costs header):**
- Subtotal — SUM of cost_items subtotals
- IGV amount — subtotal × igv_rate
- Detraccion amount — total × detraccion_rate
- Total — subtotal + igv_amount
- Amount paid, outstanding, payment status — from payments table

**Connects to:** Projects, Entities, Valuations, Bank Accounts, Quotes

---

## Module 4: Quotes Received

**Purpose:** Price references gathered from suppliers and subcontractors before committing to a purchase. Accepted quotes link to the resulting cost record. Rejected quotes remain permanently as market reference data.

**Business rules:**
- Every quote is linked to a project and an entity
- A quote can be accepted, rejected, or pending
- When accepted, the quote links to the cost record it generated
- The difference between quoted price and actual cost is visible by joining the two records
- Multiple competing quotes for the same scope should all be registered
- Quotes are never deleted — even rejected ones are valuable reference data

**Quote status:**
- Pending — received, decision not yet made
- Accepted — purchase proceeded, linked to a cost record
- Rejected — not used, kept as reference

**Key attributes:**
- Quote ID (system generated)
- Date received
- Project (references Projects)
- Entity (references Entities)
- Title (scope or item quoted)
- Quantity (nullable)
- Unit of measure (nullable)
- Unit price (nullable)
- Subtotal
- IGV amount (nullable)
- Total
- Currency: USD or PEN
- Exchange rate (reference)
- Status: Pending, Accepted, Rejected
- Linked cost ID (nullable — populated when accepted)
- Document reference code (nullable, e.g. PRY001-QT-001)
- Notes / reason for rejection

**Connects to:** Projects, Entities, Costs

---

## Module 5: Valuations

**Purpose:** Monthly billing periods that group project costs for invoicing. Each valuation represents one billing cycle and triggers one AR invoice to the client.

**Business rules:**
- Valuations are sequential per project: 1, 2, 3... (integer, no prefix)
- Each valuation covers a specific month and year
- Costs are tagged to a valuation at registration time
- When a valuation is closed, it triggers creation of an AR invoice
- A closed valuation cannot be modified
- The billed value may differ from total costs — depends on contract measurement
- One AR invoice per valuation

**Key attributes (stored):**
- Valuation ID (system generated)
- Valuation number (sequential integer per project — 1, 2, 3...)
- Project (references Projects)
- Period: month and year (e.g. January 2026)
- Status: Open, Closed
- Billed value (the amount actually invoiced — may differ from cost total)
- Billed currency
- Date closed (nullable — populated when status changes to closed)
- Notes

**Derived dynamically (never stored):**
- Total costs tagged to this valuation — SUM from costs table

**Note:** AR invoice ID is not stored on valuations — the AR invoice references the valuation instead, avoiding a circular dependency.

**Connects to:** Projects, Costs (via tag), AR Invoices

---

## Module 6: AR — Accounts Receivable

**Purpose:** Invoices sent to clients. Tracks the full lifecycle from invoice issuance to collection, including all Peruvian tax withholdings. Kept as a separate table from Costs because income and expenses have fundamentally different structures and must be separated for a clean P&L.

**Business rules:**
- Every AR invoice is linked to a project and a valuation
- The issuing partner company is recorded — each partner invoices independently
- IGV, detraccion, and retencion are all tracked separately
- Partial collections are supported — multiple collection records per invoice
- Full payment confirmed only when total collected equals net receivable
- Korakuen is NOT a retencion agent — retenciones only appear on the AR (income) side
- Detraccion is deposited to Banco de la Nación — tracked as a special account

**Peruvian tax fields on AR:**
```
Invoice gross (subtotal + IGV):        S/ 118,000
Detraccion (editable %, e.g. 4%):      S/   4,720  → Banco de la Nación
Retencion (3% if client is agent):     S/   3,540  → paid to SUNAT by client
────────────────────────────────────────────────────
Net receivable to regular account:     S/ 109,740
```

**Key attributes (stored):**
- AR ID (system generated)
- Project (references Projects)
- Valuation (references Valuations)
- Bank account (references Bank Accounts — regular receipt account)
- Issuing partner company (references Partner Companies)
- Client entity (references Entities)
- Invoice number (own numbering from Alegra/Contasis)
- Comprobante type: Factura
- Invoice date
- Due date (nullable)
- Subtotal (entered directly from valuation billed value)
- IGV rate (default 18%, editable)
- Detraccion rate % (nullable, editable)
- Retencion applicable: Yes/No
- Retencion rate (default 3% if applicable)
- Currency: USD or PEN
- Exchange rate (mandatory NOT NULL — stored at historical rate per transaction, enables application-layer conversion)
- Is internal settlement: Yes/No (flags partner-to-partner invoices)
- Document reference code (nullable, e.g. PRY001-AR-001)
- Notes

**Derived via database views (never stored):**
- IGV amount — subtotal × igv_rate
- Gross total — subtotal + igv_amount
- Detraccion amount — gross_total × detraccion_rate
- Retencion amount — gross_total × retencion_rate
- Net receivable — gross_total - detraccion_amount - retencion_amount
- Amount paid, outstanding, payment status — from payments table

**Payments (via unified payments table):**
Actual money received against this AR invoice is recorded in the `payments` table with `related_to = 'ar_invoice'`. Multiple payment records per invoice are supported — regular transfer, detraccion deposit to Banco de la Nación, and retencion withheld by client. Payment status and outstanding balance are always derived dynamically from the payments table via database views.

**Connects to:** Projects, Valuations, Entities, Bank Accounts

---

## Module 7: Bank Accounts

**Purpose:** Tracks bank accounts used by the partners for project transactions. Full tracking for Alex's accounts. Reference only for partner accounts.

**Business rules:**
- Every cost payment references a bank account
- Every AR collection references a bank account
- Banco de la Nación detraccion account is a special account type
- Balance is calculated dynamically from transactions — never stored as a static field
- Alex's accounts: full in/out tracking, reconcilable against bank statements
- Partner accounts: registered for reference only — balance calculated from net project contributions

**Account types:**
- Regular checking (BCP, Interbank, BBVA, Scotiabank, etc.)
- Savings
- Banco de la Nación — Detracciones (special — receives detraccion deposits)

**Key attributes:**
- Account ID
- Account holder (partner company)
- Bank name
- Account number (last 4 digits for reference)
- Account type
- Currency: USD or PEN
- Is detraccion account: Yes / No
- Tracking level: Full (Alex) or Reference (partners)
- Active: Yes / No
- Notes

**Connects to:** Costs (paid from), Payments (received into)

---

## Module 8: Partner Ledger (View, Not a Table)

**Purpose:** Shows each partner's financial contribution per project, calculates proportional ownership stakes, and displays inter-partner balances for settlement.

**How it works:**
This is not a database table — it is a view derived entirely from the Costs table (via bank_account → partner_company) and AR Invoices + Payments tables per project. No data is stored separately. The view is always current because it reads directly from source data.

**What the view shows:**

```
PROJECT PRY001 — Punta Hermosa
─────────────────────────────────────────────
Partner 1 (Empresa A)     S/  100,000   18.87%
Partner 2 (Empresa B)     S/  200,000   37.74%
Partner 3 (Alex — Korak)  S/  230,000   43.40%
─────────────────────────────────────────────
Total Expenses             S/  530,000  100.00%

Total Income (AR Collected) S/  600,000
─────────────────────────────────────────────
Net Profit                  S/   70,000

Income Distribution:
Partner 1                  S/   13,208   18.87%
Partner 2                  S/   26,415   37.74%
Partner 3                  S/   30,377   43.40%
```

**Partner Settlements:**
When partners settle up, one partner company issues a formal AR invoice to another partner company using the standard `ar_invoices` flow. The invoice is flagged with `is_internal_settlement = true`. Payment flows through the `payments` table as normal. No separate settlement table exists.

**Connects to:** Costs (source data), AR Invoices + Payments (source data)

---

## Module 9: Loans (Private — Alex Only)

**Purpose:** Tracks private loans Alex takes from friends, family, or informal lenders to fund project operations. These are personal financial obligations — never visible to partners.

**Business rules:**
- Every loan records the lender, amount, and terms (percentage or fixed return)
- A loan can optionally be linked to a project it funded
- Return can be percentage-based (e.g. 8%) or a fixed agreed amount
- Repayments are tracked separately from business payments — uses `loan_payments` table, not `payments`
- Loan schedule entries feed `v_ap_calendar` as a UNION source (type = 'loan_payment') — only visible to Alex
- Loans are permanent financial records — no soft delete via `is_active`

**Loan status:**
- Active — loan is outstanding
- Partially Paid — some repayments made
- Settled — fully repaid

**Key attributes — `loans` (header):**
- Loan ID (system generated)
- Lender name
- Lender contact (nullable — phone or email)
- Amount (principal borrowed)
- Currency: USD or PEN
- Exchange rate
- Date borrowed
- Project (nullable — references Projects, which project this funded)
- Purpose (freeform description)
- Return type: percentage or fixed
- Agreed return rate % (nullable — e.g. 8.00)
- Agreed return amount (nullable — if fixed instead of %)
- Due date (nullable — overall repayment deadline)
- Status: active, partially_paid, settled
- Notes

**Key attributes — `loan_schedule` (agreed repayment schedule, optional):**
- Schedule entry ID
- Loan (references Loans)
- Scheduled date
- Scheduled amount
- Exchange rate
- Paid (boolean, default false)
- Actual payment ID (nullable — references loan_payments when settled)

**Key attributes — `loan_payments` (actual repayments):**
- Payment ID
- Loan (references Loans)
- Payment date
- Amount
- Currency: USD or PEN
- Exchange rate
- Source (nullable): project_settlement, personal_funds, other
- Settlement reference (nullable — e.g. PRY001-Settlement-1, links repayment to profit event)
- Notes

**Derived via database views:**
- Total owed (principal + return) — via `v_loan_balances`
- Total paid — SUM from loan_payments
- Outstanding balance — total owed minus total paid

**Connects to:** Projects (optional), Bank Accounts (indirectly via AP Calendar)

---

## Cross-Module Business Rules

- A project must exist before costs, quotes, valuations, or AR invoices can be registered
- An entity must exist before being referenced in any transaction — but transactions can have null entity
- Costs with null project are SG&A — they appear in the company P&L but not in any project P&L
- Cost totals (subtotal, IGV, total) are always derived from cost_items via database views — never stored on the costs header. AR invoice calculated fields (igv_amount, gross_total, detraccion_amount, retencion_amount, net_receivable) are also derived via views, never stored
- Currency is always stored in natural currency — amounts are never converted at storage
- Exchange rate is mandatory (NOT NULL) on all financial tables, stored per transaction at the historical rate. Enables application-layer conversion for reporting — no conversion occurs at storage. Payment currency must match the parent document currency
- Document reference codes follow the format `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]` — see `07_file_storage.md`
- Valuations are sequential integers per project (1, 2, 3...) and never reset
- Closed valuations cannot be modified

---

## What This System Does NOT Include

- Payroll (handled by external accountant)
- SUNAT electronic invoicing (handled by Alegra/Contasis)
- Formal chart of accounts (handled by external accountant)
- Task management (handled by Todoist)
- File storage (handled by SharePoint)
- Purchase orders (quotes link directly to costs via reference field)

---

*Schema is fully locked — see `docs/08_schema.md` for definitive field names and table structures.*
