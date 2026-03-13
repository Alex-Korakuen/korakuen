#!/usr/bin/env python3
"""
Entry point for the Korakuen Management System CLI.
Run: python main.py
"""

from lib.helpers import get_input, clear_screen
from modules import projects, entities, quotes, payments, loans, exchange_rates


def main():
    while True:
        clear_screen()
        print("\n=== Korakuen Management System ===\n")
        print("1. Projects")
        print("2. Entities & Contacts")
        print("3. Quotes")
        print("4. Payments")
        print("5. Loans")
        print("6. Exchange Rates")
        print("0. Exit")

        choice = get_input("\nSelect option: ")

        if choice == "1":
            projects.menu()
        elif choice == "2":
            entities.menu()
        elif choice == "3":
            quotes.menu()
        elif choice == "4":
            payments.menu()
        elif choice == "5":
            loans.menu()
        elif choice == "6":
            exchange_rates.menu()
        elif choice == "0":
            print("\nGoodbye.\n")
            return
        else:
            print("\nInvalid option.")
            input("\nPress Enter to continue...")


if __name__ == "__main__":
    main()
