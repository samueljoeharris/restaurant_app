"""Admin-only analytics and management endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from firebase_admin import auth as firebase_auth

from ttf_api.admin_audit import list_admin_audit_log, write_admin_audit
from ttf_api.auth import AuthUser, _init_firebase, require_admin
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.iap import IapJwtError, verify_iap_jwt
from ttf_api.places_seed import PlacesSeedError
from ttf_api.pubsub_seed import enqueue_seed_job
from ttf_api.refresh_scheduler import sync_refresh_scheduler
from ttf_api.schemas import (
    AdminActivityDay,
    AdminActivityResponse,
    AdminAuditLogResponse,
    AdminAuditLogRow,
    AdminContributorRow,
    AdminContributorsResponse,
    AdminFirebaseSessionResponse,
    AdminObservationRow,
    AdminObservationsResponse,
    AdminOverviewStats,
    AdminRefreshRunResponse,
    AdminRestaurantRow,
    AdminRestaurantsResponse,
    AdminSeedJobRequest,
    LocationRefreshConfig,
    LocationRefreshConfigSaveResponse,
    LocationRefreshConfigUpdate,
    RestaurantChangelogResponse,
    RestaurantChangelogRow,
    RestaurantSeedJob,
    RestaurantSeedJobResponse,
    RestaurantSeedJobsListResponse,
    SchedulerSyncStatus,
    SeedLocation,
    SeedLocationCreate,
    SeedLocationsResponse,
    SeedLocationUpdate,
)
from ttf_api.seed_jobs import (
    add_seed_location,
    create_seed_job,
    create_scheduled_refresh_jobs,
    delete_seed_location,
    get_refresh_config,
    get_seed_job,
    get_seed_location,
    list_seed_jobs,
    list_seed_locations,
    resolve_seed_area,
    update_refresh_config,
    update_seed_location,
)

router = APIRouter(prefix="/v1/admin", tags=["admin"])

_MAX_LIMIT = 200
_REFRESH_CONFIG_AUDIT_FIELDS = (
    "enabled",
    "schedule_cron",
    "schedule_timezone",
    "default_location",
    "default_lat",
    "default_lng",
    "default_radius_m",
)


def _refresh_config_snapshot(config: dict) -> dict:
    return {field: config.get(field) for field in _REFRESH_CONFIG_AUDIT_FIELDS}


def _refresh_config_action(previous: dict, updated: dict) -> str:
    if previous.get("enabled") is True and updated.get("enabled") is False:
        return "auto_refresh_disabled"
    if previous.get("enabled") is False and updated.get("enabled") is True:
        return "auto_refresh_enabled"
    return "updated"


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, _MAX_LIMIT))


def _resolve_iap_operator_email(iap_jwt: str | None) -> str:
    """Resolve the operator email from a verified IAP JWT — fail closed, no fallback."""
    if not iap_jwt or not iap_jwt.strip():
        if settings.auth_dev_mode:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="IAP session bootstrap is disabled in AUTH_DEV_MODE without IAP headers",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing IAP JWT",
        )

    try:
        iap_claims = verify_iap_jwt(iap_jwt)
    except IapJwtError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid IAP JWT",
        ) from exc

    email = iap_claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="IAP JWT missing email claim",
        )
    return email


@router.get("/firebase-session", response_model=AdminFirebaseSessionResponse)
async def admin_firebase_session(
    x_goog_iap_jwt_assertion: Annotated[str | None, Header()] = None,
) -> AdminFirebaseSessionResponse:
    """Exchange a verified IAP login for a Firebase custom token (admin SPA SSO)."""
    email = _resolve_iap_operator_email(x_goog_iap_jwt_assertion)

    _init_firebase()
    try:
        user = firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "No Firebase account for this Google user. "
                "Sign in on the public app once, then grant admin access."
            ),
        ) from exc

    role = (user.custom_claims or {}).get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    custom_token = firebase_auth.create_custom_token(user.uid)
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")
    return AdminFirebaseSessionResponse(custom_token=custom_token)


def _enrich_firebase_users(rows: list[AdminContributorRow]) -> list[AdminContributorRow]:
    if not rows:
        return rows
    try:
        _init_firebase()
        result = firebase_auth.get_users(
            [firebase_auth.UidIdentifier(uid=r.firebase_uid) for r in rows]
        )
    except Exception:
        return rows

    by_uid = {user.uid: user for user in result.users}
    enriched: list[AdminContributorRow] = []
    for row in rows:
        fb = by_uid.get(row.firebase_uid)
        if not fb:
            enriched.append(row)
            continue
        enriched.append(
            row.model_copy(
                update={
                    "email": fb.email or row.email,
                    "display_name": fb.display_name or row.display_name,
                    "disabled": fb.disabled,
                }
            )
        )
    return enriched


@router.get("/stats", response_model=AdminOverviewStats)
def admin_stats(_admin: Annotated[AuthUser, Depends(require_admin)]) -> AdminOverviewStats:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                (SELECT COUNT(*)::int FROM restaurants WHERE pilot_city = %s) AS restaurant_count,
                (SELECT COUNT(*)::int FROM restaurants r
                 WHERE r.pilot_city = %s
                   AND EXISTS (SELECT 1 FROM ttf_observations t WHERE t.restaurant_id = r.id)
                ) AS restaurants_with_ttf,
                (SELECT COUNT(*)::int FROM restaurants r
                 WHERE r.pilot_city = %s
                   AND (
                     EXISTS (SELECT 1 FROM ttf_observations t WHERE t.restaurant_id = r.id)
                     OR EXISTS (SELECT 1 FROM restaurant_attribute_ratings a WHERE a.restaurant_id = r.id)
                     OR EXISTS (SELECT 1 FROM restaurant_notes n WHERE n.restaurant_id = r.id)
                   )
                ) AS restaurants_with_any_data,
                (SELECT COUNT(*)::int FROM ttf_observations) AS ttf_observation_count,
                (SELECT COUNT(*)::int FROM restaurant_attribute_ratings) AS attribute_rating_count,
                (SELECT COUNT(*)::int FROM restaurant_notes) AS note_count,
                (SELECT COUNT(DISTINCT firebase_uid)::int FROM (
                    SELECT firebase_uid FROM ttf_observations
                    UNION
                    SELECT firebase_uid FROM restaurant_attribute_ratings
                    UNION
                    SELECT firebase_uid FROM restaurant_notes
                ) u) AS contributor_count,
                (SELECT COUNT(*)::int FROM ttf_observations
                 WHERE created_at >= now() - interval '7 days') AS ttf_last_7_days,
                (SELECT COUNT(*)::int FROM restaurant_attribute_ratings
                 WHERE observed_at >= now() - interval '7 days') AS attribute_ratings_last_7_days,
                (SELECT COUNT(*)::int FROM restaurant_notes
                 WHERE created_at >= now() - interval '7 days') AS notes_last_7_days,
                (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float
                 FROM ttf_observations) AS median_ttf_minutes,
                (SELECT AVG(item_quality)::float FROM ttf_observations) AS avg_ttf_quality
            """,
            (settings.pilot_city, settings.pilot_city, settings.pilot_city),
        ).fetchone()

    return AdminOverviewStats(
        pilot_city=settings.pilot_city,
        pilot_display_name=settings.pilot_display_name,
        restaurant_count=int(row["restaurant_count"]),
        restaurants_with_ttf=int(row["restaurants_with_ttf"]),
        restaurants_with_any_data=int(row["restaurants_with_any_data"]),
        ttf_observation_count=int(row["ttf_observation_count"]),
        attribute_rating_count=int(row["attribute_rating_count"]),
        note_count=int(row["note_count"]),
        contributor_count=int(row["contributor_count"]),
        ttf_last_7_days=int(row["ttf_last_7_days"]),
        attribute_ratings_last_7_days=int(row["attribute_ratings_last_7_days"]),
        notes_last_7_days=int(row["notes_last_7_days"]),
        median_ttf_minutes=row["median_ttf_minutes"],
        avg_ttf_quality=row["avg_ttf_quality"],
    )


