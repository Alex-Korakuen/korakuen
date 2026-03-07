# Skill: CLI Module Generator

**Trigger:** Any time a new CLI module or module function needs to be written.

**Input:**
- `docs/08_schema.md` — the target table's fields and constraints
- `docs/10_coding_standards.md` — module structure, naming, error handling
- `docs/11_environment_setup.md` — Supabase client initialization

**Output:** A module file in `cli/modules/` named by entity type (e.g., `costs.py`, `entities.py`). Each module exposes a `menu()` function and individual operation functions.

---

## Module Template

Every CLI module follows this exact structure:

```python
#!/usr/bin/env python3
"""
Module: costs.py
Purpose: All cost operations — add single, import from Excel
Tables: costs, cost_items
"""

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

    # --- Collect inputs ---
    # [show available options for FK fields]
    # [collect required and optional fields]

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project:  {project_code} — {project_name}")
    print(f"  Amount:   {currency} {subtotal:,.2f}")
    # ... all fields

    # --- Confirm ---
    if not confirm("Register this cost?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Insert ---
    try:
        response = supabase.table("costs").insert(data).execute()
        print(f"\n✓ Cost registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


def import_costs():
    """Import costs from an Excel spreadsheet."""
    clear_screen()
    print("\n=== Import Costs ===\n")
    file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")
    # ... read file, validate, confirm, batch insert
    # See skills/import_script.md for full import pattern
    input("\nPress Enter to continue...")
```

The `if __name__ == "__main__"` pattern is NOT used in module files. Only `main.py` is executed directly.

---

## How main.py Calls Modules

`main.py` is the single entry point. It handles navigation only — no business logic:

```python
#!/usr/bin/env python3
"""
Entry point: main.py
Purpose: Main menu for the Korakuen Management System
"""

from lib.helpers import get_input, clear_screen
from modules import projects, entities, costs, quotes, ar_invoices, payments, loans, exchange_rates


def main():
    while True:
        clear_screen()
        print("\n=== Korakuen Management System ===\n")
        print("1. Projects")
        print("2. Entities & Contacts")
        print("3. Costs")
        print("4. Quotes")
        print("5. AR Invoices")
        print("6. Payments")
        print("7. Loans")
        print("8. Exchange Rates")
        print("0. Exit")
        choice = get_input("\nSelect option: ")
        if choice == "1":
            projects.menu()
        elif choice == "2":
            entities.menu()
        elif choice == "3":
            costs.menu()
        elif choice == "4":
            quotes.menu()
        elif choice == "5":
            ar_invoices.menu()
        elif choice == "6":
            payments.menu()
        elif choice == "7":
            loans.menu()
        elif choice == "8":
            exchange_rates.menu()
        elif choice == "0":
            print("\nGoodbye.\n")
            return


if __name__ == "__main__":
    main()
```

---

## Rules

### Always Use Shared Modules

```python
from lib.db import supabase
from lib.helpers import get_input, get_optional_input, confirm, list_choices, clear_screen
```

Never import Supabase directly in a module — always via `lib/db.py`.

For modules with import functionality, also use:

```python
from lib.import_helpers import (
    RED_FILL, NO_FILL, DATA_START_ROW,
    clear_highlighting, apply_error_highlighting,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_number, print_errors,
)
```

### Module Opening — Always

```python
#!/usr/bin/env python3
"""
Module: costs.py
Purpose: All cost operations — add single, import from Excel
Tables: costs, cost_items
"""
```

### Screen Clearing

Call `clear_screen()` every time entering a new menu level AND every time returning to a parent menu. This prevents terminal clutter for non-technical users.

- `menu()` calls `clear_screen()` at the top of its loop (before printing the submenu)
- Each operation function (e.g., `add_cost()`) calls `clear_screen()` before printing its title
- After an operation completes, show `Press Enter to continue...` before returning to the submenu loop (which will clear the screen)

### Foreign Key Fields — Always List Options First

Before asking for a foreign key value, query and display available options:

