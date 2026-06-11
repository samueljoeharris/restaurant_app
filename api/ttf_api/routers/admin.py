"""Admin-only analytics and management endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from firebase_admin import auth as firebase_auth

from ttf_api.auth import AuthUser, _init_firebase, require_admin
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.iap import IapJwtError, verify_iap_jwt
from ttf_api.schemas import (
    AdminActivityDay,
    AdminActivityResponse,
    AdminContributorRow,
    AdminContributorsResponse,
    AdminFirebaseSessionResponse,
    AdminObservationRow,
    AdminObservationsResponse,
    AdminOverviewStats,
    AdminRestaurantRow,
    AdminRestaurantsResponse,
)

router = APIRouter(prefix="/v1/admin", tags=["admin"])

_MAX_LIMIT = 200


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, _MAX_LIMIT))


@router.get("/firebase-session", response_model=AdminFirebaseSessionResponse)
async def admin_firebase_session(
    x_goog_iap_jwt_assertion: Annotated[str | None, Header()] = None,
) -> AdminFirebaseSessionResponse:
    """Exchange a verified IAP login for a Firebase custom token (admin SPA SSO)."""
    if settings.auth_dev_mode and not x_goog_iap_jwt_assertion:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="IAP session bootstrap is disabled in AUTH_DEV_MODE without IAP headers",
        )

    try:
        iap_claims = verify_iap_jwt(x_goog_iap_jwt_assertion or "")
    except IapJwtError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    email = iap_claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="IAP token missing email",
        )

    _init_firebase()
    try:
        user = firebase_auth.get_user_by_email(email)
    except firebase_auth.UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "No Firebase account for this Google user. "
                "Sign in on the public app once, then grant admin access."
            ),
        ) from exc

    role = (user.custom_claims or {}).get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    custom_token = firebase_auth.create_custom_token(user.uid)
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode("utf-8")
    return AdminFirebaseSessionResponse(custom_token=custom_token)


def _enrich_firebase_users(rows: list[AdminContributorRow]) -> list[AdminContributorRow]:
    if not rows:
        return rows
    try:
        _init_firebase()
        result = firebase_auth.get_users(
            [firebase_auth.UidIdentifier(uid=r.firebase_uid) for r in rows]
        )
    except Exception:
        return rows

    by_uid = {user.uid: user for user in result.users}
    enriched: list[AdminContributorRow] = []
    for row in rows:
        fb = by_uid.get(row.firebase_uid)
        if not fb:
            enriched.append(row)
            continue
        enriched.append(
            row.model_copy(
                update={
                    "email": fb.email or row.email,
                    "display_name": fb.display_name or row.display_name,
                    "disabled": fb.disabled,
                }
            )
        )
    return enriched


@router.get("/stats", response_model=AdminOverviewStats)
def admin_stats(_admin: Annotated[AuthUser, Depends(require_admin)]) -> AdminOverviewStats:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                (SELECT COUNT(*)::int FROM restaurants WHERE pilot_city = %s) AS restaurant_count,
                (SELECT COUNT(*)::int FROM restaurants r
                 WHERE r.pilot_city = %s
                   AND EXISTS (SELECT 1 FROM ttf_observations t WHERE t.restaurant_id = r.id)
                ) AS restaurants_with_ttf,
                (SELECT COUNT(*)::int FROM restaurants r
                 WHERE r.pilot_city = %s
                   AND (
                     EXISTS (SELECT 1 FROM ttf_observations t WHERE t.restaurant_id = r.id)
                     OR EXISTS (SELECT 1 FROM restaurant_attribute_ratings a WHERE a.restaurant_id = r.id)
                     OR EXISTS (SELECT 1 FROM restaurant_notes n WHERE n.restaurant_id = r.id)
                   )
                ) AS restaurants_with_any_data,
                (SELECT COUNT(*)::int FROM ttf_observations) AS ttf_observation_count,
                (SELECT COUNT(*)::int FROM restaurant_attribute_ratings) AS attribute_rating_count,
                (SELECT COUNT(*)::int FROM restaurant_notes) AS note_count,
                (SELECT COUNT(DISTINCT firebase_uid)::int FROM (
                    SELECT firebase_uid FROM ttf_observations
                    UNION
                    SELECT firebase_uid FROM restaurant_attribute_ratings
                    UNION
                    SELECT firebase_uid FROM restaurant_notes
                ) u) AS contributor_count,
                (SELECT COUNT(*)::int FROM ttf_observations
                 WHERE created_at >= now() - interval '7 days') AS ttf_last_7_days,
                (SELECT COUNT(*)::int FROM restaurant_attribute_ratings
                 WHERE observed_at >= now() - interval '7 days') AS attribute_ratings_last_7_days,
                (SELECT COUNT(*)::int FROM restaurant_notes
                 WHERE created_at >= now() - interval '7 days') AS notes_last_7_days,
                (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float
                 FROM ttf_observations) AS median_ttf_minutes,
                (SELECT AVG(item_quality)::float FROM ttf_observations) AS avg_ttf_quality
            """,
            (settings.pilot_city, settings.pilot_city, settings.pilot_city),
        ).fetchone()

    return AdminOverviewStats(
        pilot_city=settings.pilot_city,
        pilot_display_name=settings.pilot_display_name,
        restaurant_count=int(row["restaurant_count"]),
        restaurants_with_ttf=int(row["restaurants_with_ttf"]),
        restaurants_with_any_data=int(row["restaurants_with_any_data"]),
        ttf_observation_count=int(row["ttf_observation_count"]),
        attribute_rating_count=int(row["attribute_rating_count"]),
        note_count=int(row["note_count"]),
        contributor_count=int(row["contributor_count"]),
        ttf_last_7_days=int(row["ttf_last_7_days"]),
        attribute_ratings_last_7_days=int(row["attribute_ratings_last_7_days"]),
        notes_last_7_days=int(row["notes_last_7_days"]),
        median_ttf_minutes=row["median_ttf_minutes"],
        avg_ttf_quality=row["avg_ttf_quality"],
    )


