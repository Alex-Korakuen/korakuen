# Skill: SQL Schema Generator

**Trigger:** Any time a CREATE TABLE statement needs to be written or modified.

**Input:** `docs/08_schema.md` — field names, types, nullability, and notes.

**Output:** `supabase/migrations/`

---

## File Structure

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

## Table Order — Dependency Order

Generate tables in this exact order so foreign keys never reference a table that doesn't exist yet:

1. `partner_companies`
2. `bank_accounts`
3. `entities`
4. `tags`
5. `entity_tags`
6. `entity_contacts`
7. `projects`
8. `project_entities`
9. `valuations`
10. `quotes`
11. `costs`
12. `cost_items`
13. `ar_invoices`
14. `payments`
15. `loans`
16. `loan_schedule`
17. `loan_payments`
18. `project_budgets`

---

## Rules

### Primary Keys

Every table:

```sql
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
```

### Timestamps — Every Table

```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
```

Exception: `entity_tags` has `created_at` only — no `updated_at`.

### Auto-Update Trigger

Define the shared function once at the top of the file, then create a trigger per table:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Per table (skip for `entity_tags`):

```sql
CREATE TRIGGER trg_[table_name]_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Soft Delete

Reference/master data tables only (partner_companies, bank_accounts, entities, entity_contacts, tags, projects):

```sql
is_active BOOLEAN DEFAULT true NOT NULL
```

Transaction tables (costs, cost_items, ar_invoices, payments, loans, loan_schedule, loan_payments) and historical reference tables (valuations, quotes, project_entities, project_budgets) have no `is_active` — they are permanent records. `entity_tags` also has no `is_active` — tag assignments are deleted and recreated.

### Foreign Keys — Always Explicit

```sql
CONSTRAINT fk_[table]_[referenced_table]
  FOREIGN KEY ([field_id])
  REFERENCES [referenced_table](id)
  ON DELETE RESTRICT
```

### ON DELETE Behavior

- **Default:** `RESTRICT` — prevents deleting a parent if children exist
- **CASCADE** only for: `entity_tags` (both FKs), `cost_items.cost_id`
- **Never** use `SET NULL` — nullable FK fields exist for business reasons, not cascades

### NUMERIC Types

| Use | Type |
|---|---|
| Money amounts | `NUMERIC(15,2)` |
| Quantities and unit prices | `NUMERIC(15,4)` |
| Rates and percentages | `NUMERIC(5,2)` — e.g. 18.00 for IGV |
| Exchange rates | `NUMERIC(10,4)` |

### VARCHAR

- Short codes (RUC): `VARCHAR(11)`
- Currency codes: `VARCHAR(3)`
- Enum-like fields (status, type): `VARCHAR(50)`
- Names and descriptions where length is unbounded: `TEXT`

### Inline Comments

Add a comment on every non-obvious field:

```sql
igv_rate NUMERIC(5,2) DEFAULT 18.00 NOT NULL, -- Peru VAT, editable per transaction
is_detraccion_account BOOLEAN DEFAULT false NOT NULL, -- true for Banco de la Nación detracción accounts
purchase_order_id UUID, -- reserved for future PO module — always null in V0
```

### Enums — Use VARCHAR, Not PostgreSQL ENUM

All enum-like values are VARCHAR with CHECK constraints or application-level validation. Do not create PostgreSQL ENUM types.

Known enum values per field:

| Field | Valid Values |
|---|---|
| `partner_companies.owner_document_type` | RUC, DNI, CE, Pasaporte |
| `entities.entity_type` | company, individual |
| `entities.document_type` | RUC, DNI, CE, Pasaporte |
| `bank_accounts.account_type` | checking, savings, detraccion |
| `bank_accounts.currency` | USD, PEN |
| `projects.project_type` | subcontractor, oxi |
| `projects.status` | prospect, active, completed, cancelled |
| `projects.contract_currency` | USD, PEN |
| `valuations.status` | open, closed |
| `valuations.billed_currency` | USD, PEN |
| `quotes.status` | pending, accepted, rejected |
| `quotes.currency` | USD, PEN |
| `costs.cost_type` | project_cost, sga |
| `costs.currency` | USD, PEN |
| `costs.comprobante_type` | factura, boleta, recibo_por_honorarios, liquidacion_de_compra, planilla_jornales, none |
| `costs.payment_method` | bank_transfer, cash, check |
| `cost_items.category` | materials, labor, subcontractor, equipment_rental, permits_regulatory, software_licenses, partner_compensation, business_development, professional_services, office_admin, other |
| `ar_invoices.comprobante_type` | factura, boleta, recibo_por_honorarios |
| `ar_invoices.currency` | USD, PEN |
| `payments.related_to` | cost, ar_invoice |
| `payments.direction` | inbound, outbound |
| `payments.payment_type` | regular, detraccion, retencion |
| `payments.currency` | USD, PEN |
| `loans.return_type` | percentage, fixed |
| `loans.status` | active, partially_paid, settled |
| `loans.currency` | USD, PEN |
| `loan_payments.currency` | USD, PEN |
| `loan_payments.source` | project_settlement, personal_funds, other |
| `project_budgets.currency` | USD, PEN |

### What NOT to Do

- Never store derived data (totals, balances, payment status) — these are computed in views
- Never create triggers for business logic — only the `updated_at` trigger
- Never use `SET NULL` on foreign keys
- Never add fields not in `docs/08_schema.md` without explicit approval
- Never use PostgreSQL ENUM types — use VARCHAR

---

## Verification

After generating the SQL file:

1. Every table from `docs/08_schema.md` has a corresponding CREATE TABLE
2. Field names match the schema document exactly
3. All 17 tables have the `updated_at` trigger (except `entity_tags`)
4. Only the 6 reference/master tables have `is_active` (partner_companies, bank_accounts, entities, entity_contacts, tags, projects)
5. All foreign keys use explicit CONSTRAINT syntax with correct ON DELETE
6. The file runs without errors via `supabase db execute --file`
