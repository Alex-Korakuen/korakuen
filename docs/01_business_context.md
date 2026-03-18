# Korakuen — Company Handbook

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active — living document, update as the company evolves

---

## 1. Company Overview

**Korakuen** is a Peruvian construction company founded in February 2026, specializing in small-scale civil works. Current core specializations include roads, sidewalks, and small police modules (módulos policiales of one to three floors). The company is open to branching into other small civil works of similar scale as opportunities arise.

The company is positioned to take on two types of work: executing portions of larger projects as a subcontractor, and leading public infrastructure projects independently under Peru's Obras por Impuesto (OxI) framework.

**Strategic positioning:** Korakuen deliberately targets projects under USD 10 million in value. This keeps the company nimble, operations manageable for a lean three-partner structure, and avoids the political exposure and regulatory complexity that accompany larger public contracts in Peru. Small civil works under OxI are numerous, less contested, and highly repeatable once the processes are established.

Korakuen is built from day one with a focus on financial discipline, structured documentation, and operational visibility — capabilities that are rare in small construction companies and that compound in value over time.

---

## 2. Partner Structure

Korakuen operates as a collaboration between three independent companies, each owned by one partner. There is no consolidated legal entity, no formal written agreement between the companies, and no joint venture structure — the collaboration exists on a verbal agreement and mutual trust between the three partners. Each company operates fully independently for legal, tax, and invoicing purposes.

### The Partners

**Partners 1 & 2 — Civil Engineers**
Two partners with backgrounds in civil engineering and construction. They bring technical expertise in project execution, site management, and construction methodology. One of the two has prior experience working directly with government contracts and understands the OxI framework from the execution side.

**Partner 3 — Finance (Alex)**
Background in equity research and financial analysis. CFA certified with over 5 years of experience in financial modeling, valuation, and strategic planning. Responsible for financial structure, cost tracking, cash flow management, reporting, and the design of the company's internal management systems.

### How the Collaboration Works

- Each partner operates their own fully independent legal company
- All projects are executed jointly across the three partners under a verbal agreement
- Each project has an agreed **profit share percentage** per partner (stored in `project_partners`), which must total 100%
- During execution, costs are paid by whichever partner has available cash — **not necessarily proportional** to profit share %
- **Project profit** = project income - project costs (SG&A excluded — SG&A belongs to the individual partner)
- **Each partner's profit** = project profit × their profit share %
- **Settlement** at project close: each partner receives costs_they_paid + their profit share. Who owes whom depends on how costs were actually split vs the agreed profit %
- Settlements target project close, with weekly balancing attempts during execution
- Invoicing to clients is done per partner company — whoever provided the service issues the invoice

### Decision Making
To be defined formally. At inception, decisions are made collaboratively among all three partners.

### Note on Legal Structure
The absence of a formal written agreement between the three companies is the current operating reality. This is common in early-stage collaborations in Peru but carries inherent risk — particularly around dispute resolution, contribution obligations, and project liability. This is documented here as-is, with no immediate action required.

---

## 3. Types of Projects

### 3.1 Subcontractor Projects
Korakuen is contracted by a larger prime contractor to execute a defined portion of a bigger project — typically a specific civil works scope within a larger infrastructure program. The client is a private company. Billing and payment terms are governed by the contract with the prime contractor.

**Characteristics:**
- Lower regulatory complexity
- Client is a private company
- Faster payment cycles than government projects
- Scope is defined by the prime contractor
- Lower commercial risk — Korakuen executes a defined scope, does not own the client relationship

### 3.2 Obras por Impuesto (OxI) Projects
Korakuen leads the project as prime contractor under Peru's OxI framework, where private companies execute public infrastructure works in exchange for tax credits from the Peruvian government (administered through ProInversión). Current specializations within OxI include roads, sidewalks, and small police modules.

**Characteristics:**
- Higher regulatory complexity — strict compliance with OxI rules and ProInversión requirements
- Client is effectively a government entity
- Notoriously slow payment cycles — 60 to 90+ days is common
- Korakuen owns the full client relationship and project delivery
- Higher commercial and execution risk, but higher margin potential
- Requires rigorous documentation, permits, and government interaction throughout
- One partner has prior direct experience navigating this framework — a key competitive advantage

### 3.3 Project Size Policy
Korakuen deliberately limits itself to projects **under USD 10 million** in total value. This is a strategic decision — not a capability limitation — to remain outside the media and political attention that larger public contracts attract in Peru, and to keep operations lean and manageable for the current team structure.

---

## 4. Project Lifecycle

### 4.1 Typical Phases

**Prospecting**
Identifying opportunities — either being approached by a prime contractor for subcontractor work, or identifying a public project eligible for OxI participation and securing the financing company relationship.

**Quoting & Estimation**
Requesting quotes from suppliers and subcontractors. Building cost estimates for the scope of work. Evaluating feasibility and margin. This phase generates reference data that improves future estimates over time.