@router.get("/activity", response_model=AdminActivityResponse)
def admin_activity(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    days: int = Query(14, ge=1, le=90),
) -> AdminActivityResponse:
    with get_conn() as conn:
        rows = conn.execute(
            """
            WITH day_series AS (
                SELECT generate_series(
                    (current_date - (%s - 1) * interval '1 day')::date,
                    current_date,
                    interval '1 day'
                )::date AS day
            ),
            ttf AS (
                SELECT created_at::date AS day, COUNT(*)::int AS cnt
                FROM ttf_observations
                WHERE created_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            ),
            attrs AS (
                SELECT observed_at::date AS day, COUNT(*)::int AS cnt
                FROM restaurant_attribute_ratings
                WHERE observed_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            ),
            notes AS (
                SELECT created_at::date AS day, COUNT(*)::int AS cnt
                FROM restaurant_notes
                WHERE created_at >= current_date - (%s - 1) * interval '1 day'
                GROUP BY 1
            )
            SELECT
                ds.day::text AS day,
                COALESCE(t.cnt, 0) AS ttf_count,
                COALESCE(a.cnt, 0) AS attribute_count,
                COALESCE(n.cnt, 0) AS note_count
            FROM day_series ds
            LEFT JOIN ttf t ON t.day = ds.day
            LEFT JOIN attrs a ON a.day = ds.day
            LEFT JOIN notes n ON n.day = ds.day
            ORDER BY ds.day
            """,
            (days, days, days, days),
        ).fetchall()

    return AdminActivityResponse(
        days=[
            AdminActivityDay(
                day=r["day"],
                ttf_count=int(r["ttf_count"]),
                attribute_count=int(r["attribute_count"]),
                note_count=int(r["note_count"]),
            )
            for r in rows
        ]
    )


