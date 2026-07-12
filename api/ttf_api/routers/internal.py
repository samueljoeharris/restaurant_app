"""Internal endpoints for Pub/Sub push and scheduled jobs."""

from __future__ import annotations

import base64
import json
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel

from ttf_api.config import settings
from ttf_api.gcp_console import seed_job_log_marker
from ttf_api.pubsub_seed import enqueue_seed_job
from ttf_api.seed_jobs import create_catalog_refresh_job, run_seed_job

router = APIRouter(prefix="/v1/internal", tags=["internal"])
logger = logging.getLogger(__name__)


def _verify_internal_caller(
    authorization: Annotated[str | None, Header()] = None,
    x_internal_job_token: Annotated[str | None, Header()] = None,
) -> None:
    secret = settings.internal_job_secret.strip()
    if secret and x_internal_job_token == secret:
        return

    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ")
        try:
            claims = id_token.verify_oauth2_token(token, google_requests.Request())
            email = claims.get("email", "")
            if email.endswith(".iam.gserviceaccount.com"):
                return
        except Exception as exc:
            logger.debug("OIDC verification failed: %s", exc)

    if not secret and settings.auth_dev_mode:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid internal job credentials",
    )


class PubSubPushEnvelope(BaseModel):
    message: dict
    subscription: str | None = None


@router.post(
    "/pubsub/seed-jobs",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def pubsub_seed_job_handler(
    envelope: PubSubPushEnvelope,
    _auth: Annotated[None, Depends(_verify_internal_caller)],
) -> Response:
    """Process a Pub/Sub push message containing a seed job id."""
    raw = envelope.message.get("data")
    if not raw:
        raise HTTPException(status_code=400, detail="Missing message data")

    payload = json.loads(base64.b64decode(raw))
    job_id = UUID(payload["job_id"])
    logger.info("%s pubsub push received", seed_job_log_marker(str(job_id)))
    run_seed_job(job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/scheduled-push-dispatch", status_code=status.HTTP_200_OK)
def scheduled_push_dispatch(
    _auth: Annotated[None, Depends(_verify_internal_caller)],
) -> dict:
    """Cloud Scheduler entry point — bundle and send pending push notifications."""
    from ttf_api.push_dispatch import dispatch_pending_pushes

    return dispatch_pending_pushes()


@router.post("/scheduled-restaurant-refresh", status_code=status.HTTP_202_ACCEPTED)
def scheduled_restaurant_refresh(
    _auth: Annotated[None, Depends(_verify_internal_caller)],
) -> dict:
    """Cloud Scheduler entry point — enqueue the single catalog refresh job."""
    job = create_catalog_refresh_job()
    if not job:
        return {"status": "skipped", "reason": "auto_refresh_disabled"}

    if job["status"] == "pending":
        enqueue_seed_job(job["id"])

    return {"status": "accepted", "job_id": str(job["id"])}
