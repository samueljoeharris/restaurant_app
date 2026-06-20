from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, ValidationError

from ttf_api.activity_events import emit_activity_event
from ttf_api.contribution_schema import build_contribution_schema
from ttf_api.auth import AuthUser
from ttf_api.db import get_conn
from ttf_api.places_seed import PlacesSeedError, ensure_restaurant_for_place, require_maps_api_key
from ttf_api.routers.restaurants import _ensure_restaurant
from ttf_api.schemas import (
    AttributeSubmissionRequest,
    AttributeSubmissionResponse,
    NoteSubmissionRequest,
    NoteSubmissionResponse,
    TtfSubmissionRequest,
    TtfSubmissionResponse,
)
from ttf_api.security import require_write_access

router = APIRouter(prefix="/v1", tags=["contributions"])


class ContributionDraft(BaseModel):
    ttf: TtfSubmissionRequest | None = None
    attributes: list[AttributeSubmissionRequest] = Field(default_factory=list)
    note: NoteSubmissionRequest | None = None


class ContributionPreviewResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    missing_required: list[str] = Field(default_factory=list)
    draft: ContributionDraft
    ready_to_submit: bool = False


class ContributionSubmitResponse(BaseModel):
    ttf: TtfSubmissionResponse | None = None
    attributes: list[AttributeSubmissionResponse] = Field(default_factory=list)
    note: NoteSubmissionResponse | None = None


def _ttf_missing_fields(ttf: dict[str, Any]) -> list[str]:
    required = [
        "elapsed_minutes",
        "item_type",
        "item_quality",
        "portion_size",
        "daypart",
        "party_size_kids",
    ]
    return [field for field in required if ttf.get(field) is None]


def _validate_draft(conn, draft: ContributionDraft) -> ContributionPreviewResponse:
    errors: list[str] = []
    missing: list[str] = []

    has_ttf = draft.ttf is not None
    has_attrs = len(draft.attributes) > 0
    has_note = draft.note is not None

    if not has_ttf and not has_attrs and not has_note:
        errors.append("Provide at least one of: ttf, attributes, or note.")

    if draft.ttf is not None:
        partial = draft.ttf.model_dump(exclude_none=True)
        missing.extend(f"ttf.{field}" for field in _ttf_missing_fields(partial))
        try:
            TtfSubmissionRequest.model_validate(draft.ttf.model_dump())
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(part) for part in err["loc"])
                errors.append(f"ttf.{loc}: {err['msg']}")

    for index, attr in enumerate(draft.attributes):
        metric = conn.execute(
            "SELECT key, metric_type, enum_values, min_value, max_value FROM metric_definitions WHERE key = %s",
            (attr.metric_key,),
        ).fetchone()
        if not metric:
            errors.append(f"attributes[{index}].metric_key: unknown metric_key {attr.metric_key!r}")
            continue
        _validate_attribute_value(index, metric, attr.value, errors)

    if draft.note is not None:
        try:
            NoteSubmissionRequest.model_validate(draft.note.model_dump())
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(part) for part in err["loc"])
                errors.append(f"note.{loc}: {err['msg']}")

    ready = len(errors) == 0 and len(missing) == 0 and (has_ttf or has_attrs or has_note)
    return ContributionPreviewResponse(
        valid=len(errors) == 0,
        errors=errors,
        missing_required=missing,
        draft=draft,
        ready_to_submit=ready,
    )


def _validate_attribute_value(
    index: int,
    metric: dict[str, Any],
    value: Any,
    errors: list[str],
) -> None:
    prefix = f"attributes[{index}]"
    metric_type = metric["metric_type"]
    if metric_type == "boolean":
        if not isinstance(value, bool):
            errors.append(f"{prefix}.value: expected boolean for {metric['key']}")
        return
    if metric_type == "numeric":
        if not isinstance(value, (int, float)):
            errors.append(f"{prefix}.value: expected number for {metric['key']}")
            return
        if metric["min_value"] is not None and value < metric["min_value"]:
            errors.append(f"{prefix}.value: below minimum for {metric['key']}")
        if metric["max_value"] is not None and value > metric["max_value"]:
            errors.append(f"{prefix}.value: above maximum for {metric['key']}")
        return
    if metric_type == "enum":
        allowed = list(metric["enum_values"] or [])
        if value not in allowed:
            errors.append(
                f"{prefix}.value: {value!r} not in {allowed} for {metric['key']}"
            )



def _raise_place_error(exc: PlacesSeedError) -> None:
    code = status.HTTP_503_SERVICE_UNAVAILABLE if "MAPS_API_KEY" in str(exc) else status.HTTP_400_BAD_REQUEST
    if "not found" in str(exc).lower():
        code = status.HTTP_404_NOT_FOUND
    raise HTTPException(status_code=code, detail=str(exc)) from exc

def _persist_contributions(conn, restaurant_id, body, user):
    preview = _validate_draft(conn, body)
    if not preview.ready_to_submit:
        raise HTTPException(status_code=400, detail={"message": "Contribution draft is incomplete or invalid.", "errors": preview.errors, "missing_required": preview.missing_required})
    response = ContributionSubmitResponse()
    if body.ttf is not None:
        served_at = body.ttf.served_at or datetime.now(timezone.utc)
        ordered_at = body.ttf.ordered_at or (served_at - timedelta(minutes=body.ttf.elapsed_minutes or 0))
        row = conn.execute("""INSERT INTO ttf_observations (restaurant_id, firebase_uid, ordered_at, served_at, elapsed_minutes, item_type, item_quality, portion_size, daypart, party_size_kids, wait_context, photo_url) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, elapsed_minutes, item_type, item_quality""", (restaurant_id, user.firebase_uid, ordered_at, served_at, body.ttf.elapsed_minutes, body.ttf.item_type, body.ttf.item_quality, body.ttf.portion_size, body.ttf.daypart, body.ttf.party_size_kids, body.ttf.wait_context, body.ttf.photo_url)).fetchone()
        response.ttf = TtfSubmissionResponse(**row)
        emit_activity_event(conn, restaurant_id=restaurant_id, event_type="ttf", source_id=row["id"], actor_firebase_uid=user.firebase_uid)
    for attr in body.attributes:
        row = conn.execute("INSERT INTO restaurant_attribute_ratings (restaurant_id, metric_key, firebase_uid, value, visit_context) VALUES (%s,%s,%s,%s,%s) RETURNING id, metric_key", (restaurant_id, attr.metric_key, user.firebase_uid, Jsonb(attr.value), attr.visit_context)).fetchone()
        response.attributes.append(AttributeSubmissionResponse(**row))
        emit_activity_event(conn, restaurant_id=restaurant_id, event_type="attribute", source_id=row["id"], actor_firebase_uid=user.firebase_uid)
    if body.note is not None:
        row = conn.execute("INSERT INTO restaurant_notes (restaurant_id, firebase_uid, text, tags) VALUES (%s,%s,%s,%s) RETURNING id, text, tags, created_at", (restaurant_id, user.firebase_uid, body.note.text, body.note.tags)).fetchone()
        response.note = NoteSubmissionResponse(id=row["id"], text=row["text"], tags=row["tags"] or [], created_at=row["created_at"])
        emit_activity_event(conn, restaurant_id=restaurant_id, event_type="note", source_id=row["id"], actor_firebase_uid=user.firebase_uid)
    return response

@router.get("/contribution-schema")
def get_contribution_schema() -> dict[str, Any]:
    with get_conn() as conn:
        return build_contribution_schema(conn)


@router.post(
    "/restaurants/{restaurant_id}/contributions/preview",
    response_model=ContributionPreviewResponse,
)
def preview_contributions(
    restaurant_id: UUID,
    body: ContributionDraft,
    _user: Annotated[AuthUser, Depends(require_write_access)],
) -> ContributionPreviewResponse:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        return _validate_draft(conn, body)


@router.post(
    "/restaurants/{restaurant_id}/contributions",
    response_model=ContributionSubmitResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_contributions(
    restaurant_id: UUID,
    body: ContributionDraft,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> ContributionSubmitResponse:
    with get_conn() as conn:
        _ensure_restaurant(conn, restaurant_id)
        return _persist_contributions(conn, restaurant_id, body, user)



@router.post("/places/{place_id}/contributions/preview", response_model=ContributionPreviewResponse)
def preview_place_contributions(place_id: str, body: ContributionDraft, _user: Annotated[AuthUser, Depends(require_write_access)]) -> ContributionPreviewResponse:
    with get_conn() as conn:
        return _validate_draft(conn, body)

@router.post("/places/{place_id}/contributions", response_model=ContributionSubmitResponse, status_code=status.HTTP_201_CREATED)
def submit_place_contributions(place_id: str, body: ContributionDraft, user: Annotated[AuthUser, Depends(require_write_access)]) -> ContributionSubmitResponse:
    try:
        api_key = require_maps_api_key()
    except PlacesSeedError as exc:
        _raise_place_error(exc)
    with get_conn() as conn:
        try:
            restaurant_id = ensure_restaurant_for_place(conn, place_id, api_key)
        except PlacesSeedError as exc:
            _raise_place_error(exc)
        return _persist_contributions(conn, restaurant_id, body, user)
