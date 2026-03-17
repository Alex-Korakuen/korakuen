# Skill: Import Function Generator

**Trigger:** Any time an import-from-Excel function needs to be added to a CLI module.

**Input:**
- `docs/08_schema.md` — the target table's fields and constraints
- `docs/10_coding_standards.md` — module structure, naming, error handling
- `docs/11_environment_setup.md` — Supabase client initialization
- `imports/templates/[entity].xlsx` — the template file defining expected columns

**Output:** An `import_[entity]()` function within the corresponding `cli/modules/[entity].py` module file.

**Note:** The CLI is legacy — data entry has moved to the website. The costs and AR invoice import functions no longer exist (V1 unified invoice model). This skill documents the general import pattern for any remaining or future CLI imports.

---

## Function Template

Every import function follows this exact structure within its module file:

```python
import pandas as pd
from openpyxl import load_workbook
from lib.db import supabase
from lib.helpers import get_input, confirm, clear_screen
from lib.import_helpers import (
    RED_FILL,
    NO_FILL,
    DATA_START_ROW,
    clear_highlighting,
    apply_error_highlighting,
    validate_required,
    validate_enum,
    validate_lookup,
    validate_date,
    validate_number,
    print_errors,
)


def _load_invoice_lookups():
    """Pre-load all FK lookup tables from the database."""
    projects = supabase.table("projects").select("id, project_code").eq("is_active", True).execute()
    entities = supabase.table("entities").select("id, document_number").eq("is_active", True).execute()
    partners = supabase.table("partner_companies").select("id, name").eq("is_active", True).execute()
    quotes = supabase.table("quotes").select("id, document_ref").execute()

    return {
        "projects": {r["project_code"]: r["id"] for r in projects.data},
        "entities": {r["document_number"]: r["id"] for r in entities.data},
        "partners": {r["name"]: r["id"] for r in partners.data},
        "quotes": {r["document_ref"]: r["id"] for r in quotes.data if r["document_ref"]},
    }


def _validate_invoice_row(row_num, row, errors, lookups):
    """Validate a single row. Appends errors to the errors list."""
    # Required fields
    validate_required(row_num, row, "direction", errors)
    validate_required(row_num, row, "invoice_date", errors)
    validate_required(row_num, row, "igv_rate", errors)
    validate_required(row_num, row, "currency", errors)
    validate_required(row_num, row, "partner_company_name", errors)

    # Enum validation
    validate_enum(row_num, row, "direction", ["payable", "receivable"], errors)
    validate_enum(row_num, row, "cost_type", ["project_cost", "sga"], errors)
    validate_enum(row_num, row, "currency", ["USD", "PEN"], errors)
    validate_enum(row_num, row, "comprobante_type",
                  ["factura", "boleta", "recibo_por_honorarios",
                   "liquidacion_de_compra", "planilla_jornales", "none"], errors)

    # Date validation
    validate_date(row_num, row, "invoice_date", errors)
    validate_date(row_num, row, "due_date", errors)

    # Number validation
    validate_number(row_num, row, "igv_rate", errors)
    validate_number(row_num, row, "detraccion_rate", errors)
    validate_number(row_num, row, "exchange_rate", errors)

    # FK lookup validation
    validate_lookup(row_num, row, "project_code", lookups["projects"], errors)
    validate_lookup(row_num, row, "entity_document_number", lookups["entities"], errors)
    validate_lookup(row_num, row, "partner_company_name", lookups["partners"], errors)
    validate_lookup(row_num, row, "quote_document_ref", lookups["quotes"], errors)

    # Cross-field validation
    if not pd.isna(row.get("direction")) and row["direction"] == "payable":
        if not pd.isna(row.get("cost_type")) and row["cost_type"] == "project_cost":
            if pd.isna(row.get("project_code")) or str(row["project_code"]).strip() == "":
                errors.append((row_num, "project_code",
                               "Required when cost_type is project_cost"))


def _build_invoice_record(row, lookups):
    """Convert a spreadsheet row to a database record, resolving lookups."""
    data = {
        "direction": row["direction"],
        "partner_company_id": lookups["partners"][row["partner_company_name"]],
        "invoice_date": str(row["invoice_date"]),
        "igv_rate": float(row["igv_rate"]),
        "currency": row["currency"],
    }
    # Optional fields — add only if present
    if not pd.isna(row.get("project_code")) and str(row["project_code"]).strip():
        data["project_id"] = lookups["projects"][row["project_code"]]
    if not pd.isna(row.get("entity_document_number")) and str(row["entity_document_number"]).strip():
        data["entity_id"] = lookups["entities"][row["entity_document_number"]]
    if not pd.isna(row.get("quote_document_ref")) and str(row["quote_document_ref"]).strip():
        data["quote_id"] = lookups["quotes"][row["quote_document_ref"]]
    if not pd.isna(row.get("cost_type")) and str(row["cost_type"]).strip():
        data["cost_type"] = row["cost_type"]
    if not pd.isna(row.get("title")) and str(row["title"]).strip():
        data["title"] = str(row["title"]).strip()
    if not pd.isna(row.get("detraccion_rate")):
        data["detraccion_rate"] = float(row["detraccion_rate"])
    if not pd.isna(row.get("exchange_rate")):
        data["exchange_rate"] = float(row["exchange_rate"])
    if not pd.isna(row.get("comprobante_type")) and str(row["comprobante_type"]).strip():
        data["comprobante_type"] = row["comprobante_type"]
    if not pd.isna(row.get("invoice_number")) and str(row["invoice_number"]).strip():
        data["invoice_number"] = row["invoice_number"]
    if not pd.isna(row.get("document_ref")) and str(row["document_ref"]).strip():
        data["document_ref"] = row["document_ref"]
    if not pd.isna(row.get("notes")) and str(row["notes"]).strip():
        data["notes"] = str(row["notes"]).strip()
    if not pd.isna(row.get("due_date")):
        data["due_date"] = str(row["due_date"])
    if not pd.isna(row.get("payment_method")) and str(row["payment_method"]).strip():
        data["payment_method"] = row["payment_method"]
    return data


def import_invoices():
    """Import invoices from an Excel spreadsheet. Called from menu()."""
    clear_screen()
    print("\n=== Import Invoices ===\n")

    file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")

    # --- Read file ---
    df = pd.read_excel(file_path, header=0, skiprows=[1, 2, 3], engine="openpyxl")

    if df.empty:
        print("✗ No data rows found in file.")
        input("\nPress Enter to continue...")
        return

    print(f"Found {len(df)} data rows.")

    # --- Load lookups ---
    lookups = _load_invoice_lookups()

    # --- Validate all rows ---
    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_invoice_row(excel_row, row, errors, lookups)

    # --- Handle errors ---
    if errors:
        wb = load_workbook(file_path)
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        clear_highlighting(ws)
        apply_error_highlighting(ws, errors, headers)
        wb.save(file_path)

        print_errors(errors, file_path)
        input("\nPress Enter to continue...")
        return

    # --- Clear previous highlighting on clean run ---
    wb = load_workbook(file_path)
    ws = wb.active
    clear_highlighting(ws)
    wb.save(file_path)

    # --- Show summary ---
    print(f"\n--- Summary ---")
    print(f"  File:    {file_path}")
    print(f"  Records: {len(df)}")
    print(f"\n  First 3 rows:")
    for i, (_, row) in enumerate(df.head(3).iterrows()):
        preview = {k: v for k, v in row.to_dict().items() if not pd.isna(v)}
        print(f"    {i+1}. {preview}")

    # --- Confirm ---
    if not confirm(f"\nImport {len(df)} records?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Batch insert ---
    try:
        records = [_build_invoice_record(row, lookups) for _, row in df.iterrows()]
        response = supabase.table("invoices").insert(records).execute()
        print(f"\n✓ {len(response.data)} invoices imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")
```

