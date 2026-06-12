"""Firebase Auth JWT verification — identity from Firebase only, no local user store."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from ttf_api.config import settings


def dev_admin_uids() -> set[str]:
    if not settings.auth_dev_admin_uids.strip():
        return set()
    return {part.strip() for part in settings.auth_dev_admin_uids.split(",") if part.strip()}

_bearer = HTTPBearer(auto_error=False)
_firebase_initialized = False


@dataclass(frozen=True)
class AuthUser:
    firebase_uid: str
    display_name: str | None
    email: str | None
    role: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def _using_emulator() -> bool:
    return bool(settings.firebase_auth_emulator_host)


def _init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return

    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host

    options = {"projectId": settings.firebase_project_id}

    if _using_emulator():
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


def _verify_firebase_token(token: str) -> dict:
    _init_firebase()
    try:
        claims = firebase_auth.verify_id_token(
            token,
            check_revoked=not _using_emulator(),
        )
    except firebase_auth.ExpiredIdTokenError as exc:
        raise HTTPException(status_code=401, detail="Firebase token expired") from exc
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Firebase token verification failed",
        ) from exc

    return claims


def _role_from_claims(claims: dict) -> str | None:
    role = claims.get("role")
    if role is None:
        return None
    return str(role)


def _user_from_claims(claims: dict) -> AuthUser:
    uid = claims.get("uid") or claims.get("sub")
    return AuthUser(
        firebase_uid=uid,
        display_name=claims.get("name"),
        email=claims.get("email"),
        role=_role_from_claims(claims),
    )


def resolve_user_from_token(token: str) -> AuthUser:
    if settings.auth_dev_mode and token.startswith("dev:"):
        uid = token.removeprefix("dev:")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid dev token")
        role = "admin" if uid in dev_admin_uids() else None
        return AuthUser(
            firebase_uid=uid,
            display_name="Dev User",
            email=None,
            role=role,
        )

    return _user_from_claims(_verify_firebase_token(token))


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return resolve_user_from_token(creds.credentials)


async def require_admin(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
