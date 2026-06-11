"""Google Places-backed restaurant seeding and refresh helpers."""

from __future__ import annotations

from dataclasses import dataclass
import math
import time

import httpx
from psycopg import Connection

from ttf_api.config import settings

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


def upsert_restaurant(conn: Connection, row: dict) -> str:
    existing = conn.execute(
        "SELECT id FROM restaurants WHERE google_place_id = %s",
        (row["google_place_id"],),
    ).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE restaurants
            SET name = %s, address = %s, lat = %s, lng = %s,
                google_maps_url = %s, cuisine_tags = %s, status = %s,
                last_places_sync_at = now(), last_seen_in_places_at = now(),
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
                row["status"],
                row["google_place_id"],
            ),
        )
        return "closed" if row["status"] == "closed" else "updated"

    conn.execute(
        """
        INSERT INTO restaurants (
            name, address, lat, lng, google_place_id, google_maps_url,
            cuisine_tags, pilot_city, status, last_places_sync_at,
            last_seen_in_places_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
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
    )
    return "closed" if row["status"] == "closed" else "inserted"


def mark_outside_area(conn: Connection, area: SeedArea, pilot_city: str) -> int:
    rows = conn.execute(
        """
        SELECT id, lat, lng
        FROM restaurants
        WHERE pilot_city = %s AND status = 'active'
        """,
        (pilot_city,),
    ).fetchall()

    marked = 0
    for row in rows:
        if within_area(area, row["lat"], row["lng"]):
            continue
        conn.execute(
            """
            UPDATE restaurants
            SET status = 'outside_area', last_places_sync_at = now(), updated_at = now()
            WHERE id = %s
            """,
            (row["id"],),
        )
        marked += 1
    return marked


def seed_restaurants_for_area(
    conn: Connection,
    client: httpx.Client,
    api_key: str,
    area: SeedArea,
    pilot_city: str,
    queries: list[str] | None = None,
    mark_missing_outside_area: bool = False,
) -> SeedResult:
    seen: set[str] = set()
    inserted = updated = closed = skipped = out_of_area = 0

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

            action = upsert_restaurant(conn, row)
            if action == "inserted":
                inserted += 1
            elif action == "closed":
                closed += 1
            else:
                updated += 1

    outside_area = mark_outside_area(conn, area, pilot_city) if mark_missing_outside_area else 0
    return SeedResult(
        inserted=inserted,
        updated=updated,
        closed=closed,
        outside_area=outside_area,
        skipped=skipped,
        out_of_area=out_of_area,
        unique_places=len(seen),
    )
