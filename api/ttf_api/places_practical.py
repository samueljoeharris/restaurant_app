"""Normalize Google Place Details into parent-friendly practical info.

Enterprise SKU fields — fetch on demand only; never persist to Postgres.
See docs/BEST_PRACTICES.md Google Maps content policy.
"""

from __future__ import annotations

from datetime import datetime

from ttf_api.schemas import PlacePracticalResponse


def _weekday_hours(regular: dict | None, current: dict | None) -> list[str] | None:
    descriptions = (regular or {}).get("weekdayDescriptions") or (current or {}).get("weekdayDescriptions")
    if not descriptions:
        return None
    return [str(line) for line in descriptions]


def _today_hours_line(descriptions: list[str] | None) -> str | None:
    if not descriptions:
        return None
    idx = datetime.now().weekday()
    if idx >= len(descriptions):
        return None
    line = descriptions[idx]
    if ":" in line:
        return line.split(":", 1)[1].strip()
    return line.strip()


def _hours_summary(
    *,
    open_now: bool | None,
    current: dict | None,
    regular: dict | None,
) -> str | None:
    descriptions = (current or {}).get("weekdayDescriptions") or (regular or {}).get("weekdayDescriptions")
    today_hours = _today_hours_line(descriptions)

    if open_now is True:
        if today_hours:
            if today_hours.lower() == "closed":
                return "Open now"
            if "–" in today_hours or "-" in today_hours:
                separator = "–" if "–" in today_hours else "-"
                close_part = today_hours.split(separator, 1)[1].strip()
                return f"Open · Closes {close_part}"
            return f"Open · {today_hours}"
        return "Open now"

    if open_now is False:
        if today_hours:
            if today_hours.lower() == "closed":
                return "Closed today"
            if "–" in today_hours or "-" in today_hours:
                separator = "–" if "–" in today_hours else "-"
                open_part = today_hours.split(separator, 1)[0].strip()
                return f"Closed · Opens {open_part}"
            return f"Closed · {today_hours}"
        return "Closed now"

    if today_hours:
        return today_hours
    return None


def place_to_practical(place: dict) -> PlacePracticalResponse:
    current = place.get("currentOpeningHours") or None
    regular = place.get("regularOpeningHours") or None
    open_now = current.get("openNow") if isinstance(current, dict) else None
    if open_now is not None:
        open_now = bool(open_now)

    rating = place.get("rating")
    rating_count = place.get("userRatingCount")

    return PlacePracticalResponse(
        place_id=str(place.get("id") or ""),
        open_now=open_now,
        hours_summary=_hours_summary(open_now=open_now, current=current, regular=regular),
        weekday_hours=_weekday_hours(regular, current),
        phone=(place.get("nationalPhoneNumber") or None),
        website=(place.get("websiteUri") or None),
        google_maps_url=(place.get("googleMapsUri") or None),
        google_rating=float(rating) if rating is not None else None,
        google_rating_count=int(rating_count) if rating_count is not None else None,
        business_status=(place.get("businessStatus") or None),
    )
