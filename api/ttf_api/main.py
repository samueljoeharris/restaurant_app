from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ttf_api.config import settings
from ttf_api.db import run_migrations
from ttf_api.security_config import assert_safe_auth_config
from ttf_api.http_cache import ETagMiddleware
from ttf_api.routers import (
    admin,
    auth_info,
    contributions,
    coverage,
    health,
    internal,
    me,
    metrics,
    places,
    restaurants,
    review_chat,
    users,
)
from ttf_api.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    assert_safe_auth_config(settings)
    run_migrations()
    yield


app = FastAPI(
    title="TTF Restaurant API",
    description="Little Scout — parent-focused restaurant ratings",
    version="0.1.0",
    lifespan=lifespan,
)

# ETag/Cache-Control on cacheable GETs. add_middleware adds to the outside of
# the stack (last-added runs first/outermost), so register this BEFORE CORS to
# keep CORS as the outermost layer.
app.add_middleware(ETagMiddleware)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Firebase-AppCheck"],
    )

app.include_router(health.router)
app.include_router(internal.router)
app.include_router(auth_info.router)
app.include_router(users.router)
app.include_router(me.router)
app.include_router(admin.router)
app.include_router(restaurants.router)
app.include_router(places.router)
app.include_router(coverage.router)
app.include_router(metrics.router)
app.include_router(contributions.router)
app.include_router(review_chat.router)

# Security headers (CSP/X-Content-Type-Options/etc) on every response. Added
# last so it is the outermost middleware and also covers CORS preflight replies.
app.add_middleware(SecurityHeadersMiddleware)
