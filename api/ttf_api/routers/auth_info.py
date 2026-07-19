from typing import Annotated

from fastapi import APIRouter, Depends
from firebase_admin import auth as firebase_auth

from ttf_api.auth import AuthUser, _init_firebase, require_admin
from ttf_api.config import settings
from ttf_api.schemas import AdminFirebaseSessionResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.get("/config")
def auth_config() -> dict:
    """Public auth config for clients (web / iOS SDK setup)."""
    response = {
        "firebase_project_id": settings.firebase_project_id,
        "auth_dev_mode": settings.auth_dev_mode,
    }
    if settings.auth_dev_mode:
        response["emulator_enabled"] = bool(settings.firebase_auth_emulator_host)
        response["emulator_host"] = settings.firebase_auth_emulator_host or None
        response["dev_token_hint"] = "Bearer dev:<uid>"
    return response


@router.post("/handoff", response_model=AdminFirebaseSessionResponse)
async def auth_handoff(
    user: Annotated[AuthUser, Depends(require_admin)],
) -> AdminFirebaseSessionResponse:
    """Mint a Firebase custom token so another origin (e.g. app.dev) can SSO silently."""
    _init_firebase()
    custom_token = firebase_auth.create_custom_token(user.firebase_uid)
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")
    return AdminFirebaseSessionResponse(custom_token=custom_token)