```python
# Show available projects
projects = supabase.table("projects").select("id, project_code, name").eq("is_active", True).execute()
list_choices("Available projects", projects.data, display=["project_code", "name"])
project_id = get_input("Project ID: ")
```

### Confirmation Before Any Insert — Always

```python
print("\n--- Summary ---")
print(f"  Project:  {project_code} — {project_name}")
print(f"  Entity:   {entity_name}")
print(f"  Amount:   {currency} {subtotal:,.2f}")
# ... all fields
if not confirm("Register this cost?"):
    print("Cancelled.")
    input("\nPress Enter to continue...")
    return
```

### Success and Error Messages — Always

```python
try:
    response = supabase.table("costs").insert(data).execute()
    print(f"\n✓ Cost registered (ID: {response.data[0]['id'][:8]}...)")
except Exception as e:
    print(f"\n✗ Error: {e}")
```

### No Business Logic in Modules

Modules collect input and insert records. Nothing else.

- No IGV calculation in Python — derived in `v_cost_totals`
- No balance calculation in Python — derived in `v_cost_balances`
- No payment status logic in Python — derived in views
- If you're doing math in a module, stop and ask whether it belongs in a view

**Exception:** Display-only calculations for the confirmation summary are acceptable (e.g., showing the user what the IGV will be before they confirm). These are for UX only and are never stored.

### Optional Fields

Always show `(optional — press Enter to skip)` in the prompt:

```python
notes = get_optional_input("Notes (optional — press Enter to skip): ")
```

### Currency Amounts

Always display formatted with comma separators and 2 decimal places:

```python
print(f"  Amount: {currency} {amount:,.2f}")
```

### Data Dictionary for Insert

Build a dictionary and insert it — never construct SQL strings:

```python
data = {
    "project_id": project_id,
    "entity_id": entity_id,
    "date": date_str,
    "title": title,
    "cost_type": cost_type,
    "igv_rate": igv_rate,
    "currency": currency,
}
# Add optional fields only if they have values
if notes:
    data["notes"] = notes
if due_date:
    data["due_date"] = due_date
```

### Active Records Only

When querying for FK options, always filter `is_active = True`:

```python
entities = supabase.table("entities").select("*").eq("is_active", True).execute()
```

### Back Option — Always

Every submenu must include a "Back" option as the last numbered choice. Selecting it returns to the parent menu.

### Import Functions Within Modules

Modules that support Excel import include an `import_[entity]()` function. The import pattern follows `skills/import_script.md` exactly, with these differences from the standalone script pattern:

- File path is collected via prompt, not `sys.argv`:
  ```python
  file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")
  ```
- The function is called from the module's `menu()`, not as a standalone script
- No `if __name__ == "__main__"` block

See `skills/import_script.md` for the full import pattern (load_lookups, validate_row, build_record, error highlighting, confirmation, batch insert).

---

## Shared Modules

### lib/db.py

```python
"""
Shared Supabase client — used by all CLI modules.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]
)
```

### lib/helpers.py

Must provide at minimum:

- `get_input(prompt, required=True)` — get required input, loops until non-empty
- `get_optional_input(prompt)` — get optional input, returns None if empty
- `confirm(message)` — ask y/n, returns boolean
- `list_choices(title, data, display)` — display a numbered list of options from query results
- `clear_screen()` — clear the terminal screen (uses `os.system('clear')` on macOS/Linux)

---

## Verification

After generating a module:

1. Module file lives in `cli/modules/`
2. Exposes a `menu()` function with a submenu loop
3. Submenu has a "Back" option that returns to main menu
4. `clear_screen()` called before every screen transition
5. Uses `from lib.db import supabase` — never direct Supabase import
6. Uses `from lib.helpers import ...` — never inline input helpers
7. Shows confirmation summary before every insert
8. Has try/except with success (`✓`) and error (`✗`) messages
9. No business logic or calculations stored to the database
10. All FK fields show available options before prompting
11. Optional fields clearly labeled
12. Currency amounts formatted with commas and 2 decimals