@router.get("/users", response_model=AdminContributorsResponse)
def admin_users(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminContributorsResponse:
    limit = _clamp_limit(limit)
    with get_conn() as conn:
        total_row = conn.execute(
            """
            SELECT COUNT(*)::int AS total FROM (
                SELECT firebase_uid FROM ttf_observations
                UNION
                SELECT firebase_uid FROM restaurant_attribute_ratings
                UNION
                SELECT firebase_uid FROM restaurant_notes
            ) u
            """
        ).fetchone()
        rows = conn.execute(
            """
            WITH combined AS (
                SELECT firebase_uid, 'ttf'::text AS kind, created_at AS active_at
                FROM ttf_observations
                UNION ALL
                SELECT firebase_uid, 'attr', observed_at FROM restaurant_attribute_ratings
                UNION ALL
                SELECT firebase_uid, 'note', created_at FROM restaurant_notes
            )
            SELECT
                firebase_uid,
                COUNT(*) FILTER (WHERE kind = 'ttf')::int AS ttf_count,
                COUNT(*) FILTER (WHERE kind = 'attr')::int AS attribute_count,
                COUNT(*) FILTER (WHERE kind = 'note')::int AS note_count,
                COUNT(*)::int AS total_contributions,
                MAX(active_at) AS last_active_at
            FROM combined
            GROUP BY firebase_uid
            ORDER BY last_active_at DESC NULLS LAST
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        ).fetchall()

    items = [
        AdminContributorRow(
            firebase_uid=r["firebase_uid"],
            ttf_count=int(r["ttf_count"]),
            attribute_count=int(r["attribute_count"]),
            note_count=int(r["note_count"]),
            total_contributions=int(r["total_contributions"]),
            last_active_at=r["last_active_at"],
        )
        for r in rows
    ]
    items = _enrich_firebase_users(items)

    return AdminContributorsResponse(
        items=items,
        total=int(total_row["total"]),
        limit=limit,
        offset=offset,
    )


@router.get("/restaurants", response_model=AdminRestaurantsResponse)
def admin_restaurants(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminRestaurantsResponse:
    limit = _clamp_limit(limit)
    params: list[object] = [settings.pilot_city]
    where = "WHERE r.pilot_city = %s"
    if q and q.strip():
        where += " AND r.name ILIKE %s"
        params.append(f"%{q.strip()}%")

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*)::int AS total FROM restaurants r {where}",
            tuple(params),
        ).fetchone()
        rows = conn.execute(
            f"""
            SELECT
                r.id,
                r.name,
                r.address,
                r.cuisine_tags,
                r.updated_at,
                COALESCE(t.sample_size, 0)::int AS ttf_sample_size,
                t.median_minutes AS ttf_median_minutes,
                t.avg_quality AS ttf_avg_quality,
                COALESCE(a.cnt, 0)::int AS attribute_rating_count,
                COALESCE(n.cnt, 0)::int AS note_count
            FROM restaurants r
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::int AS sample_size,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes)::float
                        AS median_minutes,
                    AVG(item_quality)::float AS avg_quality
                FROM ttf_observations o
                WHERE o.restaurant_id = r.id
            ) t ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS cnt
                FROM restaurant_attribute_ratings ar
                WHERE ar.restaurant_id = r.id
            ) a ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS cnt FROM restaurant_notes rn
                WHERE rn.restaurant_id = r.id
            ) n ON true
            {where}
            ORDER BY ttf_sample_size DESC, r.name
            LIMIT %s OFFSET %s
            """,
            tuple([*params, limit, offset]),
        ).fetchall()

    return AdminRestaurantsResponse(
        items=[
            AdminRestaurantRow(
                id=r["id"],
                name=r["name"],
                address=r["address"],
                cuisine_tags=r["cuisine_tags"] or [],
                ttf_sample_size=int(r["ttf_sample_size"]),
                ttf_median_minutes=r["ttf_median_minutes"],
                ttf_avg_quality=r["ttf_avg_quality"],
                attribute_rating_count=int(r["attribute_rating_count"]),
                note_count=int(r["note_count"]),
                updated_at=r["updated_at"],
            )
            for r in rows
        ],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )


@router.get("/observations", response_model=AdminObservationsResponse)
def admin_observations(
    _admin: Annotated[AuthUser, Depends(require_admin)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
) -> AdminObservationsResponse:
    limit = _clamp_limit(limit)
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*)::int AS total FROM ttf_observations"
        ).fetchone()
        rows = conn.execute(
            """
            SELECT
                o.id,
                o.restaurant_id,
                r.name AS restaurant_name,
                o.firebase_uid,
                o.elapsed_minutes,
                o.item_type,
                o.item_quality,
                o.daypart,
                o.created_at
            FROM ttf_observations o
            JOIN restaurants r ON r.id = o.restaurant_id
            ORDER BY o.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
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
            )
            for r in rows
        ],
        total=int(total["total"]),
        limit=limit,
        offset=offset,
    )
