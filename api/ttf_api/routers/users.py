from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg.types.json import Jsonb

from ttf_api.account_deletion import delete_user_account
from ttf_api.auth import AuthUser, get_current_user, require_account_deletion, AccountDeletionAuth
from ttf_api.db import get_conn
from ttf_api.schemas import (
    AttributeSubmissionResponse,
    AttributeUpdateRequest,
    DeleteAccountRequest,
    NoteSubmissionRequest,
    NoteSubmissionResponse,
    TtfSubmissionRequest,
    TtfSubmissionResponse,
    UserAttributeContribution,
    UserContributionsResponse,
    UserNoteContribution,
    UserProfile,
    UserTtfContribution,
)
from ttf_api.security import require_write_access

router = APIRouter(prefix="/v1", tags=["users"])

_MAX_LIMIT = 100

_CONTRIBUTIONS_UNION = """
    SELECT
        'ttf'::text AS kind,
        t.id,
        t.restaurant_id,
        r.name AS restaurant_name,
        t.created_at AS submitted_at,
        t.elapsed_minutes,
        t.item_type,
        t.item_quality,
        t.portion_size,
        t.daypart,
        t.party_size_kids,
        t.wait_context,
        NULL::text AS metric_key,
        NULL::text AS metric_label,
        NULL::jsonb AS value,
        NULL::text AS visit_context,
        NULL::text AS text,
        NULL::text[] AS tags
    FROM ttf_observations t
    JOIN restaurants r ON r.id = t.restaurant_id
    WHERE t.firebase_uid = %(uid)s

    UNION ALL

    SELECT
        'attribute'::text,
        a.id,
        a.restaurant_id,
        r.name,
        a.observed_at,
        NULL::int,
        NULL::text,
        NULL::int,
        NULL::text,
        NULL::text,
        NULL::int,
        NULL::text,
        a.metric_key,
        m.label,
        a.value,
        a.visit_context,
        NULL::text,
        NULL::text[]
    FROM restaurant_attribute_ratings a
    JOIN restaurants r ON r.id = a.restaurant_id
    JOIN metric_definitions m ON m.key = a.metric_key
    WHERE a.firebase_uid = %(uid)s

    UNION ALL

    SELECT
        'note'::text,
        n.id,
        n.restaurant_id,
        r.name,
        n.created_at,
        NULL::int,
        NULL::text,
        NULL::int,
        NULL::text,
        NULL::text,
        NULL::int,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::jsonb,
        NULL::text,
        n.text,
        n.tags
    FROM restaurant_notes n
    JOIN restaurants r ON r.id = n.restaurant_id
    WHERE n.firebase_uid = %(uid)s
"""


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


def _row_to_contribution(row) -> UserTtfContribution | UserAttributeContribution | UserNoteContribution:
    kind = row["kind"]
    if kind == "ttf":
        return UserTtfContribution(
            id=row["id"],
            restaurant_id=row["restaurant_id"],
            restaurant_name=row["restaurant_name"],
            submitted_at=row["submitted_at"],
            elapsed_minutes=row["elapsed_minutes"],
            item_type=row["item_type"],
            item_quality=row["item_quality"],
            portion_size=row["portion_size"],
            daypart=row["daypart"],
            party_size_kids=row["party_size_kids"],
            wait_context=row["wait_context"],
        )
    if kind == "attribute":
        return UserAttributeContribution(
            id=row["id"],
            restaurant_id=row["restaurant_id"],
            restaurant_name=row["restaurant_name"],
            submitted_at=row["submitted_at"],
            metric_key=row["metric_key"],
            metric_label=row["metric_label"],
            value=row["value"],
            visit_context=row["visit_context"],
        )
    return UserNoteContribution(
        id=row["id"],
        restaurant_id=row["restaurant_id"],
        restaurant_name=row["restaurant_name"],
        submitted_at=row["submitted_at"],
        text=row["text"],
        tags=row["tags"] or [],
    )


def _contributions_count(conn, firebase_uid: str, kind: str | None) -> int:
    if kind == "ttf":
        sql = "SELECT COUNT(*)::int AS total FROM ttf_observations WHERE firebase_uid = %(uid)s"
    elif kind == "attribute":
        sql = (
            "SELECT COUNT(*)::int AS total FROM restaurant_attribute_ratings "
            "WHERE firebase_uid = %(uid)s"
        )
    elif kind == "note":
        sql = "SELECT COUNT(*)::int AS total FROM restaurant_notes WHERE firebase_uid = %(uid)s"
    else:
        return _contribution_count(conn, firebase_uid)
    row = conn.execute(sql, {"uid": firebase_uid}).fetchone()
    return int(row["total"])


@router.get("/me", response_model=UserProfile)
def get_me(user: Annotated[AuthUser, Depends(get_current_user)]) -> UserProfile:
    with get_conn() as conn:
        count = _contribution_count(conn, user.firebase_uid)
    return UserProfile(
        firebase_uid=user.firebase_uid,
        display_name=user.display_name,
        email=user.email,
        contribution_count=count,
        role=user.role,
    )