@router.get("/activity", response_model=AdminActivityResponse)
def admin_activity(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    days: int = Query(14, ge=1, le=90),
) -> AdminActivityResponse:
    with get_conn() as conn:
        rows = conn.execute(
            """
            WITH day_series AS (
                SELECT generate_series(
                    (current_date - (%s - 1) * interval '1 day')::date,
                    current_date,
                    interval '1 day'
                )::date AS day
            ),
            ttf AS (
                SELECT created_at::date AS day, COUNT(*)::int AS cnt
                FROM ttf_observations
                WHERE created_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            ),
            attrs AS (
                SELECT observed_at::date AS day, COUNT(*)::int AS cnt
                FROM restaurant_attribute_ratings
                WHERE observed_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            ),
            notes AS (
                SELECT created_at::date AS day, COUNT(*)::int AS cnt
                FROM restaurant_notes
                WHERE created_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            )
            SELECT
                ds.day::text AS day,
                COALESCE(t.cnt, 0) AS ttf_count,
                COALESCE(a.cnt, 0) AS attribute_count,
                COALESCE(n.cnt, 0) AS note_count
            FROM day_series ds
            LEFT JOIN ttf t ON t.day = ds.day
            LEFT JOIN attrs a ON a.day = ds.day
            LEFT JOIN notes n ON n.day = ds.day
            ORDER BY ds.day
            """,
            (days, days, days, days),
        ).fetchall()

    return AdminActivityResponse(
        days=[
            AdminActivityDay(
                day=r["day"],
                ttf_count=int(r["ttf_count"]),
                attribute_count=int(r["attribute_count"]),
                note_count=int(r["note_count"]),
            )
            for r in rows
        ]
    )


