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
        detail = exc.read().decode()
        raise RuntimeError(f"{path} failed ({exc.code}): {detail}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="Get Firebase emulator ID token")
    parser.add_argument("--email", default="pilot@ttf.test")
    parser.add_argument("--password", default="pilotpass123")
    args = parser.parse_args()

    body = {
        "email": args.email,
        "password": args.password,
        "returnSecureToken": True,
    }

    try:
        data = _post("accounts:signUp", body)
    except RuntimeError:
        data = _post("accounts:signInWithPassword", body)

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


if __name__ == "__main__":
    raise SystemExit(main())
