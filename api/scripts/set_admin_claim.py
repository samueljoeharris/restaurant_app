#!/usr/bin/env python3
"""Grant or revoke Firebase custom claim role=admin for a user."""

from __future__ import annotations

import argparse
import os
import sys

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials


def main() -> int:
    parser = argparse.ArgumentParser(description="Set Firebase admin custom claim")
    parser.add_argument("--email", help="User email")
    parser.add_argument("--uid", help="Firebase UID")
    parser.add_argument(
        "--revoke",
        action="store_true",
        help="Remove admin role instead of granting it",
    )
    parser.add_argument(
        "--project",
        default=os.environ.get("FIREBASE_PROJECT_ID", "ttf-restaurant-dev"),
    )
    parser.add_argument(
        "--service-account",
        default=os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-sa.json"),
    )
    args = parser.parse_args()

    if not args.email and not args.uid:
        parser.error("Provide --email or --uid")

    if not os.path.isfile(args.service_account):
        print(
            f"Service account not found: {args.service_account}\n"
            "Download from Firebase Console → Project settings → Service accounts.",
            file=sys.stderr,
        )
        return 1

    cred = credentials.Certificate(args.service_account)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred, {"projectId": args.project})

    if args.uid:
        user = firebase_auth.get_user(args.uid)
    else:
        user = firebase_auth.get_user_by_email(args.email)

    existing = user.custom_claims or {}
    if args.revoke:
        claims = {k: v for k, v in existing.items() if k != "role"}
    else:
        claims = {**existing, "role": "admin"}

    firebase_auth.set_custom_user_claims(user.uid, claims or None)

    action = "Revoked admin from" if args.revoke else "Granted admin to"
    print(f"{action} {user.email or user.uid} (uid={user.uid})")
    print("User must sign out and back in (or refresh ID token) for claims to apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