@router.get("/users", response_model=AdminContributorsResponse)
def admin_users(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminContributorsResponse:
    limit = _clamp_limit(limit)
    with get_conn() as conn:
        total_row = conn.execute(
            """
            SELECT COUNT(*)::int AS total FROM (
                SELECT firebase_uid FROM ttf_observations
                UNION
                SELECT firebase_uid FROM restaurant_attribute_ratings
                UNION
                SELECT firebase_uid FROM restaurant_notes
            ) u
            """
        ).fetchone()
        rows = conn.execute(
            """
            WITH combined AS (
                SELECT firebase_uid, 'ttf'::text AS kind, created_at AS active_at
                FROM ttf_observations
                UNION ALL
                SELECT firebase_uid, 'attr', observed_at FROM restaurant_attribute_ratings
                UNION ALL
                SELECT firebase_uid, 'note', created_at FROM restaurant_notes
            )
            SELECT
                firebase_uid,
                COUNT(*) FILTER (WHERE kind = 'ttf')::int AS ttf_count,
                COUNT(*) FILTER (WHERE kind = 'attr')::int AS attribute_count,
                COUNT(*) FILTER (WHERE kind = 'note')::int AS note_count,
                COUNT(*)::int AS total_contributions,
                MAX(active_at) AS last_active_at
            FROM combined
            GROUP BY firebase_uid
            ORDER BY last_active_at DESC NULLS LAST
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        ).fetchall()

    items = [
        AdminContributorRow(
            firebase_uid=r["firebase_uid"],
            ttf_count=int(r["ttf_count"]),
            attribute_count=int(r["attribute_count"]),
            note_count=int(r["note_count"]),
            total_contributions=int(r["total_contributions"]),
            last_active_at=r["last_active_at"],
        )
        for r in rows
    ]
    items = _enrich_firebase_users(items)

    return AdminContributorsResponse(
        items=items,
        total=int(total_row["total"]),
        limit=limit,
        offset=offset,
    )


@router.get("/restaurants", response_model=AdminRestaurantsResponse)
def admin_restaurants(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminRestaurantsResponse:
    limit = _clamp_limit(limit)
    params: list[object] = [settings.pilot_city]
    where = "WHERE r.pilot_city = %s"
    if q and q.strip():
        where += " AND r.name ILIKE %s"
        params.append(f"%{q.strip()}%")

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM restaurants r {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT
                r.id,
                r.name,
                r.address,
                r.cuisine_tags,
                r.status,
                r.tombstone_reason,
                r.updated_at,
                COALESCE(t.sample_size, 0)::int AS ttf_sample_size,
                t.median_minutes AS ttf_median_minutes,
                t.avg_quality AS ttf_avg_quality,
                COALESCE(a.cnt, 0)::int AS attribute_rating_count,
                COALESCE(n.cnt, 0)::int AS note_count
            FROM restaurants r
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS sample_size,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float
                        AS median_minutes,
                    AVG(item_quality)::float AS avg_quality
                FROM ttf_observations o
                WHERE o.restaurant_id = r.id
            ) t ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS cnt
                FROM restaurant_attribute_ratings ar
                WHERE ar.restaurant_id = r.id
            ) a ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS cnt FROM restaurant_notes rn
                WHERE rn.restaurant_id = r.id
            ) n ON true
            {where}
            ORDER BY ttf_sample_size DESC, r.name
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()

    return AdminRestaurantsResponse(
        items=[
            AdminRestaurantRow(
                id=r["id"],
                name=r["name"],
                address=r["address"],
                cuisine_tags=r["cuisine_tags"] or [],
                status=r["status"],
                tombstone_reason=r.get("tombstone_reason"),
                ttf_sample_size=int(r["ttf_sample_size"]),
                ttf_median_minutes=r["ttf_median_minutes"],
                ttf_avg_quality=r["ttf_avg_quality"],
                attribute_rating_count=int(r["attribute_rating_count"]),
                note_count=int(r["note_count"]),
                updated_at=r["updated_at"],
            )
            for r in rows
        ],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )


@router.get("/seed-jobs", response_model=RestaurantSeedJobsListResponse)
def admin_list_seed_jobs(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> RestaurantSeedJobsListResponse:
    limit = _clamp_limit(limit)
    rows, total = list_seed_jobs(limit=limit, offset=offset)
    return RestaurantSeedJobsListResponse(
        items=[RestaurantSeedJob(**row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/seed-jobs/{job_id}", response_model=RestaurantSeedJobResponse)
def admin_get_seed_job(
    job_id: UUID,
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> RestaurantSeedJobResponse:
    job = get_seed_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Seed job not found")
    return RestaurantSeedJobResponse(job=RestaurantSeedJob(**job))


@router.post(
    "/seed-jobs",
    response_model=RestaurantSeedJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def admin_trigger_seed_job(
    body: AdminSeedJobRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> RestaurantSeedJobResponse:
    try:
        area = resolve_seed_area(body.location, body.lat, body.lng, body.radius_m)
    except PlacesSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    job, reused = create_seed_job(
        area,
        query=body.location.strip() if body.location else area.label,
        requested_by=admin.firebase_uid,
        force=body.force,
    )
    # Re-enqueue even when reused: unsticks pending jobs whose original enqueue
    # was lost (run_seed_job's status guard makes duplicate delivery a no-op).
    if job["status"] == "pending":
        enqueue_seed_job(job["id"])
    return RestaurantSeedJobResponse(job=RestaurantSeedJob(**job), reused=reused)


@router.post(
    "/refresh-runs",
    response_model=AdminRefreshRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def admin_trigger_refresh_runs(
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminRefreshRunResponse:
    """Refresh every enabled requested location plus the full catalog."""
    jobs = create_scheduled_refresh_jobs(requested_by=admin.firebase_uid)
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Auto-refresh is disabled in location refresh config",
        )
    for job in jobs:
        if job["status"] == "pending":
            enqueue_seed_job(job["id"])
    return AdminRefreshRunResponse(jobs=[RestaurantSeedJob(**job) for job in jobs])


@router.get("/seed-locations", response_model=SeedLocationsResponse)
def admin_list_seed_locations(
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> SeedLocationsResponse:
    return SeedLocationsResponse(
        items=[SeedLocation(**row) for row in list_seed_locations()]
    )


@router.post(
    "/seed-locations",
    response_model=SeedLocation,
    status_code=status.HTTP_201_CREATED,
)
def admin_add_seed_location(
    body: SeedLocationCreate,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> SeedLocation:
    try:
        row = add_seed_location(
            body.location,
            radius_m=body.radius_m,
            created_by=admin.firebase_uid,
        )
    except PlacesSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SeedLocation(**row)


@router.patch("/seed-locations/{location_id}", response_model=SeedLocation)
def admin_update_seed_location(
    location_id: UUID,
    body: SeedLocationUpdate,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> SeedLocation:
    before = get_seed_location(location_id)
    row = update_seed_location(
        location_id,
        enabled=body.enabled,
        radius_m=body.radius_m,
        label=body.label,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Seed location not found")

    if (
        before
        and body.enabled is not None
        and before["enabled"] != body.enabled
    ):
        write_admin_audit(
            category="seed_location",
            action="enabled" if body.enabled else "disabled",
            entity_id=str(location_id),
            changed_by_uid=admin.firebase_uid,
            changed_by_email=admin.email,
            previous_values={
                "enabled": before["enabled"],
                "label": before["label"],
            },
            new_values={
                "enabled": row["enabled"],
                "label": row["label"],
            },
        )
    return SeedLocation(**row)


@router.delete(
    "/seed-locations/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def admin_delete_seed_location(
    location_id: UUID,
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> Response:
    if not delete_seed_location(location_id):
        raise HTTPException(status_code=404, detail="Seed location not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/refresh-config", response_model=LocationRefreshConfig)
def admin_get_refresh_config(
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> LocationRefreshConfig:
    return LocationRefreshConfig(**get_refresh_config())


@router.put("/refresh-config", response_model=LocationRefreshConfigSaveResponse)
def admin_update_refresh_config(
    body: LocationRefreshConfigUpdate,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> LocationRefreshConfigSaveResponse:
    previous = _refresh_config_snapshot(get_refresh_config())
    row = update_refresh_config(
        enabled=body.enabled,
        schedule_cron=body.schedule_cron,
        schedule_timezone=body.schedule_timezone,
        default_location=body.default_location,
        default_lat=body.default_lat,
        default_lng=body.default_lng,
        default_radius_m=body.default_radius_m,
        updated_by=admin.firebase_uid,
    )
    updated = _refresh_config_snapshot(row)
    scheduler_sync = sync_refresh_scheduler(row)

    if previous != updated:
        write_admin_audit(
            category="refresh_config",
            action=_refresh_config_action(previous, updated),
            entity_id=row["pilot_city"],
            changed_by_uid=admin.firebase_uid,
            changed_by_email=admin.email,
            previous_values=previous,
            new_values=updated,
            metadata={
                "scheduler_sync": {
                    "status": scheduler_sync.status,
                    "detail": scheduler_sync.detail,
                }
            },
        )

    return LocationRefreshConfigSaveResponse(
        config=LocationRefreshConfig(**row),
        scheduler_sync=SchedulerSyncStatus(
            status=scheduler_sync.status,
            detail=scheduler_sync.detail,
        ),
    )


@router.get("/audit-log", response_model=AdminAuditLogResponse)
def admin_audit_log(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None, pattern="^(refresh_config|seed_location)$"),
) -> AdminAuditLogResponse:
    limit = _clamp_limit(limit)
    rows, total = list_admin_audit_log(category=category, limit=limit, offset=offset)
    return AdminAuditLogResponse(
        items=[AdminAuditLogRow(**row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/restaurant-changelog", response_model=RestaurantChangelogResponse)
def admin_restaurant_changelog(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    action: str | None = Query(None, max_length=32),
) -> RestaurantChangelogResponse:
    limit = _clamp_limit(limit)
    params: list[object] = []
    where = ""
    if action and action.strip():
        where = "WHERE action = %s"
        params.append(action.strip())

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM restaurant_changelog {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT *
            FROM restaurant_changelog
            {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()

    return RestaurantChangelogResponse(
        items=[RestaurantChangelogRow(**row) for row in rows],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )


@router.get("/observations", response_model=AdminObservationsResponse)
def admin_observations(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminObservationsResponse:
    limit = _clamp_limit(limit)
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*)::int AS total FROM ttf_observations"
        ).fetchone()
        rows = conn.execute(
            """
            SELECT
                o.id,
                o.restaurant_id,
                r.name AS restaurant_name,
                o.firebase_uid,
                o.elapsed_minutes,
                o.item_type,
                o.item_quality,
                o.daypart,
                o.created_at
            FROM ttf_observations o
            JOIN restaurants r ON r.id = o.restaurant_id
            ORDER BY o.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        ).fetchall()

    return AdminObservationsResponse(
        items=[
            AdminObservationRow(
                id=r["id"],
                restaurant_id=r["restaurant_id"],
                restaurant_name=r["restaurant_name"],
                firebase_uid=r["firebase_uid"],
                elapsed_minutes=int(r["elapsed_minutes"]),
                item_type=r["item_type"],
                item_quality=int(r["item_quality"]),
                daypart=r["daypart"],
                created_at=r["created_at"],
            )
            for r in rows
        ],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )
