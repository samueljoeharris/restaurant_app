"""Firebase Auth JWT verification and user resolution."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated
from uuid import UUID

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from ttf_api.config import settings
from ttf_api.db import get_conn

_bearer = HTTPBearer(auto_error=False)
_firebase_initialized = False


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    firebase_uid: str
    display_name: str | None


def _init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return

    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host

    options = {"projectId": settings.firebase_project_id}

    if settings.firebase_service_account_path:
        path = Path(settings.firebase_service_account_path)
        if not path.is_file():
            raise RuntimeError(f"Firebase service account not found: {path}")
        cred = credentials.Certificate(str(path))
    else:
        cred = credentials.ApplicationDefault()

    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred, options)

    _firebase_initialized = True


def _verify_firebase_token(token: str) -> dict:
    _init_firebase()
    try:
        return firebase_auth.verify_id_token(token, check_revoked=False)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        ) from exc


def _upsert_user(firebase_uid: str, display_name: str | None) -> AuthUser:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO users (firebase_uid, display_name)
            VALUES (%s, %s)
            ON CONFLICT (firebase_uid) DO UPDATE
            SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
            RETURNING id, firebase_uid, display_name
            """,
            (firebase_uid, display_name),
        ).fetchone()
    return AuthUser(
        id=row["id"],
        firebase_uid=row["firebase_uid"],
        display_name=row["display_name"],
    )


def resolve_user_from_token(token: str) -> AuthUser:
    if settings.auth_dev_mode and token.startswith("dev:"):
        uid = token.removeprefix("dev:")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid dev token")
        return _upsert_user(uid, "Dev User")

    claims = _verify_firebase_token(token)
    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Token missing uid")
    name = claims.get("name") or claims.get("email")
    return _upsert_user(uid, name)


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
        )
    return resolve_user_from_token(creds.credentials)


async def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUser | None:
    if creds is None:
        return None
    if creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    return resolve_user_from_token(creds.credentials)
