# View Prototypes — Website

**Document version:** 3.0
**Date:** March 2, 2026
**Status:** Active — reference for Phase 4 implementation

---

## Overview

This document provides ASCII visual prototypes for every website view defined in `docs/04_visualization.md`. Each prototype shows the page layout, UI elements, column headers with sample data, interactive behavior, and the database views that feed data. Use this alongside `docs/04_visualization.md` (full specs) when building each page.

**9 pages total:**
- Browse: Projects, Entities & Contacts, Prices
- Dashboards: AP Calendar, AR Outstanding, Cash Flow, Partner Balances, P&L, Financial Position

---

## Shared Layout

Every page is wrapped in this shell. The sidebar is the primary navigation.

```
+----------------------------------------------------------------------+
|  KORAKUEN                                          Alex Tanaka  v    |
+----------+-----------------------------------------------------------+
|          |                                                           |
| Browse   |                                                           |
|  Projects|              [ Page Content Area ]                        |
|  Entities|                                                           |
|  Prices  |                                                           |
|          |                                                           |
| Dashbds  |                                                           |
|  AP Cal. |                                                           |
|  AR Out. |                                                           |
|  Cash Fl.|                                                           |
|  Partners|                                                           |
|  P&L     |                                                           |
|  Fin.Pos.|                                                           |
|          |                                                           |
+----------+-----------------------------------------------------------+
```

- Sidebar collapses to icons on small screens, becomes hamburger menu on mobile
- Header shows logged-in partner name with dropdown for logout
- Active page highlighted in sidebar
- Default landing page after login: **AP Payment Calendar**

---

## Browse Pages

### 1. Projects (Split-Panel)

**Data sources:** `projects`, `project_entities`, `costs + cost_items`, `ar_invoices`, `project_budgets`

```
+---------------------------------------------------------------------------------+
|  Projects                                                                       |
+---------------------------------------------------------------------------------+
|  Filter: [All v] Status                                                         |
+--------------------------+------------------------------------------------------+
|  PROJECT LIST            |  PROJECT DETAIL                                      |
|                          |                                                      |
|  Code    Name     Status |  PRY001 -- Punta Hermosa Sidewalks                   |
|  ------- -------- ------ |  Type: Subcontractor  Status: Active                 |
| >PRY001  Pta.Herm Active |  Client: Municipalidad de Punta Hermosa              |
|  PRY002  San Bart Active |  Contract: S/ 450,000.00                             |
|  PRY003  La Molina Prosp |  Start: 2026-02-15   Location: Lima                  |
|                          |                                                      |
|                          |  -- Assigned Entities ---------------------------      |
|                          |  Entity              Role                            |
|                          |  Aceros Arequipa     steel_supplier                   |
|                          |  UNICON              concrete_supplier                |
|                          |  JL Construcciones   civil_works_subcontractor       |
|                          |                                                      |
|                          |  -- Spending by Entity -------------------------      |
|                          |  Entity                  Total Spent   # Invoices    |
|                          |  JL Construcciones       S/ 45,000.00       3        |
|                          |  Aceros Arequipa         S/ 40,200.00       2        |
|                          |  UNICON                  S/ 32,300.00       1        |
|                          |  Pedro (Maestro)         S/ 28,400.00       4        |
|                          |  Ferreteria Lima         S/ 12,500.00       2        |
|                          |  Transp. Veloz           S/  8,400.00       1        |
|                          |  Other (no entity)       S/ 38,400.00       5        |
|                          |  -------------------------------------------------   |
|                          |  Total                   S/ 205,200.00      18       |
|                          |                                                      |
|                          |  -- Costs & Budget -----------------------------      |
|                          |  Category      Budgeted     Actual      %Used  %Ctr  |
|                          |  Materials     S/ 200,000   S/ 85,400    43%   19.0% |
|                          |  Labor         S/ 150,000   S/ 62,300    42%   13.8% |
|                          |  Subcontractor S/ 100,000   S/ 45,000    45%   10.0% |
|                          |  Equipment     S/  30,000   S/ 12,500    42%    2.8% |
|                          |  --------------------------------------------------   |
|                          |  Total         S/ 480,000   S/ 205,200   43%   45.6% |
|                          |  Remaining                  S/ 244,800         54.4% |
|                          |  Color: red >100%, yellow >90%, green <=90%         |
|                          |  i Budget set on 2026-02-01                          |
|                          |                                                      |
|                          |  -- AR Invoices --------------------------------      |
|                          |  Invoice#    Date        Gross         Status        |
|                          |  F001-0012   2026-02-28  S/ 141,600.00 Paid          |
|                          |  F001-0025   2026-03-15  S/ 112,100.00 Partial       |
|                          |                                                      |
|                          |  -- Notes ----------------------------------         |
|                          |  Project near the beach, access road floods          |
|                          |  during high tide. Schedule deliveries for           |
|                          |  morning only.                                       |
|                          |                                                      |
+--------------------------+------------------------------------------------------+
```

