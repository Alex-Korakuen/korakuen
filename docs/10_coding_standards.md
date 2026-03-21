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

These principles apply to every file in this project — SQL and TypeScript.

### DRY — Don't Repeat Yourself
Every piece of logic exists in exactly one place. If you find yourself writing the same code in two places, extract it.

- Database query functions → `website/src/lib/queries/` (barrel-exported via `index.ts`)
- Currency formatters → `website/src/lib/formatters.ts`
- TypeScript types → `website/src/lib/types.ts`

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

- Never swallow exceptions with empty catch blocks
- Validate inputs before inserting, not after

### Schema Is the Source of Truth
The database schema in `docs/08_schema.md` is the single source of truth for all data structures. If code and schema conflict, the code is wrong.

- Field names in code must match field names in schema exactly
- Enum values in code must match enum values in schema exactly
- TypeScript types must be regenerated after any schema change
- Never work around the schema — change the schema properly if needed

### No Business Logic in UI Code
Website components collect input and call Supabase. All calculations belong in the database.

- No IGV calculation in TypeScript — derived in `v_invoice_totals`
- No balance calculation in TypeScript — derived in `v_invoice_balances`
- No payment status logic in TypeScript — derived in views
- If you're doing math in a component, stop and ask whether it belongs in a view

### One Responsibility Per File
Each file does one thing.

- One view per derived concept (`v_invoice_totals` computes invoice totals, nothing else)
- One query function per query (`getPaymentsPage`, not `getPaymentsData`)

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

- **TypeScript** for all Next.js website code
- **SQL** for schema, migrations, and views
- **No JavaScript** — TypeScript only on the frontend

---

## Database Standards

### Naming Conventions
- **Tables:** snake_case, plural nouns — `invoices`, `invoice_items`, `bank_accounts`
- **Columns:** snake_case — `partner_company_id`, `is_active`, `created_at`
- **Views:** snake_case, `v_` prefix, descriptive — `v_invoice_totals`, `v_obligation_calendar`, `v_loan_balances`
- **Indexes:** `idx_[table]_[column]` — `idx_invoices_project_id`
- **Foreign keys:** `fk_[table]_[referenced_table]` — `fk_invoices_projects`

### Column Conventions
- Primary keys: always `id UUID DEFAULT gen_random_uuid()`
- Foreign keys: always `[table_singular]_id` — `project_id`, `entity_id`
- Booleans: always prefix with `is_` or `has_` — `is_active`, `is_detraccion_account`
- Timestamps: `created_at` and `updated_at` on every table
- Soft delete: `is_active BOOLEAN DEFAULT true` on reference/master data tables (partner_companies, bank_accounts, entities, entity_contacts, tags, projects, categories, project_budgets) and the `project_partners` bridge table — transaction and historical reference tables are permanent records
- Amounts: `NUMERIC(15,2)` for money, `NUMERIC(15,4)` for quantities and unit prices
- Rates/percentages: `NUMERIC(5,2)` — e.g. 18.00 for IGV, 4.00 for detraccion
- Currency: `VARCHAR(3)` — always 'USD' or 'PEN'
- Exchange rate: `NUMERIC(10,4) NOT NULL DEFAULT 3.70` — mandatory on all financial tables, PEN per USD at transaction date. Enables application-layer conversion for reporting
- Title and notes: use `title TEXT` for a record's subject or name (required, NOT NULL). Use `notes TEXT` for optional free-form context (nullable). Never use `description` as a column name. Special identity fields (`name`, `legal_name`, `bank_name`, `invoice_number`) keep their specific names

### Migration Standards
- Every schema change is a new timestamped migration file: `20260301000001_initial_schema.sql`, `20260302000001_entity_location_fields.sql`
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
      page.tsx          → redirects / to /calendar
      calendar/         → obligation calendar — AP + AR (default landing)
      invoices/         → invoice browse and detail
      payments/         → payment browse and detail
      financial-position/ → balance sheet
      projects/         → project list and detail (includes partner settlement)
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
    queries/            → reusable server-side query functions (barrel export via index.ts)
    formatters.ts       → currency and date formatting
    auth.ts             → getCurrentUser, getPartnerName
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

### Delete / Remove Actions
All destructive actions (soft-delete, remove from list) use a **trash bin icon** — never a text button ("Remove", "Eliminate", "Delete") or an X icon. The standard pattern:

```tsx
<button
  onClick={handleRemove}
  disabled={isPending}
  className="text-red-400 hover:text-red-600 disabled:opacity-50"
  title="Remove [item]"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
</button>
```

- Color: `text-red-400 hover:text-red-600` (or `text-zinc-300 hover:text-red-500` for subtler contexts like inline table rows)
- Always include a `title` attribute for accessibility
- X icons are reserved for closing modals/panels, never for deleting data

### Data Fetching
- All database queries happen server-side in `/app/api` routes or Server Components
- Never expose Supabase service key to client
- Use Supabase anon key for client-side operations (RLS policies enforce access control)

---

## Git Standards

### Branch Naming
- `main` — production only
- `dev` — active development
- `feature/[description]` — new features
- `fix/[description]` — bug fixes

### Commit Messages
```
feat: add exchange rate form to settings page
fix: correct IGV calculation in v_invoice_totals view
docs: update schema with invoice_items table
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
