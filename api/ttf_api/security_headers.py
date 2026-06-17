"""Security response headers for the JSON API.

The API serves only JSON (no HTML/JS), so its CSP is maximally locked down:
nothing may be loaded, framed, or embedded. These headers are cheap defense in
depth and satisfy the BEST_PRACTICES.md §7 "CSP configured" gate for the API
surface alongside the web/admin SPAs. Kept in its own module (like
http_cache.py) so it can be unit-tested without importing ttf_api.main.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# A JSON API never returns markup, so deny every fetch directive and forbid
# being framed. frame-ancestors 'none' is the modern X-Frame-Options: DENY.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

SECURITY_HEADERS = {
    "Content-Security-Policy": API_CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach static security headers to every API response."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response
