from typing import Annotated

from fastapi import APIRouter, Depends

from ttf_api.auth import AuthUser, get_current_user
from ttf_api.db import get_conn
from ttf_api.schemas import UserProfile

router = APIRouter(prefix="/v1", tags=["users"])


@router.get("/me", response_model=UserProfile)
def get_me(user: Annotated[AuthUser, Depends(get_current_user)]) -> UserProfile:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, firebase_uid, display_name, contribution_count FROM users WHERE id = %s",
            (user.id,),
        ).fetchone()
    return UserProfile(
        id=row["id"],
        firebase_uid=row["firebase_uid"],
        display_name=row["display_name"],
        contribution_count=row["contribution_count"],
    )
