from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ttf_api.config import settings
from ttf_api.gemini_client import GeminiError, gemini_configured
from ttf_api.review_chat_service import ChatMessage, extract_draft, generate_reply
from ttf_api.routers.contributions import ContributionDraft
from ttf_api.security import AuthUser, require_write_access

router = APIRouter(prefix="/v1/review-chat", tags=["review-chat"])


class ReviewChatReplyRequest(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=200)
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


class ReviewChatReplyResponse(BaseModel):
    reply: str


class ReviewChatExtractRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


class ReviewChatExtractResponse(BaseModel):
    draft: ContributionDraft
    missing_required: list[str] = Field(default_factory=list)
    summary: str


def _ensure_review_chat_enabled() -> None:
    if not settings.review_chat_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Review chat is disabled.",
        )
    if not gemini_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Review chat is not configured on the server.",
        )


def _gemini_http_error(exc: GeminiError) -> HTTPException:
    if exc.status_code == 429:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Review assistant is rate-limited. Try again in a moment.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(exc),
    )


@router.post("/reply", response_model=ReviewChatReplyResponse)
def review_chat_reply(
    body: ReviewChatReplyRequest,
    _user: Annotated[AuthUser, Depends(require_write_access)],
) -> ReviewChatReplyResponse:
    _ensure_review_chat_enabled()
    try:
        reply = generate_reply(body.restaurant_name, body.messages)
    except GeminiError as exc:
        raise _gemini_http_error(exc) from exc
    return ReviewChatReplyResponse(reply=reply)


@router.post("/extract", response_model=ReviewChatExtractResponse)
def review_chat_extract(
    body: ReviewChatExtractRequest,
    _user: Annotated[AuthUser, Depends(require_write_access)],
) -> ReviewChatExtractResponse:
    _ensure_review_chat_enabled()
    try:
        result = extract_draft(body.messages)
    except GeminiError as exc:
        raise _gemini_http_error(exc) from exc
    return ReviewChatExtractResponse(**result)
