# Construction Company Management System — Project Documentation

**Document version:** 1.0  
**Date:** February 28, 2026  
**Status:** Planning / Pre-schema

---

## 1. Context & Background

A small construction company based in Peru, currently composed of three partners (each with their own separate legal entity) who collaborate on projects together and split costs proportionally. The company has just been founded and needs a structured system to track business operations from day one.

The goal is to build institutional memory and operational visibility — not to replace formal accounting tools.

---

## 2. Business Reality

### Types of Projects
There are two distinct project types:

- **Subcontractor:** The company is hired by a larger firm to execute a portion (typically ~10%) of a bigger telecom infrastructure project.
- **Obras por Impuesto (OxI):** The company leads the project as prime contractor, executing public infrastructure works in exchange for tax credits under Peru's OxI framework.

### Partner Structure
Three partners, each operating under their own company, collaborate on every project. Cost splitting is proportional — not necessarily equal thirds — based on how much each partner actually contributes financially to each project. Settlements happen approximately at the end of each project, with weekly balancing attempts during execution.

### Financial Environment
- Dual currency: **USD and PEN (Peruvian Soles)**
- **IGV** (Peruvian VAT) must be tracked on every financial transaction from day one to support the external accountant
- Government clients (especially OxI) are known for slow payment cycles — tracking payment timing is critical

---

## 3. System Philosophy

- **Build institutional memory from day one.** Every cost registered becomes future reference data for estimating the next project more accurately.
- **Don't reinvent the wheel.** Use existing tools for what they're best at — the database complements them, not replaces them.
- **Start simple, add complexity later.** The MVP must be completable and useful without becoming an engineering undertaking.
- **The database is the product.** The interface is just a data entry mechanism; Power BI is the visualization layer.

---

## 4. Technology Stack

| Layer | Tool | Reason |
|---|---|---|
| Database | PostgreSQL on Supabase | Robust, Power BI native connection, free tier available |
| Data Entry | Python CLI scripts | Simple, low complexity, no UI to build |
| Visualization | Power BI | Native PostgreSQL connector, handles dashboards and reporting |
| File Storage | SharePoint | Handles versioning, access control, no need to build file management |
| Task Management | Todoist | Existing tool, no need to replicate in the system |

### Document Reference Convention
Files are stored in SharePoint and referenced in the database via a **naming convention code**, not a URL link. This avoids broken links if files are reorganized.

**Format:** `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]`  
**Example:** `PRY001-AP-001` refers to the first AP invoice on project PRY001.

SharePoint folder structure mirrors the database: `Project → Document Type → File`

---

## 5. Modules & Scope

### 5.1 Projects
The center of everything. Every other module connects to a project.

**Key attributes:**
- Project type (Subcontractor or OxI)
- Client (linked to Contacts)
- Status and dates
- Budget and currency
- Partner companies involved

---

### 5.2 Contacts
A rolodex of every external entity the company interacts with. A single contact can play multiple roles across different projects.

**Types of contacts:**
- Clients (private companies or government entities)
- Suppliers (materials, equipment)
- Subcontractors
- Government entities

Referenced throughout every other module.

---

### 5.3 Costs
The institutional memory of the business. Every expense incurred during a project is registered here with enough detail to serve as future estimating reference.

