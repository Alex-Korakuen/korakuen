#!/usr/bin/env python3
"""
Module: loans.py
Purpose: All loan operations — add loan, add repayment schedule, register repayment
Tables: loans, loan_schedule, payments (related_to='loan_schedule')
"""

from lib.db import supabase
from lib.helpers import (
    get_input, get_optional_input, get_date_input, get_optional_date_input,
    confirm, list_choices, clear_screen, cancel_and_wait,
    get_enum_input, get_optional_enum_input, get_currency, get_exchange_rate,
    select_project, select_partner_company, get_nonneg_float, execute_insert,
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
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


# ============================================================
# Add Loan
# ============================================================

def add_loan():
    """Register a new personal loan."""
    clear_screen()
    print("\n=== Add Loan ===\n")

    # --- Partner company ---
    partner = select_partner_company(show_ruc=True)
    if not partner:
        return

    # --- Lender info ---
    lender_name = get_input("\n  Lender name: ")
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
    print(f"  Partner:       {partner['name']}")
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
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "partner_company_id": partner["id"],
        "lender_name": lender_name,
        "amount": amount,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "date_borrowed": date_borrowed,
        "purpose": purpose,
        "return_type": return_type,
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

    execute_insert("loans", data, "Loan registered")


# ============================================================
# Add Repayment Schedule
# ============================================================

def add_schedule():
    """Add repayment schedule entries to an existing loan."""
    clear_screen()
    print("\n=== Add Repayment Schedule ===\n")

    # --- List active loans (status derived in view) ---
    loans = (
        supabase.table("v_loan_balances")
        .select("loan_id, lender_name, principal, currency, status, date_borrowed, total_owed")
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
        print(f"    {i}. {loan['lender_name']} — {loan['currency']} {loan['principal']:,.2f} ({loan['status']})")
    print()

    selection = get_input("  Select loan number: ")
    try:
        loan = loans.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    loan_date = loan.get("date_borrowed", "")
    loan_id = loan["loan_id"]
    loan_currency = loan["currency"]
    total_owed = float(loan["total_owed"])

    existing_schedule = (
        supabase.table("loan_schedule")
        .select("scheduled_amount")
        .eq("loan_id", loan_id)
        .execute()
    )
    already_scheduled = sum(float(s["scheduled_amount"]) for s in (existing_schedule.data or []))

    print(f"\n  Adding schedule entries for: {loan['lender_name']} — {loan_currency} {loan['principal']:,.2f}")
    print(f"  Total owed:      {loan_currency} {total_owed:,.2f}")
    if already_scheduled > 0:
        print(f"  Already scheduled: {loan_currency} {already_scheduled:,.2f}")
    remaining = total_owed - already_scheduled
    print(f"  Available to schedule: {loan_currency} {remaining:,.2f}")
    if loan_date:
        print(f"  (Loan date: {loan_date})")
    print("  (Enter entries one at a time. Type 'done' when finished.)\n")

    entries = []
    entry_num = 1
    new_scheduled = 0.0

    while True:
        print(f"  Entry {entry_num}:")
        scheduled_date = get_date_input("    Scheduled date (YYYY-MM-DD): ")

        if loan_date and scheduled_date < loan_date:
            print(f"    ✗ Scheduled date ({scheduled_date}) is before loan date ({loan_date}).")
            continue

        scheduled_amount = get_nonneg_float("    Scheduled amount: ")

        if already_scheduled + new_scheduled + scheduled_amount > total_owed:
            available = total_owed - already_scheduled - new_scheduled
            print(f"    ✗ Would exceed total owed ({loan_currency} {total_owed:,.2f}).")
            print(f"      Available to schedule: {loan_currency} {available:,.2f}")
            continue

        exchange_rate = get_exchange_rate(transaction_date=scheduled_date)

        entries.append({
            "loan_id": loan_id,
            "scheduled_date": scheduled_date,
            "scheduled_amount": scheduled_amount,
            "exchange_rate": exchange_rate,
        })
        new_scheduled += scheduled_amount
        entry_num += 1

        if not confirm("\n  Add another entry?"):
            break

    if not entries:
        print("\n  No entries to add.")
        input("\nPress Enter to continue...")
        return

    # --- Summary ---
    schedule_total = sum(e["scheduled_amount"] for e in entries)
    cumulative = already_scheduled + schedule_total
    print(f"\n--- Schedule Summary ---")
    print(f"  Loan:    {loan['lender_name']} — {loan_currency} {loan['principal']:,.2f}")
    print(f"  Entries: {len(entries)}")
    for i, entry in enumerate(entries, start=1):
        print(f"    {i}. {entry['scheduled_date']} — {loan_currency} {entry['scheduled_amount']:,.2f}")
    print(f"  New total:        {loan_currency} {schedule_total:,.2f}")
    if already_scheduled > 0:
        print(f"  Previously sched: {loan_currency} {already_scheduled:,.2f}")
    print(f"  Cumulative:       {loan_currency} {cumulative:,.2f} / {total_owed:,.2f}")

    # --- Confirm ---
    if not confirm(f"\nAdd {len(entries)} schedule entries?"):
        cancel_and_wait()
        return

    # --- Batch insert ---
    execute_insert("loan_schedule", entries, f"{len(entries)} schedule entries added")


# ============================================================
# Register Repayment
# ============================================================

def register_repayment():
    """Register a repayment against a loan schedule entry.

    Inserts into the universal payments table with related_to='loan_schedule'.
    Status is derived automatically in v_loan_balances.
    """
    clear_screen()
    print("\n=== Register Repayment ===\n")

    # --- List loans that are not settled (status derived in view) ---
    loans = (
        supabase.table("v_loan_balances")
        .select("loan_id, lender_name, principal, currency, status, total_owed, total_paid, outstanding, partner_company_id")
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
        print(f"    {i}. {loan['lender_name']} — {loan['currency']} {loan['principal']:,.2f} ({loan['status']})")
    print()

    selection = get_input("  Select loan number: ")
    try:
        loan = loans.data[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    loan_id = loan["loan_id"]
    loan_currency = loan["currency"]
    total_owed = float(loan.get("total_owed", 0))
    total_paid = float(loan.get("total_paid", 0))
    outstanding = float(loan.get("outstanding", 0))
    partner_company_id = loan["partner_company_id"]

    print(f"\n  Loan:        {loan['lender_name']}")
    print(f"  Total owed:  {loan_currency} {total_owed:,.2f}")
    print(f"  Paid so far: {loan_currency} {total_paid:,.2f}")
    print(f"  Outstanding: {loan_currency} {outstanding:,.2f}")

    # --- List schedule entries with outstanding balances ---
    schedule = (
        supabase.table("loan_schedule")
        .select("id, scheduled_date, scheduled_amount, exchange_rate")
        .eq("loan_id", loan_id)
        .order("scheduled_date")
        .execute()
    )

    if not schedule.data:
        print("\n  ✗ No schedule entries found. Add a schedule entry first.")
        input("\nPress Enter to continue...")
        return

    # Calculate outstanding per entry from payments
    entry_ids = [s["id"] for s in schedule.data]
    payments_result = (
        supabase.table("payments")
        .select("related_id, amount")
        .eq("related_to", "loan_schedule")
        .in_("related_id", entry_ids)
        .execute()
    )
    paid_map = {}
    for p in (payments_result.data or []):
        paid_map[p["related_id"]] = paid_map.get(p["related_id"], 0) + float(p["amount"])

    # Filter to entries with remaining balance
    open_entries = []
    for s in schedule.data:
        entry_paid = paid_map.get(s["id"], 0)
        entry_outstanding = float(s["scheduled_amount"]) - entry_paid
        if entry_outstanding > 0:
            open_entries.append({**s, "entry_paid": entry_paid, "entry_outstanding": entry_outstanding})

    if not open_entries:
        print("\n  ✗ All schedule entries are fully paid.")
        input("\nPress Enter to continue...")
        return

    print("\n  Unpaid schedule entries:")
    for i, entry in enumerate(open_entries, start=1):
        print(f"    {i}. {entry['scheduled_date']} — {loan_currency} {entry['scheduled_amount']:,.2f} (outstanding: {entry['entry_outstanding']:,.2f})")
    print()

    selection = get_input("  Select schedule entry number: ")
    try:
        entry = open_entries[int(selection) - 1]
    except (ValueError, IndexError):
        print("\n  ✗ Invalid selection.")
        input("\nPress Enter to continue...")
        return

    entry_outstanding = entry["entry_outstanding"]

    # --- Collect repayment details ---
    payment_date = get_date_input("\n  Payment date (YYYY-MM-DD): ")

    amount = get_nonneg_float("  Amount: ")

    if amount > entry_outstanding:
        print(f"\n  ✗ Amount ({loan_currency} {amount:,.2f}) exceeds entry outstanding ({loan_currency} {entry_outstanding:,.2f}).")
        input("\nPress Enter to continue...")
        return

    currency = loan_currency
    print(f"\n  Currency: {currency} (matches loan)")
    exchange_rate = get_exchange_rate(transaction_date=payment_date)

    notes = get_optional_input("  Notes (optional — press Enter to skip): ")

    # --- Summary ---
    new_entry_outstanding = entry_outstanding - amount

    print("\n--- Repayment Summary ---")
    print(f"  Loan:          {loan['lender_name']}")
    print(f"  Schedule:      {entry['scheduled_date']} — {loan_currency} {entry['scheduled_amount']:,.2f}")
    print(f"  Payment date:  {payment_date}")
    print(f"  Amount:        {currency} {amount:,.2f}")
    if notes:
        print(f"  Notes:         {notes}")
    print()
    print(f"  Entry before:  {loan_currency} {entry_outstanding:,.2f} outstanding")
    print(f"  Entry after:   {loan_currency} {new_entry_outstanding:,.2f} outstanding")

    # --- Confirm ---
    if not confirm("\nRegister this repayment?"):
        cancel_and_wait()
        return

    # --- Insert into payments table ---
    data = {
        "related_to": "loan_schedule",
        "related_id": entry["id"],
        "direction": "outbound",
        "payment_type": "regular",
        "payment_date": payment_date,
        "amount": amount,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "partner_company_id": partner_company_id,
        "notes": notes if notes else None,
    }

    execute_insert("payments", data, "Repayment registered")
