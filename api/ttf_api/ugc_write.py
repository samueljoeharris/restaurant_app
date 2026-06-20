"""Centralized UGC write path with moderation gate and conditional activity emit."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb

from ttf_api.activity_events import emit_activity_event
from ttf_api.config import settings
from ttf_api.schemas import (
    AttributeSubmissionRequest,
    AttributeSubmissionResponse,
    NoteSubmissionRequest,
    NoteSubmissionResponse,
    TtfSubmissionRequest,
    TtfSubmissionResponse,
)
from ttf_api.user_profiles import ensure_user_profile

_URL_PATTERN = re.compile(r"https?://", re.IGNORECASE)


@dataclass
class UgcWriteResult:
    published: bool
    flag_reasons: list[str]
    queued: bool


def _fetch_trust(conn, firebase_uid: str) -> dict[str, Any]:
    ensure_user_profile(conn, firebase_uid)
    return conn.execute(
        "SELECT trust_level, auto_publish FROM user_profiles WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()


def _venue_median_minutes(conn, restaurant_id: UUID) -> tuple[int, float | None]:
    row = conn.execute(
        """
        SELECT COUNT(*)::int AS n,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float AS median
        FROM ttf_observations
        WHERE restaurant_id = %s
          AND excluded_from_aggregate = FALSE
          AND moderation_status = 'approved'
        """,
        (restaurant_id,),
    ).fetchone()
    n = int(row["n"])
    median = float(row["median"]) if row["median"] is not None else None
    return n, median


def _auto_flag_reasons(
    conn,
    *,
    restaurant_id: UUID,
    note_text: str | None = None,
    elapsed_minutes: int | None = None,
) -> list[str]:
    reasons: list[str] = []
    if note_text and settings.moderation_auto_flag_urls_in_notes and _URL_PATTERN.search(note_text):
        reasons.append("url_in_note")
    if elapsed_minutes is not None and settings.moderation_auto_flag_ttf_outlier_z > 0:
        n, median = _venue_median_minutes(conn, restaurant_id)
        if n >= 5 and median is not None and median > 0:
            ratio = elapsed_minutes / median
            z_threshold = settings.moderation_auto_flag_ttf_outlier_z
            if ratio >= z_threshold or ratio <= (1.0 / z_threshold):
                reasons.append("ttf_outlier")
    return reasons


def _should_hold(
    conn,
    firebase_uid: str,
    flag_reasons: list[str],
) -> tuple[bool, list[str], str]:
    """Return (hold, flag_reasons, source)."""
    trust = _fetch_trust(conn, firebase_uid)
    auto_publish = bool(trust["auto_publish"]) or trust["trust_level"] == "trusted"
    if not settings.moderation_enabled:
        return False, flag_reasons, "user_submit"
    if flag_reasons:
        return True, flag_reasons, "auto_flag"
    if settings.moderation_new_user_hold and trust["trust_level"] == "new" and not auto_publish:
        return True, ["new_user_hold"], "user_submit"
    if auto_publish:
        return False, [], "user_submit"
    if trust["trust_level"] in ("standard", "new"):
        return True, ["manual_review"], "user_submit"
    return False, [], "user_submit"


def _upsert_moderation_item(
    conn,
    *,
    content_type: str,
    content_id: UUID,
    restaurant_id: UUID,
    firebase_uid: str,
    source: str,
    flag_reasons: list[str],
    visibility: str,
    status: str,
) -> None:
    conn.execute(
        """
        INSERT INTO moderation_items (
            content_type, content_id, restaurant_id, firebase_uid,
            status, visibility, source, flag_reasons
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (content_type, content_id) DO UPDATE SET
            status = EXCLUDED.status,
            visibility = EXCLUDED.visibility,
            source = EXCLUDED.source,
            flag_reasons = EXCLUDED.flag_reasons,
            updated_at = now()
        """,
        (
            content_type,
            content_id,
            restaurant_id,
            firebase_uid,
            status,
            visibility,
            source,
            flag_reasons,
        ),
    )


def insert_ttf_observation(
    conn,
    *,
    restaurant_id: UUID,
    firebase_uid: str,
    body: TtfSubmissionRequest,
) -> tuple[TtfSubmissionResponse, UgcWriteResult]:
    served_at = body.served_at or datetime.now(timezone.utc)
    ordered_at = body.ordered_at or (
        served_at - timedelta(minutes=body.elapsed_minutes or 0)
    )
    flag_reasons = _auto_flag_reasons(
        conn, restaurant_id=restaurant_id, elapsed_minutes=body.elapsed_minutes
    )
    hold, flag_reasons, source = _should_hold(conn, firebase_uid, flag_reasons)
    visibility = "hidden" if hold else "public"
    moderation_status = "pending" if hold else "approved"
    queue_status = "pending" if hold else "approved"

    row = conn.execute(
        """
        INSERT INTO ttf_observations (
            restaurant_id, firebase_uid, ordered_at, served_at, elapsed_minutes,
            item_type, item_quality, portion_size, daypart, party_size_kids,
            wait_context, photo_url, moderation_status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, elapsed_minutes, item_type, item_quality
        """,
        (
            restaurant_id,
            firebase_uid,
            ordered_at,
            served_at,
            body.elapsed_minutes,
            body.item_type,
            body.item_quality,
            body.portion_size,
            body.daypart,
            body.party_size_kids,
            body.wait_context,
            body.photo_url,
            moderation_status,
        ),
    ).fetchone()

    if hold:
        _upsert_moderation_item(
            conn,
            content_type="ttf_observation",
            content_id=row["id"],
            restaurant_id=restaurant_id,
            firebase_uid=firebase_uid,
            source=source,
            flag_reasons=flag_reasons,
            visibility=visibility,
            status=queue_status,
        )
    else:
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="ttf",
            source_id=row["id"],
            actor_firebase_uid=firebase_uid,
        )

    result = UgcWriteResult(published=not hold, flag_reasons=flag_reasons, queued=hold)
    return (
        TtfSubmissionResponse(**row, pending_review=result.queued),
        result,
    )


def insert_attribute_rating(
    conn,
    *,
    restaurant_id: UUID,
    firebase_uid: str,
    body: AttributeSubmissionRequest,
) -> tuple[AttributeSubmissionResponse, UgcWriteResult]:
    hold, flag_reasons, source = _should_hold(conn, firebase_uid, [])
    visibility = "hidden" if hold else "public"
    moderation_status = "pending" if hold else "approved"
    queue_status = "pending" if hold else "approved"

    row = conn.execute(
        """
        INSERT INTO restaurant_attribute_ratings (
            restaurant_id, metric_key, firebase_uid, value, visit_context,
            visibility, moderation_status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, metric_key
        """,
        (
            restaurant_id,
            body.metric_key,
            firebase_uid,
            Jsonb(body.value),
            body.visit_context,
            visibility,
            moderation_status,
        ),
    ).fetchone()

    if hold:
        _upsert_moderation_item(
            conn,
            content_type="attribute_rating",
            content_id=row["id"],
            restaurant_id=restaurant_id,
            firebase_uid=firebase_uid,
            source=source,
            flag_reasons=flag_reasons,
            visibility=visibility,
            status=queue_status,
        )
    else:
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="attribute",
            source_id=row["id"],
            actor_firebase_uid=firebase_uid,
        )

    result = UgcWriteResult(published=not hold, flag_reasons=flag_reasons, queued=hold)
    return (
        AttributeSubmissionResponse(**row, pending_review=result.queued),
        result,
    )


def insert_note(
    conn,
    *,
    restaurant_id: UUID,
    firebase_uid: str,
    body: NoteSubmissionRequest,
) -> tuple[NoteSubmissionResponse, UgcWriteResult]:
    flag_reasons = _auto_flag_reasons(conn, restaurant_id=restaurant_id, note_text=body.text)
    hold, flag_reasons, source = _should_hold(conn, firebase_uid, flag_reasons)
    visibility = "hidden" if hold else "public"
    moderation_status = "pending" if hold else "approved"
    queue_status = "pending" if hold else "approved"

    row = conn.execute(
        """
        INSERT INTO restaurant_notes (
            restaurant_id, firebase_uid, text, tags, visibility, moderation_status
        ) VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, text, tags, created_at
        """,
        (
            restaurant_id,
            firebase_uid,
            body.text,
            body.tags,
            visibility,
            moderation_status,
        ),
    ).fetchone()

    if hold:
        _upsert_moderation_item(
            conn,
            content_type="note",
            content_id=row["id"],
            restaurant_id=restaurant_id,
            firebase_uid=firebase_uid,
            source=source,
            flag_reasons=flag_reasons,
            visibility=visibility,
            status=queue_status,
        )
    else:
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="note",
            source_id=row["id"],
            actor_firebase_uid=firebase_uid,
        )

    result = UgcWriteResult(published=not hold, flag_reasons=flag_reasons, queued=hold)
    return (
        NoteSubmissionResponse(
            id=row["id"],
            text=row["text"],
            tags=row["tags"] or [],
            created_at=row["created_at"],
            pending_review=result.queued,
        ),
        result,
    )
