"""Watchlist, profile, activity inbox, notification prefs, and push tokens."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from ttf_api.activity_events import (
    list_activity_for_restaurant,
    list_inbox_events,
    unread_activity_count,
)
from ttf_api.auth import AuthUser, get_current_user
from ttf_api.db import get_conn
from ttf_api.map_entries import MAP_SELECT, WATCH_MAP_SELECT, apply_watched_flags, row_to_map_entry
from ttf_api.routers.restaurants import _ensure_restaurant
from ttf_api.schemas import (
    ActivityEventItem,
    ActivityInboxResponse,
    ActivityMarkReadRequest,
    ActivityUnreadCountResponse,
    DevicePushTokenRequest,
    DevicePushTokenResponse,
    ExtendedUserProfile,
    FamilyMatchRequest,
    FamilyMatchResponse,
    FamilyMatchResult,
    NotificationPreferences,
    NotificationPreferencesUpdate,
    UserProfilePatch,
    WatchedRestaurantEntry,
    WatchedRestaurantsResponse,
)
from ttf_api.family_match import compute_family_match
from ttf_api.family_profile import (
    ALLERGENS,
    ATMOSPHERE_PREFERENCES,
    DIETARY_RESTRICTIONS,
    validate_choice_list,
    validate_cuisine_tags,
)
from ttf_api.user_profiles import (
    ensure_user_profile,
    fetch_notification_prefs,
    parse_time_value,
    validate_kids_ages,
    watch_count,
)
from ttf_api.security import require_write_access

router = APIRouter(prefix="/v1/me", tags=["me"])

_WATCHES_SELECT = WATCH_MAP_SELECT


def _contribution_count(conn, firebase_uid: str) -> int:
    row = conn.execute(
        """
        SELECT (
            (SELECT COUNT(*) FROM ttf_observations WHERE firebase_uid = %s) +
            (SELECT COUNT(*) FROM restaurant_attribute_ratings WHERE firebase_uid = %s) +
            (SELECT COUNT(*) FROM restaurant_notes WHERE firebase_uid = %s)
        )::int AS total
        """,
        (firebase_uid, firebase_uid, firebase_uid),
    ).fetchone()
    return int(row["total"])


def _prefs_to_schema(row: dict) -> NotificationPreferences:
    return NotificationPreferences(
        cadence=row["cadence"],
        quiet_hours_start=row["quiet_hours_start"].strftime("%H:%M"),
        quiet_hours_end=row["quiet_hours_end"].strftime("%H:%M"),
        alert_new_ttf=row["alert_new_ttf"],
        alert_new_rating=row["alert_new_rating"],
        alert_new_note=row["alert_new_note"],
        alert_every_review=row["alert_every_review"],
        push_enabled=row["push_enabled"],
    )


def _build_extended_profile(conn, user: AuthUser) -> ExtendedUserProfile:
    profile = ensure_user_profile(conn, user.firebase_uid)
    prefs = fetch_notification_prefs(conn, user.firebase_uid)
    unread = unread_activity_count(conn, user.firebase_uid, profile["inbox_read_through"])
    watches = watch_count(conn, user.firebase_uid)
    return ExtendedUserProfile(
        firebase_uid=user.firebase_uid,
        display_name=user.display_name,
        email=user.email,
        role=user.role,
        contribution_count=_contribution_count(conn, user.firebase_uid),
        kids_ages=list(profile["kids_ages"] or []),
        home_lat=profile["home_lat"],
        home_lng=profile["home_lng"],
        home_label=profile["home_label"],
        onboarding_completed=profile["onboarding_completed_at"] is not None,
        inbox_read_through=profile["inbox_read_through"],
        timezone=profile["timezone"],
        allergies=list(profile["allergies"] or []),
        allergy_notes=profile["allergy_notes"],
        dietary_restrictions=list(profile["dietary_restrictions"] or []),
        cuisine_likes=list(profile["cuisine_likes"] or []),
        cuisine_dislikes=list(profile["cuisine_dislikes"] or []),
        atmosphere_preferences=list(profile["atmosphere_preferences"] or []),
        preference_notes=profile["preference_notes"],
        watch_count=watches,
        unread_activity_count=unread,
        notification_preferences=_prefs_to_schema(prefs),
    )


def _row_to_activity(row: dict) -> ActivityEventItem:
    return ActivityEventItem(
        id=row["id"],
        restaurant_id=row["restaurant_id"],
        restaurant_name=row["restaurant_name"],
        event_type=row["event_type"],
        source_id=row["source_id"],
        headline=row["headline"],
        created_at=row["created_at"],
    )


@router.get("/profile", response_model=ExtendedUserProfile)
def get_profile(user: Annotated[AuthUser, Depends(get_current_user)]) -> ExtendedUserProfile:
    with get_conn() as conn:
        return _build_extended_profile(conn, user)


@router.patch("/profile", response_model=ExtendedUserProfile)
def patch_profile(
    body: UserProfilePatch,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> ExtendedUserProfile:
    with get_conn() as conn:
        ensure_user_profile(conn, user.firebase_uid)
        updates: list[str] = []
        params: list[object] = []

        if body.kids_ages is not None:
            ages = validate_kids_ages(body.kids_ages)
            updates.append("kids_ages = %s")
            params.append(ages)
        if body.home_lat is not None:
            updates.append("home_lat = %s")
            params.append(body.home_lat)
        if body.home_lng is not None:
            updates.append("home_lng = %s")
            params.append(body.home_lng)
        if body.home_label is not None:
            updates.append("home_label = %s")
            params.append(body.home_label.strip() or None)
        if body.timezone is not None:
            updates.append("timezone = %s")
            params.append(body.timezone.strip() or "America/New_York")
        if body.allergies is not None:
            updates.append("allergies = %s")
            params.append(Jsonb(validate_choice_list(body.allergies, ALLERGENS, "allergy")))
        if body.allergy_notes is not None:
            updates.append("allergy_notes = %s")
            params.append(body.allergy_notes.strip() or None)
        if body.dietary_restrictions is not None:
            updates.append("dietary_restrictions = %s")
            params.append(
                Jsonb(
                    validate_choice_list(
                        body.dietary_restrictions, DIETARY_RESTRICTIONS, "dietary restriction"
                    )
                )
            )
        if body.cuisine_likes is not None:
            updates.append("cuisine_likes = %s")
            params.append(Jsonb(validate_cuisine_tags(body.cuisine_likes, "cuisine likes")))
        if body.cuisine_dislikes is not None:
            updates.append("cuisine_dislikes = %s")
            params.append(Jsonb(validate_cuisine_tags(body.cuisine_dislikes, "cuisine dislikes")))
        if body.atmosphere_preferences is not None:
            updates.append("atmosphere_preferences = %s")
            params.append(
                Jsonb(
                    validate_choice_list(
                        body.atmosphere_preferences,
                        ATMOSPHERE_PREFERENCES,
                        "atmosphere preference",
                    )
                )
            )
        if body.preference_notes is not None:
            updates.append("preference_notes = %s")
            params.append(body.preference_notes.strip() or None)
        if body.complete_onboarding:
            updates.append("onboarding_completed_at = COALESCE(onboarding_completed_at, now())")

        if updates:
            updates.append("updated_at = now()")
            params.append(user.firebase_uid)
            conn.execute(
                f"UPDATE user_profiles SET {', '.join(updates)} WHERE firebase_uid = %s",
                params,
            )
        return _build_extended_profile(conn, user)


@router.post("/family-matches", response_model=FamilyMatchResponse)
def get_family_matches(
    body: FamilyMatchRequest,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> FamilyMatchResponse:
    """Preference-aware discovery (#88): does each restaurant fit my family?

    Bounded to the restaurant ids the caller is already looking at (e.g. the
    current map viewport) — matching recomputes aggregates per restaurant,
    which isn't cheap enough to run over the whole catalog per request.
    """
    with get_conn() as conn:
        profile = ensure_user_profile(conn, user.firebase_uid)
        rows = conn.execute(
            "SELECT id, cuisine_tags FROM restaurants WHERE id = ANY(%s)",
            (body.restaurant_ids,),
        ).fetchall()
        results: dict[str, FamilyMatchResult] = {}
        for row in rows:
            match = compute_family_match(
                conn, row["id"], list(row["cuisine_tags"] or []), profile
            )
            results[str(row["id"])] = FamilyMatchResult(**match)
        return FamilyMatchResponse(results=results)


@router.get("/watches", response_model=WatchedRestaurantsResponse)
def list_watches(
    user: Annotated[AuthUser, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> WatchedRestaurantsResponse:
    with get_conn() as conn:
        total = watch_count(conn, user.firebase_uid)
        rows = conn.execute(
            _WATCHES_SELECT
            + "WHERE w.firebase_uid = %s AND r.status = 'active' "
            + "ORDER BY w.created_at DESC LIMIT %s OFFSET %s",
            (user.firebase_uid, limit, offset),
        ).fetchall()
        items = [
            WatchedRestaurantEntry(
                restaurant=row_to_map_entry(row, watched=True),
                watched_at=row["watched_at"],
            )
            for row in rows
        ]
        return WatchedRestaurantsResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/watches/{restaurant_id}", status_code=status.HTTP_201_CREATED)
def watch_restaurant(
    restaurant_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> dict[str, bool]:
    with get_conn() as conn:
        ensure_user_profile(conn, user.firebase_uid)
        _ensure_restaurant(conn, restaurant_id)
        conn.execute(
            """
            INSERT INTO restaurant_watches (firebase_uid, restaurant_id)
            VALUES (%s, %s)
            ON CONFLICT (firebase_uid, restaurant_id) DO NOTHING
            """,
            (user.firebase_uid, restaurant_id),
        )
    return {"watched": True}


@router.delete(
    "/watches/{restaurant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def unwatch_restaurant(
    restaurant_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> Response:
    with get_conn() as conn:
        deleted = conn.execute(
            """
            DELETE FROM restaurant_watches
            WHERE firebase_uid = %s AND restaurant_id = %s
            """,
            (user.firebase_uid, restaurant_id),
        ).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Watch not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/activity", response_model=ActivityInboxResponse)
def get_activity_inbox(
    user: Annotated[AuthUser, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    restaurant_id: UUID | None = Query(None),
) -> ActivityInboxResponse:
    with get_conn() as conn:
        profile = ensure_user_profile(conn, user.firebase_uid)
        if restaurant_id is not None:
            rows = list_activity_for_restaurant(
                conn, user.firebase_uid, restaurant_id, limit=limit
            )
            total = len(rows)
        else:
            rows = list_inbox_events(
                conn,
                user.firebase_uid,
                read_through=profile["inbox_read_through"],
                unread_only=unread_only,
                limit=limit,
                offset=offset,
            )
            if unread_only:
                total = unread_activity_count(
                    conn, user.firebase_uid, profile["inbox_read_through"]
                )
            else:
                count_row = conn.execute(
                    """
                    SELECT COUNT(*)::int AS total
                    FROM activity_events e
                    JOIN restaurant_watches w ON w.restaurant_id = e.restaurant_id
                    WHERE w.firebase_uid = %s AND e.actor_firebase_uid <> %s
                    """,
                    (user.firebase_uid, user.firebase_uid),
                ).fetchone()
                total = int(count_row["total"])
        return ActivityInboxResponse(
            items=[_row_to_activity(row) for row in rows],
            total=total,
            limit=limit,
            offset=offset,
            unread_count=unread_activity_count(
                conn, user.firebase_uid, profile["inbox_read_through"]
            ),
        )


@router.get("/activity/unread-count", response_model=ActivityUnreadCountResponse)
def get_unread_count(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> ActivityUnreadCountResponse:
    with get_conn() as conn:
        profile = ensure_user_profile(conn, user.firebase_uid)
        count = unread_activity_count(conn, user.firebase_uid, profile["inbox_read_through"])
        return ActivityUnreadCountResponse(unread_count=count)


@router.post("/activity/mark-read")
def mark_activity_read(
    body: ActivityMarkReadRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> ActivityUnreadCountResponse:
    through = body.through
    if through.tzinfo is None:
        through = through.replace(tzinfo=timezone.utc)
    with get_conn() as conn:
        ensure_user_profile(conn, user.firebase_uid)
        conn.execute(
            """
            UPDATE user_profiles
            SET inbox_read_through = GREATEST(inbox_read_through, %s),
                updated_at = now()
            WHERE firebase_uid = %s
            """,
            (through, user.firebase_uid),
        )
        profile = conn.execute(
            "SELECT inbox_read_through FROM user_profiles WHERE firebase_uid = %s",
            (user.firebase_uid,),
        ).fetchone()
        count = unread_activity_count(conn, user.firebase_uid, profile["inbox_read_through"])
    return ActivityUnreadCountResponse(unread_count=count)


@router.get("/notification-preferences", response_model=NotificationPreferences)
def get_notification_preferences(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> NotificationPreferences:
    with get_conn() as conn:
        prefs = fetch_notification_prefs(conn, user.firebase_uid)
        return _prefs_to_schema(prefs)


@router.patch("/notification-preferences", response_model=NotificationPreferences)
def patch_notification_preferences(
    body: NotificationPreferencesUpdate,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> NotificationPreferences:
    with get_conn() as conn:
        ensure_user_profile(conn, user.firebase_uid)
        updates: list[str] = []
        params: list[object] = []

        if body.cadence is not None:
            updates.append("cadence = %s")
            params.append(body.cadence)
        if body.quiet_hours_start is not None:
            updates.append("quiet_hours_start = %s")
            params.append(parse_time_value(body.quiet_hours_start))
        if body.quiet_hours_end is not None:
            updates.append("quiet_hours_end = %s")
            params.append(parse_time_value(body.quiet_hours_end))
        if body.alert_new_ttf is not None:
            updates.append("alert_new_ttf = %s")
            params.append(body.alert_new_ttf)
        if body.alert_new_rating is not None:
            updates.append("alert_new_rating = %s")
            params.append(body.alert_new_rating)
        if body.alert_new_note is not None:
            updates.append("alert_new_note = %s")
            params.append(body.alert_new_note)
        if body.alert_every_review is not None:
            updates.append("alert_every_review = %s")
            params.append(body.alert_every_review)
        if body.push_enabled is not None:
            updates.append("push_enabled = %s")
            params.append(body.push_enabled)

        if updates:
            updates.append("updated_at = now()")
            params.append(user.firebase_uid)
            conn.execute(
                f"UPDATE user_notification_preferences SET {', '.join(updates)} WHERE firebase_uid = %s",
                params,
            )
        prefs = fetch_notification_prefs(conn, user.firebase_uid)
        return _prefs_to_schema(prefs)


@router.post("/push-tokens", response_model=DevicePushTokenResponse, status_code=status.HTTP_201_CREATED)
def register_push_token(
    body: DevicePushTokenRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> DevicePushTokenResponse:
    with get_conn() as conn:
        ensure_user_profile(conn, user.firebase_uid)
        row = conn.execute(
            """
            INSERT INTO device_push_tokens (firebase_uid, platform, token, last_seen_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (firebase_uid, platform, token)
            DO UPDATE SET last_seen_at = now()
            RETURNING id, platform, created_at, last_seen_at
            """,
            (user.firebase_uid, body.platform, body.token.strip()),
        ).fetchone()
        return DevicePushTokenResponse(
            id=row["id"],
            platform=row["platform"],
            created_at=row["created_at"],
            last_seen_at=row["last_seen_at"],
        )


@router.delete(
    "/push-tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_push_token(
    token_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> Response:
    with get_conn() as conn:
        deleted = conn.execute(
            """
            DELETE FROM device_push_tokens
            WHERE id = %s AND firebase_uid = %s
            """,
            (token_id, user.firebase_uid),
        ).rowcount
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Push token not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
