#!/usr/bin/env python3
"""Sign up / sign in against Firebase Auth Emulator and print an ID token."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

FAKE_API_KEY = "fake-api-key"


def _emulator_base() -> str:
    host = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
    if not host.startswith("http"):
        host = f"http://{host}"
    return host.rstrip("/")


def _parse_error(exc: urllib.error.HTTPError) -> tuple[str, str]:
    try:
        payload = json.loads(exc.read().decode())
        message = payload.get("error", {}).get("message", "")
        return message, json.dumps(payload, indent=2)
    except json.JSONDecodeError:
        return "", exc.read().decode()


def _post(path: str, body: dict) -> dict:
    url = f"{_emulator_base()}/identitytoolkit.googleapis.com/v1/{path}?key={FAKE_API_KEY}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        message, detail = _parse_error(exc)
        raise RuntimeError(message or detail, path, exc.code, detail) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="Get Firebase emulator ID token")
    parser.add_argument("--email", default="pilot@ttf.test")
    parser.add_argument("--password", default="pilotpass123")
    parser.add_argument(
        "--sign-in-only",
        action="store_true",
        help="Skip sign-up; only sign in (use when the emulator user already exists)",
    )
    args = parser.parse_args()

    body = {
        "email": args.email,
        "password": args.password,
        "returnSecureToken": True,
    }

    data: dict | None = None
    if not args.sign_in_only:
        try:
            data = _post("accounts:signUp", body)
        except RuntimeError as exc:
            if exc.args and exc.args[0] != "EMAIL_EXISTS":
                _print_auth_help(args.email, exc)
                return 1

    if data is None:
        try:
            data = _post("accounts:signInWithPassword", body)
        except RuntimeError as exc:
            _print_auth_help(args.email, exc)
            return 1

    token = data.get("idToken")
    local_id = data.get("localId")
    if not token:
        print("No idToken in response", file=sys.stderr)
        return 1

    print(f"localId={local_id}")
    print(f"idToken={token}")
    print()
    print("curl example:")
    print(f'  curl -H "Authorization: Bearer {token}" http://localhost:8080/v1/me')
    return 0


def _print_auth_help(email: str, exc: RuntimeError) -> None:
    code = exc.args[0] if exc.args else "UNKNOWN"
    detail = exc.args[3] if len(exc.args) > 3 else str(exc)
    print(f"Auth failed for {email}: {code}", file=sys.stderr)
    if code == "INVALID_PASSWORD":
        print(
            "This email already exists in the Auth emulator with a different password.",
            file=sys.stderr,
        )
        print(
            "Use the password from when the user was first created, pass a new --email,",
            file=sys.stderr,
        )
        print(
            "or restart the emulator: docker compose restart firebase-emulator",
            file=sys.stderr,
        )
        print("Default password in docs/scripts is: pilotpass123", file=sys.stderr)
    elif code == "EMAIL_NOT_FOUND":
        print("No user with this email — omit --sign-in-only to create one.", file=sys.stderr)
    else:
        print(detail, file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
