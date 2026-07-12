"""Durable restaurant seed job coordination."""

from __future__ import annotations

import logging
from uuid import UUID

import httpx

from ttf_api.config import settings
from ttf_api.gcp_console import seed_job_log_marker
from ttf_api.db import get_conn
from ttf_api.places_seed import (
    PlacesSeedError,
    SeedArea,
    default_seed_area,
    geocode_location,
    refresh_catalog,
    require_maps_api_key,
    search_queries_for_area,
    seed_restaurants_for_area,
)

logger = logging.getLogger(__name__)


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


SYSTEM_REQUESTERS = {"scheduled-refresh"}


def is_scout_request(requested_by: str | None, *, refresh: bool) -> bool:
    """Whether venues added by this job count as scout-requested (#63).

    Only jobs a person explicitly asked for qualify — a user coverage request
    or an admin seed run. Scheduled refresh and other system-initiated runs
    grow the catalog without putting venues in the scouting queue.
    """
    if refresh:
        return False
    return bool(requested_by) and requested_by not in SYSTEM_REQUESTERS


def create_seed_job(
    area: SeedArea,
    *,
    query: str | None,
    requested_by: str | None,
    refresh: bool = False,
    force: bool = False,
    kind: str = "area",
) -> tuple[dict, bool]:
    """Create a seed job or reuse a recent/running one for the same area."""
    area_key = "catalog" if kind == "catalog" else area.area_key
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
                    area_key,
                    settings.restaurant_seed_cooldown_hours,
                ),
            ).fetchone()
            if existing:
                return existing, True

        row = conn.execute(
            """
            INSERT INTO restaurant_seed_jobs (
                pilot_city, area_key, query, lat, lng, radius_m, requested_by, refresh, kind
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                settings.pilot_city,
                area_key,
                query,
                area.lat,
                area.lng,
                area.radius_m,
                requested_by,
                refresh,
                kind,
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


def ensure_seed_location(
    conn,
    area: SeedArea,
    *,
    query: str | None,
    created_by: str | None,
    source: str = "seed",
) -> dict:
    """Register an area as a requested location (idempotent by area key)."""
    return conn.execute(
        """
        INSERT INTO seed_locations (
            pilot_city, area_key, label, query, lat, lng, radius_m, source, created_by
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (pilot_city, area_key) DO UPDATE
        SET updated_at = now()
        RETURNING *
        """,
        (
            settings.pilot_city,
            area.area_key,
            area.label,
            query,
            area.lat,
            area.lng,
            area.radius_m,
            source,
            created_by,
        ),
    ).fetchone()


def get_seed_location(location_id: UUID) -> dict | None:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT *
            FROM seed_locations
            WHERE id = %s AND pilot_city = %s
            """,
            (location_id, settings.pilot_city),
        ).fetchone()


def list_seed_locations() -> list[dict]:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT *
            FROM seed_locations
            WHERE pilot_city = %s
            ORDER BY created_at ASC
            """,
            (settings.pilot_city,),
        ).fetchall()


def add_seed_location(
    location: str,
    *,
    radius_m: int,
    created_by: str | None,
) -> dict:
    area = resolve_seed_area(location, None, None, radius_m)
    with get_conn() as conn:
        return ensure_seed_location(
            conn,
            area,
            query=location.strip(),
            created_by=created_by,
            source="admin",
        )


def update_seed_location(
    location_id: UUID,
    *,
    enabled: bool | None = None,
    radius_m: int | None = None,
    label: str | None = None,
) -> dict | None:
    with get_conn() as conn:
        return conn.execute(
            """
            UPDATE seed_locations
            SET enabled = COALESCE(%s, enabled),
                radius_m = COALESCE(%s, radius_m),
                label = COALESCE(%s, label),
                updated_at = now()
            WHERE id = %s AND pilot_city = %s
            RETURNING *
            """,
            (enabled, radius_m, label, location_id, settings.pilot_city),
        ).fetchone()


def delete_seed_location(location_id: UUID) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM seed_locations WHERE id = %s AND pilot_city = %s RETURNING id",
            (location_id, settings.pilot_city),
        ).fetchone()
    return row is not None


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

    marker = seed_job_log_marker(str(job_id))
    logger.info(
        "%s started (kind=%s area=%s)",
        marker,
        job.get("kind") or "area",
        job["area_key"],
    )
    try:
        api_key = require_maps_api_key()
        area = SeedArea(
            lat=float(job["lat"]),
            lng=float(job["lng"]),
            radius_m=int(job["radius_m"]),
            label=job["query"] or settings.pilot_display_name,
        )
        refresh = bool(job["refresh"])
        kind = job.get("kind") or "area"

        with httpx.Client() as client, get_conn() as conn:
            if kind == "catalog":
                result = refresh_catalog(
                    conn,
                    client,
                    api_key,
                    settings.pilot_city,
                    seed_job_id=job_id,
                )
            else:
                result = seed_restaurants_for_area(
                    conn,
                    client,
                    api_key,
                    area,
                    settings.pilot_city,
                    queries=search_queries_for_area(area, refresh=refresh),
                    tombstone_not_seen=refresh,
                    seed_job_id=job_id,
                    scout_requested=is_scout_request(
                        job["requested_by"], refresh=refresh
                    ),
                )
                # Area seeds no longer self-register in seed_locations (#111) —
                # scheduled refresh runs a single catalog-wide pass instead.
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
        logger.info(
            "%s succeeded (inserted=%s updated=%s tombstoned=%s)",
            marker,
            result.inserted,
            result.updated,
            result.tombstoned,
        )
    except Exception as exc:
        logger.exception("%s failed: %s", marker, exc)
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


def create_catalog_refresh_job(
    requested_by: str = "scheduled-refresh",
) -> dict | None:
    """Enqueue a single catalog-wide Place Details refresh.

    Returns None when auto-refresh is disabled. Both the Cloud Scheduler entry
    point and admin "Run refresh now" call this — no more per-location area
    re-search (#111); catalog hygiene is independent of seed_locations.
    """
    config = get_refresh_config()
    if not config.get("enabled"):
        return None

    job, _reused = create_seed_job(
        default_seed_area(),  # coords unused for kind=catalog; satisfies job schema
        query="catalog refresh",
        requested_by=requested_by,
        refresh=True,
        force=True,
        kind="catalog",
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


def run_default_area_seed(force: bool = True) -> dict:
    """CLI bootstrap: seed the default area.

    refresh=False — a first-time bootstrap should not run the
    tombstone_not_seen pass; that belongs to the catalog refresh job.
    """
    area = default_seed_area()
    job, _reused = create_seed_job(
        area,
        query=settings.pilot_display_name,
        requested_by="scheduled-refresh",
        refresh=False,
        force=force,
    )
    run_seed_job(job["id"])
    completed = get_seed_job(job["id"])
    if not completed:
        raise PlacesSeedError("Seed job disappeared before completion")
    return completed
