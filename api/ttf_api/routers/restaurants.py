from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from ttf_api.ugc_write import insert_attribute_rating, insert_note, insert_ttf_observation

from ttf_api.aggregates import build_attribute_aggregates
from ttf_api.auth import AuthUser, get_current_user, get_optional_user
from ttf_api.security import require_trusted_or_admin, require_write_access
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.map_query import build_bbox_filter
from ttf_api.map_entries import MAP_SELECT, apply_watched_flags, row_to_map_entry
from ttf_api.recommendations import recommendation_for_restaurant
from ttf_api.user_profiles import ensure_user_profile, fetch_watched_ids
from ttf_api.ugc_sql import PUBLIC_NOTE_FILTER, TTF_AGGREGATE_FILTER
from ttf_api.schemas import (
    AttributeSubmissionRequest,
    AttributeSubmissionResponse,
    ContributionRecency,
    CreateRestaurantRequest,
    NoteSubmissionRequest,
    NoteSubmissionResponse,
    Recommendation,
    RecommendationResponse,
    RestaurantDetail,
    RestaurantDetailResponse,
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
        f"""
        SELECT
            COUNT(*)::int AS sample_size,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes) AS median_minutes,
            AVG(item_quality)::float AS avg_quality,
            MAX(created_at) AS last_updated
        FROM ttf_observations
        WHERE restaurant_id = %s AND {TTF_AGGREGATE_FILTER}
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


@router.get("/recommendations", response_model=RecommendationResponse)
def get_recommendations(
    user: Annotated[AuthUser, Depends(get_current_user)],
    lat: float = Query(..., ge=-90, le=90, description="Center latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Center longitude"),
    radius_m: int = Query(default=8000, ge=500, le=25000, description="Search radius in metres"),
    limit: int = Query(default=3, ge=1, le=10, description="Total results (primary + alternates)"),
) -> RecommendationResponse:
    """Family-fit ranker v1: top pick + alternates for a lat/lng + profile."""
    radius_m = max(500, min(radius_m, 25000))
    limit = max(1, min(limit, 10))
    pilot = settings.pilot_city

    where_clauses = [
        "r.pilot_city = %(pilot)s",
        "r.status = 'active'",
        f"{_HAVERSINE_EXPR} <= %(radius_m)s",
    ]
    params: dict = {"pilot": pilot, "lat": lat, "lng": lng, "radius_m": radius_m}

    where = " AND ".join(where_clauses)
    sql = (
        MAP_SELECT
        + f"WHERE {where}\n"
        + f"ORDER BY {_HAVERSINE_EXPR} ASC\n"
        + "LIMIT 100"
    )

    with get_conn() as conn:
        profile = ensure_user_profile(conn, user.firebase_uid)
        rows = conn.execute(sql, params).fetchall()
        watched_ids = fetch_watched_ids(conn, user.firebase_uid)

        scored: list[Recommendation] = []
        for row in rows:
            score, _reasons, why = recommendation_for_restaurant(
                conn, row, profile, lat, lng, float(radius_m)
            )
            entry = row_to_map_entry(row, watched=row["id"] in watched_ids)
            scored.append(Recommendation(restaurant=entry, score=score, why=why))

    scored.sort(key=lambda r: r.score, reverse=True)
    primary = scored[0] if scored else None
    alternates = scored[1:limit]
    return RecommendationResponse(primary=primary, alternates=alternates)


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
    user: Annotated[AuthUser, Depends(require_trusted_or_admin)],
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
                str(body.google_maps_url) if body.google_maps_url else None,
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
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        response, _result = insert_ttf_observation(
            conn,
            restaurant_id=restaurant_id,
            firebase_uid=user.firebase_uid,
            body=body,
        )
    return response


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

        response, _result = insert_attribute_rating(
            conn,
            restaurant_id=restaurant_id,
            firebase_uid=user.firebase_uid,
            body=body,
        )
    return response


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
        response, _result = insert_note(
            conn,
            restaurant_id=restaurant_id,
            firebase_uid=user.firebase_uid,
            body=body,
        )
    return response


@router.get("/{restaurant_id}/notes")
def list_notes(restaurant_id: UUID) -> dict:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        rows = conn.execute(
            f"""
            SELECT id, text, tags, created_at
            FROM restaurant_notes
            WHERE restaurant_id = %s AND {PUBLIC_NOTE_FILTER}
            ORDER BY created_at DESC
            """,
            (restaurant_id,),
        ).fetchall()
    return {"notes": rows}
