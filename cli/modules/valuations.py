#!/usr/bin/env python3
"""
Module: valuations.py
Purpose: All valuation operations — add single, import from Excel
Tables: valuations
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_currency, select_project,
    get_nonneg_float,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_number, validate_nonneg_number,
    process_import_errors, load_project_map,
    load_excel_file, print_import_summary,
)


def menu():
    """Submenu for valuation operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Valuations ===\n")
        print("1. Add valuation")
        print("2. Import valuations from Excel")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_valuation()
        elif choice == "2":
            import_valuations()
        elif choice == "3":
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add Valuation
# ============================================================

def add_valuation():
    """Register a single valuation interactively."""
    clear_screen()
    print("\n=== Add Valuation ===\n")

    # --- Select project ---
    project = select_project()
    if not project:
        return

    # --- Auto-generate valuation number ---
    existing = (
        supabase.table("valuations")
        .select("valuation_number")
        .eq("project_id", project["id"])
        .order("valuation_number", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        valuation_number = existing.data[0]["valuation_number"] + 1
    else:
        valuation_number = 1

    print(f"\n  Valuation number: {valuation_number} (auto-generated for {project['project_code']})")

    # --- Period ---
    period_month = get_input("  Period month (1-12): ")
    while not period_month.isdigit() or not (1 <= int(period_month) <= 12):
        print("  Must be a number from 1 to 12.")
        period_month = get_input("  Period month (1-12): ")
    period_month = int(period_month)

    period_year = get_input("  Period year (e.g. 2026): ")
    while not period_year.isdigit() or len(period_year) != 4:
        print("  Must be a 4-digit year.")
        period_year = get_input("  Period year (e.g. 2026): ")
    period_year = int(period_year)

    # --- Status ---
    print("\n  Statuses: open, closed")
    status = get_enum_input("  Status: ", ("open", "closed"))

    # --- Optional fields ---
    billed_value = get_nonneg_float("  Billed value (optional — press Enter to skip): ", required=False)
    billed_currency = None
    if billed_value:
        print("  Currencies: USD, PEN")
        billed_currency = get_currency(label="Billed currency")

    date_closed = None
    if status == "closed":
        date_closed = get_optional_date_input("  Date closed (YYYY-MM-DD, optional — press Enter to skip): ")

    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project:    {project['project_code']} — {project['name']}")
    print(f"  Valuation:  #{valuation_number}")
    print(f"  Period:     {period_month}/{period_year}")
    print(f"  Status:     {status}")
    if billed_value:
        print(f"  Billed:     {billed_currency} {billed_value:,.2f}")
    if date_closed:
        print(f"  Closed:     {date_closed}")
    if notes:
        print(f"  Notes:      {notes}")

    if not confirm("\nRegister this valuation?"):
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "project_id": project["id"],
        "valuation_number": valuation_number,
        "period_month": period_month,
        "period_year": period_year,
        "status": status,
    }
    if billed_value:
        data["billed_value"] = billed_value
        data["billed_currency"] = billed_currency
    if date_closed:
        data["date_closed"] = date_closed
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("valuations").insert(data).execute()
        print(f"\n✓ Valuation #{valuation_number} registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Import Valuations
# ============================================================

def _load_valuation_lookups():
    """Pre-load lookup tables for valuation import."""
    valuations = supabase.table("valuations").select("project_id, valuation_number").execute()

    # Build max valuation number per project for sequential validation
    max_per_project = {}
    for r in valuations.data:
        pid = r["project_id"]
        vn = r["valuation_number"]
        if pid not in max_per_project or vn > max_per_project[pid]:
            max_per_project[pid] = vn

    return {
        "projects": load_project_map(),
        "existing": {(r["project_id"], r["valuation_number"]) for r in valuations.data},
        "max_per_project": max_per_project,
        # Track pending numbers during validation to allow multi-row imports
        "pending_max": {},
    }


def _validate_valuation_row(row_num, row, errors, lookups):
    """Validate a single valuation row."""
    validate_required(row_num, row, "project_code", errors)
    validate_required(row_num, row, "valuation_number", errors)
    validate_required(row_num, row, "period_month", errors)
    validate_required(row_num, row, "period_year", errors)
    validate_required(row_num, row, "status", errors)

    validate_enum(row_num, row, "status", ["open", "closed"], errors)
    validate_enum(row_num, row, "billed_currency", ["USD", "PEN"], errors)
    validate_lookup(row_num, row, "project_code", lookups["projects"], errors)

    validate_number(row_num, row, "valuation_number", errors)
    validate_number(row_num, row, "period_month", errors)
    validate_number(row_num, row, "period_year", errors)
    validate_nonneg_number(row_num, row, "billed_value", errors)
    validate_date(row_num, row, "date_closed", errors)

    # Validate period_month range
    month = row.get("period_month")
    if month is not None and not pd.isna(month):
        try:
            m = int(float(month))
            if not (1 <= m <= 12):
                errors.append((row_num, "period_month", "Must be between 1 and 12"))
        except (ValueError, TypeError):
            pass  # already caught by validate_number

    # Check uniqueness and sequential numbering (project_id + valuation_number)
    code = row.get("project_code")
    val_num = row.get("valuation_number")
    if code and not pd.isna(code) and val_num is not None and not pd.isna(val_num):
        code_str = str(code).strip()
        project_id = lookups["projects"].get(code_str)
        if project_id:
            try:
                vn = int(float(val_num))
                if (project_id, vn) in lookups["existing"]:
                    errors.append((row_num, "valuation_number", f"Valuation #{vn} already exists for {code_str}"))
                else:
                    # Check sequential: must be exactly next after current max
                    current_max = lookups["pending_max"].get(project_id, lookups["max_per_project"].get(project_id, 0))
                    expected = current_max + 1
                    if vn != expected:
                        errors.append((row_num, "valuation_number", f"Expected #{expected} for {code_str} (sequential), got #{vn}"))
                    else:
                        # Track this number for subsequent rows in the same import
                        lookups["pending_max"][project_id] = vn
            except (ValueError, TypeError):
                pass


def _build_valuation_record(row, lookups):
    """Convert a spreadsheet row to a database record."""
    project_id = lookups["projects"][str(row["project_code"]).strip()]

    data = {
        "project_id": project_id,
        "valuation_number": int(float(row["valuation_number"])),
        "period_month": int(float(row["period_month"])),
        "period_year": int(float(row["period_year"])),
        "status": str(row["status"]).strip(),
    }

    if not pd.isna(row.get("billed_value")) and str(row.get("billed_value", "")).strip():
        data["billed_value"] = float(row["billed_value"])
    if not pd.isna(row.get("billed_currency")) and str(row.get("billed_currency", "")).strip():
        data["billed_currency"] = str(row["billed_currency"]).strip()
    if not pd.isna(row.get("date_closed")) and str(row.get("date_closed", "")).strip():
        data["date_closed"] = pd.Timestamp(row["date_closed"]).strftime("%Y-%m-%d")
    if not pd.isna(row.get("notes")) and str(row.get("notes", "")).strip():
        data["notes"] = str(row["notes"]).strip()

    return data


def import_valuations():
    """Import valuations from an Excel spreadsheet."""
    result = load_excel_file("Import Valuations")
    if not result:
        return
    df, file_path = result

    lookups = _load_valuation_lookups()

    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_valuation_row(excel_row, row, errors, lookups)

    if process_import_errors(file_path, errors):
        return

    print_import_summary(file_path, df,
        lambda i, row: f"{i}. {row.get('project_code', '')} Val #{row.get('valuation_number', '')} — {row.get('period_month', '')}/{row.get('period_year', '')}")

    if not confirm(f"\nImport {len(df)} valuations?"):
        cancel_and_wait()
        return

    try:
        records = [_build_valuation_record(row, lookups) for _, row in df.iterrows()]
        response = supabase.table("valuations").insert(records).execute()
        print(f"\n✓ {len(response.data)} valuations imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")
