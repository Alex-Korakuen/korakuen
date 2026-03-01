# Skills

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active — skills to be built in Task 1.5 before Phase 2

> **⚠ This document is temporary.** It exists to guide the construction of the five skill files in `/skills/`. Once all skills are built and tested (Task 1.5.6), this file is deleted. The skill files themselves become the reference — not this document.

---

## What Is a Skill?

A skill is a focused instruction file that teaches Claude Code exactly how to perform a specific, repeatable task for this project. Each skill lives in `/skills/` as a markdown file. Before performing the task it covers, Claude Code reads the skill file first.

Skills exist because some tasks require very specific conventions, patterns, or multi-step workflows that would otherwise be done inconsistently. A skill makes the output predictable every time.

---

## Skill Index

| Skill File | Purpose |
|---|---|
| `skills/sql_schema.md` | Generate CREATE TABLE SQL from schema document |
| `skills/sql_views.md` | Generate PostgreSQL view SQL from view descriptions |
| `skills/cli_script.md` | Generate Python CLI scripts from operation spec |
| `skills/ts_types.md` | Generate and organize TypeScript types from Supabase schema |
| `skills/codebase_audit.md` | Systematically audit the codebase for issues |

---

## How to Use Skills

When Claude Code is about to perform a task covered by a skill:

1. Read the relevant skill file first: `cat skills/[skill_name].md`
2. Follow the skill instructions exactly
3. Do not deviate from the patterns defined in the skill without explicit approval

If a task is covered by more than one skill, read all relevant skills before starting.

---

## Skill 1: SQL Schema Generator

**File:** `skills/sql_schema.md`
**Trigger:** Any time a CREATE TABLE statement needs to be written

### What it does
Generates correct, complete PostgreSQL CREATE TABLE statements for the Korakuen database from the field definitions in `docs/08_schema.md`.

### What it reads
- `docs/08_schema.md` — field names, types, nullability, and notes
- `docs/10_coding_standards.md` — naming conventions

### What it produces
A single SQL file: `database/migrations/001_initial_schema.sql`

### Rules the skill must enforce

**Primary keys:**
```sql
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
```

**Timestamps — every table:**
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
```

**Auto-update trigger — every table:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_[table_name]_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Soft delete — every table except entity_tags:**
```sql
is_active BOOLEAN DEFAULT true NOT NULL
```

**Foreign keys — always explicit:**
```sql
CONSTRAINT fk_[table]_[referenced_table]
  FOREIGN KEY ([field_id])
  REFERENCES [referenced_table](id)
  ON DELETE RESTRICT  -- default: prevent deletion of referenced records
```

**ON DELETE behavior:**
- Default: `RESTRICT` — prevents deleting a parent if children exist
- `CASCADE` only for: `entity_tags`, `cost_items` (deleting a cost deletes its items)
- Never `SET NULL` — nullable FK fields exist for business reasons, not cascades

**NUMERIC types:**
- Money amounts: `NUMERIC(15,2)`
- Quantities and unit prices: `NUMERIC(15,4)`
- Rates and percentages: `NUMERIC(5,2)` — e.g. 18.00 for IGV
- Exchange rates: `NUMERIC(10,4)`

**VARCHAR — always parameterized:**
- Short codes (RUC, DNI, currency): `VARCHAR(11)`, `VARCHAR(3)`, etc.
- Names and descriptions where length is unbounded: `TEXT`
- Enum-like fields (status, type): `VARCHAR(50)`

**Table order — always respect dependencies:**
Generate tables in this exact order so foreign keys never reference a table that doesn't exist yet:
1. partner_companies
2. bank_accounts
3. entities
4. tags
5. entity_tags
6. entity_contacts
7. projects
8. project_entities
9. valuations
10. quotes
11. costs
12. cost_items
13. ar_invoices
14. payments

**Inline comments** on every non-obvious field:
```sql
igv_rate NUMERIC(5,2) DEFAULT 18.00 NOT NULL, -- Peru VAT, editable per transaction
```

**File structure:**
```sql
-- ============================================================
-- Korakuen Management System — Initial Schema
-- Migration: 001
-- Date: YYYY-MM-DD
-- ============================================================