**Interactions:**
- Click a row in the left panel to load its detail in the right panel
- Selected row highlighted with accent color
- Entity names in assigned entities and spending sections link to Entities page
- Contract value vs total costs shown only when contract_value is not null
- Costs & Budget section: when no budget data exists, Budgeted and %Used columns hidden — only shows Actual and %Contract
- Notes section only shown when projects.notes is not null

**Responsive:** On mobile, list and detail stack vertically. Back button returns to list.

---

### 2. Entities & Contacts (Split-Panel)

**Data sources:** `entities`, `entity_contacts`, `entity_tags`, `tags`, `v_entity_transactions`

```
+---------------------------------------------------------------------------------+
|  Entities & Contacts                                                            |
+---------------------------------------------------------------------------------+
|  Search: [________________________]   Filter: [All v] Type  [All v] Tag         |
|                                              [All v] City  [All v] Region      |
+--------------------------+------------------------------------------------------+
|  ENTITY LIST             |  ENTITY DETAIL                                       |
|                          |                                                      |
|  Name           Doc#     |  Aceros Arequipa S.A.                                |
|  ------------- -------- |  RUC: 20370146994                                    |
| >Aceros Arequi  2037014. |  Tags: steel_supplier, materials                     |
|  Cementos Paca  2042548. |                                                      |
|  UNICON S.A.    2010018. |  -- Contacts ---------------------------------       |
|  JL Construcc   1045678. |  Name            Role       Phone        Email       |
|  Mun. Pta.Her   2015632. |  Carlos Medina   Ventas     987-654-321  cm@aa.pe    |
|                          |  * Primary contact                                   |
|                          |                                                      |
|                          |  -- Transaction History -----------------------       |
|                          |  Project         AP Total       AR Total    Net       |
|                          |  > PRY001        S/ 85,400.00   --          -85,400   |
|                          |    PRY002        S/ 32,100.00   --          -32,100   |
|                          |                                                      |
|                          |  -- PRY001 Expanded ---------------------------       |
|                          |  Date        Type   Title            Amount           |
|                          |  2026-02-10  Cost   Acero corrugado  S/ 45,200.00    |
|                          |  2026-02-25  Cost   Acero plancha    S/ 22,800.00    |
|                          |  2026-03-05  Cost   Acero corrugado  S/ 17,400.00    |
|                          |                                                      |
+--------------------------+------------------------------------------------------+
```

**Interactions:**
- Search filters entity list by legal_name, common_name, or document_number
- Click a project row (>) to expand and see individual cost/AR records for that entity on that project
- Project names link to that project's detail in the Projects page
- Primary contact marked with star

**Responsive:** On mobile, list and detail stack vertically. Back button returns to list.

---

### 3. Prices (Single Page — Search-Driven)

**Data sources:** `cost_items`, `quotes`, joined to `entities`, `entity_tags`

