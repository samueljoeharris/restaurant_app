"""Durable restaurant seed job coordination."""

from __future__ import annotations

from uuid import UUID

import httpx

from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.places_seed import (
    PlacesSeedError,
    SeedArea,
    default_seed_area,
    geocode_location,
    require_maps_api_key,
    search_queries_for_area,
    seed_restaurants_for_area,
)


def resolve_seed_area(
    location: str | None,
    lat: float | None,
    lng: float | None,
    radius_m: int,
) -> SeedArea:
    api_key = require_maps_api_key()
    if location and location.strip():
        with httpx.Client() as client:
            return geocode_location(client, api_key, location.strip(), radius_m)
    if lat is not None and lng is not None:
        return SeedArea(lat=lat, lng=lng, radius_m=radius_m, label=f"{lat:.4f}, {lng:.4f}")
    raise PlacesSeedError("Provide location or both lat and lng")


def create_seed_job(
    area: SeedArea,
    *,
    query: str | None,
    requested_by: str | None,
    refresh: bool = False,
    force: bool = False,
) -> tuple[dict, bool]:
    """Create a seed job or reuse a recent/running one for the same area."""
    with get_conn() as conn:
        if not force:
            existing = conn.execute(
                """
                SELECT *
                FROM restaurant_seed_jobs
                WHERE pilot_city = %s
                  AND area_key = %s
                  AND (
                    status IN ('pending', 'running')
                    OR (
                      status = 'succeeded'
                      AND finished_at > now() - (%s * interval '1 hour')
                    )
                  )
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (
                    settings.pilot_city,
                    area.area_key,
                    settings.restaurant_seed_cooldown_hours,
                ),
            ).fetchone()
            if existing:
                return existing, True

        row = conn.execute(
            """
            INSERT INTO restaurant_seed_jobs (
                pilot_city, area_key, query, lat, lng, radius_m, requested_by, refresh
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                settings.pilot_city,
                area.area_key,
                query,
                area.lat,
                area.lng,
                area.radius_m,
                requested_by,
                refresh,
            ),
        ).fetchone()
        return row, False


def get_seed_job(job_id: UUID) -> dict | None:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM restaurant_seed_jobs WHERE id = %s AND pilot_city = %s",
            (job_id, settings.pilot_city),
        ).fetchone()


def list_seed_jobs(*, limit: int = 50, offset: int = 0) -> tuple[list[dict], int]:
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*)::int AS total FROM restaurant_seed_jobs WHERE pilot_city = %s",
            (settings.pilot_city,),
        ).fetchone()
        rows = conn.execute(
            """
            SELECT *
            FROM restaurant_seed_jobs
            WHERE pilot_city = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            (settings.pilot_city, limit, offset),
        ).fetchall()
    return rows, int(total["total"])


def run_seed_job(job_id: UUID) -> None:
    """Execute a pending seed job and persist terminal status."""
    with get_conn() as conn:
        job = conn.execute(
            """
            UPDATE restaurant_seed_jobs
            SET status = 'running', started_at = now(), updated_at = now(), error = NULL
            WHERE id = %s AND status = 'pending'
            RETURNING *
            """,
            (job_id,),
        ).fetchone()
        if not job:
            return

    try:
        api_key = require_maps_api_key()
        area = SeedArea(
            lat=float(job["lat"]),
            lng=float(job["lng"]),
            radius_m=int(job["radius_m"]),
            label=job["query"] or settings.pilot_display_name,
        )
        refresh = bool(job["refresh"])
        queries = search_queries_for_area(area, refresh=refresh)

        with httpx.Client() as client, get_conn() as conn:
            result = seed_restaurants_for_area(
                conn,
                client,
                api_key,
                area,
                settings.pilot_city,
                queries=queries,
                mark_missing_outside_area=refresh,
                tombstone_not_seen=refresh,
                seed_job_id=job_id,
            )
            conn.execute(
                """
                UPDATE restaurant_seed_jobs
                SET status = 'succeeded',
                    inserted_count = %s,
                    updated_count = %s,
                    closed_count = %s,
                    outside_area_count = %s,
                    tombstoned_count = %s,
                    reactivated_count = %s,
                    skipped_count = %s,
                    out_of_area_count = %s,
                    unique_places_count = %s,
                    finished_at = now(),
                    updated_at = now()
                WHERE id = %s
                """,
                (
                    result.inserted,
                    result.updated,
                    result.closed,
                    result.outside_area,
                    result.tombstoned,
                    result.reactivated,
                    result.skipped,
                    result.out_of_area,
                    result.unique_places,
                    job_id,
                ),
            )
    except Exception as exc:
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE restaurant_seed_jobs
                SET status = 'failed', error = %s, finished_at = now(), updated_at = now()
                WHERE id = %s
                """,
                (str(exc), job_id),
            )


