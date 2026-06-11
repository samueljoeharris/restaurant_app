"""Verify Identity-Aware Proxy JWT assertions (X-Goog-IAP-JWT-Assertion)."""

from __future__ import annotations

import threading

import google.auth
import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from ttf_api.config import settings

_audience_lock = threading.Lock()
_resolved_audience: str | None = None


class IapJwtError(Exception):
    """IAP JWT missing, misconfigured, or invalid."""


def _iap_audience() -> str:
    global _resolved_audience

    if settings.iap_jwt_audience.strip():
        return settings.iap_jwt_audience.strip()

    with _audience_lock:
        if _resolved_audience:
            return _resolved_audience

        backend_name = settings.iap_admin_backend_service.strip()
        project_number = settings.gcp_project_number.strip()
        if not backend_name or not project_number:
            raise IapJwtError("IAP JWT audience is not configured")

        credentials, _project_id = google.auth.default(
            scopes=["https://www.googleapis.com/auth/compute.readonly"],
        )
        credentials.refresh(google_requests.Request())
        token = credentials.token
        if not token:
            raise IapJwtError("Could not resolve IAP JWT audience")

        url = (
            "https://compute.googleapis.com/compute/v1/projects/"
            f"{settings.firebase_project_id}/global/backendServices/{backend_name}"
        )
        response = httpx.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        if response.status_code != 200:
            raise IapJwtError("Could not resolve IAP backend service audience")

        backend_id = response.json().get("id")
        if not backend_id:
            raise IapJwtError("IAP backend service response missing id")

        _resolved_audience = (
            f"/projects/{project_number}/global/backendServices/{backend_id}"
        )
        return _resolved_audience


def verify_iap_jwt(iap_jwt: str) -> dict:
    if not iap_jwt.strip():
        raise IapJwtError("Missing IAP JWT")

    audience = _iap_audience()

    try:
        return id_token.verify_token(
            iap_jwt,
            google_requests.Request(),
            audience=audience,
            certs_url="https://www.gstatic.com/iap/verify/public_key",
        )
    except Exception as exc:
        raise IapJwtError("Invalid IAP JWT") from exc