```
+---------------------------------------------------------------------------------+
|  Prices                                                                         |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Search: [ Acero corrugado___________________ ]    [ Search ]                   |
|  Filter: [All v] Category  [All v] Entity  [All v] Project                      |
|          Date: [___]-[___]  [All v] Tag                                         |
|                                                                                 |
+---------------------------------------------------------------------------------+
|  Results for: "Acero corrugado"                                                 |
|                                                                                 |
|  Date        Source  Supplier          Project  Item                  Qty  Unit  |
|  ----------  ------  ----------------  -------- --------------------  ---- ----- |
|  2026-03-05  Cost    Aceros Arequipa   PRY001   Acero corrugado 1/2  2.1  tn    |
|  2026-02-25  Quote   Distribuid.Lima   PRY002   Acero corrugado 1/2  5.0  tn    |
|  2026-02-10  Cost    Aceros Arequipa   PRY001   Acero corrugado 1/2  3.2  tn    |
|  2026-02-05  Quote   Aceros Arequipa   PRY001   Acero corrugado 1/2  5.2  tn    |
|  2026-01-18  Cost    Aceros Arequipa   PRY002   Acero corrugado 3/8  4.0  tn    |
+---------------------------------------------------------------------------------+
|  Unit Price   Currency  Tags                                                    |
|  ------------ --------  ---------------                                         |
|  S/ 3,250     PEN       steel_supplier                                          |
|  S/ 3,400     PEN       general_supplier                                        |
|  S/ 3,200     PEN       steel_supplier                                          |
|  S/ 3,200     PEN       steel_supplier                                          |
|  S/ 2,950     PEN       steel_supplier                                          |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

**Interactions:**
- Search-driven — user searches for an item title
- Results combine both cost_items and quotes for complete price history
- Tags shown per row (from entity's tags) for filtering
- No automatic aggregation — user scans and compares visually
- Filterable by category, entity, project, date range, tag

**Note:** This view grows in value as data accumulates. Will be sparse initially.

---

## Dashboard Views

### 4. AP Payment Calendar (Default Landing Page)

**Data source:** `v_ap_calendar`, `v_cost_balances`

**Tabs:** [ Main ] [ Taxes ]

#### Main Tab

```
+---------------------------------------------------------------------------------+
|  AP Payment Calendar                                     [ Main ] [ Taxes ]     |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  +-------------+  +-------------+  +-------------+  +-------------+            |
|  |  OVERDUE     |  |  TODAY       |  |  THIS WEEK  |  |  NEXT 30d   |           |
|  |  3 items     |  |  1 item      |  |  4 items    |  |  6 items    |           |
|  |  S/ 42,500   |  |  S/ 15,200   |  |  S/ 68,300  |  |  S/ 125,800 |           |
|  +-------------+  +-------------+  +-------------+  +-------------+            |
|  Buckets are non-overlapping (no double-counting)                               |
|                                                                                 |
|  Filter: [All v] Project  [All v] Supplier  [All v] Currency  [________] Title  |
+---------------------------------------------------------------------------------+
|  | Due Date    Days  Type       Supplier          Project  Title              Outstanding  |
|  - ----------  ----  ---------  ----------------  -------  -----------------  -----------  |
|  |# 2026-02-25  -5   Supplier   Aceros Arequipa  PRY001   Acero corrugado    S/ 22,800    |
|  |# 2026-02-26  -4   Supplier   JL Construcc.    PRY001   Mano de obra feb   S/ 12,500    |
|  |# 2026-02-28  -2   Supplier   Ferreteria Lima  PRY002   Materiales varios  S/  7,200    |
|  |% 2026-03-02   0   Supplier   UNICON           PRY001   Concreto f'c=210   S/ 15,200    |
|  |~ 2026-03-04   2   Supplier   Cementos Pacas.  PRY002   Cemento tipo I     S/ 11,760    |
|  |~ 2026-03-05   3   Loan (a)   Friend Juan      --       Monthly payment    S/ 40,000    |
|  |~ 2026-03-05   3   Supplier   Transp. Veloz    PRY001   Flete materiales   S/  8,400    |
|  |~ 2026-03-06   4   Supplier   UNICON           PRY002   Concreto f'c=175   S/ 24,300    |
|  |~ 2026-03-07   5   Supplier   Aceros Arequipa  PRY002   Acero plancha      S/ 23,840    |
|  |  2026-03-15  13   Supplier   JL Construcc.    PRY001   Mano de obra mar   S/ 18,500    |
|  |  2026-03-20  18   Loan (a)   Friend Pedro     --       Fixed return       S/ 15,000    |
|  |  2026-03-20  18   Supplier   Maq. del Sur     PRY002   Alquiler retro     S/ 35,000    |
+---------------------------------------------------------------------------------+
|  Currency  Status                                                               |
|  --------  -------                                                              |
|  PEN       Partial                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
|  PEN       Partial                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
|  PEN       Partial                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
|  PEN       Pending                                                              |
+---------------------------------------------------------------------------------+
```

**Color coding (left border):**
- `#` Red — overdue (past due date)
- `%` Orange — due today
- `~` Yellow — due this week (tomorrow through end of week)
- ` ` Neutral — future (after this week)

