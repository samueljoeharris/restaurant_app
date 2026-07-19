"""Google Place ID validation and safe URL construction."""

from __future__ import annotations

import re
from urllib.parse import quote

_PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,2048}$")


def validate_and_quote_place_id(place_id: str) -> str:
    """Validate a Google Place ID and return a URL-path-safe version.

    Place IDs are opaque textual identifiers that commonly contain
    alphanumerics, underscores, and hyphens (base64url-style).  This
    validator rejects control characters, path separators, and other
    characters that could change the semantics of a URL path, then
    percent-encodes the result as defense in depth.
    """
    if not isinstance(place_id, str) or not place_id:
        raise ValueError("place_id must be a non-empty string")
    if not _PLACE_ID_RE.match(place_id):
        raise ValueError(f"invalid place_id format: {place_id[:50]!r}")
    return quote(place_id, safe="")
