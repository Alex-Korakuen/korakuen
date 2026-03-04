#!/usr/bin/env python3
"""
Module: entities.py
Purpose: All entity operations — add entity, contacts, tags, assign tags, assign to project, import
Tables: entities, entity_contacts, tags, entity_tags, project_entities
"""

import pandas as pd

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_optional_date_input,
    confirm, list_choices, clear_screen,
    get_enum_input, select_project,
)
from lib.import_helpers import (
    DATA_START_ROW,
    validate_required, validate_enum,
    process_import_errors,
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
        print("5. Assign entity to project")
        print("6. Import entities from Excel")
        print("7. Back")

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
            assign_entity_to_project()
        elif choice == "6":
            import_entities()
        elif choice == "7":
            return


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
        print("Cancelled.")
        input("\nPress Enter to continue...")
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

    try:
        response = supabase.table("entities").insert(data).execute()
        entity_id = response.data[0]["id"]
        print(f"\n✓ Entity registered (ID: {entity_id[:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        input("\nPress Enter to continue...")
        return

    # --- Prompt to add primary contact ---
    if confirm("\nAdd a primary contact for this entity?"):
        _add_contact_for_entity(entity_id, is_primary=True)

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

    entity = _search_and_select_entity()
    if not entity:
        return

    _add_contact_for_entity(entity["id"])
    input("\nPress Enter to continue...")


def _add_contact_for_entity(entity_id, is_primary=False):
    """Collect contact fields and insert into entity_contacts."""
    print("\n  --- Contact Details ---")
    full_name = get_input("  Full name: ")
    role = get_optional_input("  Role (optional — press Enter to skip): ")
    phone = get_optional_input("  Phone (optional — press Enter to skip): ")
    email = get_optional_input("  Email (optional — press Enter to skip): ")

    if not is_primary:
        is_primary = confirm("  Is this the primary contact?")

    print("\n  --- Contact Summary ---")
    print(f"    Name:    {full_name}")
    if role:
        print(f"    Role:    {role}")
    if phone:
        print(f"    Phone:   {phone}")
    if email:
        print(f"    Email:   {email}")
    print(f"    Primary: {'Yes' if is_primary else 'No'}")

    if not confirm("\n  Register this contact?"):
        print("  Cancelled.")
        return

    data = {
        "entity_id": entity_id,
        "full_name": full_name,
        "is_primary": is_primary,
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
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    data = {"name": name}
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("tags").insert(data).execute()
        print(f"\n✓ Tag registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Assign Tag to Entity
# ============================================================

def assign_tag():
    """Assign one or more tags to an entity."""
    clear_screen()
    print("\n=== Assign Tag to Entity ===\n")

    entity = _search_and_select_entity()
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
# Assign Entity to Project
# ============================================================

def assign_entity_to_project():
    """Assign an entity to a project with a role."""
    clear_screen()
    print("\n=== Assign Entity to Project ===\n")

    # Select entity
    entity = _search_and_select_entity()
    if not entity:
        return

    # Select project
    project = select_project()
    if not project:
        return

    # Select role (tag)
    tags = supabase.table("tags").select("id, name").eq("is_active", True).order("name").execute()
    if not list_choices("Available roles (tags)", tags.data, display=["name"]):
        input("\nPress Enter to continue...")
        return
    tag_num = get_input("  Select role number: ")
    try:
        tag = tags.data[int(tag_num) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    # Optional dates and notes
    start_date = get_optional_date_input("  Start date (YYYY-MM-DD, optional — press Enter to skip): ")
    end_date = get_optional_date_input("  End date (YYYY-MM-DD, optional — press Enter to skip): ")
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # Summary
    print("\n--- Summary ---")
    print(f"  Entity:  {entity['legal_name']}")
    print(f"  Project: {project['project_code']} — {project['name']}")
    print(f"  Role:    {tag['name']}")
    if start_date:
        print(f"  Start:   {start_date}")
    if end_date:
        print(f"  End:     {end_date}")
    if notes:
        print(f"  Notes:   {notes}")

    if not confirm("\nAssign entity to project?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    data = {
        "entity_id": entity["id"],
        "project_id": project["id"],
        "tag_id": tag["id"],
    }
    if start_date:
        data["start_date"] = start_date
    if end_date:
        data["end_date"] = end_date
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("project_entities").insert(data).execute()
        print(f"\n✓ Entity assigned to project (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


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
    if not pd.isna(row.get("common_name", None)) and str(row.get("common_name", "")).strip():
        data["common_name"] = str(row["common_name"]).strip()
    if not pd.isna(row.get("city", None)) and str(row.get("city", "")).strip():
        data["city"] = str(row["city"]).strip()
    if not pd.isna(row.get("region", None)) and str(row.get("region", "")).strip():
        data["region"] = str(row["region"]).strip()
    if not pd.isna(row.get("notes", None)) and str(row.get("notes", "")).strip():
        data["notes"] = str(row["notes"]).strip()
    return data


def import_entities():
    """Import entities from an Excel spreadsheet."""
    clear_screen()
    print("\n=== Import Entities ===\n")

    file_path = get_input("Enter path to Excel file (or drag file into terminal): ").strip().strip("'\"")

    # Read file — header in row 1, skip rows 2-4, data starts at row 5
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

    # Load existing document numbers for uniqueness check
    existing = supabase.table("entities").select("document_number").execute()
    existing_doc_numbers = {row["document_number"] for row in existing.data}

    # Also check for duplicates within the file
    file_doc_numbers = set()
    for idx, row in df.iterrows():
        doc_num = row.get("document_number")
        if doc_num and not pd.isna(doc_num):
            doc_str = str(doc_num).strip()
            if doc_str in file_doc_numbers:
                # Will be caught as duplicate in database check or we flag it
                pass
            file_doc_numbers.add(doc_str)

    # Validate all rows
    errors = []
    for idx, row in df.iterrows():
        excel_row = idx + DATA_START_ROW
        _validate_entity_row(excel_row, row, errors, existing_doc_numbers)

    if process_import_errors(file_path, errors):
        return

    # Show summary
    print(f"\n--- Summary ---")
    print(f"  File:    {file_path}")
    print(f"  Records: {len(df)}")
    print(f"\n  First 3 rows:")
    for i, (_, row) in enumerate(df.head(3).iterrows()):
        print(f"    {i+1}. {row.get('document_type', '')} {row.get('document_number', '')} — {row.get('legal_name', '')}")

    if not confirm(f"\nImport {len(df)} entities?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # Batch insert
    try:
        records = [_build_entity_record(row) for _, row in df.iterrows()]
        response = supabase.table("entities").insert(records).execute()
        print(f"\n✓ {len(response.data)} entities imported successfully.")
    except Exception as e:
        print(f"\n✗ Error during import: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Shared Helpers
# ============================================================

def _search_and_select_entity():
    """Search for an entity by document number or name. Returns selected entity dict or None."""
    search = get_input("  Search entity (document number or name): ")

    # Try exact match on document_number first
    result = (
        supabase.table("entities")
        .select("id, entity_type, document_type, document_number, legal_name, common_name")
        .eq("is_active", True)
        .eq("document_number", search)
        .execute()
    )

    # If no exact match, search by name
    if not result.data:
        result = (
            supabase.table("entities")
            .select("id, entity_type, document_type, document_number, legal_name, common_name")
            .eq("is_active", True)
            .ilike("legal_name", f"%{search}%")
            .execute()
        )

    if not result.data:
        print("\n  No entities found.")
        input("\nPress Enter to continue...")
        return None

    if len(result.data) == 1:
        entity = result.data[0]
        print(f"\n  Found: {entity['document_type']} {entity['document_number']} — {entity['legal_name']}")
        return entity

    # Multiple results — let user pick
    list_choices("Matching entities", result.data, display=["document_number", "legal_name"])
    selection = get_input("  Select entity number: ")
    try:
        return result.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return None
