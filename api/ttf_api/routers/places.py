"""Places autocomplete and resolve endpoints.

These proxy Google Places (New) for authenticated users, merging our own
catalog name hits with Google's place predictions. Google spend is gated
behind sign-in + App Check, mirroring /v1/coverage/ensure.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ttf_api.app_check import verify_app_check
from ttf_api.auth import AuthUser, get_current_user
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.places_client import autocomplete_places, place_details
from ttf_api.places_seed import PlacesSeedError, require_maps_api_key
from ttf_api.schemas import AutocompleteResponse, PlaceSuggestion, PlaceResolveResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/places", tags=["places"])


def _raise_seed_error(exc: PlacesSeedError) -> None:
    """Map PlacesSeedError → 503 (missing key) or 400 (other Google error)."""
    code = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if "MAPS_API_KEY" in str(exc)
        else status.HTTP_400_BAD_REQUEST
    )
    raise HTTPException(status_code=code, detail=str(exc)) from exc


def _catalog_restaurant_hits(conn, q: str) -> list[PlaceSuggestion]:
    """Return up to 5 active pilot-city restaurants whose name matches %q%."""
    pilot = settings.pilot_city
    rows = conn.execute(
        """
        SELECT id, name, address
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