**Key attributes:**
- Project
- Category: Materials, Labor, Subcontractor, Equipment/Rental, Overhead/Admin
- Supplier/contact
- Quantity, unit, unit price, total amount
- Currency (USD or PEN)
- IGV amount
- Which partner company paid
- Valuation tag (e.g. Valuation #1) for grouping
- Document reference code (links to SharePoint)

Over time, this table becomes a historical unit price database by material, supplier, and project type.

---

### 5.4 Quotes Received
Price references gathered before committing to a purchase or subcontract. Stores competitive quotes for comparison and future reference.

**Key attributes:**
- Project
- Contact (supplier or subcontractor)
- Description of scope or item
- Quantity, unit, unit price
- Currency
- Status: Accepted / Rejected / Pending
- Document reference code

Accepted quotes eventually become Costs. Rejected quotes remain as market reference data.

---

### 5.5 Valuations
Monthly billing buckets that group costs for invoicing purposes. Replaces the concept of "milestones" to match actual construction billing practice in Peru.

Each month, all costs incurred are tagged to a valuation (e.g. Valuation #1, #2). At the end of the month, the valuation is closed and triggers an AR invoice to the client.

**Key attributes:**
- Project
- Valuation number and period (e.g. January 2026)
- Status: Open / Closed
- Total value invoiced

---

### 5.6 AR — Accounts Receivable (Money In)
Invoices sent to clients, triggered by closed valuations. Tracks what is owed to the company and when it was actually collected.

**Key attributes:**
- Project and valuation
- Client contact
- Issuing partner company
- Invoice number and date
- Due date
- Amount, currency, IGV
- Payment status: Pending / Partial / Paid
- Collection records (date and amount received)
- Document reference code

Key insight: tracks the gap between invoice date and actual collection date — critical for managing cash flow with slow-paying government clients.

---

### 5.7 AP — Accounts Payable (Money Out)
Invoices received from suppliers and subcontractors. Tracks what the company owes and when it must be paid.

**Key attributes:**
- Project
- Supplier/subcontractor contact
- Receiving partner company
- Invoice number and date
- Due date
- Amount, currency, IGV
- Payment status: Pending / Partial / Paid
- Payment records (date and amount paid)
- Document reference code

**Key Power BI view:** A day-by-day cash outflow calendar showing upcoming payment obligations across all projects, so the company always knows what must be paid and when.

---

### 5.8 Partner Ledger
Tracks each partner's financial contribution per project and calculates proportional ownership stakes in real time. Enables settlement calculations at project close.

**How it works:**
- Every Cost record has a "paid by" field identifying which partner company covered the expense
- The ledger aggregates contributions per partner per project
- Ownership stake = each partner's contribution / total project costs
- Inter-partner balances show who owes what to whom at any settlement point

This module is what makes the joint venture structure financially transparent and fair.

---

## 6. What This System Does NOT Do

- **SUNAT / formal tax accounting:** A licensed accountant and a compliant invoicing tool (e.g. Alegra, Contasis) are still required for electronic invoicing and tax filings.
- **Task management:** Stays in Todoist.
- **File storage:** Stays in SharePoint.
- **Automatic reminders or notifications:** Not in MVP scope.
- **Payroll:** Out of scope.

---

## 7. Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Database architecture | Single shared database with `company` field per record | One source of truth for all three partners; consolidated and per-company views in Power BI |
| IGV tracking | Captured on every financial transaction | Feeds accountant directly; non-negotiable from day one |
| Quantity & unit price | Captured on all Costs and Quotes | Enables historical unit price analysis for future estimates |
| Document management | SharePoint + naming convention | No broken links, no file storage complexity to build |
| Billing model | Monthly Valuations (not milestone-based) | Matches actual construction billing practice in Peru |
| Interface complexity | CLI Python scripts only | Avoids UI complexity; Power BI handles all visualization |
| File linking | Reference code, not URL | Resilient to SharePoint reorganization |

---

## 8. Next Steps

- [ ] Design database schema (tables, fields, relationships) in plain language for review
- [ ] Validate schema with partner input
- [ ] Write SQL to create tables
- [ ] Build Python CLI scripts for each data entry operation
- [ ] Connect Power BI to Supabase PostgreSQL
- [ ] Define initial Power BI reports: cost breakdown, AR aging, AP payment calendar, partner ledger
- [ ] Consult accountant on required fields per transaction for SUNAT compatibility

---

*This document reflects decisions made during the initial planning session. It will be updated as the schema and implementation are defined.*