-- [shared trigger function first]

-- [then tables in dependency order]
-- each table preceded by: -- === TABLE: table_name ===
```

---

## Skill 2: SQL Views Generator

**File:** `skills/sql_views.md`
**Trigger:** Any time a database view needs to be written

### What it does
Generates correct PostgreSQL view SQL for all derived data views defined in `docs/08_schema.md`.

### What it reads
- `docs/08_schema.md` — views section and table structures
- `docs/03_module_specifications.md` — business rules for what each view represents

### What it produces
One SQL file per view in `database/views/`:
- `v_cost_totals.sql`
- `v_cost_balances.sql`
- `v_ar_balances.sql`
- `v_ap_calendar.sql`
- `v_partner_ledger.sql`
- `v_entity_transactions.sql`
- `v_bank_balances.sql`
- `v_project_pl.sql`
- `v_company_pl.sql`
- `v_settlement_dashboard.sql`

### Rules the skill must enforce

**Naming:** All views prefixed with `v_` in SQL. Referenced without prefix in application code.

**Header comment on every view:**
```sql
-- View: v_cost_totals
-- Purpose: Derives subtotal, igv_amount, detraccion_amount, total per cost from cost_items
-- Source tables: costs, cost_items
-- Used by: AP calendar, project P&L, cost detail pages
CREATE OR REPLACE VIEW v_cost_totals AS
```

**Never store derived data** — views only SELECT and compute. No INSERT, UPDATE, or materialized views.

**IGV calculation:**
```sql
ROUND(subtotal * (igv_rate / 100), 2) AS igv_amount
```

**Payment status logic — always use this exact pattern:**
```sql
CASE
  WHEN COALESCE(SUM(p.amount), 0) = 0 THEN 'pending'
  WHEN COALESCE(SUM(p.amount), 0) >= total THEN 'paid'
  ELSE 'partial'
END AS payment_status
```

**Days remaining for AP calendar:**
```sql
(c.due_date - CURRENT_DATE) AS days_remaining
```

**Null safety** — always use COALESCE for aggregated amounts that could be null when no payments exist.

---

## Skill 3: CLI Script Generator

**File:** `skills/cli_script.md`
**Trigger:** Any time a new Python CLI script needs to be written

### What it does
Generates a complete, consistent Python CLI script for a data entry or view operation, following the exact template and conventions defined in `docs/10_coding_standards.md`.

### What it reads
- `docs/10_coding_standards.md` — script structure, input handling, error handling
- `docs/08_schema.md` — the target table's fields and constraints
- `docs/11_environment_setup.md` — how the Supabase client is initialized

### What it produces
A single Python file in `cli/` following the naming convention: `add_[entity].py`, `register_[action].py`, or `view_[subject].py`

### Rules the skill must enforce

**Always use shared modules:**
```python
from lib.db import supabase
from lib.helpers import get_input, get_optional_input, confirm, list_choices
```

**Never import Supabase directly in a script** — always via `lib/db.py`.

**Script opening — always:**
```python
#!/usr/bin/env python3
"""
Script: add_cost.py
Purpose: Register a new cost (expense) in the database
Tables: costs, cost_items
"""
```

**Foreign key fields — always list options:**
Before asking for a foreign key value, always query and display available options:
```python
# Show available projects before asking
projects = supabase.table("projects").select("id, project_code, name").eq("is_active", True).execute()
list_choices("Available projects", projects.data, display=["project_code", "name"])
```

**Confirmation before any insert — always:**
```python
print("\n--- Summary ---")
print(f"  Project:  {project_code} — {project_name}")
print(f"  Amount:   {currency} {subtotal:,.2f}")
# ... all fields
if not confirm("Register this cost?"):
    print("Cancelled.")
    return
```

**Success and error messages — always:**
```python
try:
    response = supabase.table("costs").insert(data).execute()
    print(f"\n✓ Cost registered (ID: {response.data[0]['id'][:8]}...)")
except Exception as e:
    print(f"\n✗ Error: {e}")
    sys.exit(1)