@router.get("/me/contributions", response_model=UserContributionsResponse)
def list_my_contributions(
    user: Annotated[AuthUser, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    kind: Literal["ttf", "attribute", "note"] | None = Query(None),
) -> UserContributionsResponse:
    params: dict = {"uid": user.firebase_uid, "limit": limit, "offset": offset}
    kind_filter = ""
    if kind:
        kind_filter = "WHERE kind = %(kind)s"
        params["kind"] = kind

    sql = (
        f"WITH combined AS ({_CONTRIBUTIONS_UNION}) "
        f"SELECT * FROM combined {kind_filter} "
        "ORDER BY submitted_at DESC "
        "LIMIT %(limit)s OFFSET %(offset)s"
    )

    with get_conn() as conn:
        total = _contributions_count(conn, user.firebase_uid, kind)
        rows = conn.execute(sql, params).fetchall()

    return UserContributionsResponse(
        items=[_row_to_contribution(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/me/ttf/{observation_id}", response_model=UserTtfContribution)
def get_my_ttf(
    observation_id: UUID,
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> UserTtfContribution:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                t.id,
                t.restaurant_id,
                r.name AS restaurant_name,
                t.created_at AS submitted_at,
                t.elapsed_minutes,
                t.item_type,
                t.item_quality,
                t.portion_size,
                t.daypart,
                t.party_size_kids,
                t.wait_context
            FROM ttf_observations t
            JOIN restaurants r ON r.id = t.restaurant_id
            WHERE t.id = %s AND t.firebase_uid = %s
            """,
            (observation_id, user.firebase_uid),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Observation not found")
    return UserTtfContribution(**row)


@router.patch("/me/ttf/{observation_id}", response_model=TtfSubmissionResponse)
def update_my_ttf(
    observation_id: UUID,
    body: TtfSubmissionRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> TtfSubmissionResponse:
    served_at = body.served_at or datetime.now(timezone.utc)
    ordered_at = body.ordered_at or (
        served_at - timedelta(minutes=body.elapsed_minutes or 0)
    )

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM ttf_observations WHERE id = %s AND firebase_uid = %s",
            (observation_id, user.firebase_uid),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Observation not found")

        row = conn.execute(
            """
            UPDATE ttf_observations
            SET ordered_at = %s,
                served_at = %s,
                elapsed_minutes = %s,
                item_type = %s,
                item_quality = %s,
                portion_size = %s,
                daypart = %s,
                party_size_kids = %s,
                wait_context = %s,
                photo_url = %s
            WHERE id = %s AND firebase_uid = %s
            RETURNING id, elapsed_minutes, item_type, item_quality
            """,
            (
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
                observation_id,
                user.firebase_uid,
            ),
        ).fetchone()
    return TtfSubmissionResponse(**row)


@router.delete("/me/ttf/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_ttf(
    observation_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> None:
    with get_conn() as conn:
        result = conn.execute(
            "DELETE FROM ttf_observations WHERE id = %s AND firebase_uid = %s RETURNING id",
            (observation_id, user.firebase_uid),
        ).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Observation not found")


@router.patch("/me/attributes/{rating_id}", response_model=AttributeSubmissionResponse)
def update_my_attribute(
    rating_id: UUID,
    body: AttributeUpdateRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> AttributeSubmissionResponse:
    with get_conn() as conn:
        existing = conn.execute(
            """
            SELECT a.metric_key
            FROM restaurant_attribute_ratings a
            WHERE a.id = %s AND a.firebase_uid = %s
            """,
            (rating_id, user.firebase_uid),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Rating not found")

        metric = conn.execute(
            "SELECT key FROM metric_definitions WHERE key = %s",
            (existing["metric_key"],),
        ).fetchone()
        if not metric:
            raise HTTPException(status_code=400, detail="Metric no longer exists")

        row = conn.execute(
            """
            UPDATE restaurant_attribute_ratings
            SET value = %s, visit_context = %s, observed_at = now()
            WHERE id = %s AND firebase_uid = %s
            RETURNING id, metric_key
            """,
            (Jsonb(body.value), body.visit_context, rating_id, user.firebase_uid),
        ).fetchone()
    return AttributeSubmissionResponse(**row)


@router.delete("/me/attributes/{rating_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_attribute(
    rating_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> None:
    with get_conn() as conn:
        result = conn.execute(
            "DELETE FROM restaurant_attribute_ratings WHERE id = %s AND firebase_uid = %s RETURNING id",
            (rating_id, user.firebase_uid),
        ).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Rating not found")


@router.patch("/me/notes/{note_id}", response_model=NoteSubmissionResponse)
def update_my_note(
    note_id: UUID,
    body: NoteSubmissionRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> NoteSubmissionResponse:
    with get_conn() as conn:
        row = conn.execute(
            """
            UPDATE restaurant_notes
            SET text = %s, tags = %s
            WHERE id = %s AND firebase_uid = %s
            RETURNING id, text, tags, created_at
            """,
            (body.text, body.tags, note_id, user.firebase_uid),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteSubmissionResponse(
        id=row["id"],
        text=row["text"],
        tags=row["tags"] or [],
        created_at=row["created_at"],
    )


@router.delete("/me/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_note(
    note_id: UUID,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> None:
    with get_conn() as conn:
        result = conn.execute(
            "DELETE FROM restaurant_notes WHERE id = %s AND firebase_uid = %s RETURNING id",
            (note_id, user.firebase_uid),
        ).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")


@router.post("/me/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    body: DeleteAccountRequest,
    auth: Annotated[AccountDeletionAuth, Depends(require_account_deletion)],
) -> None:
    delete_user_account(
        auth.user.firebase_uid,
        skip_firebase=auth.skip_firebase_delete,
        apple_authorization_code=body.apple_authorization_code,
    )
