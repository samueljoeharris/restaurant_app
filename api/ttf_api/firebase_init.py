"""Firebase Admin SDK initialization — shared by auth, App Check, and account deletion."""

from __future__ import annotations

import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials

from ttf_api.config import settings

_firebase_initialized = False


def using_emulator() -> bool:
    return bool(settings.firebase_auth_emulator_host)


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
    elif settings.firebase_service_account_path:
        path = Path(settings.firebase_service_account_path)
        if not path.is_file():
            raise RuntimeError(f"Firebase service account not found: {path}")
        cred = credentials.Certificate(str(path))
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred, options)
    else:
        cred = credentials.ApplicationDefault()
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred, options)

    _firebase_initialized = True
