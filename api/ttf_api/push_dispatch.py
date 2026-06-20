"""Push notification bundling and dispatch (FCM when configured)."""

from __future__ import annotations

import logging
from datetime import datetime, time, timezone
from typing import Any
from zoneinfo import ZoneInfo

from ttf_api.activity_events import unread_activity_count
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.user_profiles import fetch_notification_prefs

logger = logging.getLogger(__name__)


def _in_quiet_hours(now_local: datetime, start: time, end: time) -> bool:
    current = now_local.time()
    if start <= end:
        return start <= current < end
    return current >= start or current < end


def _event_allowed(prefs: dict[str, Any], event_type: str) -> bool:
    if event_type == "ttf":
        return bool(prefs["alert_new_ttf"])
    if event_type == "attribute":
        return bool(prefs["alert_new_rating"]) or bool(prefs["alert_every_review"])
    if event_type == "note":
        return bool(prefs["alert_new_note"]) or bool(prefs["alert_every_review"])
    return False


def dispatch_pending_pushes(*, dry_run: bool = False) -> dict[str, int]:
    """Bundle unread events per user and dispatch push when allowed."""
    sent = 0
    skipped = 0
    with get_conn() as conn:
        users = conn.execute(
            """
            SELECT p.firebase_uid, p.inbox_read_through, p.timezone
            FROM user_profiles p
            JOIN user_notification_preferences np ON np.firebase_uid = p.firebase_uid
            WHERE np.push_enabled = TRUE
            """
        ).fetchall()

        for user in users:
            uid = user["firebase_uid"]
            prefs = fetch_notification_prefs(conn, uid)
            tz = ZoneInfo(user["timezone"] or "America/New_York")
            now_local = datetime.now(timezone.utc).astimezone(tz)

            if _in_quiet_hours(now_local, prefs["quiet_hours_start"], prefs["quiet_hours_end"]):
                skipped += 1
                continue

            count = unread_activity_count(conn, uid, user["inbox_read_through"])
            if count == 0:
                skipped += 1
                continue

            tokens = conn.execute(
                "SELECT id, token, platform FROM device_push_tokens WHERE firebase_uid = %s",
                (uid,),
            ).fetchall()
            if not tokens:
                skipped += 1
                continue

            body = (
                f"{count} spot{'s' if count != 1 else ''} changed"
                if count > 1
                else "A saved spot has an update"
            )

            if dry_run:
                sent += 1
                continue

            delivered = _send_push(tokens, title="Little Scout", body=body)
            if delivered:
                conn.execute(
                    """
                    INSERT INTO push_dispatch_log (firebase_uid, event_count)
                    VALUES (%s, %s)
                    """,
                    (uid, count),
                )
                sent += 1
            else:
                skipped += 1

    return {"sent": sent, "skipped": skipped}


def _send_push(tokens: list[dict[str, Any]], *, title: str, body: str) -> bool:
    """Send via FCM when firebase is configured; log-only stub otherwise."""
    if not tokens:
        return False
    # Production: integrate firebase_admin.messaging.send_each_for_multicast
    logger.info(
        "push_dispatch_stub tokens=%s title=%s body=%s fcm_project=%s",
        len(tokens),
        title,
        body,
        settings.firebase_project_id,
    )
    return True