**Contract**
Formalizing the agreement. For OxI, this involves ProInversión, the financing company, and the beneficiary government entity. For subcontractor work, this is a commercial contract with the prime contractor.

**Execution**
Active construction on site. Costs are incurred continuously — materials purchased, labor engaged, subcontractors deployed, equipment rented. All costs are registered in the management system and tagged to monthly valuation periods.

**Monthly Valuation**
At the end of each month, the quantity of completed work is measured and assigned a monetary value. This valuation triggers an invoice to the client. This is the standard billing model in Peruvian construction.

**Collection**
Following up on issued invoices. Tracking payment receipt. Managing the gap between invoice date and actual payment — especially critical with government clients under OxI.

**Project Close**
Final valuation, final invoice, partner settlement calculation, and full project documentation archiving in SharePoint.

### 4.2 Billing Model
Korakuen uses a **monthly valuation model**. There are no predefined milestones that trigger billing. Each month's completed work is measured, valued, and invoiced. Payment follows after the invoice — timing varies significantly by client type.

---

## 5. Finance & Accounting

### 5.1 Responsibility
Alex (Partner 3) leads all financial structuring, cost tracking, cash flow management, and internal reporting. External formal accounting (SUNAT compliance, tax filing, payroll) is handled by a licensed external accountant.

### 5.2 Currencies
All transactions are denominated in either **USD or PEN (Peruvian Soles)**. Both currencies are actively used depending on the contract, supplier, and project type. Amounts are always stored in their original currency.

### 5.3 IGV
IGV (Impuesto General a las Ventas) is Peru's VAT, currently at 18%. It is tracked as a separate field on every financial transaction — purchases, costs, and invoices issued. This is non-negotiable from day one and feeds directly to the external accountant for tax filing.

### 5.4 Management vs. Formal Accounting
Korakuen maintains two parallel layers of financial record-keeping:

**Management accounting (internal):** The company's own database system, tracking costs, invoices, collections, payments, and partner balances in real time. Used for operational decisions, cash flow management, project control, and partner settlements.

**Formal accounting (external):** Handled by a licensed accountant. Covers SUNAT-compliant electronic invoicing, tax declarations, payroll, and official financial statements. Tools used include Alegra or Contasis.

The internal system captures sufficient detail on every transaction to make the external accountant's job straightforward — reducing accounting fees and avoiding reconstructing records from scratch.

### 5.5 Cash Flow Discipline
Given slow government payment cycles and the capital-intensive nature of construction, cash flow management is a top operational priority. Korakuen tracks:
- Upcoming payment obligations (AP) on a day-by-day basis
- Outstanding collections (AR) with aging analysis
- Net cash position per project and consolidated across all active projects

### 5.6 Partner Settlement
At project close, project profit (income minus project costs, excluding SG&A) is calculated and distributed according to each partner's agreed profit share percentage. Each partner should net: costs_they_paid + (profit × their %). Inter-partner transfers settle any difference between what each partner actually received from income and what they should have received. During project execution, partners aim to balance expenditure on a weekly basis to avoid large settlements at close.

---

## 6. Legal & Compliance

### 6.1 Company Structure
Three independent legal entities (one per partner) collaborate under a verbal agreement and mutual trust. Each company has its own RUC (Peruvian tax ID) and operates independently for invoicing and tax purposes. There is no consolidated holding entity, no formal written agreement between the companies, and no joint venture structure at inception.

### 6.2 SUNAT Compliance
All formal invoicing must comply with SUNAT's electronic invoicing requirements (comprobantes de pago electrónicos — facturas and boletas). This is handled per partner company by the external accountant using dedicated tools. The internal management system captures the data needed to support this but does not replace it.

### 6.3 Obras por Impuesto (OxI) Framework
OxI projects are governed by Law 29230 and its regulations, administered through ProInversión. Key compliance requirements include:

- Project identification, structuring, and registration through ProInversión
- Engagement with a financing company (empresa privada financiadora) who fronts the investment in exchange for tax credits
- Strict documentation of all work executed, with government supervision at defined stages
- Approval by the beneficiary government entity upon completion
- Issuance of tax credit certificates (CIPRL for national government, CIPGN for local government) upon final approval

One partner's direct prior experience with OxI compliance is a significant competitive differentiator.

### 6.4 Construction Permits & Regulatory
All construction projects require appropriate permits from municipal and sector authorities. Permit management is the responsibility of the civil engineer partners, with all permit documents archived in SharePoint under the relevant project folder.

---

## 7. HR & Subcontractor Management

### 7.1 Workforce Model
Korakuen does not maintain a permanent workforce at inception. Labor is engaged per project — either directly (day workers, specialists) or through subcontractors who manage their own teams.

### 7.2 Direct Labor
When engaging workers directly on site, the company is responsible for:
- **SCTR** (Seguro Complementario de Trabajo de Riesgo) — mandatory work accident insurance for all construction workers on site. This is a legal requirement and a significant cost line in any construction project.
- Formal labor contracts per Peruvian labor law
- Correct payroll, social benefits (CTS, gratificaciones, vacaciones), and AFP/ONP contributions, handled by the external accountant

