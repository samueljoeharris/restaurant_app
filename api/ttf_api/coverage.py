"""Density and rate checks backing the public coverage endpoint.

These guards let a signed-in user request background seeding for their own
location without exposing the admin-only Places spend directly. The actual
seed work reuses the existing job pipeline (`create_seed_job` + Pub/Sub).
"""

from __future__ import annotations

from psycopg import Connection

from ttf_api.config import settings


def count_active_within(conn: Connection, lat: float, lng: float, radius_m: int) -> int:
    """Count active restaurants within `radius_m` of (lat, lng).

    Uses the Haversine formula inline in SQL — no PostGIS dependency, matching
    the Python-side `distance_meters` used during seeding.
    """
    row = conn.execute(
        """
        SELECT COUNT(*)::int AS n
        FROM restaurants
        WHERE pilot_city = %s
          AND status = 'active'
          AND 2 * 6371000 * asin(sqrt(
                power(sin(radians(lat - %s) / 2), 2)
                + cos(radians(%s)) * cos(radians(lat))
                  * power(sin(radians(lng - %s) / 2), 2)
              )) <= %s
        """,
        (settings.pilot_city, lat, lat, lng, radius_m),
    ).fetchone()
    return int(row["n"]) if row else 0


def count_recent_user_areas(conn: Connection, requested_by: str) -> int:
    """Distinct areas this user has requested seeding for in the last 24 hours."""
    row = conn.execute(
        """
        SELECT COUNT(DISTINCT area_key)::int AS n
        FROM restaurant_seed_jobs
        WHERE pilot_city = %s
          AND requested_by = %s
          AND created_at > now() - interval '24 hours'
        """,
        (settings.pilot_city, requested_by),
    ).fetchone()
    return int(row["n"]) if row else 0
