from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ttf_api.config import settings
from ttf_api.db import run_migrations
from ttf_api.routers import auth_info, health, metrics, restaurants, users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    yield


app = FastAPI(
    title="TTF Restaurant API",
    description="Time to Fries — parent-focused restaurant ratings (Dedham pilot)",
    version="0.1.0",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Firebase-AppCheck"],
    )

app.include_router(health.router)
app.include_router(auth_info.router)
app.include_router(users.router)
app.include_router(restaurants.router)
app.include_router(metrics.router)
