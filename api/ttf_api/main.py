from contextlib import asynccontextmanager

from fastapi import FastAPI

from ttf_api.db import run_migrations
from ttf_api.routers import health, metrics, restaurants, users


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

app.include_router(health.router)
app.include_router(users.router)
app.include_router(restaurants.router)
app.include_router(metrics.router)
