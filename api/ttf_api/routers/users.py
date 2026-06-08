from typing import Annotated

from fastapi import APIRouter, Depends

from ttf_api.auth import AuthUser, get_current_user
from ttf_api.db import get_conn
from ttf_api.schemas import UserProfile

router = APIRouter(prefix="/v1", tags=["users"])


def _contribution_count(conn, firebase_uid: str) -> int:
    row = conn.execute(
        """
        SELECT (
            (SELECT COUNT(*) FROM ttf_observations WHERE firebase_uid = %s) +
            (SELECT COUNT(*) FROM restaurant_attribute_ratings WHERE firebase_uid = %s) +
            (SELECT COUNT(*) FROM restaurant_notes WHERE firebase_uid = %s)
        )::int AS total
        """,
        (firebase_uid, firebase_uid, firebase_uid),
    ).fetchone()
    return int(row["total"])


@router.get("/me", response_model=UserProfile)
def get_me(user: Annotated[AuthUser, Depends(get_current_user)]) -> UserProfile:
    with get_conn() as conn:
        count = _contribution_count(conn, user.firebase_uid)
    return UserProfile(
        firebase_uid=user.firebase_uid,
        display_name=user.display_name,
        email=user.email,
        contribution_count=count,
    )
