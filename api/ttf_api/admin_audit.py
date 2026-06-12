"""Admin audit log for refresh config and seed location changes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb

from ttf_api.db import get_conn


def write_admin_audit(
    *,
    category: str,
    action: str,
    entity_id: str | None = None,
    changed_by_uid: str | None = None,
    changed_by_email: str | None = None,
    previous_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> UUID:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO admin_audit_log (
                category, action, entity_id,
                changed_by_uid, changed_by_email,
                previous_values, new_values, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                category,
                action,
                entity_id,
                changed_by_uid,
                changed_by_email,
                Jsonb(previous_values) if previous_values is not None else None,
                Jsonb(new_values) if new_values is not None else None,
                Jsonb(metadata) if metadata is not None else None,
            ),
        ).fetchone()
    return row["id"]


def list_admin_audit_log(
    *,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    params: list[object] = []
    where = ""
    if category:
        where = "WHERE category = %s"
        params.append(category)

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM admin_audit_log {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT *
            FROM admin_audit_log
            {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()
    return rows, total["total"]
