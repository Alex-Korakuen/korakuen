# Coding Standards

**Document version:** 1.0
**Date:** February 28, 2026
**Status:** Active

---

## Philosophy

- **Discuss before building.** No code is written without first discussing the approach.
- **Simple over clever.** The simplest solution that works is always preferred.
- **Document decisions.** Any non-obvious choice gets a comment explaining why.
- **Schema is sacred.** Never modify the database schema without explicit approval and documentation update.
- **Never break existing data.** All migrations must be backward compatible.

---

## Core Coding Principles

These principles apply to every file in this project — Python, SQL, and TypeScript.

### DRY — Don't Repeat Yourself
Every piece of logic exists in exactly one place. If you find yourself writing the same code in two places, extract it.

- Input helpers → `cli/lib/helpers.py`
- Supabase client → `cli/lib/db.py`
- Database query functions → `website/lib/queries.ts`
- Currency formatters → `website/lib/formatters.ts`
- TypeScript types → `website/lib/types.ts`

If a CLI script has more than one function that formats currency or validates input, it's a DRY violation. Move it to the shared lib.

### KISS — Keep It Simple, Stupid
Write the simplest code that correctly solves the problem. No clever abstractions, no premature optimization, no unnecessary layers.

- A 40-line straightforward script is better than a 15-line abstract one
- Don't build a framework when a function will do
- Don't create a base class when copy-paste with a shared helper is clearer
- If you need to explain how the code works beyond what the code itself says, it's too complex

### YAGNI — You Aren't Gonna Need It
Don't build for imagined future requirements. Build for what's in the current phase only.

- No extra fields "just in case"
- No optional parameters that aren't used yet
- No abstraction layers for flexibility we don't need
- The PO hook (`purchase_order_id`) is the one deliberate exception — it costs one nullable column

### Fail Loudly
Errors must never be silent. Every failure must produce a clear, human-readable message.

- CLI scripts: always print `✗ Error: [message]` and exit with code 1 on failure
- Never swallow exceptions with empty except blocks
- Never return None where an error occurred — raise or exit
- Validate inputs before inserting, not after

### Schema Is the Source of Truth
The database schema in `docs/08_schema.md` is the single source of truth for all data structures. If code and schema conflict, the code is wrong.

- Field names in code must match field names in schema exactly
- Enum values in code must match enum values in schema exactly
- TypeScript types must be regenerated after any schema change
- Never work around the schema — change the schema properly if needed

### No Business Logic in Scripts
Python CLI scripts collect input and call Supabase. Nothing else. All calculations belong in the database.

- No IGV calculation in Python — derived in `v_cost_totals`
- No balance calculation in Python — derived in `v_cost_balances`
- No payment status logic in Python — derived in views
- If you're doing math in a CLI script, stop and ask whether it belongs in a view

### One Responsibility Per File
Each file does one thing.

- One CLI script per operation (`add_cost.py` adds costs, nothing else)
- One view per derived concept (`v_cost_totals` computes cost totals, nothing else)
- One query function per query (`getProjectCosts`, not `getProjectData`)

### No Dead Code
Every file in the repository must be actively used. Files that no longer serve a purpose are deleted, not commented out or left "just in case."

- No commented-out code blocks — if it's not running, it's not here
- No unused functions, components, or query helpers
- No superseded migration files kept for reference — git history serves that purpose
- No build-time documents kept after their purpose is served (e.g. `docs/12_skills.md` is deleted after skills are built)
- No stale skill files — a skill that doesn't match current conventions is worse than no skill, because Claude Code will follow it incorrectly

When retiring a file: delete it, commit with a clear message explaining why, and update any document that referenced it.

---

## Language & Runtime

- **Python 3.11+** for all CLI scripts
- **TypeScript** for all Next.js website code
- **SQL** for schema, migrations, and views
- **No JavaScript** — TypeScript only on the frontend

---

## Python CLI Standards

### File Naming
All CLI scripts use snake_case with a verb prefix:

```
add_project.py
add_tag.py
add_entity.py
add_entity_contact.py
add_project_entity.py
add_cost.py
add_quote.py
add_valuation.py
add_ar_invoice.py
register_payment.py
view_ap_calendar.py
view_partner_balances.py
```

### Script Structure
Every CLI script follows this structure:

```python
#!/usr/bin/env python3
"""
Script name: add_cost.py
Purpose: Register a new cost (expense) in the database
"""

import os
from datetime import date
from dotenv import load_dotenv
from supabase import create_client

# --- Setup ---
load_dotenv()
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

# --- Helpers ---
def get_input(prompt, required=True, default=None):
    """Get validated input from user."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        if not required and default is not None:
            return default
        if not required:
            return None
        print("  This field is required.")

# --- Main ---
def main():
    print("\n=== Add Cost ===\n")
    # ... collect inputs
    # ... validate
    # ... insert to database
    # ... confirm success

if __name__ == "__main__":
    main()
```

