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

- One CLI module per entity type (`costs.py` handles all cost operations — add single, import from Excel)
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

### File Organization
The CLI uses a module-based structure with a single entry point:

```
cli/
├── main.py                    → single entry point (python main.py)
├── modules/
│   ├── __init__.py
│   ├── projects.py            → add single + import from Excel
│   ├── entities.py            → add entity, contact, tag + import
│   ├── costs.py               → add single + import costs/cost_items
│   ├── quotes.py              → add single + import from Excel
│   ├── valuations.py          → add single + import from Excel
│   ├── ar_invoices.py         → add single + import from Excel
│   ├── payments.py            → register payment, verify retencion
│   └── loans.py               → add loan, schedule, payments + import
├── lib/
│   ├── __init__.py
│   ├── db.py                  → shared Supabase client
│   ├── helpers.py             → shared input helpers + clear_screen
│   └── import_helpers.py      → shared import validation/highlighting
└── requirements.txt
```

Module files use snake_case entity names. No verb prefix — the module contains all operations for that entity.

### Module Structure
Every module file exposes a `menu()` function called by `main.py`, plus individual operation functions:

```python
#!/usr/bin/env python3
"""
Module: costs.py
Purpose: All cost operations — add single, import from Excel
Tables: costs, cost_items
"""

import sys
from lib.db import supabase
from lib.helpers import get_input, get_optional_input, confirm, list_choices, clear_screen


def menu():
    """Submenu for cost operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Costs ===\n")
        print("1. Add cost")
        print("2. Import costs from Excel")
        print("3. Import cost items from Excel")
        print("4. Back")
        choice = get_input("\nSelect option: ")
        if choice == "1":
            add_cost()
        elif choice == "2":
            import_costs()
        elif choice == "3":
            import_cost_items()
        elif choice == "4":
            return


def add_cost():
    """Register a single cost interactively."""
    clear_screen()
    print("\n=== Add Cost ===\n")
    # ... collect inputs, validate, show summary, confirm, insert
```

The `if __name__ == "__main__"` pattern is NOT used in module files. Only `main.py` is executed directly.

### Screen Clearing
Call `clear_screen()` every time entering a new menu level AND every time returning to a parent menu. This prevents terminal clutter for non-technical users.

- `menu()` calls `clear_screen()` at the top of its loop (before printing the submenu)
- Each operation function calls `clear_screen()` before printing its title
- After an operation completes, show `Press Enter to continue...` before returning to the submenu loop

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
- **Views:** snake_case, `v_` prefix, descriptive — `v_cost_balances`, `v_ap_calendar`, `v_partner_ledger`
- **Indexes:** `idx_[table]_[column]` — `idx_costs_project_id`
- **Foreign keys:** `fk_[table]_[referenced_table]` — `fk_costs_projects`

### Column Conventions
- Primary keys: always `id UUID DEFAULT gen_random_uuid()`
- Foreign keys: always `[table_singular]_id` — `project_id`, `entity_id`
- Booleans: always prefix with `is_` or `has_` — `is_active`, `is_detraccion_account`
- Timestamps: `created_at` and `updated_at` on every table
- Soft delete: `is_active BOOLEAN DEFAULT true` on reference/master data tables only (partner_companies, bank_accounts, entities, entity_contacts, tags, projects) — transaction and historical reference tables are permanent records
- Amounts: `NUMERIC(15,2)` for money, `NUMERIC(15,4)` for quantities and unit prices
- Rates/percentages: `NUMERIC(5,2)` — e.g. 18.00 for IGV, 4.00 for detraccion
- Currency: `VARCHAR(3)` — always 'USD' or 'PEN'
- Exchange rate: `NUMERIC(10,4) NOT NULL DEFAULT 3.70` — mandatory on all financial tables, PEN per USD at transaction date. Enables application-layer conversion for reporting
- Title and notes: use `title TEXT` for a record's subject or name (required, NOT NULL). Use `notes TEXT` for optional free-form context (nullable). Never use `description` as a column name. Special identity fields (`name`, `legal_name`, `bank_name`, `invoice_number`) keep their specific names

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
src/
  app/
    login/              → email/password login (no sidebar)
    auth/
      callback/         → invite email token exchange
      set-password/     → invited users set initial password
    (app)/              → route group — all authenticated pages (sidebar + header)
      page.tsx          → redirects / to /ap-calendar
      ap-calendar/      → AP payment calendar (default landing)
      ar-outstanding/   → AR outstanding & collections
      cash-flow/        → cash flow dashboard
      partner-balances/ → partner contribution view
      pl/               → company P&L
      financial-position/ → balance sheet
      projects/         → project list and detail
      entities/         → entity/contact directory
      prices/           → historical pricing reference
      settings/
        password/       → change password (within sidebar layout)
  components/           → shared components (sidebar, header, etc.)
  lib/
    supabase/
      server.ts         → server-side Supabase client (SSR cookie handling)
      client.ts         → browser-side Supabase client
    database.types.ts   → auto-generated from supabase gen types
    types.ts            → human-friendly type aliases and enums
    queries.ts          → reusable server-side query functions
    formatters.ts       → currency and date formatting
    auth.ts             → getCurrentUser, isCompanyView, getPartnerName
  middleware.ts         → redirects unauthenticated users to /login
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
feat: add costs.py CLI module
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
# CLI
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service key — CLI scripts only]

# Website
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]

# Supabase CLI tooling
SUPABASE_PROJECT_ID=[project ref]
SUPABASE_ACCESS_TOKEN=[CLI access token]
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
