"""Admin moderation queue, trust management, and content actions."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from firebase_admin import auth as firebase_auth

from ttf_api.account_deletion import delete_user_account
from ttf_api.activity_events import emit_activity_event
from ttf_api.admin_audit import write_admin_audit
from ttf_api.auth import AuthUser, _init_firebase
from ttf_api.config import settings
from ttf_api.user_profiles import ensure_user_profile

logger = logging.getLogger(__name__)

CONTENT_TABLE = {
    "note": ("restaurant_notes", "note"),
    "ttf_observation": ("ttf_observations", "ttf"),
    "attribute_rating": ("restaurant_attribute_ratings", "attribute"),
}

EVENT_TYPE = {
    "note": "note",
    "ttf_observation": "ttf",
    "attribute_rating": "attribute",
}


def get_attention_counts(conn) -> dict[str, int]:
    row = conn.execute(
        """
        SELECT
            (SELECT COUNT(*)::int FROM moderation_items WHERE status = 'pending') AS pending_moderation,
            (SELECT COUNT(*)::int FROM moderation_items WHERE status = 'escalated') AS escalated,
            (SELECT COUNT(*)::int FROM moderation_items
             WHERE content_type = 'ttf_observation' AND status = 'pending') AS flagged_observations,
            (SELECT COUNT(*)::int FROM user_profiles WHERE trust_level = 'restricted') AS restricted_users,
            (SELECT COUNT(DISTINCT p.firebase_uid)::int
             FROM user_profiles p
             WHERE p.trust_level = 'new'
               AND EXISTS (
                   SELECT 1 FROM ttf_observations t
                   WHERE t.firebase_uid = p.firebase_uid
                     AND t.created_at >= now() - interval '7 days'
                   UNION ALL
                   SELECT 1 FROM restaurant_notes n
                   WHERE n.firebase_uid = p.firebase_uid
                     AND n.created_at >= now() - interval '7 days'
               )) AS new_contributors_active
        """
    ).fetchone()
    stale = conn.execute(
        """
        SELECT COUNT(*)::int AS cnt FROM restaurants r
        WHERE r.pilot_city = %s
          AND r.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM ttf_observations t
              WHERE t.restaurant_id = r.id
                AND t.excluded_from_aggregate = FALSE
                AND t.moderation_status = 'approved'
          )
          AND (
              SELECT COUNT(*) FROM restaurant_notes n
              WHERE n.restaurant_id = r.id AND n.moderation_status = 'approved'
          ) >= 3
        """,
        (settings.pilot_city,),
    ).fetchone()
    return {
        "pending_moderation": int(row["pending_moderation"]),
        "escalated": int(row["escalated"]),
        "flagged_observations": int(row["flagged_observations"]),
        "restricted_users": int(row["restricted_users"]),
        "new_contributors_active": int(row["new_contributors_active"]),
        "stale_review_count": int(stale["cnt"]),
    }


def _load_moderation_item(conn, item_id: UUID) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM moderation_items WHERE id = %s", (item_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Moderation item not found")
    return row


def _publish_content(conn, item: dict[str, Any]) -> None:
    content_type = item["content_type"]
    content_id = item["content_id"]
    table, _ = CONTENT_TABLE[content_type]
    conn.execute(
        f"""
        UPDATE {table}
        SET moderation_status = 'approved', visibility = 'public'
        WHERE id = %s
        """,
        (content_id,),
    )
    event_type = EVENT_TYPE.get(content_type)
    if event_type:
        emit_activity_event(
            conn,
            restaurant_id=item["restaurant_id"],
            event_type=event_type,
            source_id=content_id,
            actor_firebase_uid=item["firebase_uid"],
        )


def _hide_content(conn, item: dict[str, Any]) -> None:
    content_type = item["content_type"]
    content_id = item["content_id"]
    table, _ = CONTENT_TABLE[content_type]
    conn.execute(
        f"""
        UPDATE {table}
        SET moderation_status = 'rejected', visibility = 'removed'
        WHERE id = %s
        """,
        (content_id,),
    )


def approve_moderation_item(
    conn,
    item_id: UUID,
    admin: AuthUser,
    review_notes: str | None = None,
) -> dict[str, Any]:
    item = _load_moderation_item(conn, item_id)
    now = datetime.now(timezone.utc)
    conn.execute(
        """
        UPDATE moderation_items SET
            status = 'approved',
            visibility = 'public',
            reviewer_uid = %s,
            reviewer_email = %s,
            review_notes = %s,
            reviewed_at = %s,
            updated_at = %s
        WHERE id = %s
        """,
        (admin.firebase_uid, admin.email, review_notes, now, now, item_id),
    )
    _publish_content(conn, item)
    write_admin_audit(
        category="moderation",
        action="approve",
        entity_id=str(item_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        metadata={"content_type": item["content_type"], "content_id": str(item["content_id"])},
    )
    return _load_moderation_item(conn, item_id)


def reject_moderation_item(
    conn,
    item_id: UUID,
    admin: AuthUser,
    review_notes: str | None = None,
) -> dict[str, Any]:
    item = _load_moderation_item(conn, item_id)
    now = datetime.now(timezone.utc)
    conn.execute(
        """
        UPDATE moderation_items SET
            status = 'rejected',
            visibility = 'removed',
            reviewer_uid = %s,
            reviewer_email = %s,
            review_notes = %s,
            reviewed_at = %s,
            updated_at = %s
        WHERE id = %s
        """,
        (admin.firebase_uid, admin.email, review_notes, now, now, item_id),
    )
    _hide_content(conn, item)
    write_admin_audit(
        category="moderation",
        action="reject",
        entity_id=str(item_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        metadata={"content_type": item["content_type"], "content_id": str(item["content_id"])},
    )
    return _load_moderation_item(conn, item_id)


def escalate_moderation_item(
    conn,
    item_id: UUID,
    admin: AuthUser,
    review_notes: str | None = None,
) -> dict[str, Any]:
    _load_moderation_item(conn, item_id)
    now = datetime.now(timezone.utc)
    conn.execute(
        """
        UPDATE moderation_items SET
            status = 'escalated',
            reviewer_uid = %s,
            reviewer_email = %s,
            review_notes = %s,
            updated_at = %s
        WHERE id = %s
        """,
        (admin.firebase_uid, admin.email, review_notes, now, item_id),
    )
    write_admin_audit(
        category="moderation",
        action="escalate",
        entity_id=str(item_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
    )
    return _load_moderation_item(conn, item_id)


def exclude_observation(
    conn,
    observation_id: UUID,
    admin: AuthUser,
    reason: str,
) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM ttf_observations WHERE id = %s",
        (observation_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Observation not found")
    now = datetime.now(timezone.utc)
    conn.execute(
        """
        UPDATE ttf_observations SET
            excluded_from_aggregate = TRUE,
            exclusion_reason = %s,
            excluded_by_uid = %s,
            excluded_at = %s
        WHERE id = %s
        """,
        (reason, admin.firebase_uid, now, observation_id),
    )
    write_admin_audit(
        category="observation",
        action="exclude_from_aggregate",
        entity_id=str(observation_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        metadata={"reason": reason, "restaurant_id": str(row["restaurant_id"])},
    )
    return conn.execute(
        "SELECT * FROM ttf_observations WHERE id = %s", (observation_id,)
    ).fetchone()


def restore_observation(conn, observation_id: UUID, admin: AuthUser) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM ttf_observations WHERE id = %s",
        (observation_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Observation not found")
    conn.execute(
        """
        UPDATE ttf_observations SET
            excluded_from_aggregate = FALSE,
            exclusion_reason = NULL,
            excluded_by_uid = NULL,
            excluded_at = NULL
        WHERE id = %s
        """,
        (observation_id,),
    )
    write_admin_audit(
        category="observation",
        action="restore_to_aggregate",
        entity_id=str(observation_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
    )
    return conn.execute(
        "SELECT * FROM ttf_observations WHERE id = %s", (observation_id,)
    ).fetchone()


def submit_content_report(
    conn,
    *,
    content_type: str,
    content_id: UUID,
    reporter_uid: str,
    reason: str,
    details: str | None,
) -> UUID:
    if content_type not in CONTENT_TABLE:
        raise HTTPException(status_code=400, detail="Invalid content_type")
    table, _ = CONTENT_TABLE[content_type]
    content = conn.execute(f"SELECT * FROM {table} WHERE id = %s", (content_id,)).fetchone()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    report = conn.execute(
        """
        INSERT INTO content_reports (content_type, content_id, reporter_uid, reason, details)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (content_type, content_id, reporter_uid, reason, details),
    ).fetchone()

    restaurant_id = content["restaurant_id"]
    author_uid = content["firebase_uid"]
    existing = conn.execute(
        """
        SELECT id FROM moderation_items
        WHERE content_type = %s AND content_id = %s
        """,
        (content_type, content_id),
    ).fetchone()
    if existing:
        conn.execute(
            """
            UPDATE moderation_items SET
                report_count = report_count + 1,
                source = 'user_report',
                status = CASE WHEN status = 'approved' THEN 'pending' ELSE status END,
                flag_reasons = CASE
                    WHEN %s = ANY(flag_reasons) THEN flag_reasons
                    ELSE array_append(flag_reasons, %s)
                END,
                updated_at = now()
            WHERE id = %s
            """,
            (reason, reason, existing["id"]),
        )
    else:
        conn.execute(
            """
            INSERT INTO moderation_items (
                content_type, content_id, restaurant_id, firebase_uid,
                status, visibility, source, flag_reasons, report_count
            ) VALUES (%s, %s, %s, %s, 'pending', 'hidden', 'user_report', %s, 1)
            """,
            (content_type, content_id, restaurant_id, author_uid, [reason]),
        )
    return report["id"]