### Input Handling
- Always strip whitespace from inputs
- Always confirm before inserting: show a summary and ask "Confirm? (y/n)"
- Never silently fail — always print a clear error message
- Optional fields show "(optional, press Enter to skip)"
- Display available options for foreign key fields (e.g. list all projects before asking for project)

### Error Handling
```python
try:
    response = supabase.table("costs").insert(data).execute()
    print(f"\n✓ Cost registered successfully (ID: {response.data[0]['id']})")
except Exception as e:
    print(f"\n✗ Error registering cost: {e}")
```

### No Business Logic in Scripts
CLI scripts only collect input and call the database. All calculations (subtotals, IGV, detraccion) happen in the database via views, not in Python.

---

## Database Standards

### Naming Conventions
- **Tables:** snake_case, plural nouns — `costs`, `ar_invoices`, `bank_accounts`
- **Columns:** snake_case — `partner_company_id`, `is_active`, `created_at`
- **Views:** snake_case, descriptive — `cost_balances`, `ap_calendar`, `partner_ledger`
- **Indexes:** `idx_[table]_[column]` — `idx_costs_project_id`
- **Foreign keys:** `fk_[table]_[referenced_table]` — `fk_costs_projects`

### Column Conventions
- Primary keys: always `id UUID DEFAULT gen_random_uuid()`
- Foreign keys: always `[table_singular]_id` — `project_id`, `entity_id`
- Booleans: always prefix with `is_` or `has_` — `is_active`, `is_detraccion_account`
- Timestamps: `created_at` and `updated_at` on every table
- Soft delete: `is_active BOOLEAN DEFAULT true` on every table — never hard delete
- Amounts: `NUMERIC(15,2)` for money, `NUMERIC(15,4)` for quantities and unit prices
- Rates/percentages: `NUMERIC(5,2)` — e.g. 18.00 for IGV, 4.00 for detraccion
- Currency: `VARCHAR(3)` — always 'USD' or 'PEN'
- Exchange rate: `NUMERIC(10,4)` — reference only, never used for conversion

### Migration Standards
- Every schema change is a new numbered migration file: `001_initial_schema.sql`, `002_add_field.sql`
- Migrations are never edited after being applied — always add a new migration
- Every migration includes a rollback comment

### Views
- Views never store data — always derived from source tables
- Views are prefixed with `v_` in SQL but referenced without prefix in application code
- Every view has a comment explaining its purpose and source tables

---

## TypeScript / Next.js Standards

### File Structure
```
/app
  /dashboard          → main dashboard page
  /projects           → project list and detail
  /entities           → entity/contact directory
  /ap-calendar        → AP payment calendar
  /partner-ledger     → partner contribution view
  /company-pl         → company P&L
  /api                → API routes (server-side Supabase queries)
/components
  /ui                 → reusable UI components
  /charts             → chart components
/lib
  /supabase.ts        → Supabase client setup
  /types.ts           → TypeScript types matching database schema
  /queries.ts         → reusable database query functions
```

### Naming Conventions
- **Components:** PascalCase — `ProjectCard`, `APCalendar`
- **Files:** kebab-case — `ap-calendar.tsx`, `project-card.tsx`
- **Functions:** camelCase — `getProjectCosts`, `formatCurrency`
- **Types:** PascalCase with suffix — `ProjectRow`, `CostItem`
- **Constants:** SCREAMING_SNAKE_CASE — `IGV_RATE`, `DEFAULT_CURRENCY`

### TypeScript Rules
- No `any` type — always define proper types
- All database row types defined in `/lib/types.ts` matching schema exactly
- All Supabase queries typed with generated types

### Currency Display
```typescript
// Always format currency with proper locale and symbol
const formatPEN = (amount: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)

const formatUSD = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
```

### Data Fetching
- All database queries happen server-side in `/app/api` routes or Server Components
- Never expose Supabase service key to client
- Use Supabase anon key for client-side reads (read-only website in V0)

---

## Git Standards

### Branch Naming
- `main` — production only
- `dev` — active development
- `feature/[description]` — new features
- `fix/[description]` — bug fixes

### Commit Messages
```
feat: add add_cost.py CLI script
fix: correct IGV calculation in cost_totals view
docs: update schema with cost_items table
chore: add .env.example file
```

### What Never Goes in Git
- `.env` files — use `.env.example` as template
- Supabase keys or any credentials
- Personal data or test data with real names/RUCs

---

## Environment Variables

All sensitive configuration lives in `.env` (never committed):

```
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_KEY=[service key — CLI scripts only]
```

An `.env.example` file with empty values is committed to the repo.

---

## What Claude Code Should Never Do Without Explicit Approval

- Modify the database schema
- Delete any data or drop any table
- Change existing migration files
- Push to `main` branch
- Store credentials in code
- Add external dependencies without discussion
- Change the document naming convention or folder structure

---

*Update this document when new conventions are established during development.*
