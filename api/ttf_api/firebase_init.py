"""Firebase Admin SDK initialization — shared by auth, App Check, and account deletion."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials

from ttf_api.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def _resolve_service_account_path(raw: str) -> Path:
    path = Path(raw)
    if path.is_file():
        return path
    if not path.is_absolute():
        repo_root = Path(__file__).resolve().parents[2]
        candidate = repo_root / raw
        if candidate.is_file():
            return candidate
    return path


def using_emulator() -> bool:
    return bool(settings.firebase_auth_emulator_host)


def _service_account_path() -> str | None:
    """Return the configured Firebase service account file path.

    Falls back to the raw environment variable in case the settings parser missed
    it (observed in some Cloud Run deployments), and resolves relative paths
    against the repo root.
    """
    raw = settings.firebase_service_account_path or os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    return raw.strip() or None


def init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return

    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host

    options = {"projectId": settings.firebase_project_id}

    if using_emulator():
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(options=options)
    else:
        raw_path = _service_account_path()
        cred = None
        if raw_path:
            path = _resolve_service_account_path(raw_path)
            if path.is_file():
                try:
                    cred = credentials.Certificate(str(path))
                    logger.info("Using Firebase service account from %s", path)
                except (OSError, ValueError) as exc:
                    logger.warning(
                        "Firebase service account file %s could not be loaded (%s); "
                        "falling back to Application Default Credentials.",
                        path,
                        exc,
                    )
            else:
                logger.warning(
                    "Firebase service account file not found at %s; "
                    "falling back to Application Default Credentials.",
                    path,
                )

        if cred is None:
            cred = credentials.ApplicationDefault()
            logger.info("Using Application Default Credentials for Firebase")

        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred, options)

    _firebase_initialized = True
