"""Google Places-backed restaurant seeding and refresh helpers."""

from __future__ import annotations

from dataclasses import dataclass
import math
import time
from uuid import UUID

import httpx
from psycopg import Connection

from ttf_api.config import settings
from ttf_api.restaurant_changelog import log_change

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,"
    "places.types,places.googleMapsUri,places.businessStatus,nextPageToken"
)

GENERIC_TYPES = frozenset(
    {
        "restaurant",
        "food",
        "point_of_interest",
        "establishment",
        "meal_takeaway",
        "meal_delivery",
        "store",
    }
)

HIDDEN_STATUSES = frozenset({"closed", "outside_area", "tombstoned"})


class PlacesSeedError(RuntimeError):
    """Raised when Google Maps/Places seeding cannot complete."""


@dataclass(frozen=True)
class SeedArea:
    lat: float
    lng: float
    radius_m: int
    label: str

    @property
    def area_key(self) -> str:
        # Rounding dedupes nearby taps/ZIP geocodes without requiring PostGIS/geohash.
        return f"{round(self.lat, 3)}:{round(self.lng, 3)}:{self.radius_m}"


@dataclass(frozen=True)
class SeedResult:
    inserted: int = 0
    updated: int = 0
    closed: int = 0
    outside_area: int = 0
    tombstoned: int = 0
    reactivated: int = 0
    skipped: int = 0
    out_of_area: int = 0
    unique_places: int = 0


def default_seed_area() -> SeedArea:
    return SeedArea(
        lat=settings.restaurant_seed_default_lat,
        lng=settings.restaurant_seed_default_lng,
        radius_m=settings.restaurant_seed_default_radius_m,
        label=settings.pilot_display_name,
    )


def distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in meters."""
    radius = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def within_area(area: SeedArea, lat: float, lng: float) -> bool:
    return distance_meters(area.lat, area.lng, lat, lng) <= area.radius_m


def require_maps_api_key() -> str:
    api_key = settings.maps_api_key.strip()
    if not api_key:
        raise PlacesSeedError("MAPS_API_KEY is required for restaurant seeding")
    return api_key


def geocode_location(
    client: httpx.Client,
    api_key: str,
    query: str,
    radius_m: int,
) -> SeedArea:
    resp = client.get(
        GEOCODE_URL,
        params={"address": query, "region": "us", "key": api_key},
        timeout=20.0,
    )
    if resp.status_code != 200:
        raise PlacesSeedError(f"Geocoding API error {resp.status_code}: {resp.text}")

    data = resp.json()
    if data.get("status") != "OK" or not data.get("results"):
        detail = data.get("error_message") or data.get("status") or "no results"
        raise PlacesSeedError(f"Could not geocode location: {detail}")

    result = data["results"][0]
    loc = result.get("geometry", {}).get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")
    if lat is None or lng is None:
        raise PlacesSeedError("Geocoding result did not include coordinates")

    return SeedArea(
        lat=float(lat),
        lng=float(lng),
        radius_m=radius_m,
        label=result.get("formatted_address") or query,
    )


def search_queries_for_area(area: SeedArea, refresh: bool = False) -> list[str]:
    if refresh and settings.restaurant_seed_refresh_queries:
        return settings.restaurant_seed_refresh_queries
    label = area.label
    return [
        f"restaurants near {label}",
        f"family restaurants near {label}",
        f"pizza near {label}",
        f"breakfast near {label}",
    ]


def search_places(
    client: httpx.Client,
    api_key: str,
    area: SeedArea,
    text_query: str,
) -> list[dict]:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    base_body = {
        "textQuery": text_query,
        "languageCode": "en",
        "locationBias": {
            "circle": {
                "center": {"latitude": area.lat, "longitude": area.lng},
                "radius": float(area.radius_m),
            }
        },
    }

    results: list[dict] = []
    page_token: str | None = None
    while True:
        body = {**base_body, **({"pageToken": page_token} if page_token else {})}
        resp = client.post(PLACES_URL, headers=headers, json=body, timeout=30.0)
        if resp.status_code != 200:
            raise PlacesSeedError(f"Places API error {resp.status_code}: {resp.text}")

        data = resp.json()
        results.extend(data.get("places", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.3)

    return results


def types_to_cuisine_tags(types: list[str]) -> list[str]:
    tags: list[str] = []
    for raw in types:
        if raw in GENERIC_TYPES:
            continue
        if raw.endswith("_restaurant"):
            tag = raw[: -len("_restaurant")].replace("_", " ")
        else:
            tag = raw.replace("_", " ")
        if tag and tag not in tags:
            tags.append(tag)
    return tags or ["restaurant"]


def place_status(place: dict) -> str:
    business_status = place.get("businessStatus")
    if business_status in {"CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"}:
        return "closed"
    return "active"


def normalize_place(place: dict, area: SeedArea, pilot_city: str) -> dict | None:
    place_id = place.get("id")
    name = (place.get("displayName") or {}).get("text")
    address = place.get("formattedAddress")
    loc = place.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")

    if not place_id or not name or not address or lat is None or lng is None:
        return None

    lat_f, lng_f = float(lat), float(lng)
    if not within_area(area, lat_f, lng_f):
        return None

    return {
        "google_place_id": place_id,
        "name": name.strip(),
        "address": address.strip(),
        "lat": lat_f,
        "lng": lng_f,
        "google_maps_url": place.get("googleMapsUri"),
        "cuisine_tags": types_to_cuisine_tags(place.get("types") or []),
        "pilot_city": pilot_city,
        "status": place_status(place),
    }


def normalize_nearby_place(place: dict, pilot_city: str) -> dict | None:
    place_id = place.get("id")
    name = (place.get("displayName") or {}).get("text")
    address = place.get("formattedAddress")
    loc = place.get("location") or {}
    lat, lng = loc.get("latitude"), loc.get("longitude")
    if not place_id or not name or not address or lat is None or lng is None:
        return None
    return {"google_place_id": place_id, "name": name.strip(), "address": address.strip(),
            "lat": float(lat), "lng": float(lng), "google_maps_url": place.get("googleMapsUri"),
            "cuisine_tags": types_to_cuisine_tags(place.get("types") or []), "pilot_city": pilot_city,
            "status": place_status(place)}

def _field_changes(existing: dict, row: dict) -> dict | None:
    changes: dict[str, dict[str, object]] = {}
    for field in ("name", "address", "lat", "lng", "status"):
        old = existing.get(field)
        new = row.get(field)
        if old != new:
            changes[field] = {"from": old, "to": new}
    return changes or None


def upsert_restaurant(
    conn: Connection,
    row: dict,
    *,
    seed_job_id: UUID | None = None,
) -> str:
    existing = conn.execute(
        """
        SELECT id, name, address, lat, lng, status, google_place_id
        FROM restaurants
        WHERE google_place_id = %s
        """,
        (row["google_place_id"],),
    ).fetchone()

    if existing:
        prev_status = existing["status"]
        new_status = row["status"]
        changes = _field_changes(existing, row)

        conn.execute(
            """
            UPDATE restaurants
            SET name = %s, address = %s, lat = %s, lng = %s,
                google_maps_url = %s, cuisine_tags = %s, status = %s,
                last_places_sync_at = now(), last_seen_in_places_at = now(),
                tombstoned_at = NULL, tombstone_reason = NULL,
                updated_at = now()
            WHERE google_place_id = %s
            """,
            (
                row["name"],
                row["address"],
                row["lat"],
                row["lng"],
                row["google_maps_url"],
                row["cuisine_tags"],
                new_status,
                row["google_place_id"],
            ),
        )

        if prev_status in HIDDEN_STATUSES and new_status == "active":
            log_change(
                conn,
                restaurant_id=existing["id"],
                google_place_id=row["google_place_id"],
                restaurant_name=row["name"],
                action="reactivated",
                previous_status=prev_status,
                new_status=new_status,
                reason="seen_in_places_sync",
                seed_job_id=seed_job_id,
                changed_fields=changes,
            )
            return "reactivated"

        if new_status == "closed" and prev_status != "closed":
            log_change(
                conn,
                restaurant_id=existing["id"],
                google_place_id=row["google_place_id"],
                restaurant_name=row["name"],
                action="closed",
                previous_status=prev_status,
                new_status=new_status,
                reason="google_places_closed",
                seed_job_id=seed_job_id,
            )
            return "closed"

        if changes:
            log_change(
                conn,
                restaurant_id=existing["id"],
                google_place_id=row["google_place_id"],
                restaurant_name=row["name"],
                action="updated",
                previous_status=prev_status,
                new_status=new_status,
                seed_job_id=seed_job_id,
                changed_fields=changes,
            )
            return "updated"

        return "updated"

    inserted = conn.execute(
        """
        INSERT INTO restaurants (
            name, address, lat, lng, google_place_id, google_maps_url,
            cuisine_tags, pilot_city, status, last_places_sync_at,
            last_seen_in_places_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
        RETURNING id
        """,
        (
            row["name"],
            row["address"],
            row["lat"],
            row["lng"],
            row["google_place_id"],
            row["google_maps_url"],
            row["cuisine_tags"],
            row["pilot_city"],
            row["status"],
        ),
    ).fetchone()

    action = "closed" if row["status"] == "closed" else "added"
    log_change(
        conn,
        restaurant_id=inserted["id"],
        google_place_id=row["google_place_id"],
        restaurant_name=row["name"],
        action=action,
        new_status=row["status"],
        reason="google_places_closed" if action == "closed" else None,
        seed_job_id=seed_job_id,
    )
    return "inserted" if action == "added" else "closed"


def tombstone_restaurant(
    conn: Connection,
    restaurant_id: UUID,
    *,
    reason: str,
    new_status: str = "tombstoned",
    seed_job_id: UUID | None = None,
) -> bool:
    row = conn.execute(
        "SELECT id, name, google_place_id, status FROM restaurants WHERE id = %s",
        (restaurant_id,),
    ).fetchone()
    if not row or row["status"] == new_status:
        return False

    conn.execute(
        """
        UPDATE restaurants
        SET status = %s,
            tombstoned_at = now(),
            tombstone_reason = %s,
            last_places_sync_at = now(),
            updated_at = now()
        WHERE id = %s
        """,
        (new_status, reason, restaurant_id),
    )
    log_change(
        conn,
        restaurant_id=row["id"],
        google_place_id=row["google_place_id"],
        restaurant_name=row["name"],
        action="tombstoned" if new_status == "tombstoned" else "outside_area",
        previous_status=row["status"],
        new_status=new_status,
        reason=reason,
        seed_job_id=seed_job_id,
    )
    return True


def mark_not_seen_in_sync(
    conn: Connection,
    area: SeedArea,
    pilot_city: str,
    seen_place_ids: set[str],
    *,
    seed_job_id: UUID | None = None,
) -> int:
    """Tombstone active venues in the seed area that were absent from Places results."""
    rows = conn.execute(
        """
        SELECT id, google_place_id, lat, lng
        FROM restaurants
        WHERE pilot_city = %s
          AND status = 'active'
          AND google_place_id IS NOT NULL
        """,
        (pilot_city,),
    ).fetchall()

    marked = 0
    for row in rows:
        place_id = row["google_place_id"]
        if place_id in seen_place_ids:
            continue
        if not within_area(area, row["lat"], row["lng"]):
            continue
        if tombstone_restaurant(
            conn,
            row["id"],
            reason="not_seen_in_places_sync",
            seed_job_id=seed_job_id,
        ):
            marked += 1
    return marked


def seed_restaurants_for_area(
    conn: Connection,
    client: httpx.Client,
    api_key: str,
    area: SeedArea,
    pilot_city: str,
    queries: list[str] | None = None,
    tombstone_not_seen: bool = False,
    seed_job_id: UUID | None = None,
) -> SeedResult:
    seen: set[str] = set()
    inserted = updated = closed = reactivated = skipped = out_of_area = 0

    for query in queries or search_queries_for_area(area):
        places = search_places(client, api_key, area, query)
        time.sleep(0.2)

        for place in places:
            row = normalize_place(place, area, pilot_city)
            if not row:
                loc = place.get("location") or {}
                if loc.get("latitude") is not None:
                    out_of_area += 1
                else:
                    skipped += 1
                continue

            place_id = row["google_place_id"]
            if place_id in seen:
                continue
            seen.add(place_id)

            action = upsert_restaurant(conn, row, seed_job_id=seed_job_id)
            if action == "inserted":
                inserted += 1
            elif action == "closed":
                closed += 1
            elif action == "reactivated":
                reactivated += 1
            else:
                updated += 1

    tombstoned = (
        mark_not_seen_in_sync(conn, area, pilot_city, seen, seed_job_id=seed_job_id)
        if tombstone_not_seen
        else 0
    )

    return SeedResult(
        inserted=inserted,
        updated=updated,
        closed=closed,
        tombstoned=tombstoned,
        reactivated=reactivated,
        skipped=skipped,
        out_of_area=out_of_area,
        unique_places=len(seen),
    )


PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places"
DETAILS_FIELD_MASK = (
    "id,displayName,formattedAddress,location,types,googleMapsUri,businessStatus"
)


def fetch_place_details(
    client: httpx.Client,
    api_key: str,
    place_id: str,
) -> dict | None:
    """Fetch Place Details for one place id. Returns None when the place is gone."""
    resp = client.get(
        f"{PLACE_DETAILS_URL}/{place_id}",
        headers={
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
        timeout=20.0,
    )
    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        raise PlacesSeedError(f"Place Details API error {resp.status_code}: {resp.text}")
    return resp.json()


def ensure_restaurant_for_place(conn: Connection, place_id: str, api_key: str) -> UUID:
    existing = conn.execute("SELECT id, status FROM restaurants WHERE google_place_id = %s AND pilot_city = %s", (place_id, settings.pilot_city)).fetchone()
    if existing:
        if existing["status"] != "active":
            raise PlacesSeedError(f"Restaurant for place {place_id} is not active")
        return existing["id"]
    with httpx.Client() as client:
        place = fetch_place_details(client, api_key, place_id)
    if place is None:
        raise PlacesSeedError(f"Place not found: {place_id}")
    row = normalize_nearby_place(place, settings.pilot_city)
    if not row or row["status"] != "active":
        raise PlacesSeedError(f"Place unavailable: {place_id}")
    upsert_restaurant(conn, row)
    created = conn.execute("SELECT id FROM restaurants WHERE google_place_id = %s AND pilot_city = %s", (place_id, settings.pilot_city)).fetchone()
    if not created:
        raise PlacesSeedError(f"Failed to materialize place: {place_id}")
    return created["id"]

def _normalize_place_details(place: dict, pilot_city: str) -> dict | None:
    return normalize_nearby_place(place, pilot_city)



def refresh_catalog(
    conn: Connection,
    client: httpx.Client,
    api_key: str,
    pilot_city: str,
    *,
    seed_job_id: UUID | None = None,
) -> SeedResult:
    """Refresh every known restaurant via Place Details, regardless of seed zone.

    Covers venues whose seed location was removed or that sit outside every
    requested area. Vanished place ids are tombstoned; reopened/closed status
    flows through the normal upsert + changelog path.
    """
    rows = conn.execute(
        """
        SELECT id, google_place_id
        FROM restaurants
        WHERE pilot_city = %s
          AND google_place_id IS NOT NULL
          AND status IN ('active', 'closed', 'outside_area')
        ORDER BY last_places_sync_at ASC NULLS FIRST
        """,
        (pilot_city,),
    ).fetchall()

    updated = closed = reactivated = tombstoned = skipped = 0
    for row in rows:
        place = fetch_place_details(client, api_key, row["google_place_id"])
        time.sleep(0.05)

        if place is None:
            if tombstone_restaurant(
                conn,
                row["id"],
                reason="place_no_longer_exists",
                seed_job_id=seed_job_id,
            ):
                tombstoned += 1
            continue

        normalized = _normalize_place_details(place, pilot_city)
        if not normalized:
            skipped += 1
            continue

        action = upsert_restaurant(conn, normalized, seed_job_id=seed_job_id)
        if action == "closed":
            closed += 1
        elif action == "reactivated":
            reactivated += 1
        else:
            updated += 1

    return SeedResult(
        updated=updated,
        closed=closed,
        tombstoned=tombstoned,
        reactivated=reactivated,
        skipped=skipped,
        unique_places=len(rows),
    )
