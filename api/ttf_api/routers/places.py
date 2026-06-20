"""Places autocomplete and resolve endpoints.

These proxy Google Places (New) for authenticated users, merging our own
catalog name hits with Google's place predictions. Google spend is gated
behind sign-in + App Check, mirroring /v1/coverage/ensure.
"""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ttf_api.app_check import verify_app_check
from ttf_api.auth import AuthUser, get_current_user
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.places_client import autocomplete_places, place_details, search_nearby_places
from ttf_api.places_nearby import map_entry_from_place_details, merge_nearby_places
from ttf_api.places_practical import place_to_practical
from ttf_api.places_seed import (
    PRACTICAL_FIELD_MASK,
    PlacesSeedError,
    ensure_restaurant_for_place,
    fetch_place_details,
    require_maps_api_key,
)
from ttf_api.routers.restaurants import build_restaurant_detail_response
from ttf_api.schemas import (
    AutocompleteResponse,
    PlacePracticalResponse,
    PlaceResolveResponse,
    PlaceSuggestion,
    RestaurantDetailResponse,
    RestaurantMapEntry,
)
from ttf_api.security import require_write_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/places", tags=["places"])


def _raise_seed_error(exc: PlacesSeedError) -> None:
    msg = str(exc)
    if "MAPS_API_KEY" in msg:
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif "not found" in msg.lower():
        code = status.HTTP_404_NOT_FOUND
    else:
        code = status.HTTP_400_BAD_REQUEST
    raise HTTPException(status_code=code, detail=msg) from exc


def _catalog_restaurant_hits(conn, q: str) -> list[PlaceSuggestion]:
    """Return up to 5 active pilot-city restaurants whose name matches %q%."""
    pilot = settings.pilot_city
    rows = conn.execute(
        """
        SELECT id, name, address, lat, lng
        FROM restaurants
        WHERE pilot_city = %s
          AND status = 'active'
          AND name ILIKE %s
        ORDER BY name
        LIMIT 5
        """,
        (pilot, f"%{q}%"),
    ).fetchall()
    return [
        PlaceSuggestion(
            type="restaurant",
            restaurant_id=row["id"],
            primary_text=row["name"],
            secondary_text=row["address"],
            lat=float(row["lat"]),
            lng=float(row["lng"]),
        )
        for row in rows
    ]


def _parse_place_predictions(raw_suggestions: list[dict]) -> list[PlaceSuggestion]:
    """Convert raw Google Autocomplete (New) suggestions to PlaceSuggestion objects."""
    results: list[PlaceSuggestion] = []
    for item in raw_suggestions:
        pred = item.get("placePrediction")
        if not pred:
            continue
        place_id = pred.get("placeId")
        if not place_id:
            continue

        structured = pred.get("structuredFormat") or {}
        main_text = (structured.get("mainText") or {}).get("text")
        secondary_text = (structured.get("secondaryText") or {}).get("text")

        # Fall back to the flat text field if structured is absent
        if not main_text:
            main_text = (pred.get("text") or {}).get("text") or ""

        results.append(
            PlaceSuggestion(
                type="place",
                place_id=place_id,
                primary_text=main_text,
                secondary_text=secondary_text,
            )
        )
        if len(results) >= 5:
            break

    return results


@router.get("/autocomplete", response_model=AutocompleteResponse)
def autocomplete(
    request: Request,
    q: str = Query(..., min_length=1, description="Partial search input"),
    session_token: str = Query(..., description="Client-generated UUID for session billing"),
    lat: float | None = Query(None, description="Location bias latitude"),
    lng: float | None = Query(None, description="Location bias longitude"),
    user: Annotated[AuthUser, Depends(get_current_user)] = None,
) -> AutocompleteResponse:
    """Typeahead: up to 5 catalog restaurant hits + up to 5 Google place predictions.

    Auth: sign-in + App Check (Google spend is metered).
    Degrades gracefully: returns restaurant hits even when MAPS_API_KEY is absent
    or Google returns an error.
    """
    verify_app_check(request)

    # 1. Catalog hits (no Google spend, always attempt)
    with get_conn() as conn:
        restaurant_suggestions = _catalog_restaurant_hits(conn, q)

    # 2. Google place predictions (gated on API key availability)
    place_suggestions: list[PlaceSuggestion] = []
    try:
        api_key = require_maps_api_key()
        raw = autocomplete_places(api_key, q, session_token, lat=lat, lng=lng)
        place_suggestions = _parse_place_predictions(raw)
    except PlacesSeedError as exc:
        # Missing key or Google error — log and degrade gracefully
        logger.warning("Places autocomplete unavailable: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected error calling Places Autocomplete: %s", exc)

    return AutocompleteResponse(suggestions=restaurant_suggestions + place_suggestions)