def get_refresh_config() -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM location_refresh_config WHERE pilot_city = %s",
            (settings.pilot_city,),
        ).fetchone()
    if not row:
        area = default_seed_area()
        return {
            "pilot_city": settings.pilot_city,
            "enabled": True,
            "schedule_cron": "0 9 * * 1",
            "schedule_timezone": "America/New_York",
            "default_location": area.label,
            "default_lat": area.lat,
            "default_lng": area.lng,
            "default_radius_m": area.radius_m,
            "last_scheduled_at": None,
            "updated_at": None,
            "updated_by": None,
        }
    return row


def update_refresh_config(
    *,
    enabled: bool | None = None,
    schedule_cron: str | None = None,
    schedule_timezone: str | None = None,
    default_location: str | None = None,
    default_lat: float | None = None,
    default_lng: float | None = None,
    default_radius_m: int | None = None,
    updated_by: str | None = None,
) -> dict:
    current = get_refresh_config()
    with get_conn() as conn:
        row = conn.execute(
            """
            UPDATE location_refresh_config
            SET enabled = %s,
                schedule_cron = %s,
                schedule_timezone = %s,
                default_location = %s,
                default_lat = %s,
                default_lng = %s,
                default_radius_m = %s,
                updated_at = now(),
                updated_by = %s
            WHERE pilot_city = %s
            RETURNING *
            """,
            (
                enabled if enabled is not None else current["enabled"],
                schedule_cron if schedule_cron is not None else current["schedule_cron"],
                schedule_timezone
                if schedule_timezone is not None
                else current["schedule_timezone"],
                default_location
                if default_location is not None
                else current["default_location"],
                default_lat if default_lat is not None else current["default_lat"],
                default_lng if default_lng is not None else current["default_lng"],
                default_radius_m
                if default_radius_m is not None
                else current["default_radius_m"],
                updated_by,
                settings.pilot_city,
            ),
        ).fetchone()
    return row


def create_scheduled_refresh_job(requested_by: str = "scheduled-refresh") -> dict | None:
    """Create a refresh job from DB config if enabled. Returns None when disabled."""
    config = get_refresh_config()
    if not config.get("enabled"):
        return None

    area = SeedArea(
        lat=float(config["default_lat"] or settings.restaurant_seed_default_lat),
        lng=float(config["default_lng"] or settings.restaurant_seed_default_lng),
        radius_m=int(config["default_radius_m"] or settings.restaurant_seed_default_radius_m),
        label=config["default_location"] or settings.pilot_display_name,
    )
    job, _reused = create_seed_job(
        area,
        query=config["default_location"] or settings.pilot_display_name,
        requested_by=requested_by,
        refresh=True,
        force=True,
    )

    with get_conn() as conn:
        conn.execute(
            """
            UPDATE location_refresh_config
            SET last_scheduled_at = now(), updated_at = now()
            WHERE pilot_city = %s
            """,
            (settings.pilot_city,),
        )
    return job


def run_default_refresh(force: bool = True) -> dict:
    area = default_seed_area()
    job, _reused = create_seed_job(
        area,
        query=settings.pilot_display_name,
        requested_by="scheduled-refresh",
        refresh=True,
        force=force,
    )
    run_seed_job(job["id"])
    refreshed = get_seed_job(job["id"])
    if not refreshed:
        raise PlacesSeedError("Refresh job disappeared before completion")
    return refreshed
