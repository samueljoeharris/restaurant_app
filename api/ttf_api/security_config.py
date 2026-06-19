"""Deploy-time safety checks — fail fast before serving traffic."""

from __future__ import annotations

import os

from ttf_api.config import Settings


def is_deployed_environment(settings: Settings) -> bool:
    """True when the API is configured for Cloud Run / Cloud SQL (not local compose)."""
    if os.environ.get("K_SERVICE"):
        return True
    if os.environ.get("TTF_DEPLOYED", "").lower() in ("1", "true", "yes"):
        return True
    if "/cloudsql/" in settings.database_url:
        return True
    return False


def assert_safe_auth_config(settings: Settings) -> None:
    """Block dev-token auth on any deployed runtime (defense in depth vs Terraform typos)."""
    if not settings.auth_dev_mode:
        return
    if is_deployed_environment(settings):
        raise RuntimeError(
            "AUTH_DEV_MODE=true is not allowed on deployed environments "
            "(Cloud Run / Cloud SQL). Set AUTH_DEV_MODE=false in Terraform container_env."
        )
