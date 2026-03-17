#!/usr/bin/env python3
"""
Module: projects.py
Purpose: All project operations — add single, import from Excel, set budget, set partner shares
Tables: projects, project_budgets, project_partners
"""

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_currency, get_nonneg_float, execute_insert,
    search_and_select_entity,
)


def menu():
    """Submenu for project operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Projects ===\n")
        print("1. Add project")
        print("2. Set project budget")
        print("3. Set partner shares")
        print("4. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_project()
        elif choice == "2":
            set_project_budget()
        elif choice == "3":
            set_partner_shares()
        elif choice == "4":
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
        entity = search_and_select_entity()
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
# Set Project Budget
# ============================================================

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
    cat_result = (
        supabase.table("categories")
        .select("name, label")
        .eq("cost_type", "project_cost")
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    budget_entries = []
    for cat in cat_result.data:
        amount = get_nonneg_float(f"    {cat['label']}: ")
        budget_entries.append({"category": cat["name"], "label": cat["label"], "amount": amount})

    # --- Notes ---
    notes = get_optional_input("\n  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Summary ---")
    print(f"  Project:  {project_code} — {project_name}")
    print(f"  Currency: {currency}")
    print()
    total_budget = 0
    for entry in budget_entries:
        print(f"    {entry['label']:25s} {currency} {entry['amount']:>12,.2f}")
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

    # --- Soft-delete existing and upsert new ---
    try:
        # Soft-delete all existing active shares for this project
        supabase.table("project_partners").update(
            {"is_active": False}
        ).eq("project_id", project_id).eq("is_active", True).execute()

        # Upsert new shares (reactivate if previously soft-deleted)
        count = 0
        for s in shares:
            partner_id = s["partner"]["id"]
            # Check if an inactive row exists for this pair
            existing = (
                supabase.table("project_partners")
                .select("id")
                .eq("project_id", project_id)
                .eq("partner_company_id", partner_id)
                .eq("is_active", False)
                .limit(1)
                .execute()
            )
            if existing.data:
                # Reactivate and update
                supabase.table("project_partners").update({
                    "profit_share_pct": s["pct"],
                    "is_active": True,
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                # Insert new
                supabase.table("project_partners").insert({
                    "project_id": project_id,
                    "partner_company_id": partner_id,
                    "profit_share_pct": s["pct"],
                }).execute()
            count += 1
        print(f"\n✓ Partner shares set for {project_code}: {count} partners")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")
