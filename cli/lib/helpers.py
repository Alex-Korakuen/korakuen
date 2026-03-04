"""
Shared input helpers — used by all CLI modules.
"""

import os
from datetime import datetime

from lib.db import supabase


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


def get_date_input(prompt):
    """Prompt for required date in YYYY-MM-DD format. Loops until valid."""
    while True:
        value = input(prompt).strip()
        if not value:
            print("  This field is required.")
            continue
        try:
            datetime.strptime(value, "%Y-%m-%d")
            return value
        except ValueError:
            print("  Invalid date. Use YYYY-MM-DD format (e.g. 2026-03-15).")


def get_optional_date_input(prompt):
    """Prompt for optional date in YYYY-MM-DD format. Returns None if empty."""
    value = input(prompt).strip()
    if not value:
        return None
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except ValueError:
        print("  Invalid date. Use YYYY-MM-DD format (e.g. 2026-03-15). Skipping.")
        return None


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

    Returns:
        True if data was displayed, False if empty.
    """
    if not data:
        print(f"\n  No {title.lower()} found.")
        return False

    print(f"\n  {title}:")
    for i, row in enumerate(data, start=1):
        values = " — ".join(str(row.get(field, "")) for field in display)
        print(f"    {i}. {values}")
    print()
    return True


def clear_screen():
    """Clear the terminal screen."""
    os.system("clear")


def get_enum_input(prompt, allowed_values, transform="lower"):
    """Prompt until user enters a value in the allowed set.

    Args:
        prompt: The input prompt string.
        allowed_values: Collection of valid string values.
        transform: "lower", "upper", or None.
    """
    value = get_input(prompt)
    if transform == "lower":
        value = value.lower()
    elif transform == "upper":
        value = value.upper()

    while value not in allowed_values:
        print(f"  Must be one of: {', '.join(allowed_values)}")
        value = get_input(prompt)
        if transform == "lower":
            value = value.lower()
        elif transform == "upper":
            value = value.upper()

    return value


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
    """Prompt for required exchange rate (PEN per USD). Loops until valid number entered.
    Warns if rate is outside the typical 2.5–6.0 range and asks for confirmation.
    """
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
            # Sanity check — historical PEN/USD has been in the 2.5–6.0 range
            if not (2.5 <= rate <= 6.0):
                print(f"  Warning: {rate} is outside the typical range (2.5–6.0).")
                if not confirm("  Use this rate anyway?"):
                    continue
            return rate
        except ValueError:
            print("  Must be a valid number (e.g. 3.72).")


def get_nonneg_float(prompt, required=True):
    """Prompt for a non-negative number. Loops until valid.

    Args:
        prompt: The input prompt string.
        required: If True, loops on empty input. If False, returns None on empty.
    """
    while True:
        value = input(prompt).strip()
        if not value:
            if required:
                print("  This field is required.")
                continue
            return None
        try:
            num = float(value)
            if num < 0:
                print("  Must not be negative.")
                continue
            return num
        except ValueError:
            print("  Must be a valid number.")


def select_project(optional=False):
    """Query active projects and let user select one.

    Returns the selected project dict, or None if cancelled/invalid.
    When optional=True, user can press Enter to skip.
    """
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


def select_bank_account(detraccion_filter=None, label="bank account", currency=None):
    """Query active bank accounts and let user select one.

    Args:
        detraccion_filter: None=all, True=detraccion only, False=regular only.
        label: Display label for messages.
        currency: If provided, only show accounts matching this currency (USD/PEN).

    Returns the selected bank_account dict, or None.
    """
    query = (
        supabase.table("bank_accounts")
        .select("id, bank_name, account_number_last4, currency, is_detraccion_account, partner_companies(name)")
        .eq("is_active", True)
    )
    if detraccion_filter is not None:
        query = query.eq("is_detraccion_account", detraccion_filter)
    if currency is not None:
        query = query.eq("currency", currency)

    bank_accounts = query.execute()

    if not bank_accounts.data:
        print(f"\n  No {label} accounts found.")
        input("\nPress Enter to continue...")
        return None

    print(f"\n  Available {label} accounts:")
    for i, ba in enumerate(bank_accounts.data, start=1):
        partner = ba.get("partner_companies", {}).get("name", "Unknown")
        print(f"    {i}. {ba['bank_name']} {ba['currency']} {ba['account_number_last4']} ({partner})")
    print()

    bank_num = get_input("  Select bank account number: ")
    try:
        return bank_accounts.data[int(bank_num) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return None
