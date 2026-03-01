# Project Roadmap

**Document version:** 2.0
**Date:** February 28, 2026
**Status:** Active

---

## Phase 1: Foundation (Complete)

**Goal:** Design and validate the complete data model and prepare all documentation before writing any code.

- [x] Define business context and requirements
- [x] Define system architecture and tool stack
- [x] Define all modules and their attributes
- [x] Define visualization website views
- [x] Define SharePoint structure and naming convention
- [x] Lock all architectural decisions
- [x] Design database schema — all 13 tables fully defined
- [x] Review and validate schema
- [x] Write coding standards
- [x] Write environment setup guide
- [x] Write development execution roadmap
- [x] Write CLAUDE.md master context file
- [x] Write skills reference document
- [x] Full documentation audit and consistency check
- [ ] Build all five skill files (Task 1.5)
- [ ] Consult external accountant on required transaction fields for SUNAT compatibility

---

## Phase 2: Database

**Goal:** A working, populated database on Supabase.

- [ ] Write SQL to create all tables
- [ ] Set up Supabase project
- [ ] Apply schema to Supabase
- [ ] Define indexes for common query patterns
- [ ] Create seed data for testing (sample project, entities, costs)
- [ ] Validate data model with real examples from the business

---

## Phase 3: Data Entry (CLI)

**Goal:** Simple Python scripts to enter data from the terminal.

- [ ] add_project.py
- [ ] add_tag.py
- [ ] add_entity.py
- [ ] add_entity_contact.py
- [ ] add_project_entity.py
- [ ] add_quote.py
- [ ] add_valuation.py
- [ ] add_cost.py (project cost and SG&A, with line items)
- [ ] add_ar_invoice.py
- [ ] register_payment.py (unified — handles AP and AR payments, all types)
- [ ] view_ap_calendar.py (quick terminal AP view)
- [ ] view_partner_balances.py (quick terminal partner view)

---

## Phase 4: Visualization Website (V0 — Read Only)

**Goal:** Simple read-only Next.js website on Vercel showing all key views.

- [ ] Set up Next.js project connected to Supabase
- [ ] Deploy to Vercel
- [ ] Build AP Payment Calendar view
- [ ] Build Project Cost Summary view
- [ ] Build AR Outstanding & Collections view
- [ ] Build Partner Contribution & Balances view
- [ ] Build Entity Transaction History view
- [ ] Build Company P&L view
- [ ] Build Bank Account Balances view
- [ ] Build Unit Price History view (lower priority)
- [ ] Build Quote vs Actual Comparison view (lower priority)

---

## Phase 5: Full Web Application (V1)

**Goal:** Add data entry forms to the existing website. CLI scripts become optional fallback.

- [ ] Add Supabase Auth (per partner company)
- [ ] Add data entry forms for all modules
- [ ] Mobile browser optimization
- [ ] Retire CLI scripts as primary entry method (keep as fallback)

---

## Phase 6: Mobile + Automation (V2)

**Goal:** Native mobile and automated workflows. Define scope when V1 is stable.

---

## Open Decisions

| Decision | Status |
|---|---|
| Accountant field requirements for SUNAT | Pending — consult accountant |
| Detraccion rates by service type | Pending — confirm applicable rates |
| SharePoint setup | Pending — create site and folder structure |
| Partner company names for database | Pending |

---

*Update this document as phases are completed and decisions are made.*
