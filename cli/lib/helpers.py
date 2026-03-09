"""
Shared input helpers — used by all CLI modules.
"""

import os
from datetime import datetime

from lib.db import supabase


# IGV (Peru VAT) rate — 18%
IGV_RATE = 0.18

# PEN/USD exchange rate — historical range for sanity checks
EXCHANGE_RATE_MIN = 2.5
EXCHANGE_RATE_MAX = 6.0

# Comprobante (payment document) types — canonical definitions
COMPROBANTE_TYPES_ALL = ("factura", "boleta", "recibo_por_honorarios", "liquidacion_de_compra", "planilla_jornales", "none")
COMPROBANTE_TYPES_AR = ("factura", "boleta", "recibo_por_honorarios")
NO_IGV_CREDIT_TYPES = ("boleta", "recibo_por_honorarios", "planilla_jornales", "none")


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


def execute_insert(table, data, label, wait=True):
    """Insert record(s) into table, print success/error, optionally wait.

    Returns the response on success, None on error.
    """
    try:
        response = supabase.table(table).insert(data).execute()
        rec = response.data[0] if response.data else {}
        id_str = rec.get("id", "")[:8] if rec.get("id") else ""
        if id_str:
            print(f"\n✓ {label} (ID: {id_str}...)")
        else:
            print(f"\n✓ {label}")
        if wait:
            input("\nPress Enter to continue...")
        return response
    except Exception as e:
        print(f"\n✗ Error: {e}")
        if wait:
            input("\nPress Enter to continue...")
        return None


def cancel_and_wait():
    """Print cancellation message and wait for Enter."""
    print("Cancelled.")
    input("\nPress Enter to continue...")


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


def get_optional_enum_input(prompt, allowed_values, transform="lower"):
    """Prompt for an optional enum value. Returns None if empty, re-prompts if invalid."""
    value = input(prompt).strip()
    if not value:
        return None
    if transform == "lower":
        value = value.lower()
    elif transform == "upper":
        value = value.upper()
    while value not in allowed_values:
        print(f"  Must be one of: {', '.join(allowed_values)} (or press Enter to skip)")
        value = input(prompt).strip()
        if not value:
            return None
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


def get_exchange_rate(transaction_date=None, prompt=None):
    """Prompt for required exchange rate (PEN per USD). Loops until valid number entered.
    Warns if rate is outside the typical 2.5–6.0 range and asks for confirmation.

    If transaction_date is provided (YYYY-MM-DD string), queries the exchange_rates
    table for the most recent rate on or before that date and offers it as a default.
    If prompt is provided, uses it instead of the default prompt text (no suggestion lookup).
    """
    # Look up suggested rate from exchange_rates table
    suggested_rate = None
    suggested_date = None
    if transaction_date and not prompt:
        try:
            result = (
                supabase.table("exchange_rates")
                .select("mid_rate, rate_date")
                .lte("rate_date", transaction_date)
                .order("rate_date", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                suggested_rate = float(result.data[0]["mid_rate"])
                suggested_date = result.data[0]["rate_date"]
        except Exception:
            print("  (Could not look up exchange rate — enter manually)")


    while True:
        if prompt:
            display_prompt = prompt
        elif suggested_rate:
            display_prompt = f"  Exchange rate (PEN per USD) [{suggested_rate:.4f} from {suggested_date}]: "
        else:
            display_prompt = "  Exchange rate (PEN per USD): "

        value = input(display_prompt).strip()

        # Accept suggestion on empty input
        if not value:
            if suggested_rate:
                return suggested_rate
            print("  This field is required.")
            continue

        try:
            rate = float(value)
            if rate <= 0:
                print("  Must be a positive number.")
                continue
            if not (EXCHANGE_RATE_MIN <= rate <= EXCHANGE_RATE_MAX):
                print(f"  Warning: {rate} is outside the typical range ({EXCHANGE_RATE_MIN}–{EXCHANGE_RATE_MAX}).")
                if not confirm("  Use this rate anyway?"):
                    continue
            return rate
        except ValueError:
            print("  Must be a valid number (e.g. 3.72).")


def get_nonneg_float(prompt, required=True, default=None):
    """Prompt for a non-negative number. Loops until valid.

    Args:
        prompt: The input prompt string.
        required: If True, loops on empty input. If False, returns None on empty.
        default: If set, return this value on empty input (overrides required).
    """
    while True:
        value = input(prompt).strip()
        if not value:
            if default is not None:
                return default
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


def search_and_select_entity():
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


def select_partner_company(show_ruc=False):
    """Query active partner companies and let user select one.

    Args:
        show_ruc: If True, display RUC alongside name.

    Returns the selected partner_company dict (id, name, and ruc if show_ruc), or None.
    """
    fields = "id, name, ruc" if show_ruc else "id, name"
    partners = (
        supabase.table("partner_companies")
        .select(fields)
        .eq("is_active", True)
        .execute()
    )
    if not partners.data:
        print("\n  No partner companies found.")
        input("\nPress Enter to continue...")
        return None

    display = ["name", "ruc"] if show_ruc else ["name"]
    list_choices("Partner companies", partners.data, display=display)

    num = get_input("  Select partner company: ")
    try:
        return partners.data[int(num) - 1]
    except (ValueError, IndexError):
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
