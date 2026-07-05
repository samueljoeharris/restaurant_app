"""Hard-coded dev-only guardrails for synthetic user runs (#89).

These are intentionally not configurable via CLI flags or environment
variables — the whole point of the synthetic user team is that it can never
be pointed at anything but the dev environment, even by mistake. There is no
"skip guardrails" flag.
"""

from __future__ import annotations

from urllib.parse import urlparse

ALLOWED_HOST_SUFFIX = ".dev.littlescout.app"
ALLOWED_GCP_PROJECT = "ttf-restaurant-dev"


class GuardrailViolation(RuntimeError):
    """Raised when a run would touch anything but the dev environment."""


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def assert_dev_web_url(url: str) -> None:
    host = _host(url)
    if not host.endswith(ALLOWED_HOST_SUFFIX):
        raise GuardrailViolation(
            f"Refusing to run: web target {url!r} is not under {ALLOWED_HOST_SUFFIX!r}"
        )


def assert_dev_api_url(url: str) -> None:
    host = _host(url)
    if not host.endswith(ALLOWED_HOST_SUFFIX):
        raise GuardrailViolation(
            f"Refusing to run: API target {url!r} is not under {ALLOWED_HOST_SUFFIX!r}"
        )


def assert_dev_project(project_id: str | None) -> None:
    if project_id and project_id != ALLOWED_GCP_PROJECT:
        raise GuardrailViolation(
            f"Refusing to run: GCP project {project_id!r} is not {ALLOWED_GCP_PROJECT!r}"
        )


def assert_synthetic_email(email: str) -> None:
    """Defense in depth: synthetic accounts must be recognizable as such.

    Matches the locked-in `scout-agent-{nn}@littlescout.app` scheme from
    docs/SYNTHETIC_USERS.md so a stray real email can never slip through
    signup/pick-user flows.
    """
    local = email.strip().lower().split("@", 1)[0]
    if not local.startswith("scout-agent-"):
        raise GuardrailViolation(
            f"Refusing to use non-agent email {email!r} — synthetic accounts must "
            "start with 'scout-agent-' (see docs/SYNTHETIC_USERS.md)."
        )
