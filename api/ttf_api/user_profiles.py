"""User profile and notification preference helpers."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any
from uuid import UUID

from fastapi import HTTPException

DEFAULT_INBOX_READ_THROUGH = datetime(1970, 1, 1)


def ensure_user_profile(conn, firebase_uid: str) -> dict[str, Any]:
    """Create profile + default notification prefs if missing."""
    row = conn.execute(
        "SELECT * FROM user_profiles WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()
    if row:
        return row

    conn.execute(
        """
        INSERT INTO user_profiles (firebase_uid)
        VALUES (%s)
        ON CONFLICT (firebase_uid) DO NOTHING
        """,
        (firebase_uid,),
    )
    conn.execute(
        """
        INSERT INTO user_notification_preferences (firebase_uid)
        VALUES (%s)
        ON CONFLICT (firebase_uid) DO NOTHING
        """,
        (firebase_uid,),
    )
    row = conn.execute(
        "SELECT * FROM user_profiles WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create user profile")
    return row


def fetch_notification_prefs(conn, firebase_uid: str) -> dict[str, Any]:
    ensure_user_profile(conn, firebase_uid)
    row = conn.execute(
        "SELECT * FROM user_notification_preferences WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Missing notification preferences")
    return row


def watch_count(conn, firebase_uid: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*)::int AS total FROM restaurant_watches WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()
    return int(row["total"])


def fetch_watched_ids(conn, firebase_uid: str) -> set[UUID]:
    rows = conn.execute(
        "SELECT restaurant_id FROM restaurant_watches WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchall()
    return {row["restaurant_id"] for row in rows}


def validate_kids_ages(ages: list[int]) -> list[int]:
    if len(ages) > 8:
        raise HTTPException(status_code=400, detail="At most 8 kids ages allowed")
    cleaned: list[int] = []
    for age in ages:
        if age < 0 or age > 17:
            raise HTTPException(status_code=400, detail="Kids ages must be between 0 and 17")
        cleaned.append(age)
    return cleaned


def parse_time_value(value: str) -> time:
    parts = value.split(":")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Time must be HH:MM")
    hour, minute = int(parts[0]), int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise HTTPException(status_code=400, detail="Invalid time")
    return time(hour, minute)
