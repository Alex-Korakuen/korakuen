#!/usr/bin/env python3
"""
Module: projects.py
Purpose: All project operations — add single, import from Excel, set budget, set partner shares
Tables: projects, project_budgets, project_partners
"""

import pandas as pd

from lib.db import supabase
from modules.costs import PROJECT_CATEGORIES
from lib.helpers import (
    get_input, get_optional_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_currency, get_nonneg_float, execute_insert,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_nonneg_number,
    process_import_errors, load_entity_map,
    load_excel_file, print_import_summary,
)


def menu():
    """Submenu for project operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Projects ===\n")
        print("1. Add project")
        print("2. Import projects from Excel")
        print("3. Set project budget")
        print("4. Set partner shares")
        print("5. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_project()
        elif choice == "2":
            import_projects()
        elif choice == "3":
            set_project_budget()
        elif choice == "4":
            set_partner_shares()
        elif choice == "5":
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add Project
# ============================================================

def _next_project_code():
    """Generate the next sequential project code (PRY001, PRY002...)."""
    result = (
        supabase.table("projects")
        .select("project_code")
        .order("project_code", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        last_code = result.data[0]["project_code"]
        last_num = int(last_code.replace("PRY", ""))
        return f"PRY{last_num + 1:03d}"
    return "PRY001"


def add_project():
    """Register a single project interactively."""
    clear_screen()
    print("\n=== Add Project ===\n")

    project_code = _next_project_code()
    print(f"  Project code: {project_code} (auto-generated)\n")

    # --- Name ---
    name = get_input("  Project name: ")

    # --- Project type ---
    print("\n  Project types: subcontractor, oxi")
    project_type = get_enum_input("  Project type: ", ("subcontractor", "oxi"))

    # --- Status ---
    print("\n  Statuses: prospect, active, completed, cancelled")
    status = get_enum_input("  Status: ", ("prospect", "active", "completed", "cancelled"))

    # --- Client entity (optional) ---
    client_entity_id = None
    client_name = None
    if confirm("\n  Assign a client entity?"):
        from modules.entities import _search_and_select_entity
        entity = _search_and_select_entity()
        if entity:
            client_entity_id = entity["id"]
            client_name = entity["legal_name"]

    # --- Contract value (optional) ---
    contract_value = get_nonneg_float("\n  Contract value (optional — press Enter to skip): ", required=False)
    contract_currency = None
    if contract_value:
        print("  Currencies: USD, PEN")
        contract_currency = get_currency(label="Contract currency")

    # --- Optional fields ---
    start_date = get_optional_date_input("  Start date (YYYY-MM-DD, optional — press Enter to skip): ")
    location = get_optional_input("  Location (optional — press Enter to skip): ")
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Code:     {project_code}")
    print(f"  Name:     {name}")
    print(f"  Type:     {project_type}")
    print(f"  Status:   {status}")
    if client_name:
        print(f"  Client:   {client_name}")
    if contract_value:
        print(f"  Contract: {contract_currency} {contract_value:,.2f}")
    if start_date:
        print(f"  Start:    {start_date}")
    if location:
        print(f"  Location: {location}")
    if notes:
        print(f"  Notes:    {notes}")

    if not confirm("\nRegister this project?"):
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "project_code": project_code,
        "name": name,
        "project_type": project_type,
        "status": status,
    }
    if client_entity_id:
        data["client_entity_id"] = client_entity_id
    if contract_value:
        data["contract_value"] = contract_value
        data["contract_currency"] = contract_currency
    if start_date:
        data["start_date"] = start_date
    if location:
        data["location"] = location
    if notes:
        data["notes"] = notes

    execute_insert("projects", data, f"Project registered: {project_code}")


# ============================================================
# Import Projects
# ============================================================

def _load_project_lookups():
    """Pre-load lookup tables for project import validation."""
    existing = supabase.table("projects").select("project_code").execute()
    return {
        "entities": load_entity_map(),
        "existing_codes": {r["project_code"] for r in existing.data},
    }


def _validate_project_row(row_num, row, errors, lookups):
    """Validate a single project row."""
    validate_required(row_num, row, "name", errors)
    validate_required(row_num, row, "project_type", errors)
    validate_required(row_num, row, "status", errors)

    validate_enum(row_num, row, "project_type", ["subcontractor", "oxi"], errors)
    validate_enum(row_num, row, "status", ["prospect", "active", "completed", "cancelled"], errors)
    validate_enum(row_num, row, "contract_currency", ["USD", "PEN"], errors)

    validate_lookup(row_num, row, "client_entity_document_number", lookups["entities"], errors)

    validate_date(row_num, row, "start_date", errors)
    validate_date(row_num, row, "expected_end_date", errors)
    validate_date(row_num, row, "actual_end_date", errors)
    validate_nonneg_number(row_num, row, "contract_value", errors)

    # Validate project_code format and uniqueness if provided
    code = row.get("project_code")
    if code and not pd.isna(code):
        code_str = str(code).strip()
        if not code_str.startswith("PRY") or len(code_str) != 6:
            errors.append((row_num, "project_code", "Must follow PRY### format"))
        elif code_str in lookups["existing_codes"]:
            errors.append((row_num, "project_code", "Already exists in database"))


def _build_project_record(row, lookups, auto_code_num):
    """Convert a spreadsheet row to a database record.

    auto_code_num: the PRY### number to use if project_code is blank,
                   or None if the row provides its own code.
    """
    code = row.get("project_code")
    if code and not pd.isna(code):
        project_code = str(code).strip()
    else:
        project_code = f"PRY{auto_code_num:03d}"

    data = {
        "project_code": project_code,
        "name": str(row["name"]).strip(),
        "project_type": str(row["project_type"]).strip(),
        "status": str(row["status"]).strip(),
    }

    # FK lookups
    client_doc = row.get("client_entity_document_number")
    if client_doc and not pd.isna(client_doc) and str(client_doc).strip():
        data["client_entity_id"] = lookups["entities"][str(client_doc).strip()]

    # Optional fields
    for field in ("contract_value",):
        val = row.get(field)
        if val is not None and not pd.isna(val):
            data[field] = float(val)

    for field in ("contract_currency",):
        val = row.get(field)
        if val is not None and not pd.isna(val) and str(val).strip():
            data[field] = str(val).strip()

    for field in ("start_date", "expected_end_date", "actual_end_date"):
        val = row.get(field)
        if val is not None and not pd.isna(val):
            data[field] = pd.Timestamp(val).strftime("%Y-%m-%d")

    for field in ("location", "notes"):
        val = row.get(field)
        if val is not None and not pd.isna(val) and str(val).strip():
            data[field] = str(val).strip()

    return data


def import_projects():
    """Import projects from an Excel spreadsheet."""
    result = load_excel_file("Import Projects")
    if not result:
        return
    df, file_path = result

    lookups = _load_project_lookups()

    # Validate all rows
    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_project_row(excel_row, row, errors, lookups)

    if process_import_errors(file_path, errors):
        return

    def _format_project_row(i, row):
        code = row.get("project_code", "auto")
        if pd.isna(code):
            code = "auto"
        return f"{i}. {code} — {row.get('name', '')}"

    print_import_summary(file_path, df, _format_project_row)

    if not confirm(f"\nImport {len(df)} projects?"):
        cancel_and_wait()
        return

    # Determine next code number for auto-generation
    all_codes = lookups["existing_codes"]
    if all_codes:
        next_code_num = max(int(c.replace("PRY", "")) for c in all_codes) + 1
    else:
        next_code_num = 1

    try:
        records = []
        for _, row in df.iterrows():
            code = row.get("project_code")
            needs_auto = not code or pd.isna(code)
            records.append(_build_project_record(row, lookups, next_code_num if needs_auto else None))
            if needs_auto:
                next_code_num += 1
        response = supabase.table("projects").insert(records).execute()
        print(f"\n✓ {len(response.data)} projects imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Set Project Budget
# ============================================================

# Reuse the canonical list from costs.py
PROJECT_BUDGET_CATEGORIES = PROJECT_CATEGORIES


def set_project_budget():
    """Set budget targets per category for a project."""
    clear_screen()
    print("\n=== Set Project Budget ===\n")

    # --- Select project ---
    projects = (
        supabase.table("projects")
        .select("id, project_code, name")
        .eq("is_active", True)
        .order("project_code")
        .execute()
    )
    list_choices("Active projects", projects.data, display=["project_code", "name"])

    if not projects.data:
        input("\nPress Enter to continue...")
        return

    project_code_input = get_input("Enter project code (e.g. PRY001): ").upper()
    project = next(
        (p for p in projects.data if p["project_code"] == project_code_input), None
    )
    if not project:
        print(f"\n✗ Project '{project_code_input}' not found.")
        input("\nPress Enter to continue...")
        return

    project_id = project["id"]
    project_code = project["project_code"]
    project_name = project["name"]

    # --- Check for existing active budgets ---
    existing = (
        supabase.table("project_budgets")
        .select("category, budgeted_amount, currency, notes")
        .eq("project_id", project_id)
        .eq("is_active", True)
        .execute()
    )

    if existing.data:
        print(f"\n  Existing budgets for {project_code} — {project_name}:")
        for entry in existing.data:
            notes_str = f" ({entry['notes']})" if entry.get("notes") else ""
            print(f"    {entry['category']:25s} {entry['currency']} {entry['budgeted_amount']:>12,.2f}{notes_str}")
        print()
        if not confirm("  Overwrite existing budgets?"):
            print("  Cancelled.")
            input("\nPress Enter to continue...")
            return
        # Soft-delete existing budgets before re-inserting
        try:
            supabase.table("project_budgets").update({"is_active": False}).eq("project_id", project_id).eq("is_active", True).execute()
        except Exception as e:
            print(f"\n✗ Error deactivating existing budgets: {e}")
            input("\nPress Enter to continue...")
            return

    # --- Currency ---
    print("  Currencies: USD, PEN")
    currency = get_currency(label="Budget currency")

    # --- Collect amounts per category ---
    print(f"\n  Enter budgeted amount for each category ({currency}):\n")
    budget_entries = []
    for category in PROJECT_BUDGET_CATEGORIES:
        display_name = category.replace("_", " ").title()
        amount = get_nonneg_float(f"    {display_name}: ")
        budget_entries.append({"category": category, "amount": amount})

    # --- Notes ---
    notes = get_optional_input("\n  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project:  {project_code} — {project_name}")
    print(f"  Currency: {currency}")
    print()
    total_budget = 0
    for entry in budget_entries:
        display_name = entry["category"].replace("_", " ").title()
        print(f"    {display_name:25s} {currency} {entry['amount']:>12,.2f}")
        total_budget += entry["amount"]
    print(f"    {'':25s} {'─' * 20}")
    print(f"    {'Total':25s} {currency} {total_budget:>12,.2f}")
    if notes:
        print(f"\n  Notes: {notes}")

    if not confirm("\nSet this budget?"):
        cancel_and_wait()
        return

    # --- Batch insert ---
    records = []
    for entry in budget_entries:
        data = {
            "project_id": project_id,
            "category": entry["category"],
            "budgeted_amount": entry["amount"],
            "currency": currency,
        }
        if notes:
            data["notes"] = notes
        records.append(data)

    execute_insert("project_budgets", records, f"Budget set for {project_code}: {len(records)} categories ({currency} {total_budget:,.2f} total)")


# ============================================================
# Set Partner Shares
# ============================================================

def set_partner_shares():
    """Set profit share percentages per partner for a project."""
    clear_screen()
    print("\n=== Set Partner Shares ===\n")

    # --- Select project ---
    projects = (
        supabase.table("projects")
        .select("id, project_code, name")
        .eq("is_active", True)
        .order("project_code")
        .execute()
    )
    list_choices("Active projects", projects.data, display=["project_code", "name"])

    if not projects.data:
        input("\nPress Enter to continue...")
        return

    project_code_input = get_input("Enter project code (e.g. PRY001): ").upper()
    project = next(
        (p for p in projects.data if p["project_code"] == project_code_input), None
    )
    if not project:
        print(f"\n✗ Project '{project_code_input}' not found.")
        input("\nPress Enter to continue...")
        return

    project_id = project["id"]
    project_code = project["project_code"]
    project_name = project["name"]

    # --- Show existing shares if any ---
    existing = (
        supabase.table("project_partners")
        .select("partner_company_id, profit_share_pct")
        .eq("project_id", project_id)
        .execute()
    )

    if existing.data:
        # Resolve partner names
        partner_ids = [r["partner_company_id"] for r in existing.data]
        partners_result = supabase.table("partner_companies").select("id, name").in_("id", partner_ids).execute()
        name_map = {p["id"]: p["name"] for p in partners_result.data}

        print(f"\n  Current shares for {project_code} — {project_name}:")
        for entry in existing.data:
            pname = name_map.get(entry["partner_company_id"], "Unknown")
            print(f"    {pname:30s} {entry['profit_share_pct']:>6.2f}%")
        print()
        if not confirm("  Overwrite existing shares?"):
            print("  Cancelled.")
            input("\nPress Enter to continue...")
            return

    # --- Get all active partner companies ---
    partners = (
        supabase.table("partner_companies")
        .select("id, name")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    if not partners.data:
        print("\n✗ No active partner companies found.")
        input("\nPress Enter to continue...")
        return

    print(f"\n  Enter profit share % for each partner ({project_code} — {project_name}):\n")
    shares = []
    for partner in partners.data:
        pct = get_nonneg_float(f"    {partner['name']}: ")
        shares.append({"partner": partner, "pct": pct})

    # --- Validate sum = 100% ---
    total_pct = sum(s["pct"] for s in shares)
    if abs(total_pct - 100.0) > 0.01:
        print(f"\n✗ Shares must total 100%. Current total: {total_pct:.2f}%")
        input("\nPress Enter to continue...")
        return

    # Filter out zero shares
    shares = [s for s in shares if s["pct"] > 0]

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project: {project_code} — {project_name}\n")
    for s in shares:
        print(f"    {s['partner']['name']:30s} {s['pct']:>6.2f}%")
    print(f"    {'':30s} {'─' * 10}")
    print(f"    {'Total':30s} {total_pct:>6.2f}%")

    if not confirm("\nSet these partner shares?"):
        cancel_and_wait()
        return

    # --- Delete existing and insert new ---
    try:
        # Delete existing shares for this project
        supabase.table("project_partners").delete().eq("project_id", project_id).execute()

        records = []
        for s in shares:
            records.append({
                "project_id": project_id,
                "partner_company_id": s["partner"]["id"],
                "profit_share_pct": s["pct"],
            })
        response = supabase.table("project_partners").insert(records).execute()
        print(f"\n✓ Partner shares set for {project_code}: {len(response.data)} partners")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")
