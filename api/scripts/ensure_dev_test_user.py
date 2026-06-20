#!/usr/bin/env python3
"""Create or update the shared dev browser-test Firebase Auth user (idempotent)."""

from __future__ import annotations

import argparse
import os
import sys

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from firebase_admin import exceptions as firebase_exceptions


def _resolve_service_account(path: str) -> str:
    if os.path.isabs(path) and os.path.isfile(path):
        return path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    candidate = os.path.join(repo_root, path)
    if os.path.isfile(candidate):
        return candidate
    return path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ensure dev browser-test Firebase user exists with known password",
    )
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument(
        "--project",
        default=os.environ.get("FIREBASE_PROJECT_ID", "ttf-restaurant-dev"),
    )
    parser.add_argument(
        "--service-account",
        default=os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", ".secrets/firebase-sa.json"),
    )
    args = parser.parse_args()

    if not os.path.isfile(args.service_account):
        resolved = _resolve_service_account(args.service_account)
        if os.path.isfile(resolved):
            args.service_account = resolved

    if not os.path.isfile(args.service_account):
        print(
            f"Service account not found: {args.service_account}\n"
            "Run ./scripts/sync-secrets.sh first.",
            file=sys.stderr,
        )
        return 1

    cred = credentials.Certificate(args.service_account)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred, {"projectId": args.project})

    try:
        user = firebase_auth.get_user_by_email(args.email)
        firebase_auth.update_user(user.uid, password=args.password)
        print(f"Updated password for existing user {args.email} (uid={user.uid})")
    except firebase_exceptions.NotFoundError:
        user = firebase_auth.create_user(email=args.email, password=args.password)
        print(f"Created user {args.email} (uid={user.uid})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