**Key differences from the old standalone pattern:**
- Function is called from the module's `menu()`, not as a standalone script
- File path collected via `get_input()` prompt (supports macOS drag-and-drop), not `sys.argv`
- No `if __name__ == "__main__"` block
- Helper functions prefixed with `_` (private to module) — e.g., `_load_invoice_lookups()`, `_validate_invoice_row()`, `_build_invoice_record()`
- On error, returns to submenu instead of `sys.exit(1)`
- Shows `Press Enter to continue...` before returning to submenu

---

## Rules

### File Format — XLSX Only

Import functions accept `.xlsx` files only. No CSV support — the function writes error highlighting back to the source file, which requires Excel format.

### Template Structure — 4 Rows Before Data

Every import template has 4 header rows:
1. **Row 1:** Column names (exact match to expected field names)
2. **Row 2:** Example data showing expected format
3. **Row 3:** Field descriptions (data type, required/optional, notes)
4. **Row 4:** Allowed values for enum fields (light grey background)
5. **Row 5+:** User data

The function reads row 1 as headers and skips rows 2-4. Data starts at row 5.

```python
df = pd.read_excel(file_path, header=0, skiprows=[1, 2, 3], engine="openpyxl")
```

### File Path — Prompt with Drag-and-Drop Support

```python
file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")
```

