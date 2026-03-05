#!/usr/bin/env python3
"""
Module: exchange_rates.py
Purpose: Manage SUNAT exchange rates — add daily rates, list recent rates
Tables: exchange_rates
"""

from lib.db import supabase
from lib.helpers import (
    get_input, get_date_input, get_optional_input,
    confirm, clear_screen, cancel_and_wait, get_nonneg_float,
    EXCHANGE_RATE_MIN, EXCHANGE_RATE_MAX,
)


def menu():
    """Submenu for exchange rate operations. Called by main.py."""
    while True:
        clear_screen()
        print("\n=== Exchange Rates ===\n")
        print("1. Add rate")
        print("2. List recent rates")
        print("3. Back")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            add_rate()
        elif choice == "2":
            list_rates()
        elif choice == "3":
            return


# ============================================================
# Add Rate
# ============================================================

def add_rate():
    """Add a daily SUNAT exchange rate."""
    clear_screen()
    print("\n=== Add Exchange Rate ===\n")

    # --- Date ---
    rate_date = get_date_input("  Rate date (YYYY-MM-DD): ")

    # --- Buy rate ---
    buy_rate = _get_rate("  Buy rate (SUNAT Compra): ")

    # --- Sell rate ---
    sell_rate = _get_rate("  Sell rate (SUNAT Venta): ")

    # --- Mid rate (auto-computed) ---
    mid_rate = round((buy_rate + sell_rate) / 2, 4)

    # --- Source (optional) ---
    source = get_optional_input("  Source (default: SUNAT, press Enter to skip): ")
    if not source:
        source = "SUNAT"

    # --- Summary ---
    print("\n--- Rate Summary ---")
    print(f"  Date:      {rate_date}")
    print(f"  Buy rate:  {buy_rate:.4f}")
    print(f"  Sell rate: {sell_rate:.4f}")
    print(f"  Mid rate:  {mid_rate:.4f}")
    print(f"  Source:    {source}")

    # --- Confirm ---
    if not confirm("\nSave this rate?"):
        cancel_and_wait()
        return

    # --- Insert ---
    data = {
        "rate_date": rate_date,
        "buy_rate": buy_rate,
        "sell_rate": sell_rate,
        "mid_rate": mid_rate,
        "source": source,
    }

    try:
        response = supabase.table("exchange_rates").insert(data).execute()
        print(f"\n✓ Rate saved for {rate_date} (ID: {response.data[0]['id'][:8]}...)")
    except Exception as e:
        error_msg = str(e)
        # Handle unique constraint violation on rate_date
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower() or "23505" in error_msg:
            print(f"\n  A rate already exists for {rate_date}.")
            if confirm("  Update the existing rate?"):
                try:
                    supabase.table("exchange_rates").update({
                        "buy_rate": buy_rate,
                        "sell_rate": sell_rate,
                        "mid_rate": mid_rate,
                        "source": source,
                    }).eq("rate_date", rate_date).execute()
                    print(f"\n✓ Rate updated for {rate_date}.")
                except Exception as e2:
                    print(f"\n✗ Error updating: {e2}")
            else:
                print("Cancelled.")
        else:
            print(f"\n✗ Error: {e}")

    input("\nPress Enter to continue...")


# ============================================================
# List Recent Rates
# ============================================================

def list_rates():
    """Display the 10 most recent exchange rates."""
    clear_screen()
    print("\n=== Recent Exchange Rates ===\n")

    response = (
        supabase.table("exchange_rates")
        .select("rate_date, buy_rate, sell_rate, mid_rate, source")
        .order("rate_date", desc=True)
        .limit(10)
        .execute()
    )

    if not response.data:
        print("  No exchange rates found.")
        input("\nPress Enter to continue...")
        return

    # Header
    print(f"  {'Date':<12} {'Buy':>8} {'Sell':>8} {'Mid':>8} {'Source':<10}")
    print(f"  {'─' * 12} {'─' * 8} {'─' * 8} {'─' * 8} {'─' * 10}")

    for row in response.data:
        print(
            f"  {row['rate_date']:<12} "
            f"{float(row['buy_rate']):>8.4f} "
            f"{float(row['sell_rate']):>8.4f} "
            f"{float(row['mid_rate']):>8.4f} "
            f"{row.get('source', ''):<10}"
        )

    print(f"\n  Showing {len(response.data)} most recent rate(s).")
    input("\nPress Enter to continue...")


# ============================================================
# Internal helpers
# ============================================================

def _get_rate(prompt):
    """Prompt for an exchange rate value with range validation."""
    while True:
        value = input(prompt).strip()
        if not value:
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
