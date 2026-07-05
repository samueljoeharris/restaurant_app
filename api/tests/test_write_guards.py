"""Regression: user-facing write routes use standard security guards."""

from __future__ import annotations

import unittest
from collections.abc import Callable, Iterable

from fastapi.routing import APIRoute

from ttf_api.auth import get_current_user, require_account_deletion, require_admin
from ttf_api.main import app
from ttf_api.security import require_write_access

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Routes with intentional alternate guard stacks (documented in issue #38).
ALLOWLIST: dict[tuple[str, str], Callable[..., object]] = {
    ("POST", "/v1/coverage/ensure"): get_current_user,
    ("POST", "/v1/me/delete-account"): require_account_deletion,
    # Read-only query with a body (restaurant id list) — no mutation, so no
    # write rate limit / App Check needed, same shape as coverage/ensure (#88).
    ("POST", "/v1/me/family-matches"): get_current_user,
}

EXCLUDED_PREFIXES = ("/v1/admin", "/v1/internal")
EXCLUDED_PATHS = {
    ("POST", "/v1/auth/handoff"),
}


def _iter_dependants(dependant) -> Iterable:
    for sub in dependant.dependencies:
        yield sub
        yield from _iter_dependants(sub)


def _depends_on(route: APIRoute, guard: Callable[..., object]) -> bool:
    for dep in _iter_dependants(route.dependant):
        if dep.call is guard:
            return True
    return False


class WriteGuardTests(unittest.TestCase):
    def test_user_write_routes_use_standard_guards(self) -> None:
        gaps: list[str] = []

        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue

            methods = WRITE_METHODS.intersection(route.methods or set())
            if not methods:
                continue

            for method in sorted(methods):
                key = (method, route.path)
                if route.path.startswith(EXCLUDED_PREFIXES) or key in EXCLUDED_PATHS:
                    continue

                allowed = ALLOWLIST.get(key)
                if allowed is not None:
                    if not _depends_on(route, allowed):
                        gaps.append(f"{method} {route.path} missing allowlisted guard {allowed.__name__}")
                    continue

                if not _depends_on(route, require_write_access):
                    gaps.append(f"{method} {route.path} missing require_write_access")

        self.assertEqual(gaps, [], "Write routes without standard guards:\n" + "\n".join(gaps))

    def test_admin_write_routes_require_admin(self) -> None:
        gaps: list[str] = []

        for route in app.routes:
            if not isinstance(route, APIRoute):
                continue
            if not route.path.startswith("/v1/admin"):
                continue
            if not WRITE_METHODS.intersection(route.methods or set()):
                continue
            if not _depends_on(route, require_admin):
                gaps.append(f"{sorted(route.methods)} {route.path}")

        self.assertEqual(gaps, [], "Admin write routes without require_admin:\n" + "\n".join(gaps))


if __name__ == "__main__":
    unittest.main()
