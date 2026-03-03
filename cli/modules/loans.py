#!/usr/bin/env python3
"""
Module: loans.py
Purpose: All loan operations — add loan, add repayment schedule, register repayment, view balances
Tables: loans, loan_schedule, loan_payments
"""

from lib.db import supabase
from lib.helpers import get_input, get_optional_input, confirm, list_choices, clear_screen


def menu():
    """Submenu for loan operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Loans ===\n")
        print("1. Add loan")
        print("2. Add repayment schedule")
        print("3. Register repayment")
        print("4. View loan balances")
        print("5. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_loan()
        elif choice == "2":
            add_schedule()
        elif choice == "3":
            register_repayment()
        elif choice == "4":
            view_balances()
        elif choice == "5":
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
    amount_input = get_input("  Amount (principal borrowed): ")
    try:
        amount = float(amount_input)
    except ValueError:
        print("\n  ✗ Invalid number.")
        input("\nPress Enter to continue...")
        return

    # --- Currency ---
    print("\n  Currencies: USD, PEN")
    currency = get_input("  Currency: ").upper()
    while currency not in ("USD", "PEN"):
        print("  Must be USD or PEN.")
        currency = get_input("  Currency: ").upper()

    # --- Date borrowed ---
    date_borrowed = get_input("\n  Date borrowed (YYYY-MM-DD): ")

    # --- Project (optional) ---
    project = None
    projects = (
        supabase.table("projects")
        .select("id, project_code, name")
        .eq("is_active", True)
        .order("project_code")
        .execute()
    )
    if projects.data:
        list_choices("Active projects", projects.data, display=["project_code", "name"])
        proj_num = get_optional_input("  Select project number (optional — press Enter to skip): ")
        if proj_num:
            try:
                project = projects.data[int(proj_num) - 1]
            except (ValueError, IndexError):
                print("  Invalid selection, skipping project.")

    # --- Purpose ---
    purpose = get_input("\n  Purpose: ")

    # --- Return type ---
    print("\n  Return types: percentage, fixed")
    return_type = get_input("  Return type: ").lower()
    while return_type not in ("percentage", "fixed"):
        print("  Must be 'percentage' or 'fixed'.")
        return_type = get_input("  Return type: ").lower()

    agreed_return_rate = None
    agreed_return_amount = None

    if return_type == "percentage":
        rate_input = get_input("  Agreed return rate (%): ")
        try:
            agreed_return_rate = float(rate_input)
        except ValueError:
            print("\n  ✗ Invalid number.")
            input("\nPress Enter to continue...")
            return
        total_owed = amount + (amount * agreed_return_rate / 100)
    else:
        amt_input = get_input("  Agreed return amount (fixed): ")
        try:
            agreed_return_amount = float(amt_input)
        except ValueError:
            print("\n  ✗ Invalid number.")
            input("\nPress Enter to continue...")
            return
        total_owed = amount + agreed_return_amount

    # --- Due date (optional) ---
    due_date = get_optional_input("\n  Due date (YYYY-MM-DD, optional — press Enter to skip): ")

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
        .select("id, lender_name, amount, currency, status")
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

    print(f"\n  Adding schedule entries for: {loan['lender_name']} — {loan['currency']} {loan['amount']:,.2f}")
    print("  (Enter entries one at a time. Type 'done' when finished.)\n")

    entries = []
    entry_num = 1

    while True:
        print(f"  Entry {entry_num}:")
        scheduled_date = get_input("    Scheduled date (YYYY-MM-DD): ")
        amount_input = get_input("    Scheduled amount: ")
        try:
            scheduled_amount = float(amount_input)
        except ValueError:
            print("    Invalid number, skipping entry.")
            continue

        entries.append({
            "loan_id": loan["id"],
            "scheduled_date": scheduled_date,
            "scheduled_amount": scheduled_amount,
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
    # Try v_loan_balances first, fall back to manual calculation
    outstanding = 0
    total_owed = 0
    total_paid = 0

    try:
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
            # Fallback: calculate manually
            total_owed = _calculate_total_owed(loan)
            payments_resp = (
                supabase.table("loan_payments")
                .select("amount")
                .eq("loan_id", loan_id)
                .execute()
            )
            total_paid = sum(float(p["amount"]) for p in payments_resp.data) if payments_resp.data else 0
            outstanding = total_owed - total_paid
    except Exception:
        # Fallback if view doesn't exist yet
        total_owed = _calculate_total_owed(loan)
        payments_resp = (
            supabase.table("loan_payments")
            .select("amount")
            .eq("loan_id", loan_id)
            .execute()
        )
        total_paid = sum(float(p["amount"]) for p in payments_resp.data) if payments_resp.data else 0
        outstanding = total_owed - total_paid

    print(f"\n  Loan:        {loan['lender_name']}")
    print(f"  Total owed:  {loan_currency} {total_owed:,.2f}")
    print(f"  Paid so far: {loan_currency} {total_paid:,.2f}")
    print(f"  Outstanding: {loan_currency} {outstanding:,.2f}")

    # --- Collect repayment details ---
    payment_date = get_input("\n  Payment date (YYYY-MM-DD): ")

    amount_input = get_input("  Amount: ")
    try:
        amount = float(amount_input)
    except ValueError:
        print("\n  ✗ Invalid number.")
        input("\nPress Enter to continue...")
        return

    print(f"\n  Currencies: USD, PEN (loan currency: {loan_currency})")
    currency = get_input(f"  Currency (default: {loan_currency}): ").upper() or loan_currency
    while currency not in ("USD", "PEN"):
        print("  Must be USD or PEN.")
        currency = get_input("  Currency: ").upper()

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


def _calculate_total_owed(loan):
    """Calculate total owed for a loan (display-only UX calculation)."""
    principal = float(loan["amount"])
    if loan["return_type"] == "percentage":
        rate = float(loan.get("agreed_return_rate") or 0)
        return principal + (principal * rate / 100)
    else:
        fixed = float(loan.get("agreed_return_amount") or 0)
        return principal + fixed


# ============================================================
# View Loan Balances
# ============================================================

def view_balances():
    """Display all loan balances from v_loan_balances."""
    clear_screen()
    print("\n=== Loan Balances ===\n")

    try:
        response = (
            supabase.table("v_loan_balances")
            .select("*")
            .execute()
        )
    except Exception:
        # Fallback: query loans directly if view doesn't exist
        _view_balances_fallback()
        return

    if not response.data:
        print("  No loans found.")
        input("\nPress Enter to continue...")
        return

    # --- Column widths ---
    lender_w = max(len("Lender"), max(len(str(r.get("lender_name", ""))) for r in response.data))
    lender_w = min(lender_w, 20)  # cap width

    # --- Header ---
    print(f"  {'Lender':<{lender_w}}  {'Principal':>12}  {'Total Owed':>12}  {'Paid':>12}  {'Outstanding':>12}  {'Status':<15}  {'Due Date':<12}")
    print(f"  {'-' * lender_w}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 15}  {'-' * 12}")

    # --- Rows ---
    total_principal = 0
    total_owed_all = 0
    total_paid_all = 0
    total_outstanding_all = 0

    for r in response.data:
        lender = str(r.get("lender_name", ""))[:lender_w]
        currency = r.get("currency", "PEN")
        principal = float(r.get("principal", 0))
        total_owed = float(r.get("total_owed", 0))
        total_paid = float(r.get("total_paid", 0))
        outstanding_val = float(r.get("outstanding", 0))
        status = r.get("status", "")
        due_date = r.get("due_date") or ""

        total_principal += principal
        total_owed_all += total_owed
        total_paid_all += total_paid
        total_outstanding_all += outstanding_val

        print(
            f"  {lender:<{lender_w}}  "
            f"{currency} {principal:>9,.2f}  "
            f"{currency} {total_owed:>9,.2f}  "
            f"{currency} {total_paid:>9,.2f}  "
            f"{currency} {outstanding_val:>9,.2f}  "
            f"{status:<15}  "
            f"{due_date:<12}"
        )

    # --- Totals ---
    print(f"  {'-' * lender_w}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 15}  {'-' * 12}")
    print(
        f"  {'TOTAL':<{lender_w}}  "
        f"    {total_principal:>9,.2f}  "
        f"    {total_owed_all:>9,.2f}  "
        f"    {total_paid_all:>9,.2f}  "
        f"    {total_outstanding_all:>9,.2f}"
    )
    print(f"\n  Note: Totals mix currencies if loans have different currencies.")

    input("\nPress Enter to continue...")


def _view_balances_fallback():
    """Display loan balances without v_loan_balances view (direct query)."""
    loans = (
        supabase.table("loans")
        .select("id, lender_name, amount, currency, status, due_date, return_type, agreed_return_rate, agreed_return_amount")
        .order("date_borrowed")
        .execute()
    )

    if not loans.data:
        print("  No loans found.")
        input("\nPress Enter to continue...")
        return

    # Get all loan payments in one query
    all_payments = supabase.table("loan_payments").select("loan_id, amount").execute()
    payments_by_loan = {}
    for p in (all_payments.data or []):
        lid = p["loan_id"]
        payments_by_loan[lid] = payments_by_loan.get(lid, 0) + float(p["amount"])

    # --- Column widths ---
    lender_w = max(len("Lender"), max(len(str(r.get("lender_name", ""))) for r in loans.data))
    lender_w = min(lender_w, 20)

    # --- Header ---
    print(f"  {'Lender':<{lender_w}}  {'Principal':>12}  {'Total Owed':>12}  {'Paid':>12}  {'Outstanding':>12}  {'Status':<15}  {'Due Date':<12}")
    print(f"  {'-' * lender_w}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 15}  {'-' * 12}")

    total_principal = 0
    total_owed_all = 0
    total_paid_all = 0
    total_outstanding_all = 0

    for loan in loans.data:
        lender = str(loan.get("lender_name", ""))[:lender_w]
        currency = loan.get("currency", "PEN")
        principal = float(loan.get("amount", 0))
        total_owed = _calculate_total_owed(loan)
        total_paid = payments_by_loan.get(loan["id"], 0)
        outstanding_val = total_owed - total_paid
        status = loan.get("status", "")
        due_date = loan.get("due_date") or ""

        total_principal += principal
        total_owed_all += total_owed
        total_paid_all += total_paid
        total_outstanding_all += outstanding_val

        print(
            f"  {lender:<{lender_w}}  "
            f"{currency} {principal:>9,.2f}  "
            f"{currency} {total_owed:>9,.2f}  "
            f"{currency} {total_paid:>9,.2f}  "
            f"{currency} {outstanding_val:>9,.2f}  "
            f"{status:<15}  "
            f"{due_date:<12}"
        )

    print(f"  {'-' * lender_w}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 12}  {'-' * 15}  {'-' * 12}")
    print(
        f"  {'TOTAL':<{lender_w}}  "
        f"    {total_principal:>9,.2f}  "
        f"    {total_owed_all:>9,.2f}  "
        f"    {total_paid_all:>9,.2f}  "
        f"    {total_outstanding_all:>9,.2f}"
    )
    print(f"\n  Note: Totals mix currencies if loans have different currencies.")

    input("\nPress Enter to continue...")