### 7.3 Subcontractors
A significant portion of specialized work is subcontracted to external firms or individuals. Subcontractor management involves:
- Requesting and comparing at least two to three quotes before engagement
- Formal written subcontract agreements for every engagement
- Tracking subcontractor invoices as AP with due dates
- Quality and progress oversight during execution (civil engineer partners)
- Maintaining a database of reliable subcontractors by specialty and region

### 7.4 Supplier Management
Materials and equipment are sourced from suppliers. Key practices:
- Always request competing quotes before committing to a purchase
- Register all quotes received — including rejected ones — for future price reference
- Maintain a contacts database of reliable suppliers by category and region
- Track unit prices over time to improve future cost estimation accuracy

---

## 8. Client & Government Relations

### 8.1 Private Clients (Subcontractor Projects)
Clients are typically prime contractors or private companies executing larger infrastructure or construction programs. Relationships are managed commercially. Contract terms govern scope, billing, and payment. Communication is primarily between the project manager (civil engineer partners) and the client's project supervisor.

### 8.2 Government & OxI Relations
OxI projects involve interaction with multiple parties simultaneously:

- **ProInversión** — the government agency administering the OxI framework, responsible for project registration, approval, and certificate issuance
- **The financing company** — the private company investing in the project in exchange for tax credits. They are effectively a key stakeholder and must be kept informed throughout execution.
- **The beneficiary government entity** — the municipality, regional government, or ministry receiving the infrastructure. Their technical team supervises work and must sign off at key stages.

Government relations require patience, rigorous documentation discipline, and deep understanding of bureaucratic processes. One partner's prior experience is a key asset here.

### 8.3 Contact Management
All clients, suppliers, subcontractors, and government contacts are maintained in the company's central contacts database. A contact is registered once and reused across projects. The same entity can play different roles across different projects (e.g. a company that is a supplier on one project may be a subcontractor on another).

---

## 9. Document Management

### 9.1 File Storage
All physical and digital documents are stored in a single **SharePoint Team Site** named Korakuen. SharePoint is a file cabinet only — all business information derived from documents lives in the management database. SharePoint holds the physical file. The database holds the information.

There is no Microsoft Teams setup. SharePoint is accessed directly via browser or mobile app. All team communication happens via WhatsApp.

All three partners have full equal access to the SharePoint site. There are no permission restrictions between partners.

### 9.2 Folder Structure
```
Korakuen (SharePoint Team Site)
└── Documents
    ├── Projects
    │   └── PRY001-ProjectName
    │       ├── 01-Contracts
    │       ├── 02-QuotesReceived
    │       ├── 03-InvoicesReceived
    │       ├── 04-InvoicesSent
    │       ├── 05-PermitsRegulatory
    │       ├── 06-TechnicalDocuments
    │       └── 07-Correspondence
    └── Company
        ├── LegalCorporate
        ├── Accounting
        │   └── 2026
        └── InternalDocumentation
            └── SystemDocs
```

A new project folder following this exact structure is created every time a project is opened in the management system.

### 9.3 Naming Convention
- **PascalCase** for all folder names — no spaces, no accents, no special characters
- **English** throughout for consistency with the database and codebase
- **Hyphens** only to separate a code from a name (e.g. `PRY001-ProjectName`)
- **Numbered prefixes** on project subfolders for consistent sort order

### 9.4 Document Reference Convention
Every document linked to a database record is named using a standardized reference code:

**Format:** `[PROJECT_CODE]-[DOCTYPE]-[NUMBER].pdf`

| Code | Type |
|---|---|
| CT | Contract |
| AP | Invoice Received |
| AR | Invoice Sent |
| QT | Quote Received |
| PM | Permit |
| CR | Correspondence |

**Example:** `PRY001-AP-003.pdf` = third AP invoice on project PRY001

This code is stored in the database record, linking the physical file to the business information permanently. Any document can be found by searching SharePoint for its reference code.

For full detail on file storage, workflows, and mobile filing, see `07_file_storage.md`.

### 9.5 Task Management
Day-to-day tasks during project execution are managed in **Todoist**. The management system does not replicate task management.

---

## 10. Internal Systems

Korakuen maintains a custom internal management system for operational visibility. It is not an ERP or CRM — it is a structured PostgreSQL database with a Next.js website on Vercel for visualization and data entry (including Excel-based bulk imports), built specifically for Korakuen's operational reality.

For full technical detail, refer to:
- `02_system_architecture.md` — technology stack and key design decisions
- `03_module_specifications.md` — what the system tracks and how each module works
- `04_visualization.md` — dashboards and views available on the website
- `06_tech_evolution.md` — how the system will evolve from V0 (foundation) through V1 (website) to V2 (mobile + automation)

---

*This handbook describes Korakuen as it exists at founding on February 28, 2026. It is a living document — update it as the company grows, roles are formalized, and processes evolve.*
