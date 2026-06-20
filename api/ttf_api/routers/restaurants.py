from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from psycopg.types.json import Jsonb

from ttf_api.aggregates import build_attribute_aggregates
from ttf_api.activity_events import emit_activity_event
from ttf_api.auth import AuthUser, get_optional_user, require_admin
from ttf_api.security import require_write_access
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.map_query import build_bbox_filter
from ttf_api.map_entries import MAP_SELECT, apply_watched_flags, row_to_map_entry
from ttf_api.user_profiles import fetch_watched_ids
from ttf_api.places_seed import PlacesSeedError
from ttf_api.pubsub_seed import enqueue_seed_job
from ttf_api.seed_jobs import create_seed_job, get_seed_job, resolve_seed_area
from ttf_api.schemas import (
    AttributeSubmissionRequest,
    AttributeSubmissionResponse,
    ContributionRecency,
    CreateRestaurantRequest,
    NoteSubmissionRequest,
    NoteSubmissionResponse,
    RestaurantDetail,
    RestaurantDetailResponse,
    RestaurantSeedJob,
    RestaurantSeedJobRequest,
    RestaurantSeedJobResponse,
    RestaurantMapEntry,
    RestaurantSummary,
    TtfAggregate,
    TtfSubmissionRequest,
    TtfSubmissionResponse,
)

# Haversine distance expression (metres).  Parametrised by %(lat)s / %(lng)s.
_HAVERSINE_EXPR = """
    2 * 6371000 * asin(sqrt(
        power(sin(radians(r.lat - %(lat)s) / 2), 2)
        + cos(radians(%(lat)s)) * cos(radians(r.lat))
          * power(sin(radians(r.lng - %(lng)s) / 2), 2)
    ))
"""

router = APIRouter(prefix="/v1/restaurants", tags=["restaurants"])


def _map_entries_from_rows(rows: list, watched_ids: set) -> list[RestaurantMapEntry]:
    entries = [row_to_map_entry(row, watched=row["id"] in watched_ids) for row in rows]
    return apply_watched_flags(entries, watched_ids)


def _row_to_summary(row: dict) -> RestaurantSummary:
    return RestaurantSummary(
        id=row["id"],
        google_place_id=row.get("google_place_id"),
        name=row["name"],
        address=row["address"],
        lat=row["lat"],
        lng=row["lng"],
        cuisine_tags=row["cuisine_tags"] or [],
        pilot_city=row["pilot_city"],
        google_maps_url=row.get("google_maps_url"),
    )


