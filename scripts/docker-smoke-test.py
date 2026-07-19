#!/usr/bin/env python3
"""HTTP smoke test for the local Docker API stack."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


API_BASE = os.environ.get("API_BASE", "http://api-smoke:8080")
ADMIN_UID = os.environ.get("ADMIN_UID", "smoke-admin")


def get(path: str, headers: dict[str, str] | None = None) -> tuple[int, object]:
    req = urllib.request.Request(API_BASE + path, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = body
        return exc.code, payload


def main() -> int:
    status, body = get("/health")
    assert status == 200, f"/health failed: {status} {body}"
    assert body.get("pilot_city") == "dedham-ma", f"unexpected health body: {body}"
    print("OK /health")

    status, body = get("/v1/metrics")
    assert status == 200, f"/v1/metrics failed: {status} {body}"
    assert isinstance(body, list) and len(body) > 0, f"metrics empty: {body}"
    print("OK /v1/metrics")

    status, body = get("/v1/restaurants")
    assert status == 200, f"/v1/restaurants failed: {status} {body}"
    assert isinstance(body, list), f"restaurants not a list: {body}"
    print("OK /v1/restaurants")

    status, body = get("/v1/me/profile", {"Authorization": f"Bearer dev:{ADMIN_UID}"})
    assert status == 200, f"/v1/me/profile failed: {status} {body}"
    assert body.get("firebase_uid") == ADMIN_UID, f"unexpected uid: {body}"
    assert body.get("role") == "admin", f"expected admin role: {body}"
    print("OK /v1/me/profile")

    print("smoke tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
