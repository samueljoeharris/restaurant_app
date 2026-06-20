"""Admin moderation, trust, restaurant ops, and observation quality endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import auth as firebase_auth

from ttf_api.admin_audit import write_admin_audit
from ttf_api.auth import AuthUser, _init_firebase, require_admin
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.moderation_service import (
    approve_moderation_item,
    disable_user,
    enable_user,
    escalate_moderation_item,
    exclude_observation,
    get_attention_counts,
    merge_restaurants,
    reject_moderation_item,
    restore_observation,
    set_user_trust,
)
from ttf_api.schemas import (
    AdminAttentionStats,
    AdminContributorDetail,
    AdminObservationRow,
    AdminObservationsResponse,
    AdminRestaurantDetail,
    AdminRestaurantMergeRequest,
    AdminRestaurantUpdate,
    AdminTrustUpdate,
    ModerationItemRow,
    ModerationListResponse,
    ModerationReviewRequest,
    ModerationSettingsResponse,
    ObservationExcludeRequest,
)
from ttf_api.ugc_sql import TTF_AGGREGATE_FILTER
from ttf_api.user_profiles import ensure_user_profile, watch_count

router = APIRouter(prefix="/v1/admin", tags=["admin-moderation"])

_MAX_LIMIT = 200


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, _MAX_LIMIT))


def _preview_for_item(conn, item: dict) -> str | None:
    content_type = item["content_type"]
    content_id = item["content_id"]
    if content_type == "note":
        row = conn.execute(
            "SELECT text FROM restaurant_notes WHERE id = %s", (content_id,)
        ).fetchone()
        return (row["text"][:120] + "…") if row and len(row["text"]) > 120 else (row["text"] if row else None)
    if content_type == "ttf_observation":
        row = conn.execute(
            "SELECT elapsed_minutes, item_type FROM ttf_observations WHERE id = %s",
            (content_id,),
        ).fetchone()
        return f"{row['elapsed_minutes']} min · {row['item_type']}" if row else None
    if content_type == "attribute_rating":
        row = conn.execute(
            "SELECT metric_key, value FROM restaurant_attribute_ratings WHERE id = %s",
            (content_id,),
        ).fetchone()
        return f"{row['metric_key']}: {row['value']}" if row else None
    return None


@router.get("/attention", response_model=AdminAttentionStats)
def admin_attention(_admin: Annotated[AuthUser, Depends(require_admin)]) -> AdminAttentionStats:
    with get_conn() as conn:
        counts = get_attention_counts(conn)
    return AdminAttentionStats(**counts)


@router.get("/settings/moderation", response_model=ModerationSettingsResponse)
def admin_moderation_settings(
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> ModerationSettingsResponse:
    return ModerationSettingsResponse(
        moderation_enabled=settings.moderation_enabled,
        moderation_auto_flag_urls_in_notes=settings.moderation_auto_flag_urls_in_notes,
        moderation_auto_flag_ttf_outlier_z=settings.moderation_auto_flag_ttf_outlier_z,
        moderation_new_user_hold=settings.moderation_new_user_hold,
    )


@router.get("/moderation", response_model=ModerationListResponse)
def list_moderation(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    status_filter: Literal["pending", "escalated", "approved", "rejected", "removed", "all"] = Query(
        "pending", alias="status"
    ),
    content_type: str | None = Query(None),
    source: str | None = Query(None),
    restaurant_id: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> ModerationListResponse:
    limit = _clamp_limit(limit)
    clauses = ["1=1"]
    params: list[object] = []
    if status_filter != "all":
        clauses.append("m.status = %s")
        params.append(status_filter)
    if content_type:
        clauses.append("m.content_type = %s")
        params.append(content_type)
    if source:
        clauses.append("m.source = %s")
        params.append(source)
    if restaurant_id:
        clauses.append("m.restaurant_id = %s")
        params.append(restaurant_id)
    where = " AND ".join(clauses)

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM moderation_items m WHERE {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT m.*, r.name AS restaurant_name, p.trust_level AS author_trust_level
            FROM moderation_items m
            JOIN restaurants r ON r.id = m.restaurant_id
            LEFT JOIN user_profiles p ON p.firebase_uid = m.firebase_uid
            WHERE {where}
            ORDER BY m.created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()
        items = [
            ModerationItemRow(
                id=r["id"],
                content_type=r["content_type"],
                content_id=r["content_id"],
                restaurant_id=r["restaurant_id"],
                restaurant_name=r["restaurant_name"],
                firebase_uid=r["firebase_uid"],
                author_trust_level=r.get("author_trust_level"),
                status=r["status"],
                visibility=r["visibility"],
                source=r["source"],
                flag_reasons=list(r["flag_reasons"] or []),
                report_count=int(r["report_count"]),
                preview_text=_preview_for_item(conn, r),
                created_at=r["created_at"],
                reviewed_at=r.get("reviewed_at"),
            )
            for r in rows
        ]

    return ModerationListResponse(
        items=items, total=int(total["total"]), limit=limit, offset=offset
    )


@router.post("/moderation/{item_id}/approve")
def approve_moderation(
    item_id: UUID,
    body: ModerationReviewRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict:
    with get_conn() as conn:
        approve_moderation_item(conn, item_id, admin, body.review_notes)
    return {"status": "approved"}


@router.post("/moderation/{item_id}/reject")
def reject_moderation(
    item_id: UUID,
    body: ModerationReviewRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict:
    with get_conn() as conn:
        reject_moderation_item(conn, item_id, admin, body.review_notes)
    return {"status": "rejected"}


@router.post("/moderation/{item_id}/escalate")
def escalate_moderation(
    item_id: UUID,
    body: ModerationReviewRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict:
    with get_conn() as conn:
        escalate_moderation_item(conn, item_id, admin, body.review_notes)
    return {"status": "escalated"}


@router.get("/restaurants/{restaurant_id}", response_model=AdminRestaurantDetail)
def admin_restaurant_detail(
    restaurant_id: UUID,
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminRestaurantDetail:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM restaurants WHERE id = %s AND pilot_city = %s",
            (restaurant_id, settings.pilot_city),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        stats = conn.execute(
            f"""
            SELECT
                COUNT(*) FILTER (WHERE {TTF_AGGREGATE_FILTER})::int AS ttf_sample_size,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)
                    FILTER (WHERE {TTF_AGGREGATE_FILTER})::float AS ttf_median_minutes,
                (SELECT COUNT(*)::int FROM restaurant_notes
                 WHERE restaurant_id = %s AND moderation_status = 'approved') AS note_count,
                (SELECT COUNT(*)::int FROM moderation_items
                 WHERE restaurant_id = %s AND status = 'pending') AS pending_moderation_count
            FROM ttf_observations WHERE restaurant_id = %s
            """,
            (restaurant_id, restaurant_id, restaurant_id),
        ).fetchone()
    return AdminRestaurantDetail(
        id=row["id"],
        name=row["name"],
        address=row["address"],
        lat=row["lat"],
        lng=row["lng"],
        cuisine_tags=row["cuisine_tags"] or [],
        status=row["status"],
        tombstone_reason=row.get("tombstone_reason"),
        google_place_id=row.get("google_place_id"),
        ttf_sample_size=int(stats["ttf_sample_size"]),
        ttf_median_minutes=stats["ttf_median_minutes"],
        note_count=int(stats["note_count"]),
        pending_moderation_count=int(stats["pending_moderation_count"]),
        updated_at=row["updated_at"],
    )


@router.patch("/restaurants/{restaurant_id}", response_model=AdminRestaurantDetail)
def admin_update_restaurant(
    restaurant_id: UUID,
    body: AdminRestaurantUpdate,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminRestaurantDetail:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return admin_restaurant_detail(restaurant_id, admin)
    with get_conn() as conn:
        prev = conn.execute(
            "SELECT * FROM restaurants WHERE id = %s", (restaurant_id,)
        ).fetchone()
        if not prev:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        set_parts = [f"{k} = %s" for k in updates]
        set_parts.append("updated_at = now()")
        conn.execute(
            f"UPDATE restaurants SET {', '.join(set_parts)} WHERE id = %s",
            tuple([*updates.values(), restaurant_id]),
        )
        write_admin_audit(
            category="restaurant",
            action="update_fields",
            entity_id=str(restaurant_id),
            changed_by_uid=admin.firebase_uid,
            changed_by_email=admin.email,
            previous_values={k: prev.get(k) for k in updates},
            new_values=updates,
        )
    return admin_restaurant_detail(restaurant_id, admin)


@router.post("/restaurants/merge")
def admin_merge_restaurants(
    body: AdminRestaurantMergeRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict[str, str]:
    with get_conn() as conn:
        merge_restaurants(
            conn,
            source_id=body.source_id,
            target_id=body.target_id,
            admin=admin,
            reason=body.reason,
        )
    return {"status": "merged"}


def _build_admin_contributor_detail(conn, firebase_uid: str) -> AdminContributorDetail:
    ensure_user_profile(conn, firebase_uid)
    profile = conn.execute(
        "SELECT * FROM user_profiles WHERE firebase_uid = %s", (firebase_uid,)
    ).fetchone()
    stats = conn.execute(
        """
        WITH combined AS (
            SELECT firebase_uid, 'ttf'::text AS kind, created_at AS active_at
            FROM ttf_observations WHERE firebase_uid = %s
            UNION ALL
            SELECT firebase_uid, 'attr', observed_at FROM restaurant_attribute_ratings
            WHERE firebase_uid = %s
            UNION ALL
            SELECT firebase_uid, 'note', created_at FROM restaurant_notes
            WHERE firebase_uid = %s
        )
        SELECT
            COUNT(*) FILTER (WHERE kind = 'ttf')::int AS ttf_count,
            COUNT(*) FILTER (WHERE kind = 'attr')::int AS attribute_count,
            COUNT(*) FILTER (WHERE kind = 'note')::int AS note_count,
            COUNT(*)::int AS total_contributions,
            MAX(active_at) AS last_active_at
        FROM combined
        """,
        (firebase_uid, firebase_uid, firebase_uid),
    ).fetchone()
    watches = watch_count(conn, firebase_uid)

    email = None
    display_name = None
    disabled = None
    try:
        _init_firebase()
        fb = firebase_auth.get_user(firebase_uid)
        email = fb.email
        display_name = fb.display_name
        disabled = fb.disabled
    except Exception:
        pass

    return AdminContributorDetail(
        firebase_uid=firebase_uid,
        email=email,
        display_name=display_name,
        disabled=disabled,
        trust_level=profile["trust_level"],
        auto_publish=bool(profile["auto_publish"]),
        trust_notes=profile.get("trust_notes"),
        watch_count=watches,
        ttf_count=int(stats["ttf_count"]),
        attribute_count=int(stats["attribute_count"]),
        note_count=int(stats["note_count"]),
        total_contributions=int(stats["total_contributions"]),
        last_active_at=stats["last_active_at"],
    )


@router.get("/users/{firebase_uid}", response_model=AdminContributorDetail)
def admin_user_detail(
    firebase_uid: str,
    _admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminContributorDetail:
    with get_conn() as conn:
        return _build_admin_contributor_detail(conn, firebase_uid)


@router.patch("/users/{firebase_uid}/trust", response_model=AdminContributorDetail)
def admin_update_trust(
    firebase_uid: str,
    body: AdminTrustUpdate,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminContributorDetail:
    with get_conn() as conn:
        set_user_trust(
            conn,
            firebase_uid,
            admin,
            trust_level=body.trust_level,
            auto_publish=body.auto_publish,
            trust_notes=body.trust_notes,
        )
        return _build_admin_contributor_detail(conn, firebase_uid)


@router.post("/users/{firebase_uid}/disable", response_model=AdminContributorDetail)
def admin_disable_user(
    firebase_uid: str,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminContributorDetail:
    with get_conn() as conn:
        disable_user(conn, firebase_uid, admin)
        return _build_admin_contributor_detail(conn, firebase_uid)


@router.post("/users/{firebase_uid}/enable", response_model=AdminContributorDetail)
def admin_enable_user(
    firebase_uid: str,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> AdminContributorDetail:
    with get_conn() as conn:
        enable_user(conn, firebase_uid, admin)
        return _build_admin_contributor_detail(conn, firebase_uid)


@router.post("/observations/{observation_id}/exclude")
def admin_exclude_observation(
    observation_id: UUID,
    body: ObservationExcludeRequest,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict:
    with get_conn() as conn:
        exclude_observation(conn, observation_id, admin, body.reason)
    return {"status": "excluded"}


@router.post("/observations/{observation_id}/restore")
def admin_restore_observation(
    observation_id: UUID,
    admin: Annotated[AuthUser, Depends(require_admin)],
) -> dict:
    with get_conn() as conn:
        restore_observation(conn, observation_id, admin)
    return {"status": "restored"}


@router.get("/observations/enhanced", response_model=AdminObservationsResponse, include_in_schema=False)
def admin_observations_enhanced_alias(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    restaurant_id: UUID | None = Query(None),
    firebase_uid: str | None = Query(None),
    daypart: str | None = Query(None),
    excluded: bool | None = Query(None),
    min_minutes: int | None = Query(None, ge=1),
    max_minutes: int | None = Query(None, le=180),
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminObservationsResponse:
    limit = _clamp_limit(limit)
    clauses = ["1=1"]
    params: list[object] = []
    if restaurant_id:
        clauses.append("o.restaurant_id = %s")
        params.append(restaurant_id)
    if firebase_uid:
        clauses.append("o.firebase_uid = %s")
        params.append(firebase_uid)
    if daypart:
        clauses.append("o.daypart = %s")
        params.append(daypart)
    if excluded is not None:
        clauses.append("o.excluded_from_aggregate = %s")
        params.append(excluded)
    if min_minutes is not None:
        clauses.append("o.elapsed_minutes >= %s")
        params.append(min_minutes)
    if max_minutes is not None:
        clauses.append("o.elapsed_minutes <= %s")
        params.append(max_minutes)
    if since:
        clauses.append("o.created_at >= %s")
        params.append(since)
    if until:
        clauses.append("o.created_at <= %s")
        params.append(until)
    where = " AND ".join(clauses)

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM ttf_observations o WHERE {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT
                o.id, o.restaurant_id, r.name AS restaurant_name, o.firebase_uid,
                o.elapsed_minutes, o.item_type, o.item_quality, o.daypart, o.created_at,
                o.excluded_from_aggregate, o.exclusion_reason, o.moderation_status,
                med.median_minutes AS restaurant_median_minutes
            FROM ttf_observations o
            JOIN restaurants r ON r.id = o.restaurant_id
            LEFT JOIN LATERAL (
                SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float
                    AS median_minutes
                FROM ttf_observations t
                WHERE t.restaurant_id = o.restaurant_id AND {TTF_AGGREGATE_FILTER}
            ) med ON true
            WHERE {where}
            ORDER BY o.created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()

    return AdminObservationsResponse(
        items=[
            AdminObservationRow(
                id=r["id"],
                restaurant_id=r["restaurant_id"],
                restaurant_name=r["restaurant_name"],
                firebase_uid=r["firebase_uid"],
                elapsed_minutes=int(r["elapsed_minutes"]),
                item_type=r["item_type"],
                item_quality=int(r["item_quality"]),
                daypart=r["daypart"],
                created_at=r["created_at"],
                excluded_from_aggregate=bool(r["excluded_from_aggregate"]),
                exclusion_reason=r.get("exclusion_reason"),
                moderation_status=r["moderation_status"],
                restaurant_median_minutes=r.get("restaurant_median_minutes"),
            )
            for r in rows
        ],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )
