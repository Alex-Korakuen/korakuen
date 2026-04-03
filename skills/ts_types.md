# Skill: TypeScript Types Generator

**Trigger:** Any time TypeScript types need to be created or updated after a schema change.

**Input:**
- `docs/08_schema.md` — table structures and field types
- `docs/11_environment_setup.md` — Supabase project setup

**Output:**
- `website/src/lib/database.types.ts` — auto-generated, never hand-edited
- `website/src/lib/types.ts` — human-friendly types, enums, and composite types

---

## Workflow

### Step 1 — Generate Base Types via Supabase CLI

```bash
npx supabase gen types typescript \
  --project-id [project-ref] \
  --schema public \
  > website/src/lib/database.types.ts
```

This produces the raw generated file. **Never edit `database.types.ts` directly** — it gets overwritten on every regeneration.

### Step 2 — Write Human-Friendly Types in `types.ts`

Import from the generated file and create clean aliases:

```typescript
import type { Database } from './database.types'

// === Table row types (read from database) ===
// Use base names (no Row suffix) for table types used in application code.

export type Entity = Database['public']['Tables']['entities']['Row']
export type EntityContact = Database['public']['Tables']['entity_contacts']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
// ... add more as needed

// === View row types (use Row suffix to distinguish from table types) ===

export type InvoiceBalanceRow = Database['public']['Views']['v_invoice_balances']['Row']
export type ObligationCalendarRow = Database['public']['Views']['v_obligation_calendar']['Row']
export type InvoicesWithLoansRow = Database['public']['Views']['v_invoices_with_loans']['Row']
export type BudgetVsActualRow = Database['public']['Views']['v_budget_vs_actual']['Row']

// === Insert types (for forms) ===

export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert']
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type LoanInsert = Database['public']['Tables']['loans']['Insert']
export type LoanScheduleInsert = Database['public']['Tables']['loan_schedule']['Insert']
export type ProjectBudgetInsert = Database['public']['Tables']['project_budgets']['Insert']
// ... add more as needed
```

### Step 3 — Define Enum Types Matching Schema Values

Every enum must exactly match the VARCHAR values stored in the database:

```typescript
// === Enum types — must match schema VARCHAR values exactly ===

export type EntityType = 'company' | 'individual'
export type DocumentType = 'RUC' | 'DNI' | 'CE' | 'Pasaporte'
export type AccountType = 'checking' | 'savings' | 'detraccion'
export type Currency = 'USD' | 'PEN'
export type ProjectType = 'subcontractor' | 'oxi'
export type ProjectStatus = 'prospect' | 'active' | 'completed' | 'cancelled'
export type CostType = 'project_cost' | 'sga' | 'intercompany'
export type InvoiceDirection = 'payable' | 'receivable'
export type PaymentRelatedTo = 'invoice' | 'loan_schedule' | 'loan'
export type PaymentDirection = 'inbound' | 'outbound'
export type PaymentType = 'regular' | 'detraccion' | 'retencion'

export type QuoteStatus = 'pending' | 'accepted' | 'rejected'

// Optional — add when used in application code:
// export type PaymentStatus = 'pending' | 'partial' | 'paid'
// export type LoanReturnType = 'percentage' | 'fixed'

// Cost item categories — values come from the `categories` table
// project_cost: materials, labor, subcontractor, equipment_rental, housing_food, other
// sga: software_licenses, partner_compensation, professional_services, other_sga
export type CostCategory = string  // dynamic — managed in categories table
```

### Step 4 — Define Composite Types for Joined Queries

```typescript
// === Composite types for views and joined queries ===

export type InvoiceWithItems = Invoice & {
  invoice_items: InvoiceItem[]
  entity: Entity | null
  project: Project | null
}

export type InvoiceWithTotals = Invoice & {
  subtotal: number
  igv_amount: number
  detraccion_amount: number
  retencion_amount: number
  total: number
}

export type InvoiceWithBalance = InvoiceWithTotals & {
  amount_paid: number
  outstanding: number
  payment_status: PaymentStatus
}

export type ObligationCalendarEntry = {
  invoice_id: string
  type: 'commercial' | 'loan'
  direction: InvoiceDirection | null
  project_code: string | null
  project_name: string | null
  entity_name: string | null
  title: string
  due_date: string
  days_remaining: number
  total: number
  amount_paid: number
  outstanding: number
  currency: Currency
  payment_status: PaymentStatus
}

export type LoanWithBalance = {
  total_owed: number
  total_paid: number
  outstanding: number
  scheduled_total: number
  next_payment_date: string | null
}

export type BudgetVsActual = {
  project_id: string
  project_code: string
  project_name: string
  category: CostCategory
  budgeted_amount: number
  actual_amount: number
  variance: number
  currency: Currency
}
```

---

## Rules

- **Never use `any`** — every query result must be typed
- **Composite types for all joined queries** — never `any[]`
- **Regenerate `database.types.ts`** after every schema change
- **Never edit `database.types.ts` directly** — it is auto-generated
- **All enum values must exactly match** the VARCHAR values in the schema
- **Table row types use base names** (e.g. `Entity`, `Invoice`), **view row types end in `Row`** (e.g. `InvoiceBalanceRow`), **insert types end in `Insert`**
- **Add composite types as needed** when new views or joined queries are written

---

## Verification

After generating or updating types:

1. `database.types.ts` was regenerated from current schema (not hand-edited)
2. Every table used in application code has a corresponding type in `types.ts`
3. All enum type values match VARCHAR values in `docs/08_schema.md` exactly
4. No `any` types anywhere in the types file
5. Composite types exist for all views that the website consumes
6. The website builds without TypeScript errors
