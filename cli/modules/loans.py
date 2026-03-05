#!/usr/bin/env python3
"""
Module: loans.py
Purpose: All loan operations — add loan, add repayment schedule, register repayment
Tables: loans, loan_schedule, loan_payments
"""

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_date_input, get_optional_date_input,
    confirm, list_choices, clear_screen,
    get_enum_input, get_currency, get_exchange_rate, select_project,
    get_nonneg_float,
)


def menu():
    """Submenu for loan operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Loans ===\n")
        print("1. Add loan")
        print("2. Add repayment schedule")
        print("3. Register repayment")
        print("4. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_loan()
        elif choice == "2":
            add_schedule()
        elif choice == "3":
            register_repayment()
        elif choice == "4":
            return


# ============================================================
# Add Loan
# ============================================================

def add_loan():
    """Register a new personal loan."""
    clear_screen()
    print("\n=== Add Loan ===\n")

    # --- Lender info ---
    lender_name = get_input("  Lender name: ")
    lender_contact = get_optional_input("  Lender contact (optional — press Enter to skip): ")

    # --- Principal ---
    amount = get_nonneg_float("  Amount (principal borrowed): ")

    # --- Date borrowed ---
    date_borrowed = get_date_input("\n  Date borrowed (YYYY-MM-DD): ")

    # --- Currency ---
    print("\n  Currencies: USD, PEN")
    currency = get_currency()

    exchange_rate = get_exchange_rate(transaction_date=date_borrowed)

    # --- Project (optional) ---
    project = select_project(optional=True)

    # --- Purpose ---
    purpose = get_input("\n  Purpose: ")

    # --- Return type ---
    print("\n  Return types: percentage, fixed")
    return_type = get_enum_input("  Return type: ", ("percentage", "fixed"))

    agreed_return_rate = None
    agreed_return_amount = None

    if return_type == "percentage":
        agreed_return_rate = get_nonneg_float("  Agreed return rate (%): ")
        total_owed = amount + (amount * agreed_return_rate / 100)
    else:
        agreed_return_amount = get_nonneg_float("  Agreed return amount (fixed): ")
        total_owed = amount + agreed_return_amount

    # --- Due date (optional) ---
    due_date = get_optional_date_input("\n  Due date (YYYY-MM-DD, optional — press Enter to skip): ")

    # --- Notes (optional) ---
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    print("\n--- Loan Summary ---")
    print(f"  Lender:        {lender_name}")
    if lender_contact:
        print(f"  Contact:       {lender_contact}")
    print(f"  Principal:     {currency} {amount:,.2f}")
    print(f"  Date borrowed: {date_borrowed}")
    if project:
        print(f"  Project:       {project['project_code']} — {project['name']}")
    print(f"  Purpose:       {purpose}")
    print(f"  Return type:   {return_type}")
    if return_type == "percentage":
        print(f"  Return rate:   {agreed_return_rate}%")
    else:
        print(f"  Return amount: {currency} {agreed_return_amount:,.2f}")
    print(f"  Total owed:    {currency} {total_owed:,.2f}")
    if due_date:
        print(f"  Due date:      {due_date}")
    if notes:
        print(f"  Notes:         {notes}")

    # --- Confirm ---
    if not confirm("\nRegister this loan?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Insert ---
    data = {
        "lender_name": lender_name,
        "amount": amount,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "date_borrowed": date_borrowed,
        "purpose": purpose,
        "return_type": return_type,
        "status": "active",
    }
    if lender_contact:
        data["lender_contact"] = lender_contact
    if project:
        data["project_id"] = project["id"]
    if agreed_return_rate is not None:
        data["agreed_return_rate"] = agreed_return_rate
    if agreed_return_amount is not None:
        data["agreed_return_amount"] = agreed_return_amount
    if due_date:
        data["due_date"] = due_date
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("loans").insert(data).execute()
        print(f"\n✓ Loan registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Add Repayment Schedule
# ============================================================

def add_schedule():
    """Add repayment schedule entries to an existing loan."""
    clear_screen()
    print("\n=== Add Repayment Schedule ===\n")

    # --- List active loans ---
    loans = (
        supabase.table("loans")
        .select("id, lender_name, amount, currency, status, date_borrowed")
        .neq("status", "settled")
        .order("date_borrowed")
        .execute()
    )

    if not loans.data:
        print("  No active loans found.")
        input("\nPress Enter to continue...")
        return

    print("  Active loans:")
    for i, loan in enumerate(loans.data, start=1):
        print(f"    {i}. {loan['lender_name']} — {loan['currency']} {loan['amount']:,.2f} ({loan['status']})")
    print()

    selection = get_input("  Select loan number: ")
    try:
        loan = loans.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    loan_date = loan.get("date_borrowed", "")
    print(f"\n  Adding schedule entries for: {loan['lender_name']} — {loan['currency']} {loan['amount']:,.2f}")
    if loan_date:
        print(f"  (Loan date: {loan_date})")
    print("  (Enter entries one at a time. Type 'done' when finished.)\n")

    entries = []
    entry_num = 1

    while True:
        print(f"  Entry {entry_num}:")
        scheduled_date = get_date_input("    Scheduled date (YYYY-MM-DD): ")

        if loan_date and scheduled_date < loan_date:
            print(f"    ✗ Scheduled date ({scheduled_date}) is before loan date ({loan_date}).")
            continue

        scheduled_amount = get_nonneg_float("    Scheduled amount: ")
        exchange_rate = get_exchange_rate(transaction_date=scheduled_date)

        entries.append({
            "loan_id": loan["id"],
            "scheduled_date": scheduled_date,
            "scheduled_amount": scheduled_amount,
            "exchange_rate": exchange_rate,
        })
        entry_num += 1

        if not confirm("\n  Add another entry?"):
            break

    if not entries:
        print("\n  No entries to add.")
        input("\nPress Enter to continue...")
        return

    # --- Summary ---
    schedule_total = sum(e["scheduled_amount"] for e in entries)
    print(f"\n--- Schedule Summary ---")
    print(f"  Loan:    {loan['lender_name']} — {loan['currency']} {loan['amount']:,.2f}")
    print(f"  Entries: {len(entries)}")
    for i, entry in enumerate(entries, start=1):
        print(f"    {i}. {entry['scheduled_date']} — {loan['currency']} {entry['scheduled_amount']:,.2f}")
    print(f"  Total:   {loan['currency']} {schedule_total:,.2f}")

    # --- Confirm ---
    if not confirm(f"\nAdd {len(entries)} schedule entries?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Batch insert ---
    try:
        response = supabase.table("loan_schedule").insert(entries).execute()
        print(f"\n✓ {len(response.data)} schedule entries added.")
    except Exception as e:
        print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# Register Repayment
# ============================================================

def register_repayment():
    """Register a repayment against a loan."""
    clear_screen()
    print("\n=== Register Repayment ===\n")

    # --- List loans that are not settled ---
    loans = (
        supabase.table("loans")
        .select("id, lender_name, amount, currency, status, return_type, agreed_return_rate, agreed_return_amount")
        .neq("status", "settled")
        .order("date_borrowed")
        .execute()
    )

    if not loans.data:
        print("  No active loans found.")
        input("\nPress Enter to continue...")
        return

    print("  Loans with outstanding balances:")
    for i, loan in enumerate(loans.data, start=1):
        print(f"    {i}. {loan['lender_name']} — {loan['currency']} {loan['amount']:,.2f} ({loan['status']})")
    print()

    selection = get_input("  Select loan number: ")
    try:
        loan = loans.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    loan_id = loan["id"]
    loan_currency = loan["currency"]

    # --- Calculate total owed and paid ---
    balance = (
        supabase.table("v_loan_balances")
        .select("*")
        .eq("loan_id", loan_id)
        .execute()
    )
    if balance.data:
        b = balance.data[0]
        total_owed = float(b.get("total_owed", 0))
        total_paid = float(b.get("total_paid", 0))
        outstanding = float(b.get("outstanding", 0))
    else:
        print("\n  ✗ Could not load loan balance.")
        input("\nPress Enter to continue...")
        return

    print(f"\n  Loan:        {loan['lender_name']}")
    print(f"  Total owed:  {loan_currency} {total_owed:,.2f}")
    print(f"  Paid so far: {loan_currency} {total_paid:,.2f}")
    print(f"  Outstanding: {loan_currency} {outstanding:,.2f}")

    # --- Collect repayment details ---
    payment_date = get_date_input("\n  Payment date (YYYY-MM-DD): ")

    amount = get_nonneg_float("  Amount: ")

    if amount > outstanding:
        print(f"\n  ✗ Amount ({loan_currency} {amount:,.2f}) exceeds outstanding balance ({loan_currency} {outstanding:,.2f}).")
        print("    Enter a lower amount.")
        input("\nPress Enter to continue...")
        return

    currency = loan_currency
    print(f"\n  Currency: {currency} (matches loan)")
    exchange_rate = get_exchange_rate(transaction_date=payment_date)

    print("\n  Source options: project_settlement, personal_funds, other")
    source = get_optional_input("  Source (optional — press Enter to skip): ")
    if source and source.lower() not in ("project_settlement", "personal_funds", "other"):
        print("  Invalid source, skipping.")
        source = None
    elif source:
        source = source.lower()

    settlement_ref = get_optional_input("  Settlement ref (e.g. PRY001-Settlement-1, optional — press Enter to skip): ")
    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Before/after balance ---
    new_outstanding = outstanding - amount

    print("\n--- Repayment Summary ---")
    print(f"  Loan:          {loan['lender_name']}")
    print(f"  Payment date:  {payment_date}")
    print(f"  Amount:        {currency} {amount:,.2f}")
    if source:
        print(f"  Source:        {source}")
    if settlement_ref:
        print(f"  Settlement:    {settlement_ref}")
    if notes:
        print(f"  Notes:         {notes}")
    print()
    print(f"  Before:        {loan_currency} {outstanding:,.2f} outstanding")
    print(f"  After:         {loan_currency} {new_outstanding:,.2f} outstanding")
    if new_outstanding <= 0:
        print(f"  Status:        fully paid")

    # --- Confirm ---
    if not confirm("\nRegister this repayment?"):
        print("Cancelled.")
        input("\nPress Enter to continue...")
        return

    # --- Insert ---
    data = {
        "loan_id": loan_id,
        "payment_date": payment_date,
        "amount": amount,
        "currency": currency,
        "exchange_rate": exchange_rate,
    }
    if source:
        data["source"] = source
    if settlement_ref:
        data["settlement_ref"] = settlement_ref
    if notes:
        data["notes"] = notes

    try:
        response = supabase.table("loan_payments").insert(data).execute()
        print(f"\n✓ Repayment registered (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        input("\nPress Enter to continue...")
        return

    # --- Offer to settle loan if fully paid ---
    if new_outstanding <= 0:
        if confirm("\nLoan fully paid. Update status to 'settled'?"):
            try:
                supabase.table("loans").update({"status": "settled"}).eq("id", loan_id).execute()
                print("✓ Loan status updated to 'settled'.")
            except Exception as e:
                print(f"✗ Error updating status: {e}")
    elif total_paid + amount > 0 and loan["status"] == "active":
        # Update to partially_paid if this is the first payment
        if confirm("\nUpdate loan status to 'partially_paid'?"):
            try:
                supabase.table("loans").update({"status": "partially_paid"}).eq("id", loan_id).execute()
                print("✓ Loan status updated to 'partially_paid'.")
            except Exception as e:
                print(f"✗ Error updating status: {e}")

    input("\nPress Enter to continue...")
