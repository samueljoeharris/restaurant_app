"""Sign in with Apple — server-side token exchange and revocation."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import jwt

from ttf_api.config import settings

logger = logging.getLogger(__name__)

APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"


def _apple_configured() -> bool:
    return bool(
        settings.apple_team_id
        and settings.apple_key_id
        and settings.apple_private_key
        and settings.apple_client_id
    )


def _client_secret() -> str:
    now = int(time.time())
    headers = {"kid": settings.apple_key_id, "alg": "ES256"}
    payload = {
        "iss": settings.apple_team_id,
        "iat": now,
        "exp": now + 86400 * 180,
        "aud": "https://appleid.apple.com",
        "sub": settings.apple_client_id,
    }
    key = settings.apple_private_key.replace("\\n", "\n")
    return jwt.encode(payload, key, algorithm="ES256", headers=headers)


def revoke_apple_tokens(authorization_code: str) -> None:
    """Exchange a fresh authorization code and revoke the Apple refresh token."""
    if not authorization_code.strip():
        return
    if not _apple_configured():
        logger.warning("apple_sign_in_not_configured skip_revoke")
        return

    client_secret = _client_secret()
    with httpx.Client(timeout=15.0) as client:
        token_resp = client.post(
            APPLE_TOKEN_URL,
            data={
                "client_id": settings.apple_client_id,
                "client_secret": client_secret,
                "code": authorization_code,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            logger.warning(
                "apple_token_exchange_failed status=%s body=%s",
                token_resp.status_code,
                token_resp.text[:200],
            )
            return

        tokens: dict[str, Any] = token_resp.json()
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            logger.warning("apple_token_exchange_no_refresh_token")
            return

        revoke_resp = client.post(
            APPLE_REVOKE_URL,
            data={
                "client_id": settings.apple_client_id,
                "client_secret": client_secret,
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if revoke_resp.status_code != 200:
            logger.warning(
                "apple_revoke_failed status=%s body=%s",
                revoke_resp.status_code,
                revoke_resp.text[:200],
            )
            return

    logger.info("apple_tokens_revoked")