On macOS, dragging a file from Finder into the terminal pastes the path — sometimes with surrounding quotes or trailing spaces. Always strip both whitespace and quotes.

### Modify Source File In Place

When validation errors are found, the function:
1. Opens the source `.xlsx` file with openpyxl
2. Clears all previous red highlighting (cells from earlier runs)
3. Applies dark red fill to each error cell
4. Saves the file

The user fixes the highlighted cells in the same file and re-runs. No copies, no new files.

### Clear Previous Highlighting on Every Run

Before applying new error highlighting — or before inserting on a clean run — always clear all cell fills from row 5 onward. This ensures cells fixed since the last run don't stay red.

### All Errors Before Aborting

Never stop at the first error. Validate every row, every field, collect all errors, then report them all at once. The user should be able to fix everything in one pass.

### No Partial Inserts

Validation must be 100% clean before a single row is inserted. Either all rows pass and all are inserted, or nothing is inserted.

### Lookup Columns — Human-Readable Identifiers

Templates use human-readable identifiers instead of UUIDs:

| Template Column | Resolves To | Lookup Table |
|---|---|---|
| `project_code` | `project_id` | projects (by project_code) |
| `entity_document_number` | `entity_id` | entities (by document_number) |
| `client_entity_document_number` | `client_entity_id` | entities (by document_number) |
| `bank_name` + `bank_account_last4` | `bank_account_id` | bank_accounts (by bank_name + account_number_last4) |
| `partner_company_name` | `partner_company_id` | partner_companies (by name) |
| `invoice_document_ref` | `invoice_id` | invoices (by document_ref) |
| `quote_document_ref` | `quote_id` | quotes (by document_ref) |

If a lookup fails, the cell gets highlighted red with the message "Not found in database".

**Limitation:** `invoice_document_ref` resolves parent invoices via the `document_ref` field, but that field is nullable. Invoices created without a `document_ref` cannot have their invoice_items imported via Excel — those items must be added through the website.

### Validation Rules

Every import function validates:

1. **Required fields:** cell is not empty
2. **Data types:** dates are valid dates, numbers are valid numbers, booleans are true/false
3. **Enum values:** value is in the allowed list (cost_type, currency, status, comprobante_type, etc.)
4. **FK lookups:** referenced record exists in the database and is active
5. **Format checks:** document numbers match expected patterns (RUC=11 digits, DNI=8 digits), currency codes are USD or PEN
6. **Cross-field rules:** if `direction` is `payable` and `cost_type` is `project_cost`, then `project_code` should be present; if `retencion_applicable` is true, `retencion_rate` must be present
7. **Uniqueness:** where applicable (e.g., entity document_number, project_code), check for duplicates within the file and against the database

### Error Reporting — Terminal

Errors are printed as a formatted table:

