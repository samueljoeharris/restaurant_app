"""HTTP caching middleware: strong ETag + Cache-Control + 304 handling.

Scoped to the cacheable read endpoints so route handlers stay clean. Adding a
strong validator lets the iOS URLCache and browsers revalidate cheaply, turning
repeat reads into empty 304 responses and cutting bandwidth.
"""

import hashlib

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# max-age keeps responses fresh for 30s; stale-while-revalidate lets clients
# serve a stale copy for up to 5min while they revalidate in the background.
CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300"

# Exact-path match only: these are the cacheable GET read endpoints.
CACHEABLE_PATHS = frozenset({"/v1/restaurants/map", "/v1/restaurants", "/v1/metrics"})


def compute_etag(body: bytes) -> str:
    """Return a strong, quoted ETag validator for ``body`` (stdlib only)."""
    return '"' + hashlib.sha256(body).hexdigest()[:32] + '"'


class ETagMiddleware(BaseHTTPMiddleware):
    """Attach ETag/Cache-Control to cacheable GETs and serve 304s."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)

        # Only touch successful GETs to the exact cacheable paths.
        if (
            request.method != "GET"
            or response.status_code != 200
            or request.url.path not in CACHEABLE_PATHS
        ):
            return response

        # Gotcha: a streamed response's body_iterator can only be consumed
        # once, so we buffer the bytes and must return a brand-new Response.
        body = b"".join([chunk async for chunk in response.body_iterator])
        etag = compute_etag(body)

        # If-None-Match may carry a comma-separated list of validators.
        inm = request.headers.get("if-none-match")
        if inm:
            candidates = [tag.strip() for tag in inm.split(",")]
            if etag in candidates:
                return Response(
                    status_code=304,
                    headers={"ETag": etag, "Cache-Control": CACHE_CONTROL},
                )

        # Rebuild the 200 from the buffered bytes. Copy the original headers,
        # set/overwrite our validators, and drop the now-stale Content-Length
        # so Starlette recomputes it for the new Response.
        headers = dict(response.headers)
        headers.pop("content-length", None)
        headers["ETag"] = etag
        headers["Cache-Control"] = CACHE_CONTROL

        return Response(
            content=body,
            status_code=200,
            headers=headers,
            media_type=response.media_type,
        )