def set_user_trust(
    conn,
    firebase_uid: str,
    admin: AuthUser,
    *,
    trust_level: str | None = None,
    auto_publish: bool | None = None,
    trust_notes: str | None = None,
) -> dict[str, Any]:
    ensure_user_profile(conn, firebase_uid)
    prev = conn.execute(
        "SELECT trust_level, auto_publish, trust_notes FROM user_profiles WHERE firebase_uid = %s",
        (firebase_uid,),
    ).fetchone()
    updates: list[str] = []
    params: list[Any] = []
    if trust_level is not None:
        updates.append("trust_level = %s")
        params.append(trust_level)
        auto_publish = trust_level == "trusted"
        updates.append("auto_publish = %s")
        params.append(auto_publish)
    elif auto_publish is not None:
        updates.append("auto_publish = %s")
        params.append(auto_publish)
    if trust_notes is not None:
        updates.append("trust_notes = %s")
        params.append(trust_notes)
    if not updates:
        return prev
    updates.extend(
        [
            "trust_updated_at = now()",
            "trust_updated_by_uid = %s",
            "trust_updated_by_email = %s",
        ]
    )
    params.extend([admin.firebase_uid, admin.email, firebase_uid])
    conn.execute(
        f"UPDATE user_profiles SET {', '.join(updates)} WHERE firebase_uid = %s",
        tuple(params),
    )
    new_trust_level = trust_level or prev["trust_level"]
    new_auto_publish = (
        trust_level == "trusted"
        if trust_level is not None
        else auto_publish if auto_publish is not None else prev["auto_publish"]
    )
    write_admin_audit(
        category="user_trust",
        action="set_trust_level",
        entity_id=firebase_uid,
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        previous_values=dict(prev),
        new_values={
            "trust_level": new_trust_level,
            "auto_publish": new_auto_publish,
        },
    )
    return conn.execute(
        "SELECT * FROM user_profiles WHERE firebase_uid = %s", (firebase_uid,)
    ).fetchone()


