"""Merge Google Nearby Search results with rated SQL rows."""
from ttf_api.config import settings
from ttf_api.map_entries import fetch_rated_by_place_ids
from ttf_api.places_seed import normalize_nearby_place, place_status
from ttf_api.schemas import RestaurantMapEntry, TtfAggregate

def merge_nearby_places(conn, google_places: list[dict], *, pilot_city: str | None = None) -> list[RestaurantMapEntry]:
    pilot = pilot_city or settings.pilot_city
    normalized, place_ids = [], []
    for place in google_places:
        if place_status(place) != "active":
            continue
        row = normalize_nearby_place(place, pilot)
        if not row:
            continue
        normalized.append(row)
        place_ids.append(row["google_place_id"])
    rated = fetch_rated_by_place_ids(conn, place_ids, pilot)
    entries: list[RestaurantMapEntry] = []
    for row in normalized:
        pid = row["google_place_id"]
        if pid in rated:
            entries.append(rated[pid])
        else:
            entries.append(RestaurantMapEntry(
                id=None, google_place_id=pid, name=row["name"], address=row["address"],
                lat=row["lat"], lng=row["lng"], cuisine_tags=row["cuisine_tags"], pilot_city=pilot,
                ttf=TtfAggregate(), note_count=0, attribute_rating_count=0,
            ))
    return entries

def map_entry_from_place_details(place: dict, conn, pilot_city: str | None = None) -> RestaurantMapEntry | None:
    pilot = pilot_city or settings.pilot_city
    row = normalize_nearby_place(place, pilot)
    if not row:
        return None
    rated = fetch_rated_by_place_ids(conn, [row["google_place_id"]], pilot)
    if row["google_place_id"] in rated:
        return rated[row["google_place_id"]]
    return RestaurantMapEntry(
        id=None, google_place_id=row["google_place_id"], name=row["name"], address=row["address"],
        lat=row["lat"], lng=row["lng"], cuisine_tags=row["cuisine_tags"], pilot_city=pilot,
        ttf=TtfAggregate(), note_count=0, attribute_rating_count=0,
    )
