#!/usr/bin/env python3
"""
Module: entities.py
Purpose: All entity operations — add entity, contacts, tags, assign tags, import
Tables: entities, entity_contacts, tags, entity_tags
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, execute_insert,
    search_and_select_entity,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum,
    process_import_errors,
    load_excel_file, print_import_summary,
    opt_str,
)


def menu():
    """Submenu for entity operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Entities & Contacts ===\n")
        print("1. Add entity")
        print("2. Add contact to entity")
        print("3. Add tag")
        print("4. Assign tag to entity")
        print("5. Import entities from Excel")
        print("6. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_entity()
        elif choice == "2":
            add_contact()
        elif choice == "3":
            add_tag()
        elif choice == "4":
            assign_tag()
        elif choice == "5":
            import_entities()
        elif choice == "6":
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add Entity
# ============================================================

def add_entity():
    """Register a single entity interactively."""
    clear_screen()
    print("\n=== Add Entity ===\n")

    # --- Entity type ---
    print("  Entity types: company, individual")
    entity_type = get_enum_input("  Entity type: ", ("company", "individual"))

    # --- Document type ---
    print("\n  Document types: RUC, DNI, CE, Pasaporte")
    document_type = get_enum_input("  Document type: ", ("RUC", "DNI", "CE", "PASAPORTE"), transform="upper")
    # Normalize casing
    if document_type == "PASAPORTE":
        document_type = "Pasaporte"

    # --- Document number ---
    document_number = get_input("  Document number: ")
    if document_type == "RUC" and len(document_number) != 11:
        print(f"  Warning: RUC should be 11 digits (got {len(document_number)}).")
    elif document_type == "DNI" and len(document_number) != 8:
        print(f"  Warning: DNI should be 8 digits (got {len(document_number)}).")

    # --- Duplicate check ---
    existing = (
        supabase.table("entities")
        .select("id, document_type, document_number, legal_name, is_active")
        .eq("document_number", document_number)
        .execute()
    )
    if existing.data:
        e = existing.data[0]
        status = "active" if e.get("is_active") else "INACTIVE"
        print(f"\n  Warning: Entity already exists with this document number:")
        print(f"    {e['document_type']} {e['document_number']} — {e['legal_name']} ({status})")
        if not confirm("\n  Continue adding a new entity anyway?"):
            print("  Cancelled.")
            input("\nPress Enter to continue...")
            return

    # --- Names ---
    legal_name = get_input("  Legal name (razón social): ")
    common_name = get_optional_input("  Common name (optional — press Enter to skip): ")

    # --- Notes ---
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Location ---
    city = get_optional_input("  City (optional — press Enter to skip): ")
    region = get_optional_input("  Region (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Type:            {entity_type}")
    print(f"  Document:        {document_type} {document_number}")
    print(f"  Legal name:      {legal_name}")
    if common_name:
        print(f"  Common name:     {common_name}")
    if city:
        print(f"  City:            {city}")
    if region:
        print(f"  Region:          {region}")
    if notes:
        print(f"  Notes:           {notes}")

    if not confirm("\nRegister this entity?"):
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "entity_type": entity_type,
        "document_type": document_type,
        "document_number": document_number,
        "legal_name": legal_name,
    }
    if common_name:
        data["common_name"] = common_name
    if city:
        data["city"] = city
    if region:
        data["region"] = region
    if notes:
        data["notes"] = notes

    response = execute_insert("entities", data, "Entity registered", wait=False)
    if not response:
        input("\nPress Enter to continue...")
        return
    entity_id = response.data[0]["id"]

    # --- Prompt to add contact ---
    if confirm("\nAdd a contact for this entity?"):
        _add_contact_for_entity(entity_id)

    # --- Prompt to add tags ---
    if confirm("\nAdd tags to this entity?"):
        _assign_tags_to_entity(entity_id)

    input("\nPress Enter to continue...")


# ============================================================
# Add Contact
# ============================================================

def add_contact():
    """Add a contact to an existing entity."""
    clear_screen()
    print("\n=== Add Contact to Entity ===\n")

    entity = search_and_select_entity()
    if not entity:
        return

    _add_contact_for_entity(entity["id"])
    input("\nPress Enter to continue...")


def _add_contact_for_entity(entity_id):
    """Collect contact fields and insert into entity_contacts."""
    print("\n  --- Contact Details ---")
    full_name = get_input("  Full name: ")
    role = get_optional_input("  Role (optional — press Enter to skip): ")
    phone = get_optional_input("  Phone (optional — press Enter to skip): ")
    email = get_optional_input("  Email (optional — press Enter to skip): ")

    print("\n  --- Contact Summary ---")
    print(f"    Name:    {full_name}")
    if role:
        print(f"    Role:    {role}")
    if phone:
        print(f"    Phone:   {phone}")
    if email:
        print(f"    Email:   {email}")

    if not confirm("\n  Register this contact?"):
        print("  Cancelled.")
        return

    data = {
        "entity_id": entity_id,
        "full_name": full_name,
    }
    if role:
        data["role"] = role
    if phone:
        data["phone"] = phone
    if email:
        data["email"] = email

    try:
        response = supabase.table("entity_contacts").insert(data).execute()
        print(f"\n  ✓ Contact registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n  ✗ Error: {e}")


# ============================================================
# Add Tag
# ============================================================