def guard_admin_not_target_self(admin: AuthUser, firebase_uid: str) -> None:
    if admin.firebase_uid == firebase_uid:
        raise HTTPException(
            status_code=403,
            detail="You cannot disable, enable, or delete your own account from the admin console.",
        )


def disable_user(conn, firebase_uid: str, admin: AuthUser, reason: str | None = None) -> None:
    guard_admin_not_target_self(admin, firebase_uid)
    set_user_trust(conn, firebase_uid, admin, trust_level="restricted", auto_publish=False)
    _init_firebase()
    try:
        firebase_auth.update_user(firebase_uid, disabled=True)
    except firebase_auth.UserNotFoundError:
        logger.warning("disable_user firebase_user_not_found uid=%s", firebase_uid)
    write_admin_audit(
        category="user_trust",
        action="disable",
        entity_id=firebase_uid,
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        metadata={"reason": reason},
    )


def enable_user(conn, firebase_uid: str, admin: AuthUser) -> None:
    guard_admin_not_target_self(admin, firebase_uid)
    set_user_trust(conn, firebase_uid, admin, trust_level="standard")
    _init_firebase()
    try:
        firebase_auth.update_user(firebase_uid, disabled=False)
    except firebase_auth.UserNotFoundError:
        logger.warning("enable_user firebase_user_not_found uid=%s", firebase_uid)
    write_admin_audit(
        category="user_trust",
        action="enable",
        entity_id=firebase_uid,
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
    )


