# Module Specifications

**Document version:** 3.0
**Date:** March 13, 2026
**Status:** Active — schema fully locked, see 08_schema.md

---

## Overview

The system is organized around a central invoices table with supporting reference tables. The diagram below shows the relationships:

```
                    ENTITIES
                    (+ Contacts)
                        |
                        | referenced by all financial records
                        |
PROJECT ─────────────────────────────────────
   |              |              |
INVOICES       QUOTES         LOANS
+ INVOICE_ITEMS  |           + LOAN_SCHEDULE
(payable &    links to        (repayments)
receivable)   INVOICES           |
   |          when accepted      |
   └─────────────────────────────┘
                  |
              PAYMENTS (unified — AP, AR, and loan repayments)
```

**Calendar and Financial Position are views/queries, not tables.** They are derived from the Invoices, Payments, and Loans tables and displayed on the visualization website.

---

## Module 1: Projects

**Purpose:** The anchor for all other data. Every invoice and quote belongs to a project. The project code drives the document naming convention throughout SharePoint.

**Business rules:**
- Every project gets a unique sequential code: PRY001, PRY002, PRY003...
- This code is used in all document filenames: `PRY001-AP-001.pdf`
- A project must exist before invoices or quotes can be registered against it
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

### 2.4 Informality Support
Transactions do not require an entity to be assigned. An unassigned transaction has a null entity_id. This supports:
- Informal suppliers with no RUC
- Small cash purchases
- Unknown payees
- Early registration before entity details are available

The visualization website shows "unassigned expenses" as a separate filterable category.

---

## Module 3: Invoices (Unified — Payable & Receivable)

**Purpose:** The central transaction table. Every commercial document — both expenses (payable) and income (receivable) — lives in one `invoices` table with a `direction` column. Line items live in `invoice_items`. Over time, payable invoice items become a historical unit price database for future estimation.

**V1 unification:** Previously two separate tables (`costs` + `ar_invoices`). Merged in V1 into `invoices` with `direction = 'payable' | 'receivable'`, and `cost_items` became `invoice_items` serving both directions.

**Business rules:**
- `direction` column: `'payable'` (expense) or `'receivable'` (income)
- Project field is nullable — null means SG&A (company-level expense, not tied to a project)
- **SG&A invoices belong exclusively to the individual partner who incurred them** — excluded from project profit/settlement calculations
- Every invoice records the partner (`partner_id`, FK to entities tagged as partner)
- Quantity and unit price on line items enable historical unit price analysis
- IGV, detraccion, and retencion tracked separately on every invoice
- Currency must be specified (USD or PEN) — never converted at storage
- Exchange rate mandatory (NOT NULL) — stored at transaction date for application-layer conversion
- Entity field is nullable — supports informal/unassigned expenses
- Comprobante fields are nullable — supports expenses without formal invoices
- A payable invoice can reference a quote (`quote_id`) when the purchase was preceded by a quote
- `purchase_order_id` reserved for future PO module — always null
- Retencion only applies on receivables (Korakuen is NOT a retencion agent)

**Categories (on `invoice_items`, not header):**

Project Costs: Materials, Labor, Subcontractor, Equipment / Rental, Permits / Regulatory, Other

SG&A: Software & Licenses, Partner Compensation, Business Development, Professional Services, Office & Admin, Other

**Key attributes — `invoices` header:**
- Invoice ID (system generated)
- Direction: payable or receivable
- Partner (references Entities — must be tagged as partner)
- Project (nullable — null if SG&A)
- Entity (nullable — references Entities)
- Quote reference (nullable — references Quotes)
- Purchase order reference (nullable — reserved for future PO module)
- Invoice number (nullable)
- Document reference code (nullable, e.g. PRY001-AP-001)
- Comprobante type (nullable): Factura, Boleta, Recibo por Honorarios, None
- Invoice date
- Due date (nullable — feeds calendar)
- Currency: USD or PEN
- Exchange rate (mandatory NOT NULL)
- IGV rate (default 18%, editable)
- Detraccion rate % (nullable, editable)
- Retencion rate % (nullable — only on receivables)
- Notes

**Key attributes — `invoice_items` (line items, one or many per invoice):**
- Line item title
- Category (references categories table)
- Quantity
- Unit of measure (nullable)
- Unit price

**Derived via database views (never stored on invoices header):**
- Subtotal — SUM of invoice_items (quantity × unit_price)
- IGV amount — subtotal × igv_rate
- Detraccion amount — total × detraccion_rate
- Retencion amount — total × retencion_rate (receivables only)
- Total — subtotal + igv_amount
- Amount paid, outstanding, payment status — from payments table

**Connects to:** Projects, Entities, Quotes

