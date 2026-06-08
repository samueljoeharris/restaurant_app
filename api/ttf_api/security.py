"""Combined guards for authenticated write endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

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
