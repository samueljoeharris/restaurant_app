"""Shared map-entry SQL and row mapping."""

from __future__ import annotations

from uuid import UUID

from ttf_api.schemas import RestaurantMapEntry, TtfAggregate
from ttf_api.ugc_sql import (
    PUBLIC_ATTRIBUTE_COUNT_SUBQUERY,
    PUBLIC_NOTE_COUNT_SUBQUERY,
    TTF_AGGREGATE_SUBQUERY,
)

_MAP_JOINS = f"""
    LEFT JOIN ({TTF_AGGREGATE_SUBQUERY}) t ON r.id = t.restaurant_id
    LEFT JOIN ({PUBLIC_NOTE_COUNT_SUBQUERY}) n ON n.restaurant_id = r.id
    LEFT JOIN ({PUBLIC_ATTRIBUTE_COUNT_SUBQUERY}) a ON a.restaurant_id = r.id
"""

MAP_SELECT = f"""
    SELECT
        r.id, r.name, r.address, r.lat, r.lng, r.cuisine_tags, r.pilot_city,
        r.google_place_id, r.google_maps_url,
        COALESCE(t.sample_size, 0)::int AS sample_size,
        t.median_minutes, t.avg_quality, t.last_updated,
        COALESCE(n.note_count, 0)::int AS note_count,
        COALESCE(a.attribute_rating_count, 0)::int AS attribute_rating_count
    FROM restaurants r
    {_MAP_JOINS}
"""

WATCH_MAP_SELECT = f"""
    SELECT
        r.id, r.name, r.address, r.lat, r.lng, r.cuisine_tags, r.pilot_city,
        r.google_place_id, r.google_maps_url,
        COALESCE(t.sample_size, 0)::int AS sample_size,
        t.median_minutes, t.avg_quality, t.last_updated,
        COALESCE(n.note_count, 0)::int AS note_count,
        COALESCE(a.attribute_rating_count, 0)::int AS attribute_rating_count,
        w.created_at AS watched_at
    FROM restaurant_watches w
    JOIN restaurants r ON r.id = w.restaurant_id
    {_MAP_JOINS}
"""


def row_to_map_entry(row: dict, *, watched: bool = False) -> RestaurantMapEntry:
    ttf = TtfAggregate() if row["sample_size"] == 0 else TtfAggregate(
        sample_size=row["sample_size"],
        median_minutes=float(row["median_minutes"]) if row["median_minutes"] is not None else None,
        avg_quality=float(row["avg_quality"]) if row["avg_quality"] is not None else None,
        last_updated=row["last_updated"],
    )
    return RestaurantMapEntry(
        id=row["id"],
        google_place_id=row.get("google_place_id"),
        name=row["name"],
        address=row["address"],
        lat=row["lat"],
        lng=row["lng"],
        cuisine_tags=row["cuisine_tags"] or [],
        pilot_city=row["pilot_city"],
        google_maps_url=row.get("google_maps_url"),
        ttf=ttf,
        note_count=row["note_count"],
        attribute_rating_count=row["attribute_rating_count"],
        watched=watched,
    )


def apply_watched_flags(
    entries: list[RestaurantMapEntry],
    watched_ids: set[UUID],
) -> list[RestaurantMapEntry]:
    if not watched_ids:
        return entries
    return [
        entry.model_copy(update={"watched": entry.id in watched_ids if entry.id else False})
        for entry in entries
    ]


def fetch_rated_by_place_ids(conn, place_ids: list[str], pilot_city: str) -> dict[str, RestaurantMapEntry]:
    if not place_ids:
        return {}
    rows = conn.execute(
        MAP_SELECT + " WHERE r.pilot_city = %s AND r.status = 'active' AND r.google_place_id = ANY(%s)",
        (pilot_city, place_ids),
    ).fetchall()
    return {row["google_place_id"]: row_to_map_entry(row) for row in rows if row.get("google_place_id")}