**(a) Loan rows (Alex-only):** Rows with Type = "Loan" come from `loan_schedule` via UNION in `v_ap_calendar`. Partners never see these rows.

#### Taxes Tab

```
+---------------------------------------------------------------------------------+
|  AP Payment Calendar                                     [ Main ] [ Taxes ]     |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  -- Detraccion Deposits Pending ------------------------------------------      |
|                                                                                 |
|  Supplier          Project  Invoice Title          Detraccion Amt  Status       |
|  ----------------  -------  --------------------   --------------  --------     |
|  Aceros Arequipa   PRY001   Acero corrugado        S/    832.37    Pending      |
|  UNICON            PRY001   Concreto f'c=210       S/    608.00    Pending      |
|  JL Construcc.     PRY001   Mano de obra feb       S/      --     N/A          |
|  Cementos Pacas.   PRY002   Cemento tipo I         S/    470.40    Deposited    |
|                                                                                 |
|  i Detracciones must be deposited to supplier's Banco de la Nacion account.    |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

**Row detail modal (from Main tab):**
```
+----------------------- Cost Detail (Modal) -----------------------+
|                                                                    |
|  Acero corrugado -- PRY001                                         |
|  Supplier: Aceros Arequipa S.A.                                    |
|  Date: 2026-02-10   Due: 2026-02-25                                |
|  Bank: BCP ****4521 (Alex)                                         |
|  Comprobante: Factura E001-00456                                   |
|  Document: PRY001-AP-003.pdf                                       |
|                                                                    |
|  -- Cost Items ------------------------------------                |
|  Item                   Qty    Price    Subtotal                    |
|  Acero corrugado 1/2"   3.2tn  S/3,200  S/10,240                  |
|  Acero corrugado 3/8"   2.1tn  S/2,950  S/ 6,195                  |
|  Flete                  1 glb  S/1,200  S/ 1,200                   |
|  --------------------------------------------------                |
|  Subtotal:                      S/ 17,635.00                       |
|  IGV (18%):                     S/  3,174.30                       |
|  Total:                         S/ 20,809.30                       |
|  Detraccion (4%):               S/    832.37                       |
|                                                                    |
|  -- Payment History ----------------------------------             |
|  Date        Type       Amount       Bank                          |
|  2026-02-15  Regular    S/ 15,000    BCP ****4521                  |
|  --------------------------------------------------                |
|  Paid:        S/ 15,000.00                                         |
|  Outstanding: S/  5,809.30                                         |
|                                                                    |
|                                              [ Close ]             |
+--------------------------------------------------------------------+
```

---

### 5. AR Outstanding & Collections

**Data source:** `v_ar_balances`, `v_retencion_dashboard`

**Tabs:** [ Main ] [ Taxes ]

#### Main Tab

```
+---------------------------------------------------------------------------------+
|  AR Outstanding & Collections                            [ Main ] [ Taxes ]     |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  +-------------+  +-------------+  +-------------+  +-------------+            |
|  |  CURRENT     |  |  31-60 DAYS  |  |  61-90 DAYS |  |  90+ DAYS   |           |
|  |  0-30 days   |  |  overdue     |  |  overdue    |  |  overdue    |           |
|  |  2 invoices  |  |  1 invoice   |  |  0 invoices |  |  0 invoices |           |
|  |  S/ 209,740  |  |  S/ 85,320   |  |  --         |  |  --         |           |
|  +-------------+  +-------------+  +-------------+  +-------------+            |
|                                                                                 |
|  Filter: [All v] Project  [All v] Client  [All v] Partner  [All v] Currency     |
+---------------------------------------------------------------------------------+
|  Invoice#    Project  Client          Inv.Date    Due Date    Days  Gross        |
|  ----------  -------  --------------  ----------  ----------  ----  ----------   |
|  F001-0025   PRY001   Mun. Pta.Herm  2026-02-28  2026-03-30    28  S/ 141,600  |
|  F002-0008   PRY002   Mun. San Bart  2026-02-15  2026-03-17    15  S/ 118,000  |
|  F001-0019   PRY001   Mun. Pta.Herm  2026-01-20  2026-02-19   -11  S/ 106,200  |
+---------------------------------------------------------------------------------+
|  Detraccion  Retencion  Net Receivable  Paid        Outstanding  Status         |
|  ----------  ---------  --------------  ----------  -----------  ------         |
|  S/  5,664   S/  4,248  S/ 131,688      S/       0  S/ 131,688  Pending        |
|  S/  4,720   S/  3,540  S/ 109,740      S/ 31,688  S/  78,052  Partial        |
|  S/  4,248   S/  3,186  S/  98,766      S/ 13,446  S/  85,320  Partial        |
|  ----------  ---------  --------------  ----------  -----------                  |
|  TOTAL                  S/ 340,194      S/ 45,134  S/ 295,060                   |
+---------------------------------------------------------------------------------+
```

**Color coding (Days column):**
- Green — current (0-30 days)
- Yellow — 31-60 days overdue
- Orange — 61-90 days overdue
- Red — 90+ days overdue

#### Taxes Tab

```
+---------------------------------------------------------------------------------+
|  AR Outstanding & Collections                            [ Main ] [ Taxes ]     |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  -- Retenciones --------------------------------------------------------        |
|  Has the client paid the 3% retencion to SUNAT?                                 |
|                                                                                 |
|  Project  Client          Invoice#    Inv.Date    Days  Ret. Amount  Verified   |
|  -------  --------------  ----------  ----------  ----  -----------  --------   |
|  PRY001   Mun. Pta.Herm  F001-0025   2026-02-28    2   S/ 4,248.00  o Unver.  |
|  PRY002   Mun. San Bart  F002-0008   2026-02-15   15   S/ 3,540.00  o Unver.  |
|  PRY001   Mun. Pta.Herm  F001-0019   2026-01-20   41   S/ 3,186.00  o Unver.  |
|  PRY001   Mun. Pta.Herm  F001-0012   2025-12-28   64   S/ 2,862.00  * Verif.  |
|                                                                                 |
|  Color: green <30d, yellow 30-60d, orange 60-90d, red 90+d (unverified)        |
|                                                                                 |
|  -- Detracciones -------------------------------------------------------        |
|  Has the client deposited to our Banco de la Nacion?                            |
|                                                                                 |
|  Project  Client          Invoice#    Detr. Amount   Received    Pending        |
|  -------  --------------  ----------  ------------   ----------  ----------     |
|  PRY001   Mun. Pta.Herm  F001-0025   S/  5,664.00   S/       0  S/ 5,664.00   |
|  PRY002   Mun. San Bart  F002-0008   S/  4,720.00   S/ 4,720.00 S/      0     |
|  PRY001   Mun. Pta.Herm  F001-0019   S/  4,248.00   S/ 4,248.00 S/      0     |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