```
✗ 5 validation error(s) found:

  Row    Column                         Error
  ---    ------                         -----
  5      invoice_date                   Required field is empty
  5      direction                      Must be one of: payable, receivable
  7      project_code                   Not found in database
  8      currency                       Must be one of: USD, PEN
  9      bank_account_last4             Not found in database

Errors highlighted in red in: /path/to/file.xlsx
Fix the highlighted cells and re-run.
```

### Error Reporting — Excel

Each error cell gets a dark red background fill (`fgColor='8B0000'`). Only error cells are highlighted — correct cells are left unformatted. Previous highlights are always cleared first.

### Confirmation Pattern

After successful validation, show:

```
--- Summary ---
  File:    /path/to/invoices.xlsx
  Records: 47

  First 3 rows:
    1. {'direction': 'payable', 'project_code': 'PRY001', 'invoice_date': '2026-03-01', ...}
    2. {'direction': 'payable', 'project_code': 'PRY001', 'invoice_date': '2026-03-02', ...}
    3. {'direction': 'receivable', 'project_code': 'PRY002', 'invoice_date': '2026-03-03', ...}

Import 47 records? (y/n):
```

### Import Order

Import functions must be run in dependency order matching the database schema layers:

1. `entities.import_entities()` — no dependencies (Layer 1)
2. `quotes.import_quotes()` — depends on projects and entities (Layer 3)
3. Invoices import — depends on projects, entities, partner_companies (Layer 4)
4. Invoice items import — depends on invoices (Layer 4)

---

## lib/import_helpers.py Reference

All import functions share these utilities from `lib/import_helpers.py`:

### Constants

- `RED_FILL = PatternFill(fill_type='solid', fgColor='8B0000')` — dark red cell fill for error highlighting
- `NO_FILL = PatternFill(fill_type=None)` — reset cell to no fill
- `DATA_START_ROW = 5` — first row of user data in templates (rows 1-4 are header rows)

### Functions

- `clear_highlighting(ws)` — reset all cell fills from `DATA_START_ROW` onward. Called before applying new highlights and before inserting on a clean run.
- `apply_error_highlighting(ws, errors, headers)` — apply `RED_FILL` to each error cell. `errors` is a list of `(row_num, column_name, message)` tuples. `headers` maps column names to column indices.
- `validate_required(row_num, row, field, errors)` — check that field is not empty/NaN. Appends `(row_num, field, "Required field is empty")` if missing.
- `validate_enum(row_num, row, field, allowed_values, errors)` — check that field value is in the allowed list. Appends `(row_num, field, "Must be one of: ...")` if invalid. Skips validation if field is empty (use `validate_required` separately for required enums).
- `validate_lookup(row_num, row, field, lookup_dict, errors)` — check that field value exists as a key in `lookup_dict`. Appends `(row_num, field, "Not found in database")` if missing. Skips if field is empty.
- `validate_date(row_num, row, field, errors)` — check that field is a valid date. Appends `(row_num, field, "Invalid date format")` if invalid. Skips if field is empty.
- `validate_number(row_num, row, field, errors)` — check that field is a valid number. Appends `(row_num, field, "Must be a number")` if invalid. Skips if field is empty.
- `print_errors(errors, file_path)` — print formatted error table to terminal showing row, column, and error message for each error. Shows total count and the file path where errors are highlighted.

---

## Verification

After generating an import function:

1. Function lives inside a module file in `cli/modules/`
2. Called from the module's `menu()` function
3. Uses `from lib.db import supabase` — never direct Supabase import
4. Uses `from lib.import_helpers import ...` — never inline validation logic
5. Collects file path via prompt with drag-and-drop support (strip quotes)
6. Reads header from row 1, skips rows 2-4, data starts at row 5
7. Pre-loads all FK lookup tables before validation
8. Validates every row, every field — collects all errors
9. On error: highlights cells red in source file, prints error table, returns to submenu
10. On clean validation: clears previous highlights, shows summary with count + sample, asks for confirmation
11. Batch inserts all records in one operation
12. Has try/except with success (`✓`) and error (`✗`) messages
13. No business logic — lookup resolution only, no calculations
14. Shows `Press Enter to continue...` before returning to submenu
