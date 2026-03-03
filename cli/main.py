#!/usr/bin/env python3
"""
Entry point for the Korakuen Management System CLI.
Run: python main.py
"""

from lib.helpers import get_input, clear_screen
from modules import projects, entities, costs, quotes, valuations, ar_invoices, payments, loans


def main():
    while True:
        clear_screen()
        print("\n=== Korakuen Management System ===\n")
        print("1. Projects")
        print("2. Entities & Contacts")
        print("3. Costs")
        print("4. Quotes")
        print("5. Valuations")
        print("6. AR Invoices")
        print("7. Payments")
        print("8. Loans")
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
            valuations.menu()
        elif choice == "6":
            ar_invoices.menu()
        elif choice == "7":
            payments.menu()
        elif choice == "8":
            loans.menu()
        elif choice == "0":
            print("\nGoodbye.\n")
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()
