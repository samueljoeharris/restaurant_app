"""Activity event emission and inbox queries for watched restaurants."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

EVENT_HEADLINES = {
    "ttf": "New speed visit logged",
    "attribute": "New parent rating added",
    "note": "New parent note posted",
    "profile_match": "New spot matches your family profile",
}


def emit_activity_event(
    conn,
    *,
    restaurant_id: UUID,
    event_type: str,
    source_id: UUID,
    actor_firebase_uid: str,
    headline: str | None = None,
    target_firebase_uid: str | None = None,
) -> None:
    """Insert an activity event.

    Most event types (ttf/attribute/note) reach users via a
    ``restaurant_watches`` row and use the default per-type headline.
    ``target_firebase_uid`` targets one specific user directly instead
    (profile_match — the recipient hasn't necessarily watched this
    restaurant), and ``headline`` lets callers override the default text
    with something specific to that event (e.g. naming the match reason).
    """
    resolved_headline = headline or EVENT_HEADLINES.get(event_type, "New update")
    conn.execute(
        """
        INSERT INTO activity_events (
            restaurant_id, event_type, source_id, actor_firebase_uid,
            headline, target_firebase_uid
        ) VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            restaurant_id,
            event_type,
            source_id,
            actor_firebase_uid,
            resolved_headline,
            target_firebase_uid,
        ),
    )


_INBOX_BASE = """
    SELECT
        e.id,
        e.restaurant_id,
        e.event_type,
        e.source_id,
        e.headline,
        e.created_at,
        e.actor_firebase_uid,
        r.name AS restaurant_name
    FROM activity_events e
    JOIN restaurants r ON r.id = e.restaurant_id
    WHERE e.actor_firebase_uid <> %(uid)s
      AND (
        e.target_firebase_uid = %(uid)s
        OR (
            e.target_firebase_uid IS NULL
            AND EXISTS (
                SELECT 1 FROM restaurant_watches w
                WHERE w.restaurant_id = e.restaurant_id AND w.firebase_uid = %(uid)s
            )
        )
      )
"""


def _inbox_filters(*, since: datetime | None, unread_only: bool, read_through: datetime) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if since is not None:
        clauses.append("AND e.created_at > %(since)s")
        params["since"] = since
    if unread_only:
        clauses.append("AND e.created_at > %(read_through)s")
        params["read_through"] = read_through
    return " ".join(clauses), params


def list_inbox_events(
    conn,
    firebase_uid: str,
    *,
    read_through: datetime,
    since: datetime | None = None,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    extra, params = _inbox_filters(
        since=since, unread_only=unread_only, read_through=read_through
    )
    params.update({"uid": firebase_uid, "limit": limit, "offset": offset})
    sql = (
        _INBOX_BASE
        + extra
        + "\nORDER BY e.created_at DESC\nLIMIT %(limit)s OFFSET %(offset)s"
    )
    return conn.execute(sql, params).fetchall()


def unread_activity_count(conn, firebase_uid: str, read_through: datetime) -> int:
    extra, params = _inbox_filters(
        since=None, unread_only=True, read_through=read_through
    )
    params["uid"] = firebase_uid
    row = conn.execute(
        f"SELECT COUNT(*)::int AS total FROM ({_INBOX_BASE}{extra}) sub",
        params,
    ).fetchone()
    return int(row["total"])


def list_activity_for_restaurant(
    conn,
    firebase_uid: str,
    restaurant_id: UUID,
    *,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Per-spot update thread — watched restaurants only.

    Excludes profile_match events: those are personal, derived from another
    user's private family-profile data (allergies etc.), and must never
    surface in this restaurant-wide thread even to other watchers.
    """
    watched = conn.execute(
        """
        SELECT 1 FROM restaurant_watches
        WHERE firebase_uid = %s AND restaurant_id = %s
        """,
        (firebase_uid, restaurant_id),
    ).fetchone()
    if not watched:
        return []
    rows = conn.execute(
        """
        SELECT
            e.id,
            e.restaurant_id,
            e.event_type,
            e.source_id,
            e.headline,
            e.created_at,
            e.actor_firebase_uid,
            r.name AS restaurant_name
        FROM activity_events e
        JOIN restaurants r ON r.id = e.restaurant_id
        WHERE e.restaurant_id = %s
          AND e.actor_firebase_uid <> %s
          AND e.event_type <> 'profile_match'
        ORDER BY e.created_at DESC
        LIMIT %s
        """,
        (restaurant_id, firebase_uid, limit),
    ).fetchall()
    return rows