### 6. Partner Contribution & Balances

**Data source:** `v_partner_ledger`

```
+---------------------------------------------------------------------------------+
|  Partner Contribution & Balances                                                |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  Project: [ PRY001 -- Punta Hermosa Sidewalks v ]      (required)              |
|                                                                                 |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  -- Contributions (PEN) -----------------------------------------------        |
|                                                                                 |
|  Partner               Amount          Share                                    |
|  ---------------------- -------------- ------                                   |
|  Korakuen (Alex)        S/ 125,400.00  61.1%  ################--------          |
|  Partner B              S/  52,300.00  25.5%  ########--------------------      |
|  Partner C              S/  27,500.00  13.4%  ####------------------------      |
|  ---------------------- --------------                                          |
|  Total Project Costs    S/ 205,200.00  100%                                     |
|                                                                                 |
|  -- Income --------------------------------------------------------            |
|                                                                                 |
|  Total Invoiced:     S/ 247,800.00                                              |
|  Total Collected:    S/ 155,088.00                                              |
|  Outstanding:        S/  92,712.00                                              |
|                                                                                 |
|  -- Settlement ---------------------------------------------------------        |
|                                                                                 |
|  Partner           Should Receive   Already Received*   Owes / (Is Owed)       |
|  ---------------   ---------------  -----------------   ----------------        |
|  Korakuen (Alex)   S/  94,819.00    S/ 155,088.00       Owes  S/ 60,269.00     |
|  Partner B         S/  39,548.00    S/       0.00       Owed  S/ 39,548.00     |
|  Partner C         S/  20,721.00    S/       0.00       Owed  S/ 20,721.00     |
|                                                                                 |
|  * "Already Received" = inbound payments to that partner's bank accounts       |
|  i Settlement amounts update as more AR payments are collected.                 |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

**Interactions:**
- Project selector at top is required — no "all projects" aggregate view
- Click a partner's contribution amount to expand and show the list of individual costs
- Visual proportion bars show relative contribution at a glance
- Settlement section shows who owes whom based on collected income vs contribution share

**Expanded partner costs (inline):**
```
|  Korakuen (Alex)        S/ 125,400.00  61.1%                                    |
|    +----------------------------------------------------------+                 |
|    | Date        Title                  Category     Amount    |                 |
|    | 2026-02-10  Acero corrugado        Materials    S/45,200  |                 |
|    | 2026-02-15  Concreto f'c=210       Materials    S/32,300  |                 |
|    | 2026-02-20  Mano de obra febrero   Labor        S/28,400  |                 |
|    | 2026-03-01  Encofrado metalico     Equipment    S/19,500  |                 |
|    +----------------------------------------------------------+                 |
```

---

### 7. Company P&L

**Data sources:** Computed in `queries.ts` (period-filtered, multi-table aggregation with currency conversion). SQL views `v_company_pl`/`v_project_pl` exist for simple queries but the website computes P&L directly

#### Year View (columns = months)

```
+-------------------------------------------------------------------------------------------+
|  Company P&L                                                                              |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  Period: [ 2026 v ]   Reporting currency: [ PEN v ]                                       |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
|                              JAN            FEB            MAR         ...    TOTAL        |
|                                                                                           |
|  INCOME                                                                                   |
|  > AR Invoiced              S/ 106,200     S/ 141,600     S/  95,000  ...   S/ 342,800    |
|                                                                                           |
|  PROJECT COSTS                                                                            |
|  > Total Project Costs     (S/  62,800)   (S/ 142,400)   (S/  85,000) ... (S/ 290,200)   |
|  -----------------------------------------------------------------------------------      |
|  GROSS PROFIT               S/  43,400    -S/     800     S/  10,000  ...   S/  52,600    |
|  Gross Margin                    40.9%         -0.6%          10.5%              15.3%     |
|                                                                                           |
|  SGA                                                                                      |
|    Software Licenses       (S/   1,200)   (S/   1,200)   (S/   1,200) ...  (S/   3,600)  |
|    Partner Compensation    (S/   5,000)   (S/   5,000)   (S/   5,000) ... (S/  15,000)   |
|    Business Development    (S/   1,500)   (S/   2,000)   (S/   1,200) ...  (S/   4,700)  |
|    Professional Services   (S/     800)   (S/   2,000)   (S/   1,000) ...  (S/   3,800)  |
|    Office & Admin          (S/     350)   (S/     300)   (S/     300) ...  (S/     950)   |
|  Total SGA                 (S/   8,850)   (S/  10,500)   (S/   8,700) ... (S/  28,050)   |
|  -----------------------------------------------------------------------------------      |
|  NET PROFIT                 S/  34,550    -S/  11,300     S/   1,300  ...   S/  24,550    |
|  Net Margin                      32.5%         -8.0%           1.4%               7.2%    |
|                                                                                           |
|  ==================================================================================       |
|  -- Personal Position (Alex only) --                                                      |
|                                                                                           |
|  Alex's profit share (61.1%):                                         S/  15,012.05       |
|                                                                                           |
|  Loan obligations:                                                                        |
|    Friend Juan (8% on S/ 500k):                                      (S/  40,000.00)     |
|    Friend Pedro (fixed return):                                      (S/  15,000.00)     |
|  -----------------------------------------------                                         |
|  Net after obligations:                                              -S/  39,987.95       |
|                                                                                           |
|  i This section is only visible to Alex.                                                  |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
```

#### Quarter View

```
|  Period: [ Q1 2026 v ]   Reporting currency: [ PEN v ]                                    |
|                              JAN            FEB            MAR          TOTAL              |
|  (same structure, 3 months + total)                                                       |
```

#### Single Month View

```
|  Period: [ February 2026 v ]   Reporting currency: [ PEN v ]                              |
|                              FEB 2026                                                     |
|  (same structure, one column)                                                             |
```

**Display conventions:**
- Costs shown in parentheses — standard financial presentation
- Reporting currency selector converts all amounts using stored exchange rates
- Converted amounts marked with * to indicate conversion
- Margin percentages shown below profit lines

**Interactions:**
- Period selector: year (12 columns), quarter (3 columns), single month (1 column)
- Click AR Invoiced to expand per-project breakdown
- Click Total Project Costs to expand category breakdown

---

### 8. Cash Flow

**Data source:** Computed in `queries.ts` (no SQL view — too complex for a single view)

```
+-------------------------------------------------------------------------------------------+
|  Cash Flow                                                                                |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  Scope: [ All Projects v ]       Period: [ 2026 v ]   Currency: [ PEN v ]                 |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
|                                                                                           |
|  Month      Cash In        Materials    Labor       Subcontr.   Equip.    Other           |
|  ---------- -------------- ------------ ----------- ----------- --------- ---------       |
|  Jan 2026   S/       --    S/  15,400   S/  8,000   S/      --  S/ 2,000  S/    --        |
|  Feb 2026   S/ 155,088     S/  42,300   S/ 28,400   S/ 45,000  S/12,500  S/14,100        |
|  Mar 2026   S/  45,134     S/  22,000   S/ 18,500   S/  8,400  S/    --  S/14,000        |
|  -- forecast below ------------------------------------------------------------------     |
|  Apr 2026   S/ 131,688     S/  35,200   S/ 25,000   S/ 15,000  S/ 5,000  S/ 5,000        |
|  May 2026   S/ 109,740     S/  20,000   S/ 15,000   S/ 10,000  S/    --  S/    --        |
|  Jun 2026   S/  98,766     S/  18,500   S/ 12,000   S/  8,000  S/    --  S/    --        |
+-------------------------------------------------------------------------------------------+
|  Cash Out        Net            Cumulative                                                |
|  -------------- -------------- --------------                                             |
|  S/  25,400     -S/  25,400   -S/  25,400                                                |
|  S/ 142,300      S/  12,788   -S/  12,612                                                |
|  S/  62,900     -S/  17,766   -S/  30,378                                                |
|                                                                                           |
|  S/  85,200      S/  46,488    S/  16,110                                                |
|  S/  45,000      S/  64,740    S/  80,850                                                |
|  S/  38,500      S/  60,266    S/ 141,116                                                |
|                                                                                           |
|  !! Mar 2026: Negative cumulative -- cash shortfall risk                                  |
|                                                                                           |
+-------------------------------------------------------------------------------------------+
```

**Color coding:**
- Red — negative net months
- Yellow — months below threshold
- Green — positive net
- Forecast rows visually distinct (lighter styling or dashed separator)

**Interactions:**
- Scope selector: All Projects (default) or single project
- Year picker to select period
- Reporting currency selector (PEN default, USD option)
- Company view (Alex-only) includes loan outflows in Cash Out
- Cash shortfall warning when cumulative goes negative in future months
- Cash Out broken down by cost category (materials, labor, subcontractor, equipment, other)

---

### 9. Financial Position

**Data sources:** `v_bank_balances`, `v_ar_balances`, `v_cost_balances`, `v_igv_position`, `v_retencion_dashboard`, `v_loan_balances`

```
+---------------------------------------------------------------------------------+
|  Financial Position                                                             |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  As of: March 2, 2026                Reporting currency: [ PEN v ]              |
|                                                                                 |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  === ASSETS ================================================================    |
|                                                                                 |
|  Cash in Bank                                                                   |
|    +--------------------+  +--------------------+  +--------------------+       |
|    |  BCP ****4521       |  |  Interbank ****7890 |  |  BN ****1234       |      |
|    |  Cuenta Corriente   |  |  Cuenta Ahorro      |  |  Detraccion        |      |
|    |  PEN                |  |  USD                 |  |  PEN               |      |
|    |                     |  |                      |  |                    |      |
|    |  S/ 45,230.50       |  |  $ 12,450.00         |  |  S/ 8,752.37       |      |
|    |                     |  |  (S/ 46,314.00) *    |  |  !! Tax only       |      |
|    +--------------------+  +--------------------+  +--------------------+       |
|                                                                                 |
|    Partner Accounts (net contribution position):                                |
|    +--------------------+  +--------------------+                               |
|    |  Partner B          |  |  Partner C          |                              |
|    |  BCP ****6543       |  |  BBVA ****9876      |                              |
|    |  S/ 52,300.00       |  |  S/ 27,500.00       |                              |
|    |  Net contributed    |  |  Net contributed     |                              |
|    +--------------------+  +--------------------+                               |
|                                                                                 |
|  Total Cash                                          S/  100,296.87             |
|                                                                                 |
|  Accounts Receivable                                                            |
|    Outstanding AR invoices                           S/  295,060.00             |
|                                                                                 |
|  Tax Credits                                                                    |
|    IGV Paid (credito fiscal)                         S/   48,240.00             |
|    Retenciones Unverified                            S/   10,974.00             |
|                                                                                 |
|  TOTAL ASSETS                                        S/  454,570.87             |
|                                                                                 |
|  === LIABILITIES ============================================================   |
|                                                                                 |
|  Accounts Payable                                                               |
|    Outstanding costs                                 S/  125,800.00             |
|                                                                                 |
|  Tax Liabilities                                                                |
|    IGV Collected (debito fiscal)                     S/   62,100.00             |
|                                                                                 |
|  Loans (Alex only) (a)                                                          |
|    Friend Juan (S/500k @ 8%)                         S/  460,000.00             |
|    Friend Pedro (fixed return)                       S/   15,000.00             |
|                                                                                 |
|  TOTAL LIABILITIES                                   S/  647,900.00             |
|                                                                                 |
|  =======================================================================        |
|                                                                                 |
|  NET POSITION (Assets - Liabilities)                -S/  193,329.13             |
|                                                                                 |
|  * Converted at stored exchange rate                                            |
|  (a) Loans section visible to Alex only                                         |
|  i Balances are system-calculated, not bank-reconciled.                         |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

**Account detail (click any bank card to expand below):**

```
|  -- Account Detail: BCP ****4521 ----------------  Filter: [All v] Date Range   |
|                                                                                 |
|  Date        Direction  Entity              Project  Amount                     |
|  ----------  ---------  ------------------  -------  ----------                 |
|  2026-03-01  Outbound   Aceros Arequipa     PRY001   S/ -15,000                 |
|  2026-02-28  Inbound    Mun. Pta.Hermosa    PRY001   S/ +31,688                 |
|  2026-02-25  Outbound   JL Construcciones   PRY001   S/ -12,500                 |
|  2026-02-20  Outbound   UNICON              PRY001   S/  -8,400                 |
|                                                                                 |
|  Filters: date range, entity, project, direction, tag                           |
```

**Interactions:**
- Click any bank account card to expand recent transactions below
- Banco de la Nacion detraccion account flagged with warning that balance is for tax payments only
- Partner accounts show net contribution position, not full balance tracking
- Transaction detail filterable by date range, entity, project, direction, tag
- Reporting currency selector converts all amounts for consolidated view

---

*Prototypes are reference mockups for Phase 4 implementation. See `docs/04_visualization.md` for full functional specifications. Database views are defined in `supabase/views/`.*
