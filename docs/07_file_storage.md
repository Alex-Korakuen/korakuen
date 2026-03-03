# File Storage & SharePoint Structure

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active

---

## 1. Overview

Korakuen uses a single **SharePoint Team Site** as its file cabinet. All documents — contracts, invoices, permits, technical drawings, correspondence — are stored here as physical files (PDFs, scanned documents, Word files, etc.).

SharePoint is a file storage system only. All business information derived from those documents (invoice amounts, due dates, costs, contacts) lives in the management database and is accessed through the visualization website. SharePoint holds the physical file. The database holds the information.

**There is no Teams setup.** SharePoint is accessed directly via browser at `sharepoint.com` or through the SharePoint mobile app. All team communication happens via WhatsApp.

---

## 2. SharePoint Site

| Setting | Value |
|---|---|
| Site type | Team Site |
| Site name | Korakuen |
| Members | All three partners (full access) |
| Permissions | All members have equal read/write access |

One site only. No separate sites per project, per company, or per partner.

---

## 3. Naming Convention

All folder and file names follow these rules:

- **PascalCase** for all folder names — no spaces, no special characters, no accents
- **Hyphens** only to separate a code from a name (e.g. `PRY001-ProjectName`)
- **English** throughout — for consistency with the database and codebase
- **No accents or special characters** — so `Permits` not `Permisos`, `Regulatory` not `Regulatorio`
- **Numbered prefixes** on project subfolders — so they always sort in logical order regardless of alphabetical sorting

**File naming:** follows the document reference convention defined in the database — `[PROJECT_CODE]-[DOCTYPE]-[NUMBER]` (e.g. `PRY001-AP-001.pdf`). See Section 5 for full reference.

---

## 4. Folder Structure

### 4.1 Root Level

```
Korakuen (Team Site)
└── Documents
    ├── Projects
    └── Company
```

### 4.2 Projects

Each project gets its own folder created when the project is opened in the system. The folder name uses the project code and a short name with no spaces.

```
Projects/
└── PRY001-ProjectName/
    ├── 01-Contracts
    ├── 02-QuotesReceived
    ├── 03-InvoicesReceived
    ├── 04-InvoicesSent
    ├── 05-PermitsRegulatory
    ├── 06-TechnicalDocuments
    └── 07-Correspondence
```

**Subfolder purpose:**

| Folder | Contents |
|---|---|
| 01-Contracts | Signed contracts with clients, subcontractors, and suppliers |
| 02-QuotesReceived | Quote documents received from suppliers and subcontractors |
| 03-InvoicesReceived | AP invoices — bills received from suppliers and subcontractors |
| 04-InvoicesSent | AR invoices — bills sent to clients |
| 05-PermitsRegulatory | Municipal permits, OxI documentation, government sign-offs, regulatory approvals |
| 06-TechnicalDocuments | Engineering plans, specifications, site drawings, progress reports |
| 07-Correspondence | Formal letters, emails saved as PDF, official communications |

### 4.3 Company

Holds everything that belongs to Korakuen as an entity, not tied to any specific project.

```
Company/
├── LegalCorporate/
│   ├── CompanyFormation/
│   └── PartnerAgreements/
├── Accounting/
│   └── 2026/
│       ├── TaxDeclarations/
│       ├── BankStatements/
│       └── AccountantReports/
└── InternalDocumentation/
    └── SystemDocs/
        ├── 01-BusinessContext.md
        ├── 02-SystemArchitecture.md
        ├── 03-ModuleSpecifications.md
        ├── 04-Visualization.md
        ├── 05-Roadmap.md
        ├── 06-TechEvolution.md
        ├── 07-FileStorage.md
        ├── 08-Schema.md
        ├── 09-DevRoadmap.md
        ├── 10-CodingStandards.md
        ├── 11-EnvironmentSetup.md
        └── CLAUDE.md
```

**Folder purpose:**

| Folder | Contents |
|---|---|
| LegalCorporate | Each partner company's formation documents, RUC certificates, any formal agreements |
| PartnerAgreements | Any written agreements between the three partner companies if formalized in the future |
| Accounting/[Year] | Tax declarations, bank statements, and reports from the external accountant — organized by year |
| InternalDocumentation/SystemDocs | All internal system and company documentation — this file and its siblings |

---

## 5. Document Reference Convention

Every document stored in SharePoint that is linked to a database record uses a standardized reference code as its filename. This code is also stored in the database record, allowing the physical file to always be found by searching SharePoint.

**Format:** `[PROJECT_CODE]-[DOCTYPE]-[NUMBER].pdf`

| DOCTYPE Code | Document Type |
|---|---|
| CT | Contract |
| AP | Invoice Received (Accounts Payable) |
| AR | Invoice Sent (Accounts Receivable) |
| QT | Quote Received |
| PM | Permit |
| CR | Correspondence |

**Examples:**

| Filename | Meaning |
|---|---|
| `PRY001-AP-001.pdf` | First AP invoice received on project PRY001 |
| `PRY001-AR-002.pdf` | Second AR invoice sent on project PRY001 |
| `PRY002-QT-001.pdf` | First quote received on project PRY002 |
| `PRY001-CT-001.pdf` | First contract on project PRY001 |

**Numbering** is sequential per document type per project, starting at 001. Numbers never reset — even if a document is deleted, its number is retired.

---

## 6. Standard Workflows

### 6.1 Receiving an Invoice from a Supplier
1. Receive the PDF (email, WhatsApp, or scan on site)
2. Determine the next AP number for that project (check database or last file in folder)
3. Rename the file: `PRY001-AP-001.pdf`
4. Upload to: `Projects/PRY001-ProjectName/03-InvoicesReceived/`
5. Register the invoice in the management system with that reference code

### 6.2 Sending an Invoice to a Client
1. Issue the invoice through your formal invoicing tool (Alegra/Contasis)
2. Save the PDF copy
3. Rename it: `PRY001-AR-001.pdf`
4. Upload to: `Projects/PRY001-ProjectName/04-InvoicesSent/`
5. Register the AR invoice in the management system with that reference code

### 6.3 Receiving a Quote from a Supplier
1. Receive the quote document
2. Rename it: `PRY001-QT-001.pdf`
3. Upload to: `Projects/PRY001-ProjectName/02-QuotesReceived/`
4. Register the quote in the management system with that reference code

### 6.4 Opening a New Project
1. Create the project in the management system — get the project code (e.g. PRY002)
2. Create the project folder in SharePoint: `Projects/PRY002-ProjectName/`
3. Create all 7 subfolders inside it following the standard structure
4. Start filing documents as they arrive

---

## 7. Mobile Filing

Since work happens on construction sites, documents are frequently captured on mobile. The recommended workflow:

1. Photograph the physical document (receipt, permit, delivery note) using your phone camera
2. Rename or note the reference code
3. Upload directly to the correct SharePoint folder via the SharePoint mobile app
4. Register in the management system at your next opportunity

The SharePoint mobile app is available on iOS and Android and supports direct photo upload to any folder.

---

## 8. Finding Documents

Since all document filenames follow the reference convention, any document can be found instantly by searching SharePoint for its reference code.

- Search `PRY001-AP` → all AP invoices for project PRY001
- Search `PRY001` → all documents for project PRY001
- Search `-AP-` → all AP invoices across all projects (useful for accountant)
- Search `-AR-` → all AR invoices across all projects

The management system is always the primary source of information. SharePoint search is only needed when accessing the physical file.

---

*Update this document when new document types are introduced or folder structure changes.*
