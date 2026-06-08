from fastapi import APIRouter

from ttf_api.config import settings

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.get("/config")
def auth_config() -> dict:
    """Public auth config for clients (web / iOS SDK setup)."""
    return {
        "firebase_project_id": settings.firebase_project_id,
        "auth_dev_mode": settings.auth_dev_mode,
        "emulator_enabled": bool(settings.firebase_auth_emulator_host),
        "emulator_host": settings.firebase_auth_emulator_host or None,
        "dev_token_hint": "Bearer dev:<uid>" if settings.auth_dev_mode else None,
    }