---

## Module 4: Quotes Received

**Purpose:** Price references gathered from suppliers and subcontractors before committing to a purchase. Accepted quotes link to the resulting invoice. Rejected quotes remain permanently as market reference data.

**Business rules:**
- Every quote is linked to a project and an entity
- A quote can be accepted, rejected, or pending
- When accepted, the quote links to the invoice it generated
- The difference between quoted price and actual invoice is visible by joining the two records
- Multiple competing quotes for the same scope should all be registered
- Quotes are never deleted — even rejected ones are valuable reference data

**Quote status:**
- Pending — received, decision not yet made
- Accepted — purchase proceeded, linked to an invoice
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
- Linked invoice ID (nullable — populated when accepted)
- Document reference code (nullable, e.g. PRY001-QT-001)
- Notes / reason for rejection

**Connects to:** Projects, Entities, Invoices

---

## Module 5: AR — Accounts Receivable

**Merged into Module 3 (Invoices).** Receivable invoices are now `invoices` rows with `direction = 'receivable'`. See Module 3 for the unified schema. All AR-specific tax fields (retencion_rate) live on the same `invoices` table.

**Peruvian tax fields on receivables:**
```
Invoice gross (subtotal + IGV):        S/ 118,000
Detraccion (editable %, e.g. 4%):      S/   4,720  → Banco de la Nación
Retencion (3% if client is agent):     S/   3,540  → paid to SUNAT by client
────────────────────────────────────────────────────
Net receivable to regular account:     S/ 109,740
```

Payments against receivables use `payments` with `related_to = 'invoice'`, `direction = 'inbound'`.

---

## Module 6: Bank Accounts

**Purpose:** Tracks bank accounts used by all three partners for project transactions. All accounts are fully tracked in the system — every payment references a bank account.

**Business rules:**
- Every payment references a bank account
- Every collection references a bank account
- Banco de la Nación detraccion account is a special account type
- Balance is calculated dynamically from transactions — never stored as a static field
- All partner accounts are tracked for project-related transactions (invoice payments, collections, loan repayments)
- Partner account balances reflect only project transactions visible in the system — not full personal banking activity

**Account types:**
- Regular checking (BCP, Interbank, BBVA, Scotiabank, etc.)
- Savings
- Banco de la Nación — Detracciones (special — receives detraccion deposits)

**Key attributes:**
- Account ID
- Account holder (partner entity)
- Bank name
- Account number (last 4 digits for reference)
- Account type
- Currency: USD or PEN
- Is detraccion account: Yes / No
- Active: Yes / No

**Connects to:** Payments (all cash movements reference a bank account)

---

## Module 7: Partner Settlement (Computed in Application Layer)

**Purpose:** Shows each partner's financial position per project — what they contributed, what profit they're owed, and who owes whom for settlement.

**How it works:**
This is not a database table or SQL view — it is computed in the application layer (`queries/settlement.ts`) from `v_invoice_totals` grouped by `partner_id` per project. SG&A and intercompany invoices (`cost_type = 'intercompany'`) are excluded from settlement totals — intercompany invoices are settlement transfers between partners that would distort project economics if counted. No data is stored separately. The calculation is always current because it reads directly from source data. Settlement is displayed on the dedicated Settlement dashboard page (`/settlement`), which supports aggregating balances across multiple selected projects.

**Direct transactions:** Partners' informal cash payments (no comprobante) are recorded via auto-generated invoices (`is_auto_generated = true`) with an immediate payment. These appear in settlement calculations identically to formal invoices. They can be promoted to formal invoices later when the comprobante arrives.

**What the view shows:**

```
PROJECT PRY001 — Punta Hermosa
─────────────────────────────────────────────────────────────
Contributions (project costs only, SG&A excluded):
Partner 1 (Empresa A)     S/  100,000   18.87%  (contribution %)
Partner 2 (Empresa B)     S/  200,000   37.74%  (contribution %)
Partner 3 (Alex — Korak)  S/  230,000   43.40%  (contribution %)
─────────────────────────────────────────────────────────────
Total Project Costs        S/  530,000  100.00%

Total Income (AR)          S/  600,000
─────────────────────────────────────────────────────────────
Project Profit             S/   70,000

Agreed Profit Share:
Partner 1 (20%)           S/   14,000
Partner 2 (50%)           S/   35,000
Partner 3 (30%)           S/   21,000

Settlement (each partner should receive = costs_paid + profit_share):
Partner 1                 S/  114,000   (100,000 + 14,000)
Partner 2                 S/  235,000   (200,000 + 35,000)
Partner 3                 S/  251,000   (230,000 + 21,000)
                          ─────────────
                          S/  600,000   (= total income)
```

