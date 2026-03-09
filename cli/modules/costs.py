#!/usr/bin/env python3
"""
Module: costs.py
Purpose: All cost operations — add single (header + line items), import from Excel
Tables: costs, cost_items
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_date_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_optional_enum_input, get_currency, get_exchange_rate,
    select_project, select_partner_company, get_nonneg_float,
    search_and_select_entity,
    COMPROBANTE_TYPES_ALL, NO_IGV_CREDIT_TYPES,
)
from lib.import_helpers import (
    DATA_START_ROW,
    is_empty, cell_str,
    validate_required, validate_enum, validate_lookup,
    validate_date, validate_nonneg_number,
    validate_exchange_rate,
    validate_partner_company,
    process_import_errors,
    load_project_map, load_entity_map, load_partner_map,
    load_quote_map,
    load_excel_file, print_import_summary,
    opt_float, opt_date,
)

def load_categories(cost_type=None):
    """Load categories from database, optionally filtered by cost_type.
    Returns list of dicts with 'name', 'cost_type', 'label' keys."""
    query = (supabase.table("categories")
             .select("name, cost_type, label")
             .eq("is_active", True)
             .order("sort_order"))
    if cost_type:
        query = query.eq("cost_type", cost_type)
    return query.execute().data


def menu():
    """Submenu for cost operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Costs ===\n")
        print("1. Add cost")
        print("2. Import costs from Excel")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_cost()
        elif choice == "2":
            import_costs()
        elif choice == "3":
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add Cost — Two-step: Header + Line Items
# ============================================================

