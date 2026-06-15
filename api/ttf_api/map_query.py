"""Pure helpers for the optional bounding-box filter on GET /v1/restaurants/map.

Dependency-free so it can be unit-tested in isolation (the rest of the app pulls
in psycopg/firebase, which are not always installed).
"""


def build_bbox_filter(
    min_lat: float | None,
    max_lat: float | None,
    min_lng: float | None,
    max_lng: float | None,
) -> tuple[str, list[float]]:
    """Build a SQL fragment + params for an optional viewport bbox filter.

    All-or-nothing: pass all four bounds for a viewport-scoped read, or none for
    the whole pilot city (backward compatible). Returns a ``%s``-placeholder
    fragment using the ``r.`` alias to match the existing /map query, plus the
    params in placeholder order.
    """
    provided = [v is not None for v in (min_lat, max_lat, min_lng, max_lng)]
    if not any(provided):
        return ("", [])
    if not all(provided):
        raise ValueError("Provide all of min_lat, max_lat, min_lng, max_lng or none")

    # mypy: all() above guarantees these are not None here.
    assert (
        min_lat is not None
        and max_lat is not None
        and min_lng is not None
        and max_lng is not None
    )
    if min_lat >= max_lat or min_lng >= max_lng:
        raise ValueError("min bounds must be less than max bounds")

    return (
        " AND r.lat BETWEEN %s AND %s AND r.lng BETWEEN %s AND %s",
        [min_lat, max_lat, min_lng, max_lng],
    )
