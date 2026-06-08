#!/usr/bin/env python3
"""Seed Dedham pilot restaurants from Google Places API (New)."""

from __future__ import annotations

import math
import sys
import time

import httpx

from ttf_api.config import settings
from ttf_api.db import get_conn, run_migrations

PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,"
    "places.types,places.googleMapsUri,nextPageToken"
)

# Dedham center + ~5 mi radius (covers town + immediate neighbors for pilot)
DEDHAM_LAT = 42.2418
DEDHAM_LNG = -71.1662
SEARCH_RADIUS_M = 8000

SEARCH_QUERIES = [
    "restaurants in Dedham Massachusetts",
    "family restaurants Dedham MA",
    "pizza Dedham MA",
    "breakfast Dedham Massachusetts",
]

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


def distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in meters."""
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def within_pilot_area(lat: float, lng: float) -> bool:
    return distance_meters(DEDHAM_LAT, DEDHAM_LNG, lat, lng) <= SEARCH_RADIUS_M


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


def search_places(client: httpx.Client, api_key: str, text_query: str) -> list[dict]:
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
                "center": {"latitude": DEDHAM_LAT, "longitude": DEDHAM_LNG},
                "radius": float(SEARCH_RADIUS_M),
            }
        },
    }

    results: list[dict] = []
    page_token: str | None = None
    while True:
        body = {**base_body, **({"pageToken": page_token} if page_token else {})}
        resp = client.post(PLACES_URL, headers=headers, json=body, timeout=30.0)
        if resp.status_code != 200:
            raise RuntimeError(f"Places API error {resp.status_code}: {resp.text}")

        data = resp.json()
        results.extend(data.get("places", []))

        page_token = data.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.3)

    return results


def normalize_place(place: dict) -> dict | None:
    place_id = place.get("id")
    name = (place.get("displayName") or {}).get("text")
    address = place.get("formattedAddress")
    loc = place.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")

    if not all([place_id, name, address, lat, lng]):
        return None

    lat_f, lng_f = float(lat), float(lng)
    if not within_pilot_area(lat_f, lng_f):
        return None

    return {
        "google_place_id": place_id,
        "name": name.strip(),
        "address": address.strip(),
        "lat": lat_f,
        "lng": lng_f,
        "google_maps_url": place.get("googleMapsUri"),
        "cuisine_tags": types_to_cuisine_tags(place.get("types") or []),
        "pilot_city": settings.pilot_city,
    }


def upsert_restaurant(conn, row: dict) -> str:
    existing = conn.execute(
        "SELECT id FROM restaurants WHERE google_place_id = %s",
        (row["google_place_id"],),
    ).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE restaurants
            SET name = %s, address = %s, lat = %s, lng = %s,
                google_maps_url = %s, cuisine_tags = %s, updated_at = now()
            WHERE google_place_id = %s
            """,
            (
                row["name"],
                row["address"],
                row["lat"],
                row["lng"],
                row["google_maps_url"],
                row["cuisine_tags"],
                row["google_place_id"],
            ),
        )
        return "updated"

    conn.execute(
        """
        INSERT INTO restaurants (
            name, address, lat, lng, google_place_id, google_maps_url,
            cuisine_tags, pilot_city
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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
        ),
    )
    return "inserted"


def prune_out_of_area() -> int:
    removed = 0
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, lat, lng FROM restaurants WHERE pilot_city = %s",
            (settings.pilot_city,),
        ).fetchall()
        for row in rows:
            if not within_pilot_area(row["lat"], row["lng"]):
                conn.execute("DELETE FROM restaurants WHERE id = %s", (row["id"],))
                removed += 1
    if removed:
        print(f"Pruned {removed} restaurant(s) outside {SEARCH_RADIUS_M}m of Dedham center")
    return removed


def main() -> int:
    api_key = settings.maps_api_key.strip()
    if not api_key:
        print(
            "MAPS_API_KEY is required. Add it to .env at repo root, then re-run.",
            file=sys.stderr,
        )
        return 1

    run_migrations()
    prune_out_of_area()

    seen: set[str] = set()
    inserted = updated = skipped = out_of_area = 0

    with httpx.Client() as client:
        for query in SEARCH_QUERIES:
            print(f"Searching: {query!r}")
            try:
                places = search_places(client, api_key, query)
            except RuntimeError as exc:
                print(exc, file=sys.stderr)
                return 1
            time.sleep(0.2)

            with get_conn() as conn:
                for place in places:
                    row = normalize_place(place)
                    if not row:
                        loc = (place.get("location") or {})
                        if loc.get("latitude") is not None:
                            out_of_area += 1
                        else:
                            skipped += 1
                        continue
                    pid = row["google_place_id"]
                    if pid in seen:
                        continue
                    seen.add(pid)

                    action = upsert_restaurant(conn, row)
                    if action == "inserted":
                        inserted += 1
                        print(f"  + {row['name']}")
                    else:
                        updated += 1

    print(
        f"\nDone — inserted: {inserted}, updated: {updated}, "
        f"out of area: {out_of_area}, skipped: {skipped}, unique places: {len(seen)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
