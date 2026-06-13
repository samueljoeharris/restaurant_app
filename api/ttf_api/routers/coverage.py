"""Public, rate-limited location coverage endpoint.

A signed-in user can ask Little Scout to make sure their current location is
seeded. Each request is guarded (pilot bbox, existing density, per-user daily
cap, 24h area cooldown) before any Google Places spend, then reuses the
existing background seed pipeline.
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from ttf_api.app_check import verify_app_check
from ttf_api.auth import AuthUser, get_current_user
from ttf_api.config import settings
from ttf_api.coverage import (
    count_active_within,
    count_recent_user_areas,
    within_pilot_bbox,
)
from ttf_api.db import get_conn
from ttf_api.places_seed import SeedArea
from ttf_api.pubsub_seed import enqueue_seed_job
from ttf_api.schemas import CoverageEnsureRequest, CoverageEnsureResponse
from ttf_api.seed_jobs import create_seed_job

router = APIRouter(prefix="/v1/coverage", tags=["coverage"])


@router.post("/ensure", response_model=CoverageEnsureResponse)
def ensure_coverage(
    body: CoverageEnsureRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> CoverageEnsureResponse:
    verify_app_check(request)

    if not within_pilot_bbox(body.lat, body.lng):
        return CoverageEnsureResponse(status="out_of_area", radius_m=body.radius_m)

    with get_conn() as conn:
        nearby = count_active_within(conn, body.lat, body.lng, body.radius_m)
        if nearby >= settings.coverage_min_restaurants:
            return CoverageEnsureResponse(
                status="covered", restaurant_count=nearby, radius_m=body.radius_m
            )
        recent_areas = count_recent_user_areas(conn, user.firebase_uid)

    if recent_areas >= settings.coverage_max_areas_per_day:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Coverage request limit reached "
                f"({settings.coverage_max_areas_per_day} new areas per day)."
            ),
        )

    area = SeedArea(
        lat=body.lat,
        lng=body.lng,
        radius_m=body.radius_m,
        label=f"Near {body.lat:.4f}, {body.lng:.4f}",
    )
    # create_seed_job applies the shared 24h area_key cooldown / running-job reuse.
    job, reused = create_seed_job(
        area, query=area.label, requested_by=user.firebase_uid
    )
    # Re-enqueue only pending jobs (mirrors the admin seed endpoint); a reused
    # succeeded/running job is already covered.
    if job["status"] == "pending":
        enqueue_seed_job(job["id"], background_tasks=background_tasks)

    return CoverageEnsureResponse(
        status="queued",
        restaurant_count=nearby,
        radius_m=body.radius_m,
        job_id=job["id"],
        reused=reused,
    )