def admin_delete_contributor_account(firebase_uid: str, admin: AuthUser) -> None:
    guard_admin_not_target_self(admin, firebase_uid)
    delete_user_account(firebase_uid)
    write_admin_audit(
        category="user_trust",
        action="delete_account",
        entity_id=firebase_uid,
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
    )


def merge_restaurants(
    conn,
    *,
    source_id: UUID,
    target_id: UUID,
    admin: AuthUser,
    reason: str,
) -> None:
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Source and target must differ")
    source = conn.execute("SELECT * FROM restaurants WHERE id = %s", (source_id,)).fetchone()
    target = conn.execute("SELECT * FROM restaurants WHERE id = %s", (target_id,)).fetchone()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    for table in (
        "ttf_observations",
        "restaurant_notes",
        "restaurant_attribute_ratings",
        "moderation_items",
        "activity_events",
    ):
        conn.execute(
            f"UPDATE {table} SET restaurant_id = %s WHERE restaurant_id = %s",
            (target_id, source_id),
        )

    conn.execute(
        """
        DELETE FROM restaurant_watches w
        USING restaurant_watches t
        WHERE w.firebase_uid = t.firebase_uid
          AND w.restaurant_id = %s
          AND t.restaurant_id = %s
        """,
        (source_id, target_id),
    )
    conn.execute(
        "UPDATE restaurant_watches SET restaurant_id = %s WHERE restaurant_id = %s",
        (target_id, source_id),
    )

    conn.execute(
        """
        UPDATE restaurants SET
            status = 'tombstoned',
            tombstoned_at = now(),
            tombstone_reason = %s,
            merged_into_id = %s,
            updated_at = now()
        WHERE id = %s
        """,
        (reason or "merged", target_id, source_id),
    )
    conn.execute(
        """
        INSERT INTO restaurant_changelog (
            restaurant_id, google_place_id, restaurant_name,
            action, previous_status, new_status, reason
        ) VALUES (%s, %s, %s, 'merged', %s, 'tombstoned', %s)
        """,
        (
            source_id,
            source.get("google_place_id"),
            source["name"],
            source["status"],
            reason,
        ),
    )
    write_admin_audit(
        category="restaurant",
        action="merge",
        entity_id=str(source_id),
        changed_by_uid=admin.firebase_uid,
        changed_by_email=admin.email,
        metadata={"target_id": str(target_id), "reason": reason},
    )