```

**No business logic in scripts** — no calculating IGV, totals, or balances in Python. These are derived in the database. Scripts only collect input and insert records.

**Optional fields** — always show `(optional — press Enter to skip)` in the prompt.

**Currency amounts** — always display formatted with comma separators and 2 decimal places.

---

## Skill 4: TypeScript Types

**File:** `skills/ts_types.md`
**Trigger:** Any time TypeScript types need to be created or updated after a schema change

### What it does
Guides the process of generating TypeScript types from the Supabase schema and organizing them correctly in the Next.js website.

### What it reads
- `docs/08_schema.md` — table structures and field types
- `docs/11_environment_setup.md` — Supabase project setup

### What it produces
- `website/lib/types.ts` — all TypeScript types for the project
- Updates to `website/lib/supabase.ts` if needed

### Workflow

**Step 1 — Generate base types via Supabase CLI:**
```bash
npx supabase gen types typescript \
  --project-id [project-ref] \
  --schema public \
  > website/lib/database.types.ts
```

This produces the raw generated file. Never edit `database.types.ts` directly — it gets overwritten on every regeneration.

**Step 2 — Write human-friendly types in `types.ts`:**
Import from the generated file and create clean aliases:

```typescript
import type { Database } from './database.types'

// Raw row types from generated schema
export type PartnerCompanyRow = Database['public']['Tables']['partner_companies']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type CostRow = Database['public']['Tables']['costs']['Row']
export type CostItemRow = Database['public']['Tables']['cost_items']['Row']
export type ArInvoiceRow = Database['public']['Tables']['ar_invoices']['Row']
export type PaymentRow = Database['public']['Tables']['payments']['Row']
export type EntityRow = Database['public']['Tables']['entities']['Row']
// ... all tables

// Insert types (for forms in V1)
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type CostInsert = Database['public']['Tables']['costs']['Insert']
// ... as needed

// Composite types for joined queries
export type CostWithItems = CostRow & {
  cost_items: CostItemRow[]
  entity: EntityRow | null
  project: ProjectRow | null
}

export type ArInvoiceWithBalance = ArInvoiceRow & {
  amount_paid: number
  outstanding: number
  payment_status: 'pending' | 'partial' | 'paid'
}
```

**Step 3 — Define enum types matching schema values:**
```typescript
export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'
export type ProjectType = 'subcontractor' | 'oxi'
export type CostType = 'project_cost' | 'sga'
export type PaymentType = 'regular' | 'detraccion' | 'retencion'
export type PaymentDirection = 'inbound' | 'outbound'
export type Currency = 'USD' | 'PEN'
export type ComprobanteType = 'factura' | 'boleta' | 'recibo_por_honorarios'
export type QuoteStatus = 'pending' | 'accepted' | 'rejected'
export type ValuationStatus = 'open' | 'closed'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type EntityType = 'company' | 'individual'
export type DocumentType = 'RUC' | 'DNI' | 'CE' | 'Pasaporte'
```

**Rules:**
- Never use `any` — every query result must be typed
- Composite types for all joined queries — never `any[]`
- Regenerate `database.types.ts` after every schema change
- Never edit `database.types.ts` directly
- All enum values must exactly match the VARCHAR values in the schema

---

## Skill 5: Codebase Audit

**File:** `skills/codebase_audit.md`
**Trigger:** Run periodically, before any major phase transition, or when inconsistencies are suspected

### What it does
Systematically checks the codebase for issues across five categories: schema consistency, coding standards, DRY violations, security, and documentation drift. Produces a structured report with findings and fixes.

### What it reads
- All files in `cli/`
- All files in `database/`
- All files in `website/lib/` and `website/app/`
- `docs/08_schema.md` — the source of truth
- `docs/10_coding_standards.md` — the conventions to check against
- `docs/CLAUDE.md` — the never-do list

### What it produces
A written audit report listing every issue found, categorized by severity, with suggested fixes.

### Audit Checklist

**Category 1 — Schema Consistency**
- [ ] Every table in `08_schema.md` has a corresponding CREATE TABLE in `001_initial_schema.sql`
- [ ] Field names in SQL match field names in schema document exactly
- [ ] Field types in SQL match the types specified in schema document
- [ ] Every FK in SQL references the correct table and field
- [ ] All tables have `is_active`, `created_at`, `updated_at` (except `entity_tags`)
- [ ] TypeScript types in `database.types.ts` match current schema — regenerate if schema changed
- [ ] Enum values in `types.ts` match VARCHAR values in schema exactly
- [ ] CLI scripts reference field names that exist in the current schema

**Category 2 — Coding Standards**
- [ ] All CLI scripts use `from lib.db import supabase` — never direct import
- [ ] All CLI scripts use `from lib.helpers import ...` for input/confirm/list
- [ ] All CLI scripts show confirmation summary before inserting
- [ ] All CLI scripts have success/error messages with try/except
- [ ] No business logic (calculations) in CLI scripts — only in database
- [ ] All view SQL files have header comments
- [ ] All TypeScript files use no `any` types
- [ ] All query functions in `website/lib/queries.ts` — not inline in components

**Category 3 — DRY Violations**
- [ ] No duplicated input helper code across CLI scripts — all in `lib/helpers.py`
- [ ] No duplicated Supabase client initialization — all in `lib/db.py`
- [ ] No duplicated query logic across website pages — all in `lib/queries.ts`
- [ ] No duplicated currency formatting — all in `lib/formatters.ts`
- [ ] No duplicated TypeScript types — all in `lib/types.ts`

**Category 4 — Security**
- [ ] No `.env` file committed to git
- [ ] No Supabase keys hardcoded anywhere in code
- [ ] Service role key not referenced in website code — only anon key
- [ ] `.env.example` exists and has all required variable names with empty values
- [ ] `.gitignore` includes `.env`, `.env.local`, `venv/`, `node_modules/`

**Category 5 — Documentation Drift**
- [ ] `09_dev_roadmap.md` task statuses reflect actual completion state
- [ ] `05_roadmap.md` phase statuses reflect actual completion state
- [ ] Any new architectural decision made during development is recorded in `02_system_architecture.md`
- [ ] Any new CLI script is listed in `10_coding_standards.md` file naming section
- [ ] `CLAUDE.md` current status section reflects actual phase

**Category 6 — Dead Files**
- [ ] No commented-out code blocks anywhere in the codebase
- [ ] No unused functions in `cli/lib/helpers.py` or `cli/lib/db.py`
- [ ] No unused query functions in `website/lib/queries.ts`
- [ ] No unused TypeScript types in `website/lib/types.ts`
- [ ] No unused React components in `website/components/`
- [ ] No build-time documents that have served their purpose (e.g. `docs/12_skills.md` if skills are already built)
- [ ] No stale skill files in `/skills/` — every skill must match current conventions exactly
- [ ] No superseded migration files outside of `database/migrations/` numbered sequence

### Severity Levels

| Level | Meaning | Action |
|---|---|---|
| CRITICAL | Schema mismatch, security issue, or broken functionality | Fix immediately before proceeding |
| HIGH | DRY violation or missing convention that will compound | Fix before next task |
| MEDIUM | Documentation drift or missing comment | Fix in current session |
| LOW | Minor style inconsistency | Note and fix when convenient |

### Report Format

```
## Codebase Audit — [Date]

### CRITICAL
- [file:line] Description of issue → suggested fix

### HIGH
- [file:line] Description of issue → suggested fix

### MEDIUM
...

### LOW
...

### Summary
X critical, X high, X medium, X low issues found.
```

---

## Building a Skill

When building a skill file for the first time:

1. Create the file at `skills/[skill_name].md`
2. The file must contain: purpose, trigger condition, input documents, output files, and all rules with code examples
3. Test the skill by having Claude Code read it and perform the task once — verify the output matches expectations
4. If the output needs adjustment, update the skill file, not just the output

Skills are living documents — update them when conventions change or new patterns are discovered during development.

---

*All five skills must be built and tested before Phase 2 begins. See Task 1.5 in `09_dev_roadmap.md`.*
