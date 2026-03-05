# Skill: TypeScript Types Generator

**Trigger:** Any time TypeScript types need to be created or updated after a schema change.

**Input:**
- `docs/08_schema.md` — table structures and field types
- `docs/11_environment_setup.md` — Supabase project setup

**Output:**
- `website/lib/database.types.ts` — auto-generated, never hand-edited
- `website/lib/types.ts` — human-friendly types, enums, and composite types

---

## Workflow

### Step 1 — Generate Base Types via Supabase CLI

```bash
npx supabase gen types typescript \
  --project-id [project-ref] \
  --schema public \
  > website/lib/database.types.ts
```

This produces the raw generated file. **Never edit `database.types.ts` directly** — it gets overwritten on every regeneration.

### Step 2 — Write Human-Friendly Types in `types.ts`

Import from the generated file and create clean aliases:

```typescript
import type { Database } from './database.types'

// === Row types (read from database) ===

export type PartnerCompanyRow = Database['public']['Tables']['partner_companies']['Row']
export type BankAccountRow = Database['public']['Tables']['bank_accounts']['Row']
export type EntityRow = Database['public']['Tables']['entities']['Row']
export type TagRow = Database['public']['Tables']['tags']['Row']
export type EntityTagRow = Database['public']['Tables']['entity_tags']['Row']
export type EntityContactRow = Database['public']['Tables']['entity_contacts']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ProjectEntityRow = Database['public']['Tables']['project_entities']['Row']
export type QuoteRow = Database['public']['Tables']['quotes']['Row']
export type CostRow = Database['public']['Tables']['costs']['Row']
export type CostItemRow = Database['public']['Tables']['cost_items']['Row']
export type ArInvoiceRow = Database['public']['Tables']['ar_invoices']['Row']
export type PaymentRow = Database['public']['Tables']['payments']['Row']
export type LoanRow = Database['public']['Tables']['loans']['Row']
export type LoanScheduleRow = Database['public']['Tables']['loan_schedule']['Row']
export type LoanPaymentRow = Database['public']['Tables']['loan_payments']['Row']
export type ProjectBudgetRow = Database['public']['Tables']['project_budgets']['Row']

// === Insert types (for forms in V1) ===

export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type CostInsert = Database['public']['Tables']['costs']['Insert']
export type CostItemInsert = Database['public']['Tables']['cost_items']['Insert']
export type ArInvoiceInsert = Database['public']['Tables']['ar_invoices']['Insert']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type LoanInsert = Database['public']['Tables']['loans']['Insert']
export type LoanScheduleInsert = Database['public']['Tables']['loan_schedule']['Insert']
export type LoanPaymentInsert = Database['public']['Tables']['loan_payments']['Insert']
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
export type QuoteStatus = 'pending' | 'accepted' | 'rejected'
export type CostType = 'project_cost' | 'sga'
export type ComprobanteType = 'factura' | 'boleta' | 'recibo_por_honorarios' | 'liquidacion_de_compra' | 'planilla_jornales' | 'none'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'check'
export type PaymentRelatedTo = 'cost' | 'ar_invoice'
export type PaymentDirection = 'inbound' | 'outbound'
export type PaymentType = 'regular' | 'detraccion' | 'retencion'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type LoanReturnType = 'percentage' | 'fixed'
export type LoanStatus = 'active' | 'partially_paid' | 'settled'
export type LoanPaymentSource = 'project_settlement' | 'personal_funds' | 'other'

// Cost item categories — project costs
export type ProjectCostCategory =
  | 'materials'
  | 'labor'
  | 'subcontractor'
  | 'equipment_rental'
  | 'permits_regulatory'
  | 'other'

// Cost item categories — SG&A
export type SgaCostCategory =
  | 'software_licenses'
  | 'partner_compensation'
  | 'business_development'
  | 'professional_services'
  | 'office_admin'
  | 'other'

export type CostCategory = ProjectCostCategory | SgaCostCategory
```

### Step 4 — Define Composite Types for Joined Queries

```typescript
// === Composite types for views and joined queries ===

export type CostWithItems = CostRow & {
  cost_items: CostItemRow[]
  entity: EntityRow | null
  project: ProjectRow | null
}

export type CostWithTotals = CostRow & {
  subtotal: number
  igv_amount: number
  detraccion_amount: number
  total: number
}

export type CostWithBalance = CostWithTotals & {
  amount_paid: number
  outstanding: number
  payment_status: PaymentStatus
}

export type ArInvoiceWithBalance = ArInvoiceRow & {
  igv_amount: number
  gross_total: number
  detraccion_amount: number
  retencion_amount: number
  net_receivable: number
  amount_paid: number
  outstanding: number
  payment_status: PaymentStatus
}

export type ApCalendarEntry = {
  cost_id: string
  source_type: 'cost' | 'loan_payment'
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

export type LoanWithBalance = LoanRow & {
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
- **Row types end in `Row`**, insert types end in `Insert`
- **Add composite types as needed** when new views or joined queries are written

---

## Verification

After generating or updating types:

1. `database.types.ts` was regenerated from current schema (not hand-edited)
2. Every table in the schema has a corresponding `Row` type in `types.ts`
3. All enum type values match VARCHAR values in `docs/08_schema.md` exactly
4. No `any` types anywhere in the types file
5. Composite types exist for all views that the website consumes
6. The website builds without TypeScript errors