def _row_to_detail(row: dict) -> RestaurantDetail:
    return RestaurantDetail(
        **_row_to_summary(row).model_dump(),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _fetch_contribution_recency(conn, restaurant_id: UUID) -> ContributionRecency:
    """Combined TTF + attribute counts by age bucket at restaurant scope.

    Buckets are exclusive by contribution age in days. Contributions older than
    180 days roll into ``over_365_days`` so totals always partition cleanly.
    """
    row = conn.execute(
        """
        SELECT
            COUNT(*) FILTER (WHERE age_days <= 7)::int AS last_7_days,
            COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 30)::int AS days_8_to_30,
            COUNT(*) FILTER (WHERE age_days BETWEEN 31 AND 180)::int AS days_31_to_180,
            COUNT(*) FILTER (WHERE age_days > 180)::int AS over_365_days,
            COUNT(*)::int AS total
        FROM (
            SELECT (CURRENT_DATE - ts::date) AS age_days
            FROM (
                SELECT created_at AS ts
                FROM ttf_observations
                WHERE restaurant_id = %s
                UNION ALL
                SELECT observed_at AS ts
                FROM restaurant_attribute_ratings
                WHERE restaurant_id = %s
            ) contributions
        ) aged
        """,
        (restaurant_id, restaurant_id),
    ).fetchone()
    return ContributionRecency(**row)


def build_restaurant_detail_response(
    conn,
    row: dict,
    restaurant_id: UUID,
    *,
    watched: bool = False,
) -> RestaurantDetailResponse:
    return RestaurantDetailResponse(
        restaurant=_row_to_detail(row),
        ttf=_fetch_ttf_aggregate(conn, restaurant_id),
        contribution_recency=_fetch_contribution_recency(conn, restaurant_id),
        watched=watched,
    )


def _fetch_ttf_aggregate(conn, restaurant_id: UUID) -> TtfAggregate:
    row = conn.execute(
        """
        SELECT
            COUNT(*)::int AS sample_size,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes) AS median_minutes,
            AVG(item_quality)::float AS avg_quality,
            MAX(created_at) AS last_updated
        FROM ttf_observations
        WHERE restaurant_id = %s
        """,
        (restaurant_id,),
    ).fetchone()
    if not row or row["sample_size"] == 0:
        return TtfAggregate()
    return TtfAggregate(
        sample_size=row["sample_size"],
        median_minutes=float(row["median_minutes"]) if row["median_minutes"] is not None else None,
        avg_quality=float(row["avg_quality"]) if row["avg_quality"] is not None else None,
        last_updated=row["last_updated"],
    )


def _ensure_restaurant(conn, restaurant_id: UUID) -> dict:
    row = conn.execute(
        "SELECT * FROM restaurants WHERE id = %s AND pilot_city = %s AND status = 'active'",
        (restaurant_id, settings.pilot_city),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return row


def _seed_job_response(row: dict, reused: bool = False) -> RestaurantSeedJobResponse:
    return RestaurantSeedJobResponse(job=RestaurantSeedJob(**row), reused=reused)


def _raise_seed_error(exc: PlacesSeedError) -> None:
    status_code = status.HTTP_400_BAD_REQUEST
    if "MAPS_API_KEY" in str(exc):
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.get("", response_model=list[RestaurantSummary])
def list_restaurants(
    q: str | None = Query(None, description="Name search"),
    cuisine: str | None = Query(None, description="Filter by cuisine tag"),
) -> list[RestaurantSummary]:
    pilot = settings.pilot_city
    clauses = ["pilot_city = %s", "status = 'active'"]
    params: list[object] = [pilot]

    if q:
        clauses.append("name ILIKE %s")
        params.append(f"%{q}%")
    if cuisine:
        clauses.append("%s = ANY(cuisine_tags)")
        params.append(cuisine)

    sql = f"""
        SELECT id, name, address, lat, lng, cuisine_tags, pilot_city
        FROM restaurants
        WHERE {' AND '.join(clauses)}
        ORDER BY name
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_summary(row) for row in rows]


@router.get("/map", response_model=list[RestaurantMapEntry])
def list_restaurants_for_map(
    min_lat: float | None = Query(None, ge=-90, le=90),
    max_lat: float | None = Query(None, ge=-90, le=90),
    min_lng: float | None = Query(None, ge=-180, le=180),
    max_lng: float | None = Query(None, ge=-180, le=180),
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
) -> list[RestaurantMapEntry]:
    pilot = settings.pilot_city
    try:
        bbox_sql, bbox_params = build_bbox_filter(min_lat, max_lat, min_lng, max_lng)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    sql = MAP_SELECT + f"WHERE r.pilot_city = %s AND r.status = 'active'{bbox_sql}\nORDER BY r.name"
    params: list[object] = [pilot]
    params.extend(bbox_params)
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
        watched_ids = fetch_watched_ids(conn, user.firebase_uid) if user else set()
    return _map_entries_from_rows(rows, watched_ids)


@router.get("/search", response_model=list[RestaurantMapEntry])
def search_restaurants(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_m: int = Query(default=8000, description="Search radius in metres (500–25000)"),
    q: str | None = Query(None, description="Optional name filter (ILIKE)"),
    limit: int = Query(default=100, description="Max results (1–250)"),
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
) -> list[RestaurantMapEntry]:
    """Radius query returning RestaurantMapEntry rows sorted by distance ascending.

    Public — no auth required (read-only, no Google spend).
    """
    radius_m = max(500, min(radius_m, 25000))
    limit = max(1, min(limit, 250))
    pilot = settings.pilot_city

    where_clauses = [
        "r.pilot_city = %(pilot)s",
        "r.status = 'active'",
        f"{_HAVERSINE_EXPR} <= %(radius_m)s",
    ]
    params: dict = {"pilot": pilot, "lat": lat, "lng": lng, "radius_m": radius_m, "limit": limit}

    if q:
        where_clauses.append("r.name ILIKE %(q)s")
        params["q"] = f"%{q}%"

    where = " AND ".join(where_clauses)
    sql = (
        MAP_SELECT
        + f"WHERE {where}\n"
        + f"ORDER BY {_HAVERSINE_EXPR} ASC\n"
        + "LIMIT %(limit)s"
    )
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
        watched_ids = fetch_watched_ids(conn, user.firebase_uid) if user else set()
    return _map_entries_from_rows(rows, watched_ids)


@router.post(
    "/seed-jobs",
    response_model=RestaurantSeedJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_restaurant_seed_job(
    body: RestaurantSeedJobRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[AuthUser, Depends(require_admin)],
) -> RestaurantSeedJobResponse:
    try:
        area = resolve_seed_area(body.location, body.lat, body.lng, body.radius_m)
    except PlacesSeedError as exc:
        _raise_seed_error(exc)

    job, reused = create_seed_job(
        area,
        query=body.location.strip() if body.location else area.label,
        requested_by=user.firebase_uid,
        force=body.force,
    )
    # Re-enqueue even when reused: unsticks pending jobs whose original enqueue
    # was lost (run_seed_job's status guard makes duplicate delivery a no-op).
    if job["status"] == "pending":
        enqueue_seed_job(job["id"], background_tasks=background_tasks)
    return _seed_job_response(job, reused=reused)


@router.get("/seed-jobs/{job_id}", response_model=RestaurantSeedJobResponse)
def get_restaurant_seed_job(
    job_id: UUID,
    _user: Annotated[AuthUser, Depends(require_admin)],
) -> RestaurantSeedJobResponse:
    job = get_seed_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Seed job not found")
    return _seed_job_response(job)


@router.get("/{restaurant_id}", response_model=RestaurantDetailResponse)
def get_restaurant(
    restaurant_id: UUID,
    user: Annotated[AuthUser | None, Depends(get_optional_user)] = None,
) -> RestaurantDetailResponse:
    with get_conn() as conn:
        row = _ensure_restaurant(conn, restaurant_id)
        watched = False
        if user:
            watched = conn.execute(
                """
                SELECT 1 FROM restaurant_watches
                WHERE firebase_uid = %s AND restaurant_id = %s
                """,
                (user.firebase_uid, restaurant_id),
            ).fetchone() is not None
        return build_restaurant_detail_response(conn, row, restaurant_id, watched=watched)


@router.post("", response_model=RestaurantDetail, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    body: CreateRestaurantRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> RestaurantDetail:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO restaurants (
                name, address, lat, lng, google_place_id, google_maps_url,
                cuisine_tags, pilot_city
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                body.name,
                body.address,
                body.lat,
                body.lng,
                body.google_place_id,
                body.google_maps_url,
                body.cuisine_tags,
                settings.pilot_city,
            ),
        ).fetchone()
    return _row_to_detail(row)


@router.post(
    "/{restaurant_id}/ttf",
    response_model=TtfSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_ttf(
    restaurant_id: UUID,
    body: TtfSubmissionRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> TtfSubmissionResponse:
    served_at = body.served_at or datetime.now(timezone.utc)
    ordered_at = body.ordered_at or (
        served_at - timedelta(minutes=body.elapsed_minutes or 0)
    )

    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        row = conn.execute(
            """
            INSERT INTO ttf_observations (
                restaurant_id, firebase_uid, ordered_at, served_at, elapsed_minutes,
                item_type, item_quality, portion_size, daypart, party_size_kids,
                wait_context, photo_url
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, elapsed_minutes, item_type, item_quality
            """,
            (
                restaurant_id,
                user.firebase_uid,
                ordered_at,
                served_at,
                body.elapsed_minutes,
                body.item_type,
                body.item_quality,
                body.portion_size,
                body.daypart,
                body.party_size_kids,
                body.wait_context,
                body.photo_url,
            ),
        ).fetchone()
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="ttf",
            source_id=row["id"],
            actor_firebase_uid=user.firebase_uid,
        )
    return TtfSubmissionResponse(**row)


@router.get("/{restaurant_id}/ttf", response_model=TtfAggregate)
def get_ttf(restaurant_id: UUID) -> TtfAggregate:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        return _fetch_ttf_aggregate(conn, restaurant_id)


@router.post(
    "/{restaurant_id}/attributes",
    response_model=AttributeSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_attributes(
    restaurant_id: UUID,
    body: AttributeSubmissionRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> AttributeSubmissionResponse:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        metric = conn.execute(
            "SELECT key FROM metric_definitions WHERE key = %s",
            (body.metric_key,),
        ).fetchone()
        if not metric:
            raise HTTPException(status_code=400, detail=f"Unknown metric_key: {body.metric_key}")

        row = conn.execute(
            """
            INSERT INTO restaurant_attribute_ratings (
                restaurant_id, metric_key, firebase_uid, value, visit_context
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING id, metric_key
            """,
            (
                restaurant_id,
                body.metric_key,
                user.firebase_uid,
                Jsonb(body.value),
                body.visit_context,
            ),
        ).fetchone()
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="attribute",
            source_id=row["id"],
            actor_firebase_uid=user.firebase_uid,
        )
    return AttributeSubmissionResponse(**row)


@router.get("/{restaurant_id}/attributes")
def get_attributes(restaurant_id: UUID) -> dict:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        return build_attribute_aggregates(conn, restaurant_id)


@router.post(
    "/{restaurant_id}/notes",
    response_model=NoteSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_note(
    restaurant_id: UUID,
    body: NoteSubmissionRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> NoteSubmissionResponse:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        row = conn.execute(
            """
            INSERT INTO restaurant_notes (restaurant_id, firebase_uid, text, tags)
            VALUES (%s, %s, %s, %s)
            RETURNING id, text, tags, created_at
            """,
            (restaurant_id, user.firebase_uid, body.text, body.tags),
        ).fetchone()
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="note",
            source_id=row["id"],
            actor_firebase_uid=user.firebase_uid,
        )
    return NoteSubmissionResponse(
        id=row["id"],
        text=row["text"],
        tags=row["tags"] or [],
        created_at=row["created_at"],
    )


@router.get("/{restaurant_id}/notes")
def list_notes(restaurant_id: UUID) -> dict:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        rows = conn.execute(
            """
            SELECT id, text, tags, created_at
            FROM restaurant_notes
            WHERE restaurant_id = %s
            ORDER BY created_at DESC
            """,
            (restaurant_id,),
        ).fetchall()
    return {"notes": rows}
