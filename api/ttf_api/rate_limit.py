"""Per-user write rate limits backed by Postgres (Cloud Run safe)."""

from __future__ import annotations

from fastapi import HTTPException, status
from psycopg import Connection

from ttf_api.config import settings


def check_write_rate_limit(conn: Connection, firebase_uid: str) -> None:
    row = conn.execute(
        """
        SELECT (
            (SELECT COUNT(*) FROM ttf_observations
             WHERE firebase_uid = %s
               AND created_at > now() - make_interval(mins => %s))
          + (SELECT COUNT(*) FROM restaurant_attribute_ratings
             WHERE firebase_uid = %s
               AND observed_at > now() - make_interval(mins => %s))
          + (SELECT COUNT(*) FROM restaurant_notes
             WHERE firebase_uid = %s
               AND created_at > now() - make_interval(mins => %s))
        ) AS write_count
        """,
        (
            firebase_uid,
            settings.rate_limit_window_minutes,
            firebase_uid,
            settings.rate_limit_window_minutes,
            firebase_uid,
            settings.rate_limit_window_minutes,
        ),
    ).fetchone()

    if row and row["write_count"] >= settings.rate_limit_max_writes:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many submissions. Limit is {settings.rate_limit_max_writes} "
                f"per {settings.rate_limit_window_minutes} minutes."
            ),
        )
