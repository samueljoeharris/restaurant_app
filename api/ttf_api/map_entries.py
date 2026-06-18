"""Shared map-entry SQL and row mapping."""

from __future__ import annotations
from uuid import UUID
from ttf_api.schemas import RestaurantMapEntry, TtfAggregate

MAP_SELECT = """
    SELECT
        r.id, r.name, r.address, r.lat, r.lng, r.cuisine_tags, r.pilot_city,
        r.google_place_id, r.google_maps_url,
        COALESCE(t.sample_size, 0)::int AS sample_size,
        t.median_minutes, t.avg_quality, t.last_updated,
        COALESCE(n.note_count, 0)::int AS note_count,
        COALESCE(a.attribute_rating_count, 0)::int AS attribute_rating_count
    FROM restaurants r
    LEFT JOIN (
        SELECT restaurant_id, COUNT(*)::int AS sample_size,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes) AS median_minutes,
            AVG(item_quality)::float AS avg_quality, MAX(created_at) AS last_updated
        FROM ttf_observations GROUP BY restaurant_id
    ) t ON r.id = t.restaurant_id
    LEFT JOIN (SELECT restaurant_id, COUNT(*)::int AS note_count FROM restaurant_notes GROUP BY restaurant_id) n ON n.restaurant_id = r.id
    LEFT JOIN (SELECT restaurant_id, COUNT(*)::int AS attribute_rating_count FROM restaurant_attribute_ratings GROUP BY restaurant_id) a ON a.restaurant_id = r.id
"""

def row_to_map_entry(row: dict) -> RestaurantMapEntry:
    ttf = TtfAggregate() if row["sample_size"] == 0 else TtfAggregate(
        sample_size=row["sample_size"],
        median_minutes=float(row["median_minutes"]) if row["median_minutes"] is not None else None,
        avg_quality=float(row["avg_quality"]) if row["avg_quality"] is not None else None,
        last_updated=row["last_updated"],
    )
    return RestaurantMapEntry(
        id=row["id"], google_place_id=row.get("google_place_id"),
        name=row["name"], address=row["address"], lat=row["lat"], lng=row["lng"],
        cuisine_tags=row["cuisine_tags"] or [], pilot_city=row["pilot_city"],
        google_maps_url=row.get("google_maps_url"),
        ttf=ttf, note_count=row["note_count"], attribute_rating_count=row["attribute_rating_count"],
    )

def fetch_rated_by_place_ids(conn, place_ids: list[str], pilot_city: str) -> dict[str, RestaurantMapEntry]:
    if not place_ids:
        return {}
    rows = conn.execute(MAP_SELECT + "WHERE r.pilot_city = %s AND r.status = 'active' AND r.google_place_id = ANY(%s)", (pilot_city, place_ids)).fetchall()
    return {row["google_place_id"]: row_to_map_entry(row) for row in rows if row.get("google_place_id")}
