from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from ttf_api.config import settings
from ttf_api.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/", response_class=HTMLResponse)
def root() -> str:
    pilot = settings.pilot_display_name
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Little Scout API</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }}
    h1 {{ font-size: 1.5rem; margin-bottom: 0.25rem; }}
    p {{ color: #444; }}
    ul {{ padding-left: 1.25rem; }}
    a {{ color: #0b57d0; }}
    code {{ font-size: 0.9em; background: #f4f4f4; padding: 0.1em 0.35em; border-radius: 3px; }}
  </style>
</head>
<body>
  <h1>Little Scout API</h1>
  <p>Parent-focused restaurant ratings — <strong>{pilot}</strong> pilot.</p>
  <ul>
    <li><a href="/health">Health</a> — service status</li>
    <li><a href="/docs">API docs</a> — interactive OpenAPI</li>
    <li><a href="/v1/metrics">Metrics</a> — rating definitions (public)</li>
    <li><a href="/v1/restaurants">Restaurants</a> — list pilot restaurants (public read)</li>
  </ul>
  <p>Writes (<code>POST</code>, profile) require a Firebase ID token.</p>
</body>
</html>"""


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        pilot_city=settings.pilot_city,
        pilot_display_name=settings.pilot_display_name,
    )
