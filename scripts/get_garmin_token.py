#!/usr/bin/env python3
"""Helper script to get Garmin authentication token."""

import garth
from getpass import getpass


def main():
    """Get Garmin authentication token."""
    print("=" * 60)
    print("Garmin Authentication Token Generator")
    print("=" * 60)
    print()

    email = input("Enter your Garmin email address: ")
    password = getpass("Enter your Garmin password: ")

    print("\nAuthenticating with Garmin...")

    try:
        # Try to login
        garth.login(email, password)
        print("✓ Successfully authenticated with Garmin")

        # Get token
        token = garth.client.dumps()

        print("\n" + "=" * 60)
        print("Your Garmin Secret String:")
        print("=" * 60)
        print(token)
        print("=" * 60)
        print()
        print("Add this to your GitHub Secrets as GARMIN_SECRET_STRING")
        print()

    except Exception as e:
        print(f"\n✗ Authentication failed: {e}")
        print()
        print("Possible reasons:")
        print("1. Incorrect email or password")
        print("2. Two-factor authentication enabled (not supported yet)")
        print("3. Network connection issues")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
