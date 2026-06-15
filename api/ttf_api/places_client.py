"""Thin httpx helpers for the Google Places (New) autocomplete and details APIs.

Mirrors the style of ``places_seed.search_places`` / ``fetch_place_details``.
The router keeps business logic; these functions handle HTTP mechanics only.
"""

from __future__ import annotations

import logging

import httpx

from ttf_api.places_seed import PlacesSeedError

logger = logging.getLogger(__name__)

AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete"
PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places"
RESOLVE_FIELD_MASK = "id,location,formattedAddress,displayName"


def autocomplete_places(
    api_key: str,
    q: str,
    session_token: str,
    lat: float | None = None,
    lng: float | None = None,
) -> list[dict]:
    """Call Google Places Autocomplete (New) and return the raw ``suggestions`` list.

    Returns an empty list on any HTTP error (caller degrades gracefully).
    Raises ``PlacesSeedError`` only for configuration issues that should
    propagate as 503.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
    }
    body: dict = {
        "input": q,
        "sessionToken": session_token,
        "includedRegionCodes": ["us"],
    }
    if lat is not None and lng is not None:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 50000.0,
            }
        }

    with httpx.Client(timeout=20.0) as client:
        resp = client.post(AUTOCOMPLETE_URL, headers=headers, json=body)

    if resp.status_code != 200:
        raise PlacesSeedError(
            f"Places Autocomplete API error {resp.status_code}: {resp.text}"
        )

    return resp.json().get("suggestions", [])


def place_details(
    api_key: str,
    place_id: str,
    session_token: str,
) -> dict:
    """Call Place Details (New) for a single place_id.

    Raises ``PlacesSeedError`` on HTTP errors (404 included, so caller can
    distinguish missing-place from other errors by checking status_code via
    exception message).
    """
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": RESOLVE_FIELD_MASK,
    }
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(
            f"{PLACE_DETAILS_BASE}/{place_id}",
            headers=headers,
            params={"sessionToken": session_token},
        )

    if resp.status_code == 404:
        raise PlacesSeedError(f"Place not found: {place_id}")
    if resp.status_code != 200:
        raise PlacesSeedError(
            f"Place Details API error {resp.status_code}: {resp.text}"
        )

    return resp.json()
