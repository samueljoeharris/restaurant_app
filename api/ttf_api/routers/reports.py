"""Public content report intake."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from ttf_api.auth import AuthUser
from ttf_api.db import get_conn
from ttf_api.moderation_service import submit_content_report
from ttf_api.schemas import ContentReportRequest, ContentReportResponse
from ttf_api.security import require_write_access

router = APIRouter(prefix="/v1", tags=["reports"])


@router.post("/reports", response_model=ContentReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    body: ContentReportRequest,
    user: Annotated[AuthUser, Depends(require_write_access)],
) -> ContentReportResponse:
    with get_conn() as conn:
        report_id = submit_content_report(
            conn,
            content_type=body.content_type,
            content_id=body.content_id,
            reporter_uid=user.firebase_uid,
            reason=body.reason,
            details=body.details,
        )
    return ContentReportResponse(id=report_id)
