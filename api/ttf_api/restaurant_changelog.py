"""Audit log for restaurant catalog changes."""

from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb


def log_change(
    conn: Connection,
    *,
    restaurant_id: UUID | None,
    google_place_id: str | None,
    restaurant_name: str | None,
    action: str,
    previous_status: str | None = None,
    new_status: str | None = None,
    reason: str | None = None,
    seed_job_id: UUID | None = None,
    changed_fields: dict | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO restaurant_changelog (
            restaurant_id, google_place_id, restaurant_name, action,
            previous_status, new_status, reason, seed_job_id, changed_fields
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            restaurant_id,
            google_place_id,
            restaurant_name,
            action,
            previous_status,
            new_status,
            reason,
            seed_job_id,
            Jsonb(changed_fields) if changed_fields else None,
        ),
    )
