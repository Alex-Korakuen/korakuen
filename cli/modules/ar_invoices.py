#!/usr/bin/env python3
"""
Module: ar_invoices.py
Purpose: All AR invoice operations — add single, import from Excel
Tables: ar_invoices
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_date_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_currency, get_exchange_rate, select_project,
    select_bank_account, get_nonneg_float,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_nonneg_number, validate_exchange_rate,
    validate_boolean, parse_bool,
    validate_bank_account,
    process_import_errors,
    load_project_map, load_entity_map, load_bank_account_map,
    load_partner_map,
    load_excel_file, print_import_summary,
)


def menu():
    """Submenu for AR invoice operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== AR Invoices ===\n")
        print("1. Add AR invoice")
        print("2. Import AR invoices from Excel")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_ar_invoice()
        elif choice == "2":
            import_ar_invoices()
        elif choice == "3":
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add AR Invoice
# ============================================================

def add_ar_invoice():
    """Register a single AR invoice interactively."""
    clear_screen()
    print("\n=== Add AR Invoice ===\n")

    # --- Select project ---
    project = select_project()
    if not project:
        return

    # --- Select bank account ---
    bank_account = select_bank_account(detraccion_filter=False, label="regular bank")
    if not bank_account:
        return

    # --- Select client entity ---
    from modules.entities import _search_and_select_entity
    print("\n  Client entity:")
    entity = _search_and_select_entity()
    if not entity:
        return

    # --- Validate entity is project client (Issue 9) ---
    project_detail = (
        supabase.table("projects")
        .select("client_entity_id")
        .eq("id", project["id"])
        .single()
        .execute()
    )
    client_entity_id = project_detail.data.get("client_entity_id") if project_detail.data else None
    if client_entity_id and entity["id"] != client_entity_id:
        client = (
            supabase.table("entities")
            .select("legal_name")
            .eq("id", client_entity_id)
            .single()
            .execute()
        )
        client_name = client.data["legal_name"] if client.data else "Unknown"
        print(f"\n  Warning: Selected entity ({entity['legal_name']}) is not the project client ({client_name}).")
        if not confirm("  Continue anyway?"):
            print("  Cancelled.")
            input("\nPress Enter to continue...")
            return
    elif not client_entity_id:
        print("  Note: Project has no client entity assigned — skipping client check.")

    # --- Select partner company ---
    partners = (
        supabase.table("partner_companies")
        .select("id, name, ruc")
        .eq("is_active", True)
        .execute()
    )
    if not list_choices("Partner companies", partners.data, display=["name", "ruc"]):
        input("\nPress Enter to continue...")
        return
    partner_num = get_input("  Select partner company number: ")
    try:
        partner = partners.data[int(partner_num) - 1]
    except (ValueError, IndexError):
        print("\n✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    # --- Invoice details ---
    invoice_number = get_input("\n  Invoice number: ")

    print("\n  Comprobante types: factura, boleta, recibo_por_honorarios")
    comprobante_type = get_enum_input("  Comprobante type: ", ("factura", "boleta", "recibo_por_honorarios"))

    invoice_date = get_date_input("  Invoice date (YYYY-MM-DD): ")
    due_date = get_optional_date_input("  Due date (YYYY-MM-DD, optional — press Enter to skip): ")

    # --- Financial ---
    subtotal = get_nonneg_float("\n  Subtotal: ")

    igv_rate = get_nonneg_float("  IGV rate % (default: 18, press Enter for default): ", default=18.0)

    detraccion_rate = get_nonneg_float("  Detraccion rate % (optional — press Enter to skip): ", required=False)

    # --- Retencion ---
    retencion_applicable = confirm("  Retencion applicable?")
    retencion_rate = None
    if retencion_applicable:
        retencion_rate = get_nonneg_float("  Retencion rate % (default: 3, press Enter for default): ", default=3.0)

    # --- Currency ---
    print("\n  Currencies: USD, PEN")
    currency = get_currency()
    exchange_rate = get_exchange_rate(transaction_date=invoice_date)

    document_ref = get_optional_input("  Document ref (e.g. PRY001-AR-001, optional — press Enter to skip): ")

    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Tax breakdown (display-only) ---
    igv_amount = subtotal * (igv_rate / 100)
    gross_total = subtotal + igv_amount
    detraccion_amount = gross_total * (detraccion_rate / 100) if detraccion_rate else 0
    retencion_amount = gross_total * (retencion_rate / 100) if retencion_rate else 0
    net_receivable = gross_total - detraccion_amount - retencion_amount

    print("\n--- Tax Breakdown ---")
    print(f"  Subtotal:        {currency} {subtotal:>12,.2f}")
    print(f"  IGV ({igv_rate}%):      {currency} {igv_amount:>12,.2f}")
    print(f"  Gross Total:     {currency} {gross_total:>12,.2f}")
    if detraccion_rate:
        print(f"  Detraccion ({detraccion_rate}%): {currency} {detraccion_amount:>12,.2f}")
    if retencion_rate:
        print(f"  Retencion ({retencion_rate}%):  {currency} {retencion_amount:>12,.2f}")
    print(f"  Net Receivable:  {currency} {net_receivable:>12,.2f}")

    # --- Full Summary ---
    print("\n--- Summary ---")
    print(f"  Project:    {project['project_code']} — {project['name']}")
    print(f"  Client:     {entity['legal_name']}")
    print(f"  Partner:    {partner['name']}")
    print(f"  Invoice:    {invoice_number} ({comprobante_type})")
    print(f"  Date:       {invoice_date}")

    if not confirm("\nRegister this AR invoice?"):
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "project_id": project["id"],
        "bank_account_id": bank_account["id"],
        "entity_id": entity["id"],
        "partner_company_id": partner["id"],
        "invoice_number": invoice_number,
        "comprobante_type": comprobante_type,
        "invoice_date": invoice_date,
        "subtotal": subtotal,
        "igv_rate": igv_rate,
        "retencion_applicable": retencion_applicable,
        "currency": currency,
        "retencion_verified": False,
    }
    if due_date:
        data["due_date"] = due_date
    if detraccion_rate:
        data["detraccion_rate"] = detraccion_rate
    if retencion_rate:
        data["retencion_rate"] = retencion_rate
    data["exchange_rate"] = exchange_rate
    if document_ref:
        data["document_ref"] = document_ref
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("ar_invoices").insert(data).execute()
        print(f"\n✓ AR invoice registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Import AR Invoices
# ============================================================

def _load_ar_lookups():
    """Pre-load all FK lookup tables for AR invoice import."""
    # Load project client_entity_id for Issue 9 validation
    project_clients_result = supabase.table("projects").select("id, client_entity_id").eq("is_active", True).execute()
    project_clients = {r["id"]: r["client_entity_id"] for r in project_clients_result.data}

    # Load existing (partner_company_id, invoice_number) pairs for duplicate detection
    existing_ar = supabase.table("ar_invoices").select("partner_company_id, invoice_number").execute()
    existing_partner_invoices = {
        (r["partner_company_id"], r["invoice_number"]) for r in existing_ar.data
    }

    return {
        "projects": load_project_map(),
        "entities": load_entity_map(),
        "bank_accounts": load_bank_account_map(),
        "partners": load_partner_map(),
        "project_clients": project_clients,
        "existing_partner_invoices": existing_partner_invoices,
    }




def _validate_ar_row(row_num, row, errors, lookups):
    """Validate a single AR invoice row."""
    validate_required(row_num, row, "project_code", errors)
    validate_required(row_num, row, "bank_account", errors)
    validate_required(row_num, row, "entity_document_number", errors)
    validate_required(row_num, row, "partner_company_name", errors)
    validate_required(row_num, row, "invoice_number", errors)
    validate_required(row_num, row, "comprobante_type", errors)
    validate_required(row_num, row, "invoice_date", errors)
    validate_required(row_num, row, "subtotal", errors)
    validate_required(row_num, row, "igv_rate", errors)
    validate_required(row_num, row, "currency", errors)
    validate_required(row_num, row, "exchange_rate", errors)
    validate_required(row_num, row, "retencion_applicable", errors)
    validate_required(row_num, row, "retencion_verified", errors)

    validate_enum(row_num, row, "comprobante_type", ["factura", "boleta", "recibo_por_honorarios"], errors)
    validate_enum(row_num, row, "currency", ["USD", "PEN"], errors)

    validate_lookup(row_num, row, "project_code", lookups["projects"], errors)
    validate_lookup(row_num, row, "entity_document_number", lookups["entities"], errors)
    validate_lookup(row_num, row, "partner_company_name", lookups["partners"], errors)

    validate_bank_account(row_num, row, lookups, errors)

    validate_date(row_num, row, "invoice_date", errors)
    validate_date(row_num, row, "due_date", errors)
    validate_nonneg_number(row_num, row, "subtotal", errors)
    validate_nonneg_number(row_num, row, "igv_rate", errors)
    validate_nonneg_number(row_num, row, "detraccion_rate", errors)
    validate_nonneg_number(row_num, row, "retencion_rate", errors)
    validate_nonneg_number(row_num, row, "exchange_rate", errors)
    validate_exchange_rate(row_num, row, "exchange_rate", errors)

    validate_boolean(row_num, row, "retencion_applicable", errors)
    validate_boolean(row_num, row, "retencion_verified", errors)

    # Cross-field: if retencion_applicable, retencion_rate must be present
    ret_app = row.get("retencion_applicable")
    if ret_app and not pd.isna(ret_app) and parse_bool(ret_app):
        ret_rate = row.get("retencion_rate")
        if ret_rate is None or pd.isna(ret_rate):
            errors.append((row_num, "retencion_rate", "Required when retencion_applicable is true"))

    # Cross-field: entity should be the project client (Issue 9)
    proj_code = row.get("project_code")
    entity_doc = row.get("entity_document_number")
    if proj_code and entity_doc and not pd.isna(proj_code) and not pd.isna(entity_doc):
        project_id = lookups["projects"].get(str(proj_code).strip())
        entity_id = lookups["entities"].get(str(entity_doc).strip())
        if project_id and entity_id:
            expected_client = lookups["project_clients"].get(project_id)
            if expected_client and entity_id != expected_client:
                errors.append((row_num, "entity_document_number", "Entity is not the project client"))

    # Duplicate detection: (partner_company_id, invoice_number) must be unique
    partner_name = row.get("partner_company_name")
    inv_num = row.get("invoice_number")
    if partner_name and inv_num and not pd.isna(partner_name) and not pd.isna(inv_num):
        partner_id = lookups["partners"].get(str(partner_name).strip())
        if partner_id:
            key = (partner_id, str(inv_num).strip())
            if key in lookups["existing_partner_invoices"]:
                errors.append((row_num, "invoice_number", f"Invoice '{str(inv_num).strip()}' already exists for this partner"))


def _build_ar_record(row, lookups):
    """Convert a spreadsheet row to a database record."""
    proj_code = str(row["project_code"]).strip()
    project_id = lookups["projects"][proj_code]

    data = {
        "project_id": project_id,
        "bank_account_id": lookups["bank_accounts"][str(row["bank_account"]).strip()],
        "entity_id": lookups["entities"][str(row["entity_document_number"]).strip()],
        "partner_company_id": lookups["partners"][str(row["partner_company_name"]).strip()],
        "invoice_number": str(row["invoice_number"]).strip(),
        "comprobante_type": str(row["comprobante_type"]).strip(),
        "invoice_date": pd.Timestamp(row["invoice_date"]).strftime("%Y-%m-%d"),
        "subtotal": float(row["subtotal"]),
        "igv_rate": float(row["igv_rate"]),
        "retencion_applicable": parse_bool(row.get("retencion_applicable")),
        "currency": str(row["currency"]).strip(),
        "exchange_rate": float(row["exchange_rate"]),
        "retencion_verified": parse_bool(row.get("retencion_verified")),
    }

    # Optional numeric
    for field in ("detraccion_rate", "retencion_rate"):
        val = row.get(field)
        if val is not None and not pd.isna(val):
            data[field] = float(val)

    # Optional string
    for field in ("document_ref", "notes"):
        val = row.get(field)
        if val is not None and not pd.isna(val) and str(val).strip():
            data[field] = str(val).strip()

    # Optional date
    due = row.get("due_date")
    if due is not None and not pd.isna(due):
        data["due_date"] = pd.Timestamp(due).strftime("%Y-%m-%d")

    return data


def import_ar_invoices():
    """Import AR invoices from an Excel spreadsheet."""
    result = load_excel_file("Import AR Invoices")
    if not result:
        return
    df, file_path = result

    lookups = _load_ar_lookups()

    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_ar_row(excel_row, row, errors, lookups)

    # Within-file duplicate detection: (partner, invoice_number)
    seen_keys = {}
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        partner_name = row.get("partner_company_name")
        inv_num = row.get("invoice_number")
        if partner_name and inv_num and not pd.isna(partner_name) and not pd.isna(inv_num):
            key = (str(partner_name).strip(), str(inv_num).strip())
            if key in seen_keys:
                errors.append((excel_row, "invoice_number", f"Duplicate in file (same as row {seen_keys[key]})"))
            else:
                seen_keys[key] = excel_row

    if process_import_errors(file_path, errors):
        return

    print_import_summary(file_path, df,
        lambda i, row: f"{i}. {row.get('project_code', '')} — {row.get('invoice_number', '')} — {row.get('subtotal', '')}")

    if not confirm(f"\nImport {len(df)} AR invoices?"):
        cancel_and_wait()
        return

    try:
        records = [_build_ar_record(row, lookups) for _, row in df.iterrows()]
        response = supabase.table("ar_invoices").insert(records).execute()
        print(f"\n✓ {len(response.data)} AR invoices imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")