@router.get("/resolve", response_model=PlaceResolveResponse)
def resolve_place(
    request: Request,
    place_id: str = Query(..., description="Google place_id to resolve"),
    session_token: str = Query(..., description="Session token to close billing session"),
    user: Annotated[AuthUser, Depends(get_current_user)] = None,
) -> PlaceResolveResponse:
    """Resolve a Google place_id to lat/lng + label.

    Auth: sign-in + App Check (closes the autocomplete billing session).
    Errors: 503 if MAPS_API_KEY missing, 404 if place has no location, 400 otherwise.
    """
    verify_app_check(request)

    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_seed_error(exc)

    try:
        data = place_details(api_key, place_id, session_token)
    except PlacesSeedError as exc:
        msg = str(exc)
        if "not found" in msg.lower() or "404" in msg:
            raise HTTPException(status_code=404, detail="Place not found") from exc
        _raise_seed_error(exc)

    location = data.get("location") or {}
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is None or lng is None:
        raise HTTPException(status_code=404, detail="Place has no location data")

    label = data.get("formattedAddress") or (data.get("displayName") or {}).get("text") or place_id

    return PlaceResolveResponse(
        place_id=data.get("id") or place_id,
        lat=float(lat),
        lng=float(lng),
        label=label,
    )


@router.get("/nearby", response_model=list[RestaurantMapEntry])
def nearby_places(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: int = Query(default=8000, ge=500, le=25000),
    limit: int = Query(default=20, ge=1, le=20),
    user: Annotated[AuthUser, Depends(get_current_user)] = None,
) -> list[RestaurantMapEntry]:
    verify_app_check(request)
    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_seed_error(exc)
    try:
        places = search_nearby_places(api_key, lat, lng, radius_m, max_result_count=limit)
    except PlacesSeedError as exc:
        _raise_seed_error(exc)
    with get_conn() as conn:
        entries = merge_nearby_places(conn, places)
    entries.sort(key=lambda e: (e.lat - lat) ** 2 + (e.lng - lng) ** 2)
    return entries[:limit]


@router.get("/{place_id}/practical", response_model=PlacePracticalResponse)
def get_place_practical(
    request: Request,
    place_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)] = None,
) -> PlacePracticalResponse:
    """Live Google practical info (hours, phone, rating) for detail surfaces.

    Auth: sign-in + App Check. Enterprise SKU fields — not persisted to Postgres.
    """
    verify_app_check(request)
    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_seed_error(exc)
    with httpx.Client() as client:
        place = fetch_place_details(client, api_key, place_id, field_mask=PRACTICAL_FIELD_MASK)
    if place is None:
        raise HTTPException(status_code=404, detail="Place not found")
    return place_to_practical(place)


@router.get("/{place_id}/entry", response_model=RestaurantMapEntry)
def get_place_entry(request: Request, place_id: str, user: Annotated[AuthUser, Depends(get_current_user)] = None) -> RestaurantMapEntry:
    verify_app_check(request)
    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_seed_error(exc)
    with httpx.Client() as client:
        place = fetch_place_details(client, api_key, place_id)
    if place is None:
        raise HTTPException(status_code=404, detail="Place not found")
    with get_conn() as conn:
        entry = map_entry_from_place_details(place, conn)
    if entry is None:
        raise HTTPException(status_code=404, detail="Place could not be normalized")
    return entry


@router.post("/{place_id}/materialize", response_model=RestaurantDetailResponse)
def materialize_place(
    place_id: str,
    _user: Annotated[AuthUser, Depends(require_write_access)],
) -> RestaurantDetailResponse:
    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_seed_error(exc)
    with get_conn() as conn:
        try:
            restaurant_id = ensure_restaurant_for_place(conn, place_id, api_key)
        except PlacesSeedError as exc:
            _raise_seed_error(exc)
        row = conn.execute("SELECT * FROM restaurants WHERE id = %s AND pilot_city = %s", (restaurant_id, settings.pilot_city)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        return build_restaurant_detail_response(conn, row, restaurant_id)
