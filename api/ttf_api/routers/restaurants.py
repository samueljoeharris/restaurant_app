from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from psycopg.types.json import Jsonb

from ttf_api.aggregates import build_attribute_aggregates
from ttf_api.auth import AuthUser, require_admin
from ttf_api.security import require_write_access
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.places_seed import PlacesSeedError
from ttf_api.pubsub_seed import enqueue_seed_job
from ttf_api.seed_jobs import create_seed_job, get_seed_job, resolve_seed_area
from ttf_api.schemas import (
    AttributeSubmissionRequest,
    AttributeSubmissionResponse,
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

router = APIRouter(prefix="/v1/restaurants", tags=["restaurants"])


def _row_to_summary(row: dict) -> RestaurantSummary:
    return RestaurantSummary(
        id=row["id"],
        name=row["name"],
        address=row["address"],
        lat=row["lat"],
        lng=row["lng"],
        cuisine_tags=row["cuisine_tags"] or [],
        pilot_city=row["pilot_city"],
    )


def _row_to_detail(row: dict) -> RestaurantDetail:
    return RestaurantDetail(
        **_row_to_summary(row).model_dump(),
        google_place_id=row.get("google_place_id"),
        google_maps_url=row.get("google_maps_url"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
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
def list_restaurants_for_map() -> list[RestaurantMapEntry]:
    pilot = settings.pilot_city
    sql = """
        SELECT
            r.id, r.name, r.address, r.lat, r.lng, r.cuisine_tags, r.pilot_city,
            COALESCE(t.sample_size, 0)::int AS sample_size,
            t.median_minutes,
            t.avg_quality,
            t.last_updated,
            COALESCE(n.note_count, 0)::int AS note_count,
            COALESCE(a.attribute_rating_count, 0)::int AS attribute_rating_count
        FROM restaurants r
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::int AS sample_size,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes) AS median_minutes,
                AVG(item_quality)::float AS avg_quality,
                MAX(created_at) AS last_updated
            FROM ttf_observations
            WHERE restaurant_id = r.id
        ) t ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS note_count
            FROM restaurant_notes
            WHERE restaurant_id = r.id
        ) n ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS attribute_rating_count
            FROM restaurant_attribute_ratings
            WHERE restaurant_id = r.id
        ) a ON true
        WHERE r.pilot_city = %s AND r.status = 'active'
        ORDER BY r.name
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (pilot,)).fetchall()

    results: list[RestaurantMapEntry] = []
    for row in rows:
        summary = _row_to_summary(row)
        if row["sample_size"] == 0:
            ttf = TtfAggregate()
        else:
            ttf = TtfAggregate(
                sample_size=row["sample_size"],
                median_minutes=float(row["median_minutes"])
                if row["median_minutes"] is not None
                else None,
                avg_quality=float(row["avg_quality"])
                if row["avg_quality"] is not None
                else None,
                last_updated=row["last_updated"],
            )
        results.append(
            RestaurantMapEntry(
                **summary.model_dump(),
                ttf=ttf,
                note_count=row["note_count"],
                attribute_rating_count=row["attribute_rating_count"],
            )
        )
    return results


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
def get_restaurant(restaurant_id: UUID) -> RestaurantDetailResponse:
    with get_conn() as conn:
        row = _ensure_restaurant(conn, restaurant_id)
        ttf = _fetch_ttf_aggregate(conn, restaurant_id)
    return RestaurantDetailResponse(restaurant=_row_to_detail(row), ttf=ttf)


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
