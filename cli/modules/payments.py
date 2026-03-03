#!/usr/bin/env python3
"""
Module: payments.py
Purpose: All payment operations — register payment, verify retencion
Tables: payments, ar_invoices (update retencion_verified)
"""

from lib.db import supabase
from lib.helpers import get_input, get_optional_input, confirm, list_choices, clear_screen


def menu():
    """Submenu for payment operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Payments ===\n")
        print("1. Register payment")
        print("2. Verify retencion")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            register_payment()
        elif choice == "2":
            verify_retencion()
        elif choice == "3":
            return


# ============================================================
# Register Payment
# ============================================================

def register_payment():
    """Register a payment against a cost or AR invoice."""
    clear_screen()
    print("\n=== Register Payment ===\n")

    # --- Select related_to ---
    print("  Payment relates to:")
    print("    1. Cost (outbound payment)")
    print("    2. AR Invoice (inbound collection)")
    rel_choice = get_input("\n  Select (1 or 2): ")

    if rel_choice == "1":
        related_to = "cost"
        direction = "outbound"
    elif rel_choice == "2":
        related_to = "ar_invoice"
        direction = "inbound"
    else:
        print("\n✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    # --- Select the specific record ---
    if related_to == "cost":
        record = _select_cost()
    else:
        record = _select_ar_invoice()

    if not record:
        return

    related_id = record["_id"]
    outstanding = record.get("_outstanding", 0)
    record_currency = record.get("_currency", "PEN")

    print(f"\n  Direction: {direction} (auto-derived)")

    # --- Payment type ---
    print("\n  Payment types: regular, detraccion, retencion")
    payment_type = get_input("  Payment type: ").lower()
    while payment_type not in ("regular", "detraccion", "retencion"):
        print("  Must be regular, detraccion, or retencion.")
        payment_type = get_input("  Payment type: ").lower()

    # --- Payment details ---
    payment_date = get_input("\n  Payment date (YYYY-MM-DD): ")

    amount_input = get_input("  Amount: ")
    try:
        amount = float(amount_input)
    except ValueError:
        print("  Invalid number.")
        input("\nPress Enter to continue...")
        return

    print(f"\n  Currencies: USD, PEN (record currency: {record_currency})")
    currency = get_input(f"  Currency (default: {record_currency}): ").upper() or record_currency
    while currency not in ("USD", "PEN"):
        print("  Must be USD or PEN.")
        currency = get_input("  Currency: ").upper()

    exchange_rate = get_optional_input("  Exchange rate (optional — press Enter to skip): ")
    if exchange_rate:
        try:
            exchange_rate = float(exchange_rate)
        except ValueError:
            exchange_rate = None

    # --- Bank account (conditional) ---
    bank_account = None
    if payment_type == "retencion":
        print("\n  Bank account: N/A (retencion — withheld by client, paid to SUNAT)")
    else:
        # Filter by account type
        bank_query = (
            supabase.table("bank_accounts")
            .select("id, bank_name, account_number_last4, currency, is_detraccion_account, partner_companies(name)")
            .eq("is_active", True)
        )
        if payment_type == "detraccion":
            bank_query = bank_query.eq("is_detraccion_account", True)
        else:
            bank_query = bank_query.eq("is_detraccion_account", False)

        accounts = bank_query.execute()
        if not accounts.data:
            label = "detraccion" if payment_type == "detraccion" else "regular"
            print(f"\n  No {label} bank accounts found.")
            input("\nPress Enter to continue...")
            return

        print(f"\n  Available {'detraccion' if payment_type == 'detraccion' else 'regular'} accounts:")
        for i, ba in enumerate(accounts.data, start=1):
            partner = ba.get("partner_companies", {}).get("name", "Unknown")
            print(f"    {i}. {ba['bank_name']} {ba['currency']} {ba['account_number_last4']} ({partner})")
        print()

        bank_num = get_input("  Select bank account number: ")
        try:
            bank_account = accounts.data[int(bank_num) - 1]
        except (ValueError, IndexError):
            print("\n  ✗ Invalid selection.")
            input("\nPress Enter to continue...")
            return

    # --- Partner company ---
    partners = (
        supabase.table("partner_companies")
        .select("id, name")
        .eq("is_active", True)
        .execute()
    )

    # Default to partner from bank account if available
    default_partner = None
    if bank_account and bank_account.get("partner_companies"):
        default_partner = bank_account["partner_companies"]["name"]

    list_choices("Partner companies", partners.data, display=["name"])
    if default_partner:
        print(f"  (Default: {default_partner})")
    partner_num = get_input("  Select partner company number: ")
    try:
        partner = partners.data[int(partner_num) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    notes = get_optional_input("\n  Notes (optional — press Enter to skip): ")

    # --- Display balance before/after ---
    new_outstanding = outstanding - amount

    print("\n--- Payment Summary ---")
    print(f"  Related to:    {'Cost' if related_to == 'cost' else 'AR Invoice'} {record.get('_label', related_id[:8])}")
    print(f"  Outstanding:   {record_currency} {outstanding:,.2f}")
    print()
    print(f"  Payment:")
    print(f"    Type:        {payment_type}")
    print(f"    Direction:   {direction}")
    print(f"    Date:        {payment_date}")
    print(f"    Amount:      {currency} {amount:,.2f}")
    if bank_account:
        print(f"    Bank:        {bank_account['bank_name']} {bank_account['currency']} {bank_account['account_number_last4']}")
    else:
        print(f"    Bank:        N/A (retencion)")
    print(f"    Partner:     {partner['name']}")
    print()
    print(f"  After payment:")
    print(f"    Outstanding: {record_currency} {new_outstanding:,.2f}")
    if new_outstanding <= 0:
        print(f"    Status:      paid")
    else:
        print(f"    Status:      partial")

    if not confirm("\nRegister this payment?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Insert ---
    data = {
        "related_to": related_to,
        "related_id": related_id,
        "direction": direction,
        "payment_type": payment_type,
        "payment_date": payment_date,
        "amount": amount,
        "currency": currency,
        "partner_company_id": partner["id"],
    }
    if exchange_rate:
        data["exchange_rate"] = exchange_rate
    if bank_account:
        data["bank_account_id"] = bank_account["id"]
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("payments").insert(data).execute()
        print(f"\n✓ Payment registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


def _select_cost():
    """Show costs with outstanding balances and let user select one."""
    # Query costs joined with balance view
    costs = (
        supabase.table("v_cost_balances")
        .select("*")
        .neq("payment_status", "paid")
        .execute()
    )

    if not costs.data:
        print("\n  No costs with outstanding balances found.")
        input("\nPress Enter to continue...")
        return None

    print("\n  Costs with outstanding balances:")
    for i, c in enumerate(costs.data, start=1):
        label = c.get("document_ref") or c.get("title", "")[:30]
        print(f"    {i}. {label} — Outstanding: {c.get('currency', 'PEN')} {c.get('outstanding', 0):,.2f} ({c.get('payment_status', '')})")
    print()

    selection = get_input("  Select cost number: ")
    try:
        cost = costs.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return None

    # Attach display metadata
    cost["_id"] = cost["cost_id"]
    cost["_outstanding"] = cost.get("outstanding", 0)
    cost["_currency"] = cost.get("currency", "PEN")
    cost["_label"] = cost.get("document_ref") or cost.get("title", "")[:30]
    return cost


def _select_ar_invoice():
    """Show AR invoices with outstanding balances and let user select one."""
    invoices = (
        supabase.table("v_ar_balances")
        .select("*")
        .neq("payment_status", "paid")
        .execute()
    )

    if not invoices.data:
        print("\n  No AR invoices with outstanding balances found.")
        input("\nPress Enter to continue...")
        return None

    print("\n  AR invoices with outstanding balances:")
    for i, inv in enumerate(invoices.data, start=1):
        label = inv.get("invoice_number") or inv.get("document_ref") or ""
        print(f"    {i}. {label} — Outstanding: {inv.get('currency', 'PEN')} {inv.get('outstanding', 0):,.2f} ({inv.get('payment_status', '')})")
    print()

    selection = get_input("  Select AR invoice number: ")
    try:
        invoice = invoices.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return None

    invoice["_id"] = invoice["ar_invoice_id"]
    invoice["_outstanding"] = invoice.get("outstanding", 0)
    invoice["_currency"] = invoice.get("currency", "PEN")
    invoice["_label"] = invoice.get("invoice_number") or invoice.get("document_ref") or ""
    return invoice


# ============================================================
# Verify Retencion
# ============================================================

def verify_retencion():
    """Mark retencion as verified on an AR invoice."""
    clear_screen()
    print("\n=== Verify Retencion ===\n")

    # Query AR invoices with retencion_applicable=true and retencion_verified=false
    invoices = (
        supabase.table("ar_invoices")
        .select("id, invoice_number, invoice_date, subtotal, igv_rate, retencion_rate, currency, document_ref, projects(project_code), entities(legal_name)")
        .eq("retencion_applicable", True)
        .eq("retencion_verified", False)
        .execute()
    )

    if not invoices.data:
        print("  No unverified retencion invoices found.")
        input("\nPress Enter to continue...")
        return

    print("  Unverified retencion invoices:")
    for i, inv in enumerate(invoices.data, start=1):
        proj = inv.get("projects", {}).get("project_code", "")
        client = inv.get("entities", {}).get("legal_name", "")
        print(f"    {i}. {proj} — {inv['invoice_number']} — {client}")
    print()

    selection = get_input("  Select invoice number: ")
    try:
        invoice = invoices.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    # Calculate retencion amount for display
    subtotal = float(invoice["subtotal"])
    igv_rate = float(invoice["igv_rate"])
    retencion_rate = float(invoice.get("retencion_rate") or 3)
    gross_total = subtotal * (1 + igv_rate / 100)
    retencion_amount = gross_total * (retencion_rate / 100)

    print(f"\n--- Invoice Details ---")
    print(f"  Invoice:        {invoice['invoice_number']}")
    print(f"  Project:        {invoice.get('projects', {}).get('project_code', '')}")
    print(f"  Client:         {invoice.get('entities', {}).get('legal_name', '')}")
    print(f"  Gross Total:    {invoice['currency']} {gross_total:,.2f}")
    print(f"  Retencion ({retencion_rate}%): {invoice['currency']} {retencion_amount:,.2f}")
    print(f"  Current status: NOT VERIFIED")

    if not confirm("\nMark retencion as verified?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    try:
        supabase.table("ar_invoices").update({"retencion_verified": True}).eq("id", invoice["id"]).execute()
        print(f"\n✓ Retencion verified for invoice {invoice['invoice_number']}.")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")
