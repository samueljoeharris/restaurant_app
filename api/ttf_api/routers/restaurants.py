from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.schemas import (
    RestaurantDetail,
    RestaurantDetailResponse,
    RestaurantSummary,
    TtfAggregate,
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


@router.get("", response_model=list[RestaurantSummary])
def list_restaurants(
    q: str | None = Query(None, description="Name search"),
    cuisine: str | None = Query(None, description="Filter by cuisine tag"),
) -> list[RestaurantSummary]:
    pilot = settings.pilot_city
    clauses = ["pilot_city = %s"]
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


@router.get("/{restaurant_id}", response_model=RestaurantDetailResponse)
def get_restaurant(restaurant_id: UUID) -> RestaurantDetailResponse:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM restaurants
            WHERE id = %s AND pilot_city = %s
            """,
            (restaurant_id, settings.pilot_city),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        ttf = _fetch_ttf_aggregate(conn, restaurant_id)
    return RestaurantDetailResponse(restaurant=_row_to_detail(row), ttf=ttf)


@router.post("", status_code=501)
def create_restaurant() -> None:
    raise HTTPException(
        status_code=501,
        detail="Firebase Auth required — implement in Phase 3",
    )


@router.post("/{restaurant_id}/ttf", status_code=501)
def submit_ttf(restaurant_id: UUID) -> None:
    raise HTTPException(status_code=501, detail="Firebase Auth required — implement in Phase 3")


@router.get("/{restaurant_id}/ttf")
def get_ttf(restaurant_id: UUID) -> TtfAggregate:
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM restaurants WHERE id = %s AND pilot_city = %s",
            (restaurant_id, settings.pilot_city),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        return _fetch_ttf_aggregate(conn, restaurant_id)


@router.post("/{restaurant_id}/attributes", status_code=501)
def submit_attributes(restaurant_id: UUID) -> None:
    raise HTTPException(status_code=501, detail="Firebase Auth required — implement in Phase 3")


@router.get("/{restaurant_id}/attributes")
def get_attributes(restaurant_id: UUID) -> dict:
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM restaurants WHERE id = %s AND pilot_city = %s",
            (restaurant_id, settings.pilot_city),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Restaurant not found")
    return {"attributes": {}, "message": "Aggregates coming soon"}


@router.post("/{restaurant_id}/notes", status_code=501)
def submit_note(restaurant_id: UUID) -> None:
    raise HTTPException(status_code=501, detail="Firebase Auth required — implement in Phase 3")


@router.get("/{restaurant_id}/notes")
def list_notes(restaurant_id: UUID) -> dict:
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM restaurants WHERE id = %s AND pilot_city = %s",
            (restaurant_id, settings.pilot_city),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Restaurant not found")
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