def add_tag():
    """Create a new tag."""
    clear_screen()
    print("\n=== Add Tag ===\n")

    # Show existing tags
    existing = supabase.table("tags").select("name").eq("is_active", True).order("name").execute()
    if existing.data:
        print("  Existing tags:")
        for t in existing.data:
            print(f"    - {t['name']}")
        print()

    name = get_input("  Tag name (snake_case): ").strip().lower().replace(" ", "_")

    # Check uniqueness
    check = supabase.table("tags").select("id").eq("name", name).execute()
    if check.data:
        print(f"\n✗ Tag '{name}' already exists.")
        input("\nPress Enter to continue...")
        return

    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    print("\n--- Summary ---")
    print(f"  Name:  {name}")
    if notes:
        print(f"  Notes: {notes}")

    if not confirm("\nRegister this tag?"):
        cancel_and_wait()
        return

    data = {"name": name}
    if notes:
        data["notes"] = notes

    execute_insert("tags", data, "Tag registered")


# ============================================================
# Assign Tag to Entity
# ============================================================

def assign_tag():
    """Assign one or more tags to an entity."""
    clear_screen()
    print("\n=== Assign Tag to Entity ===\n")

    entity = search_and_select_entity()
    if not entity:
        return

    _assign_tags_to_entity(entity["id"])
    input("\nPress Enter to continue...")


def _assign_tags_to_entity(entity_id):
    """Show available tags and let user select multiple to assign."""
    # Get current tags for this entity
    current = (
        supabase.table("entity_tags")
        .select("tag_id, tags(name)")
        .eq("entity_id", entity_id)
        .execute()
    )
    current_tag_ids = {row["tag_id"] for row in current.data}

    if current.data:
        print("\n  Current tags:")
        for row in current.data:
            print(f"    - {row['tags']['name']}")

    # Get all active tags
    all_tags = supabase.table("tags").select("id, name").eq("is_active", True).order("name").execute()
    available = [t for t in all_tags.data if t["id"] not in current_tag_ids]

    if not available:
        print("\n  No additional tags available to assign.")
        return

    list_choices("Available tags", available, display=["name"])

    print("  Enter tag numbers to assign (comma-separated), or press Enter to skip:")
    selection = get_optional_input("  Tags: ")
    if not selection:
        return

    # Parse comma-separated numbers
    try:
        indices = [int(x.strip()) - 1 for x in selection.split(",")]
        selected_tags = [available[i] for i in indices if 0 <= i < len(available)]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        return

    if not selected_tags:
        return

    # Insert tag assignments
    records = [{"entity_id": entity_id, "tag_id": t["id"]} for t in selected_tags]
    try:
        supabase.table("entity_tags").insert(records).execute()
        tag_names = ", ".join(t["name"] for t in selected_tags)
        print(f"\n  ✓ Assigned tags: {tag_names}")
    except Exception as e:
        print(f"\n  ✗ Error: {e}")


# ============================================================
# Import Entities
# ============================================================

def _validate_entity_row(row_num, row, errors, existing_doc_numbers):
    """Validate a single entity row."""
    validate_required(row_num, row, "entity_type", errors)
    validate_required(row_num, row, "document_type", errors)
    validate_required(row_num, row, "document_number", errors)
    validate_required(row_num, row, "legal_name", errors)

    validate_enum(row_num, row, "entity_type", ["company", "individual"], errors)
    validate_enum(row_num, row, "document_type", ["RUC", "DNI", "CE", "Pasaporte"], errors)

    # Validate document number format
    doc_type = row.get("document_type")
    doc_num = row.get("document_number")
    if doc_type and doc_num and not pd.isna(doc_type) and not pd.isna(doc_num):
        doc_num_str = str(doc_num).strip()
        if str(doc_type).strip() == "RUC" and len(doc_num_str) != 11:
            errors.append((row_num, "document_number", "RUC must be 11 digits"))
        elif str(doc_type).strip() == "DNI" and len(doc_num_str) != 8:
            errors.append((row_num, "document_number", "DNI must be 8 digits"))

    # Check uniqueness against database
    if doc_num and not pd.isna(doc_num):
        if str(doc_num).strip() in existing_doc_numbers:
            errors.append((row_num, "document_number", "Already exists in database"))


def _build_entity_record(row):
    """Convert a spreadsheet row to a database record."""
    data = {
        "entity_type": str(row["entity_type"]).strip(),
        "document_type": str(row["document_type"]).strip(),
        "document_number": str(row["document_number"]).strip(),
        "legal_name": str(row["legal_name"]).strip(),
    }
    for field in ("common_name", "city", "region", "notes"):
        val = opt_str(row, field)
        if val:
            data[field] = val
    return data


def import_entities():
    """Import entities from an Excel spreadsheet."""
    result = load_excel_file("Import Entities")
    if not result:
        return
    df, file_path = result

    # Load existing document numbers for uniqueness check
    existing = supabase.table("entities").select("document_number").execute()
    existing_doc_numbers = {row["document_number"] for row in existing.data}

    # Check for duplicates within the file
    file_doc_numbers = set()
    file_duplicate_errors = []
    for idx, row in df.iterrows():
        doc_num = row.get("document_number")
        if doc_num and not pd.isna(doc_num):
            doc_str = str(doc_num).strip()
            if doc_str in file_doc_numbers:
                excel_row = idx + DATA_START_ROW
                file_duplicate_errors.append((excel_row, f"Duplicate document_number '{doc_str}' within file"))
            file_doc_numbers.add(doc_str)

    # Validate all rows
    errors = list(file_duplicate_errors)
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_entity_row(excel_row, row, errors, existing_doc_numbers)

    if process_import_errors(file_path, errors):
        return

    print_import_summary(file_path, df,
        lambda i, row: f"{i}. {row.get('document_type', '')} {row.get('document_number', '')} — {row.get('legal_name', '')}")

    if not confirm(f"\nImport {len(df)} entities?"):
        cancel_and_wait()
        return

    # Batch insert
    try:
        records = [_build_entity_record(row) for _, row in df.iterrows()]
        response = supabase.table("entities").insert(records).execute()
        print(f"\n✓ {len(response.data)} entities imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")


