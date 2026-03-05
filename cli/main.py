#!/usr/bin/env python3
"""
Entry point for the Korakuen Management System CLI.
Run: python main.py
"""

from lib.helpers import get_input, clear_screen
from modules import projects, entities, costs, quotes, ar_invoices, payments, loans, exchange_rates


def main():
    while True:
        clear_screen()
        print("\n=== Korakuen Management System ===\n")
        print("1. Projects")
        print("2. Entities & Contacts")
        print("3. Costs")
        print("4. Quotes")
        print("5. AR Invoices")
        print("6. Payments")
        print("7. Loans")
        print("8. Exchange Rates")
        print("0. Exit")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            projects.menu()
        elif choice == "2":
            entities.menu()
        elif choice == "3":
            costs.menu()
        elif choice == "4":
            quotes.menu()
        elif choice == "5":
            ar_invoices.menu()
        elif choice == "6":
            payments.menu()
        elif choice == "7":
            loans.menu()
        elif choice == "8":
            exchange_rates.menu()
        elif choice == "0":
            print("\nGoodbye.\n")
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()
