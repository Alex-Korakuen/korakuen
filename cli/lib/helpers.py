"""
Shared input helpers — used by all CLI modules.
"""

import os


def get_input(prompt):
    """Prompt for required input. Loops until non-empty."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("  This field is required.")


def get_optional_input(prompt):
    """Prompt for optional input. Returns None if empty."""
    value = input(prompt).strip()
    return value if value else None


def confirm(message):
    """Ask y/n confirmation. Returns True if user types y or Y."""
    response = input(f"{message} (y/n): ").strip().lower()
    return response == "y"


def list_choices(title, data, display):
    """Display a numbered list of options from a Supabase query result.

    Args:
        title: Header text to print above the list.
        data: List of dicts (from response.data).
        display: List of field names to show per row.
    """
    if not data:
        print(f"\n  No {title.lower()} found.")
        return

    print(f"\n  {title}:")
    for i, row in enumerate(data, start=1):
        values = " — ".join(str(row.get(field, "")) for field in display)
        print(f"    {i}. {values}")
    print()


def clear_screen():
    """Clear the terminal screen."""
    os.system("clear")


def get_currency(default=None, label="Currency"):
    """Prompt for USD/PEN currency selection. Returns the selected currency string.

    Args:
        default: If provided, allows pressing Enter to use this value.
        label: Prompt label (e.g. "Currency", "Contract currency", "Budget currency").
    """
    if default:
        value = input(f"  {label} (default: {default}): ").strip().upper()
        currency = value if value else default
    else:
        currency = get_input(f"  {label}: ").upper()
    while currency not in ("USD", "PEN"):
        print("  Must be USD or PEN.")
        currency = get_input(f"  {label}: ").upper()
    return currency


def get_exchange_rate():
    """Prompt for required exchange rate (PEN per USD). Loops until valid number entered."""
    while True:
        value = input("  Exchange rate (PEN per USD): ").strip()
        if not value:
            print("  This field is required.")
            continue
        try:
            rate = float(value)
            if rate <= 0:
                print("  Must be a positive number.")
                continue
            return rate
        except ValueError:
            print("  Must be a valid number (e.g. 3.72).")


def select_project(optional=False):
    """Query active projects and let user select one.

    Returns the selected project dict, or None if cancelled/invalid.
    When optional=True, user can press Enter to skip.
    """
    from lib.db import supabase

    projects = (
        supabase.table("projects")
        .select("id, project_code, name")
        .eq("is_active", True)
        .order("project_code")
        .execute()
    )
    if not projects.data:
        if not optional:
            print("\n  No active projects found.")
            input("\nPress Enter to continue...")
        return None

    list_choices("Active projects", projects.data, display=["project_code", "name"])

    if optional:
        proj_num = get_optional_input("  Select project number (optional — press Enter to skip): ")
        if not proj_num:
            return None
    else:
        proj_num = get_input("  Select project number: ")

    try:
        return projects.data[int(proj_num) - 1]
    except (ValueError, IndexError):
        if optional:
            print("  Invalid selection, skipping project.")
        else:
            print("\n  ✗ Invalid selection.")
            input("\nPress Enter to continue...")
        return None