Note: contribution % reflects how costs were actually split during execution. Profit share % is the agreed split from `project_partners.profit_share_pct` — these are independent.

**Connects to:** v_invoice_totals (source data — both directions), Payments (source data), Project Partners (profit share %)

---

## Module 8: Loans

**Purpose:** Tracks loans taken by any partner to fund project operations. Each loan belongs to a partner via `partner_id` (FK to entities tagged as partner). All loan data is visible — no access restrictions.

**Business rules:**
- Every loan records the lender, amount, terms (percentage or fixed return), and which partner borrowed (`partner_id`)
- Business rule: 10% return on loans — borrower keeps the spread between agreed return and what they pay the lender
- A loan can optionally be linked to a project it funded
- Return can be percentage-based (e.g. 8%) or a fixed agreed amount
- Repayments use the universal `payments` table with `related_to = 'loan_schedule'` — same pattern as invoice payments
- Every repayment must be against a schedule entry (create one first for ad-hoc payments)
- Loan schedule entries feed `v_obligation_calendar` as a UNION source (type = 'loan')
- Loans are permanent financial records — no soft delete via `is_active`

**Loan status (derived in `v_loan_balances`, not stored):**
- Active — no payments made
- Partially Paid — some repayments made
- Settled — fully repaid

**Key attributes — `loans` (header):**
- Loan ID (system generated)
- Partner (references Entities — must be tagged as partner — which partner borrowed)
- Entity ID (nullable — references Entities, the lender)
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
- Notes

**Key attributes — `loan_schedule` (agreed repayment schedule):**
- Schedule entry ID
- Loan (references Loans)
- Scheduled date
- Scheduled amount
- Exchange rate

**Repayments:** Tracked in universal `payments` table (`related_to = 'loan_schedule'`, `related_id = loan_schedule.id`, `direction = 'outbound'`, `payment_type = 'regular'`).

**Derived via database views:**
- Total owed (principal + return) — via `v_loan_balances`
- Total paid — SUM from payments where related_to = 'loan_schedule'
- Outstanding balance — total owed minus total paid
- Status — derived from payment totals (active/partially_paid/settled)
- Per-entry outstanding — derived from SUM of payments per schedule entry

**Connects to:** Projects (optional), Bank Accounts (indirectly via AP Calendar)

---

## Module 9: Exchange Rates

**Purpose:** Daily SUNAT USD/PEN exchange rates. Lookup/reference table used during data entry to suggest rates and for reporting conversions. Not linked via FK to any financial table — financial tables store their own `exchange_rate` at transaction time.

**Business rules:**
- One row per day — `rate_date` is unique
- Stores buy rate (banco compra), sell rate (banco venta), and mid rate ((buy + sell) / 2)
- Mid rate is used for everything in the management system
- Source defaults to 'SUNAT'
- Exchange rates are historical facts — no `is_active`, never deactivated or deleted

**Key attributes:**
- Rate date (unique — one per day)
- Buy rate (SUNAT banco compra)
- Sell rate (SUNAT banco venta)
- Mid rate (calculated as (buy + sell) / 2 before insert)
- Source (default 'SUNAT')

**Data management:** Exchange rates are managed directly via the Supabase Dashboard (SQL Editor or table editor), not via Excel import. This is the only module without Excel import capability — rates are simple single-row inserts that don't justify a template workflow.

**Connects to:** All financial tables (indirectly — provides suggested rates during data entry, not via FK)

---

## Cross-Module Business Rules

- A project must exist before invoices or quotes can be registered against it
- An entity must exist before being referenced in any transaction — but transactions can have null entity
- Invoices with null project are SG&A — they belong to the individual partner who incurred them and are excluded from project profit/settlement calculations
- Invoice totals (subtotal, IGV, detraccion, retencion, total) are always derived from invoice_items via database views (`v_invoice_totals`) — never stored on the invoices header. Payment status derived via `v_invoice_balances`
- Currency is always stored in natural currency — amounts are never converted at storage
- Exchange rate is mandatory (NOT NULL) on all financial tables, stored per transaction at the historical rate. Enables application-layer conversion for reporting — no conversion occurs at storage. Payment currency must match the parent document currency
- Document reference codes follow the format `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]` — see `07_file_storage.md`

---

## What This System Does NOT Include

- Payroll (handled by external accountant)
- SUNAT electronic invoicing (handled by Alegra/Contasis)
- Formal chart of accounts (handled by external accountant)
- Task management (handled by Todoist)
- File storage (handled by SharePoint)
- Purchase orders (quotes link directly to invoices via reference field)

---

*Schema is fully locked — see `docs/08_schema.md` for definitive field names and table structures.*