def add_cost():
    """Register a single cost with line items interactively."""
    clear_screen()
    print("\n=== Add Cost ===\n")

    # ---- STEP 1: HEADER ----

    # --- Cost type ---
    print("  Cost types: project_cost, sga")
    cost_type = get_enum_input("  Cost type: ", ("project_cost", "sga"))

    # --- Project (optional for SGA, expected for project_cost) ---
    project = None
    if cost_type == "project_cost":
        project = select_project()
        if not project:
            return

    # --- Partner company (required) ---
    partner = select_partner_company()
    if not partner:
        return

    # --- Entity (optional) ---
    entity = None
    if confirm("\n  Assign an entity (supplier)?"):
        entity = search_and_select_entity()

    # --- Quote (optional) ---
    quote = None
    if project:
        quotes = (
            supabase.table("quotes")
            .select("id, title, document_ref, total, currency")
            .eq("project_id", project["id"])
            .eq("status", "accepted")
            .execute()
        )
        if quotes.data:
            list_choices("Accepted quotes", quotes.data, display=["document_ref", "title"])
            q_num = get_optional_input("  Select quote number (optional — press Enter to skip): ")
            if q_num:
                try:
                    quote = quotes.data[int(q_num) - 1]
                except (ValueError, IndexError):
                    print("  Invalid selection, skipping quote.")

    # --- Date, title ---
    date_str = get_date_input("\n  Date (YYYY-MM-DD): ")
    title = get_input("  Title: ")

    # --- Comprobante (before IGV — determines whether IGV credit applies) ---
    comprobante_type = get_optional_enum_input(
        "  Comprobante type (factura/boleta/recibo_por_honorarios/liquidacion_de_compra/planilla_jornales/none, optional — press Enter to skip): ",
        COMPROBANTE_TYPES_ALL)
    comprobante_number = None
    if comprobante_type:
        comprobante_number = get_optional_input("  Comprobante number (optional — press Enter to skip): ")

    # --- Tax rates ---
    if comprobante_type in NO_IGV_CREDIT_TYPES:
        igv_rate = 0.0
        print(f"  IGV rate: 0% (no IGV credit for {comprobante_type})")
    else:
        igv_rate = get_nonneg_float("  IGV rate % (default: 18, press Enter for default): ", default=18.0)

    detraccion_rate = get_nonneg_float("  Detraccion rate % (optional — press Enter to skip): ", required=False)

    # --- Currency ---
    print("\n  Currencies: USD, PEN")
    currency = get_currency()
    exchange_rate = get_exchange_rate(transaction_date=date_str)

    # --- Payment method (optional) ---
    payment_method = get_optional_enum_input(
        "  Payment method (bank_transfer/cash/check, optional — press Enter to skip): ",
        ("bank_transfer", "cash", "check"))

    document_ref = get_optional_input("  Document ref (e.g. PRY001-AP-001, optional — press Enter to skip): ")
    due_date = get_optional_date_input("  Due date (YYYY-MM-DD, optional — press Enter to skip): ")
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # ---- STEP 2: LINE ITEMS ----
    print("\n--- Add Line Items ---")
    print("(Add at least one item)\n")

    cat_rows = load_categories(cost_type)
    cat_names = [c["name"] for c in cat_rows]
    cat_labels = {c["name"]: c["label"] for c in cat_rows}
    items = []
    running_total = 0.0
    item_num = 1

    while True:
        print(f"  Item {item_num}:")

        item_title = get_input("    Title: ")

        print(f"    Categories: {', '.join(cat_labels[n] + ' (' + n + ')' for n in cat_names)}")
        category = get_enum_input("    Category: ", cat_names)

        qty = get_nonneg_float("    Quantity (optional — press Enter for lump sum): ", required=False)
        uom = None
        up = None
        if qty:
            uom = get_optional_input("    Unit of measure (optional — press Enter to skip): ")
            up = get_nonneg_float("    Unit price (optional — press Enter to skip): ", required=False)

        # Subtotal
        default_sub = qty * up if (qty and up) else None
        if default_sub:
            print(f"    Computed: {default_sub:,.2f}")
        item_subtotal = get_nonneg_float(
            f"    Subtotal{f' (default: {default_sub:,.2f})' if default_sub else ''}: ",
            required=not default_sub,
        )
        if item_subtotal is None:
            item_subtotal = default_sub
        if item_subtotal is None:
            print("    Subtotal is required.")
            continue

        item_notes = get_optional_input("    Notes (optional — press Enter to skip): ")

        items.append({
            "title": item_title,
            "category": category,
            "quantity": qty,
            "unit_of_measure": uom,
            "unit_price": up,
            "subtotal": item_subtotal,
            "notes": item_notes,
        })

        running_total += item_subtotal
        item_num += 1
        print(f"\n    Running total: {currency} {running_total:,.2f}")

        if not confirm("\n  Add another item?"):
            break

    if not items:
        print("\n✗ At least one line item is required.")
        input("\nPress Enter to continue...")
        return

    # ---- FULL SUMMARY ----
    igv_amount = running_total * (igv_rate / 100)
    total = running_total + igv_amount
    detraccion_amount = total * (detraccion_rate / 100) if detraccion_rate else 0

    print("\n--- Cost Summary ---")
    if project:
        print(f"  Project:     {project['project_code']} — {project['name']}")
    else:
        print(f"  Project:     (SG&A — no project)")
    if entity:
        print(f"  Entity:      {entity['legal_name']}")
    print(f"  Date:        {date_str}")
    print(f"  Title:       {title}")
    print(f"  Partner:     {partner['name']}")
    print(f"  Cost type:   {cost_type}")
    print(f"  Currency:    {currency}")
    if payment_method:
        print(f"  Payment:     {payment_method}")

    print(f"\n  Line Items:")
    for i, item in enumerate(items, start=1):
        print(f"    {i}. {item['title']} ({item['category']}) — {currency} {item['subtotal']:,.2f}")

    print(f"\n  Subtotal:      {currency} {running_total:,.2f}")
    print(f"  IGV ({igv_rate}%):   {currency} {igv_amount:,.2f}")
    print(f"  Total:         {currency} {total:,.2f}")
    if detraccion_rate:
        print(f"  Detraccion ({detraccion_rate}%): {currency} {detraccion_amount:,.2f}")

    if not confirm("\nRegister this cost?"):
        cancel_and_wait()
        return

    # ---- BUILD HEADER + ITEMS DATA ----
    header_data = {
        "cost_type": cost_type,
        "partner_company_id": partner["id"],
        "date": date_str,
        "title": title,
        "igv_rate": igv_rate,
        "currency": currency,
        "exchange_rate": exchange_rate,
    }
    if project:
        header_data["project_id"] = project["id"]
    if entity:
        header_data["entity_id"] = entity["id"]
    if quote:
        header_data["quote_id"] = quote["id"]
    if detraccion_rate:
        header_data["detraccion_rate"] = detraccion_rate
    if comprobante_type:
        header_data["comprobante_type"] = comprobante_type
    if comprobante_number:
        header_data["comprobante_number"] = comprobante_number
    if payment_method:
        header_data["payment_method"] = payment_method
    if document_ref:
        header_data["document_ref"] = document_ref
    if due_date:
        header_data["due_date"] = due_date
    if notes:
        header_data["notes"] = notes

    items_data = []
    for item in items:
        record = {
            "title": item["title"],
            "category": item["category"],
            "subtotal": item["subtotal"],
        }
        if item["quantity"]:
            record["quantity"] = item["quantity"]
        if item["unit_of_measure"]:
            record["unit_of_measure"] = item["unit_of_measure"]
        if item["unit_price"]:
            record["unit_price"] = item["unit_price"]
        if item["notes"]:
            record["notes"] = item["notes"]
        items_data.append(record)

    # ---- ATOMIC INSERT via RPC (header + items in one transaction) ----
    try:
        response = supabase.rpc("fn_create_cost_with_items", {
            "header_data": header_data,
            "items_data": items_data,
        }).execute()
        result = response.data
        cost_id = result["cost_id"]
        items_count = result["items_count"]
        print(f"\n✓ Cost registered (ID: {cost_id[:8]}...) with {items_count} line items.")
    except Exception as e:
        print(f"\n✗ Error creating cost: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Import Costs — Combined (header + items in one template)
# ============================================================

# Header fields that must be consistent across rows in the same document_ref group
HEADER_FIELDS = [
    "document_ref", "date", "title", "partner_company", "currency", "igv_rate",
    "project_code", "entity_document_number", "exchange_rate",
    "comprobante_type", "comprobante_number", "detraccion_rate",
    "payment_method", "quote_document_ref", "due_date", "notes",
]



def _load_cost_lookups():
    """Pre-load all FK lookup tables for cost import."""
    existing_costs = supabase.table("costs").select("document_ref, entity_id, comprobante_number").execute()
    existing_refs = {r["document_ref"] for r in existing_costs.data if r.get("document_ref")}

    existing_entity_comprobantes = {
        (r["entity_id"], r["comprobante_number"])
        for r in existing_costs.data
        if r.get("entity_id") and r.get("comprobante_number")
    }

    # Load exchange rates for auto-lookup
    exchange_rates_resp = supabase.table("exchange_rates").select("rate_date, mid_rate").execute()
    exchange_rate_by_date = {}
    for r in exchange_rates_resp.data:
        exchange_rate_by_date[r["rate_date"]] = float(r["mid_rate"])

    return {
        "projects": load_project_map(),
        "entities": load_entity_map(),
        "partners": load_partner_map(),
        "quotes": load_quote_map(),
        "existing_document_refs": existing_refs,
        "existing_entity_comprobantes": existing_entity_comprobantes,
        "exchange_rates": exchange_rate_by_date,
        "category_names": [c["name"] for c in load_categories()],
    }


def _validate_cost_row(row_num, row, errors, lookups):
    """Validate a single combined cost row (header + item fields)."""
    # Header required fields
    validate_required(row_num, row, "document_ref", errors)
    validate_required(row_num, row, "date", errors)
    validate_required(row_num, row, "title", errors)
    validate_required(row_num, row, "partner_company", errors)
    validate_required(row_num, row, "currency", errors)
    validate_required(row_num, row, "igv_rate", errors)

    # Item required fields
    validate_required(row_num, row, "item_title", errors)
    validate_required(row_num, row, "category", errors)
    validate_required(row_num, row, "subtotal", errors)

    # Enums
    validate_enum(row_num, row, "currency", ["USD", "PEN"], errors)
    validate_enum(row_num, row, "comprobante_type", list(COMPROBANTE_TYPES_ALL), errors)
    validate_enum(row_num, row, "payment_method", ["bank_transfer", "cash", "check"], errors)
    validate_enum(row_num, row, "category", lookups["category_names"], errors)

    # Lookups
    validate_lookup(row_num, row, "project_code", lookups["projects"], errors)
    validate_lookup(row_num, row, "entity_document_number", lookups["entities"], errors)
    validate_partner_company(row_num, row, lookups, errors)
    validate_lookup(row_num, row, "quote_document_ref", lookups["quotes"], errors)

    # Dates and numbers
    validate_date(row_num, row, "date", errors)
    validate_date(row_num, row, "due_date", errors)
    validate_nonneg_number(row_num, row, "igv_rate", errors)
    validate_nonneg_number(row_num, row, "detraccion_rate", errors)
    validate_nonneg_number(row_num, row, "subtotal", errors)
    validate_nonneg_number(row_num, row, "quantity", errors)
    validate_nonneg_number(row_num, row, "unit_price", errors)

    # Exchange rate: validate if provided, auto-lookup if blank
    exchange_rate_val = row.get("exchange_rate")
    if not is_empty(exchange_rate_val):
        validate_nonneg_number(row_num, row, "exchange_rate", errors)
        validate_exchange_rate(row_num, row, "exchange_rate", errors)
    else:
        # Auto-lookup by date
        date_val = row.get("date")
        if not is_empty(date_val):
            try:
                date_str = pd.Timestamp(date_val).strftime("%Y-%m-%d")
                if date_str not in lookups["exchange_rates"]:
                    errors.append((row_num, "exchange_rate", f"No exchange rate in database for {date_str} — enter manually"))
            except (ValueError, TypeError):
                pass  # date validation already catches bad dates

    # Cross-field: IGV must be 0 for non-IGV comprobante types
    comp_val = row.get("comprobante_type")
    igv_val = row.get("igv_rate")
    if not is_empty(comp_val) and cell_str(comp_val).lower() in NO_IGV_CREDIT_TYPES:
        if not is_empty(igv_val):
            try:
                if float(igv_val) > 0:
                    errors.append((row_num, "igv_rate", f"IGV must be 0 for comprobante_type '{cell_str(comp_val)}' (no IGV credit)"))
            except (ValueError, TypeError):
                pass


def _validate_groups(df, errors, lookups):
    """Validate cross-row consistency and duplicate detection for grouped costs."""
    groups = {}
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        doc_ref = cell_str(row.get("document_ref"))
        if doc_ref:
            groups.setdefault(doc_ref, []).append((excel_row, row))

    # Check header field consistency within each group
    for doc_ref, rows in groups.items():
        if len(rows) < 2:
            continue
        first_row_num, first_row = rows[0]
        for subsequent_row_num, subsequent_row in rows[1:]:
            for field in HEADER_FIELDS:
                first_val = cell_str(first_row.get(field))
                subsequent_val = cell_str(subsequent_row.get(field))
                if first_val != subsequent_val:
                    errors.append((subsequent_row_num, field,
                        f"Mismatch with row {first_row_num} in group '{doc_ref}' "
                        f"('{subsequent_val}' vs '{first_val}')"))

    # Duplicate detection: document_ref must not exist in database
    for doc_ref in groups:
        if doc_ref in lookups["existing_document_refs"]:
            first_row_num = groups[doc_ref][0][0]
            errors.append((first_row_num, "document_ref",
                f"Document ref '{doc_ref}' already exists in database"))

    # Duplicate detection: (entity_id, comprobante_number) must be unique per group
    seen_entity_comprobantes = {}
    for doc_ref, rows in groups.items():
        first_row = rows[0][1]
        first_row_num = rows[0][0]
        entity_doc = cell_str(first_row.get("entity_document_number"))
        comp_num = cell_str(first_row.get("comprobante_number"))
        if entity_doc and comp_num:
            entity_id = lookups["entities"].get(entity_doc)
            if entity_id:
                key = (entity_id, comp_num)
                if key in lookups["existing_entity_comprobantes"]:
                    errors.append((first_row_num, "comprobante_number",
                        f"Comprobante '{comp_num}' already exists for this entity"))
                elif key in seen_entity_comprobantes:
                    errors.append((first_row_num, "comprobante_number",
                        f"Duplicate in file (same entity+comprobante as group '{seen_entity_comprobantes[key]}')"))
                else:
                    seen_entity_comprobantes[key] = doc_ref


def _build_header_data(first_row, lookups):
    """Build the header_data dict for fn_create_cost_with_items from the first row of a group."""
    # Derive cost_type from project_code
    proj_code = cell_str(first_row.get("project_code"))
    cost_type = "project_cost" if proj_code else "sga"

    # Resolve exchange_rate (auto-lookup if blank)
    exchange_rate_val = first_row.get("exchange_rate")
    if is_empty(exchange_rate_val):
        date_str = pd.Timestamp(first_row["date"]).strftime("%Y-%m-%d")
        exchange_rate = lookups["exchange_rates"][date_str]
    else:
        exchange_rate = float(exchange_rate_val)

    data = {
        "cost_type": cost_type,
        "partner_company_id": lookups["partners"][cell_str(first_row["partner_company"])],
        "date": pd.Timestamp(first_row["date"]).strftime("%Y-%m-%d"),
        "title": cell_str(first_row["title"]),
        "igv_rate": float(first_row["igv_rate"]),
        "currency": cell_str(first_row["currency"]),
        "exchange_rate": exchange_rate,
        "document_ref": cell_str(first_row["document_ref"]),
    }

    # FK lookups (optional)
    if proj_code:
        data["project_id"] = lookups["projects"][proj_code]

    entity_doc = cell_str(first_row.get("entity_document_number"))
    if entity_doc:
        data["entity_id"] = lookups["entities"][entity_doc]

    quote_ref = cell_str(first_row.get("quote_document_ref"))
    if quote_ref:
        data["quote_id"] = lookups["quotes"][quote_ref]

    # Optional numeric
    detraccion = opt_float(first_row, "detraccion_rate")
    if detraccion is not None:
        data["detraccion_rate"] = detraccion

    # Optional strings
    for field in ("comprobante_type", "comprobante_number", "payment_method", "notes"):
        val = cell_str(first_row.get(field))
        if val:
            data[field] = val

    # Optional dates
    due = opt_date(first_row, "due_date")
    if due:
        data["due_date"] = due

    return data


def _build_item_data(row):
    """Build a single item dict for fn_create_cost_with_items."""
    data = {
        "title": cell_str(row["item_title"]),
        "category": cell_str(row["category"]),
        "subtotal": float(row["subtotal"]),
    }

    for field in ("quantity", "unit_price"):
        val = row.get(field)
        if not is_empty(val):
            data[field] = float(val)

    uom = cell_str(row.get("unit_of_measure"))
    if uom:
        data["unit_of_measure"] = uom

    return data


def import_costs():
    """Import costs with line items from a combined Excel template."""
    result = load_excel_file("Import Costs")
    if not result:
        return
    df, file_path = result

    lookups = _load_cost_lookups()

    # Per-row validation
    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_cost_row(excel_row, row, errors, lookups)

    # Group-level validation (consistency, duplicates)
    _validate_groups(df, errors, lookups)

    if process_import_errors(file_path, errors):
        return

    # Group rows by document_ref for summary and insert
    groups = {}
    for _, row in df.iterrows():
        doc_ref = cell_str(row.get("document_ref"))
        groups.setdefault(doc_ref, []).append(row)

    # Summary
    print(f"\n--- Summary ---")
    print(f"  File:    {file_path}")
    print(f"  Costs:   {len(groups)}")
    print(f"  Items:   {len(df)}")
    print(f"\n  Preview:")
    for i, (doc_ref, rows) in enumerate(list(groups.items())[:5]):
        proj = cell_str(rows[0].get("project_code")) or "SGA"
        print(f"    {i + 1}. [{doc_ref}] {proj} — {cell_str(rows[0].get('title'))} ({len(rows)} items)")

    if not confirm(f"\nImport {len(groups)} costs with {len(df)} total items?"):
        cancel_and_wait()
        return

    # Insert via RPC — one call per cost group
    success_count = 0
    for doc_ref, rows in groups.items():
        header_data = _build_header_data(rows[0], lookups)
        items_data = [_build_item_data(row) for row in rows]
        try:
            supabase.rpc("fn_create_cost_with_items", {
                "header_data": header_data,
                "items_data": items_data,
            }).execute()
            success_count += 1
        except Exception as e:
            print(f"\n✗ Error inserting '{doc_ref}': {e}")
            if success_count > 0:
                print(f"  ({success_count} costs were already inserted before this error)")
            input("\nPress Enter to continue...")
            return

    print(f"\n✓ {success_count} costs ({len(df)} items) imported successfully.")
    input("\nPress Enter to continue...")
