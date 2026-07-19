"""Combined guards for authenticated write endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from ttf_api.app_check import verify_app_check
from ttf_api.auth import AuthUser, get_current_user
from ttf_api.db import get_conn
from ttf_api.rate_limit import check_write_rate_limit


async def require_write_access(
    request: Request,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    verify_app_check(request)
    with get_conn() as conn:
        check_write_rate_limit(conn, user.firebase_uid)
    return user


async def require_trusted_or_admin(
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> AuthUser:
    if user.is_admin:
        return user
    with get_conn() as conn:
        row = conn.execute(
            "SELECT trust_level FROM user_profiles WHERE firebase_uid = %s",
            (user.firebase_uid,),
        ).fetchone()
    if row and row["trust_level"] == "trusted":
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin or trusted contributor required",
    )
