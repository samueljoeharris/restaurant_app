"""Firebase App Check verification for write endpoints."""

from __future__ import annotations

from fastapi import HTTPException, Request, status
from firebase_admin import app_check as firebase_app_check

from ttf_api.auth import _init_firebase
from ttf_api.config import settings

APP_CHECK_HEADER = "X-Firebase-AppCheck"


def verify_app_check(request: Request) -> None:
    if not settings.app_check_enforce:
        return

    token = request.headers.get(APP_CHECK_HEADER)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="App Check token required",
        )

    _init_firebase()
    try:
        firebase_app_check.verify_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid App Check token",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="App Check verification failed",
        ) from exc
