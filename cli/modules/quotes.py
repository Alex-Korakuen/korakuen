#!/usr/bin/env python3
"""
Module: quotes.py
Purpose: All quote operations — add single, import from Excel
Tables: quotes
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_date_input,
    confirm, list_choices, clear_screen,
    get_enum_input, get_currency, get_exchange_rate, select_project,
    get_nonneg_float,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_number, validate_nonneg_number,
    validate_exchange_rate,
    process_import_errors, load_project_map, load_entity_map,
)


def menu():
    """Submenu for quote operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Quotes ===\n")
        print("1. Add quote")
        print("2. Import quotes from Excel")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_quote()
        elif choice == "2":
            import_quotes()
        elif choice == "3":
            return


# ============================================================
# Add Quote
# ============================================================

def add_quote():
    """Register a single quote interactively."""
    clear_screen()
    print("\n=== Add Quote ===\n")

    # --- Select project ---
    project = select_project()
    if not project:
        return

    # --- Select entity ---
    from modules.entities import _search_and_select_entity
    print()
    entity = _search_and_select_entity()
    if not entity:
        return

    # --- Quote details ---
    date_received = get_date_input("\n  Date received (YYYY-MM-DD): ")
    title = get_input("  Title (what was quoted): ")

    # --- Quantity and pricing ---
    quantity = get_nonneg_float("  Quantity (optional — press Enter to skip): ", required=False)
    unit_of_measure = None
    unit_price = None
    if quantity:
        unit_of_measure = get_optional_input("  Unit of measure (optional — press Enter to skip): ")
        unit_price = get_nonneg_float("  Unit price (optional — press Enter to skip): ", required=False)

    # --- Subtotal ---
    default_subtotal = None
    if quantity and unit_price:
        default_subtotal = quantity * unit_price
        print(f"\n  Computed subtotal: {default_subtotal:,.2f}")

    subtotal = get_nonneg_float(
        f"  Subtotal{f' (default: {default_subtotal:,.2f})' if default_subtotal else ''}: ",
        required=not default_subtotal,
    )
    if subtotal is None:
        subtotal = default_subtotal
    if subtotal is None:
        print("  Subtotal is required.")
        input("\nPress Enter to continue...")
        return

    # --- IGV ---
    igv_suggestion = subtotal * 0.18
    igv_amount = get_nonneg_float(f"  IGV amount (suggested: {igv_suggestion:,.2f}, optional — press Enter to skip): ", required=False)

    # --- Total ---
    default_total = subtotal + (igv_amount or 0)
    total = get_nonneg_float(f"  Total (default: {default_total:,.2f}): ", required=False)
    if total is None:
        total = default_total
    elif abs(total - default_total) > 0.01:
        print(f"  ⚠ Total ({total:,.2f}) differs from subtotal + IGV ({default_total:,.2f}).")
        if not confirm("  Continue with entered total?"):
            print("Cancelled.")
            input("\nPress Enter to continue...")
            return

    # --- Currency ---
    print("\n  Currencies: USD, PEN")
    currency = get_currency()
    exchange_rate = get_exchange_rate(transaction_date=date_received)

    # --- Status ---
    print("\n  Statuses: pending, accepted, rejected")
    status = get_enum_input("  Status: ", ("pending", "accepted", "rejected"))

    document_ref = get_optional_input("  Document ref (optional — press Enter to skip): ")
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project:       {project['project_code']} — {project['name']}")
    print(f"  Entity:        {entity['legal_name']}")
    print(f"  Date received: {date_received}")
    print(f"  Title:         {title}")
    if quantity:
        print(f"  Quantity:      {quantity:,.4f} {unit_of_measure or ''}")
    if unit_price:
        print(f"  Unit price:    {unit_price:,.4f}")
    print(f"  Subtotal:      {currency} {subtotal:,.2f}")
    if igv_amount:
        print(f"  IGV:           {currency} {igv_amount:,.2f}")
    print(f"  Total:         {currency} {total:,.2f}")
    print(f"  Status:        {status}")
    if document_ref:
        print(f"  Doc ref:       {document_ref}")
    if notes:
        print(f"  Notes:         {notes}")

    if not confirm("\nRegister this quote?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Insert ---
    data = {
        "project_id": project["id"],
        "entity_id": entity["id"],
        "date_received": date_received,
        "title": title,
        "subtotal": subtotal,
        "total": total,
        "currency": currency,
        "status": status,
    }
    if quantity:
        data["quantity"] = quantity
    if unit_of_measure:
        data["unit_of_measure"] = unit_of_measure
    if unit_price:
        data["unit_price"] = unit_price
    if igv_amount:
        data["igv_amount"] = igv_amount
    data["exchange_rate"] = exchange_rate
    if document_ref:
        data["document_ref"] = document_ref
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("quotes").insert(data).execute()
        print(f"\n✓ Quote registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Import Quotes
# ============================================================

def _load_quote_lookups():
    """Pre-load lookup tables for quote import."""
    return {
        "projects": load_project_map(),
        "entities": load_entity_map(),
    }


def _validate_quote_row(row_num, row, errors, lookups):
    """Validate a single quote row."""
    validate_required(row_num, row, "project_code", errors)
    validate_required(row_num, row, "entity_document_number", errors)
    validate_required(row_num, row, "date_received", errors)
    validate_required(row_num, row, "title", errors)
    validate_required(row_num, row, "subtotal", errors)
    validate_required(row_num, row, "total", errors)
    validate_required(row_num, row, "currency", errors)
    validate_required(row_num, row, "exchange_rate", errors)
    validate_required(row_num, row, "status", errors)

    validate_enum(row_num, row, "currency", ["USD", "PEN"], errors)
    validate_enum(row_num, row, "status", ["pending", "accepted", "rejected"], errors)

    validate_lookup(row_num, row, "project_code", lookups["projects"], errors)
    validate_lookup(row_num, row, "entity_document_number", lookups["entities"], errors)

    validate_date(row_num, row, "date_received", errors)
    validate_nonneg_number(row_num, row, "quantity", errors)
    validate_nonneg_number(row_num, row, "unit_price", errors)
    validate_nonneg_number(row_num, row, "subtotal", errors)
    validate_nonneg_number(row_num, row, "igv_amount", errors)
    validate_nonneg_number(row_num, row, "total", errors)
    validate_nonneg_number(row_num, row, "exchange_rate", errors)
    validate_exchange_rate(row_num, row, "exchange_rate", errors)

    # Cross-field: total should equal subtotal + igv_amount
    try:
        st = float(row.get("subtotal", 0) or 0)
        igv = float(row.get("igv_amount", 0) or 0)
        tot = float(row.get("total", 0) or 0)
        expected = st + igv
        if tot > 0 and abs(tot - expected) > 0.01:
            errors.append((row_num, "total", f"Total ({tot:,.2f}) differs from subtotal + IGV ({expected:,.2f})"))
    except (ValueError, TypeError):
        pass  # individual field errors already caught above


def _build_quote_record(row, lookups):
    """Convert a spreadsheet row to a database record."""
    data = {
        "project_id": lookups["projects"][str(row["project_code"]).strip()],
        "entity_id": lookups["entities"][str(row["entity_document_number"]).strip()],
        "date_received": pd.Timestamp(row["date_received"]).strftime("%Y-%m-%d"),
        "title": str(row["title"]).strip(),
        "subtotal": float(row["subtotal"]),
        "total": float(row["total"]),
        "currency": str(row["currency"]).strip(),
        "exchange_rate": float(row["exchange_rate"]),
        "status": str(row["status"]).strip(),
    }

    for field in ("quantity", "unit_price", "igv_amount"):
        val = row.get(field)
        if val is not None and not pd.isna(val):
            data[field] = float(val)

    for field in ("unit_of_measure", "document_ref", "notes"):
        val = row.get(field)
        if val is not None and not pd.isna(val) and str(val).strip():
            data[field] = str(val).strip()

    return data


def import_quotes():
    """Import quotes from an Excel spreadsheet."""
    clear_screen()
    print("\n=== Import Quotes ===\n")

    file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")

    try:
        df = pd.read_excel(file_path, header=0, skiprows=[1, 2, 3], engine="openpyxl")
    except Exception as e:
        print(f"\n✗ Error reading file: {e}")
        input("\nPress Enter to continue...")
        return

    if df.empty:
        print("✗ No data rows found in file.")
        input("\nPress Enter to continue...")
        return

    print(f"Found {len(df)} data rows.")

    lookups = _load_quote_lookups()

    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_quote_row(excel_row, row, errors, lookups)

    if process_import_errors(file_path, errors):
        return

    print(f"\n--- Summary ---")
    print(f"  File:    {file_path}")
    print(f"  Records: {len(df)}")
    print(f"\n  First 3 rows:")
    for i, (_, row) in enumerate(df.head(3).iterrows()):
        print(f"    {i+1}. {row.get('project_code', '')} — {row.get('title', '')}")

    if not confirm(f"\nImport {len(df)} quotes?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    try:
        records = [_build_quote_record(row, lookups) for _, row in df.iterrows()]
        response = supabase.table("quotes").insert(records).execute()
        print(f"\n✓ {len(response.data)} quotes imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")
