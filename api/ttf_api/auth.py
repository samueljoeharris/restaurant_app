"""Firebase Auth JWT verification — identity from Firebase only, no local user store."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth

from ttf_api.config import settings
from ttf_api.firebase_init import init_firebase, using_emulator

# Backward-compatible aliases for internal callers.
_init_firebase = init_firebase
_using_emulator = using_emulator


def dev_admin_uids() -> set[str]:
    if not settings.auth_dev_admin_uids.strip():
        return set()
    return {part.strip() for part in settings.auth_dev_admin_uids.split(",") if part.strip()}

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    firebase_uid: str
    display_name: str | None
    email: str | None
    role: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


@dataclass(frozen=True)
class AccountDeletionAuth:
    user: AuthUser
    skip_firebase_delete: bool


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


def _is_dev_token(token: str) -> bool:
    return settings.auth_dev_mode and token.startswith("dev:")


def _require_recent_login(token: str) -> None:
    claims = _verify_firebase_token(token)
    auth_time = claims.get("auth_time")
    if auth_time is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent sign-in required. Confirm your identity and try again.",
        )
    max_age = settings.account_delete_recent_login_minutes * 60
    if time.time() - int(auth_time) > max_age:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recent sign-in required. Confirm your identity and try again.",
        )


async def require_account_deletion(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AccountDeletionAuth:
    """Authenticated user with recent sign-in — required before account deletion."""
    from ttf_api.app_check import verify_app_check

    verify_app_check(request)
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = creds.credentials
    user = resolve_user_from_token(token)
    skip_firebase = _is_dev_token(token)

    if not skip_firebase and not _using_emulator():
        _require_recent_login(token)

    return AccountDeletionAuth(user=user, skip_firebase_delete=skip_firebase)
