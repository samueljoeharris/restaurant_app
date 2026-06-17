"""Review chat prompts and structured extraction for Little Scout contributions."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from ttf_api.config import settings
from ttf_api.contribution_schema import build_contribution_schema, build_extraction_json_schema
from ttf_api.db import get_conn
from ttf_api.gemini_client import generate_content, parse_json_response
from ttf_api.routers.contributions import ContributionDraft, _ttf_missing_fields

# Chat = cheap plain-text turns. Extract (Preview submission) = structured JSON only.


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4000)


def build_chat_system_prompt(restaurant_name: str) -> str:
    return f"""You are Little Scout's friendly review assistant helping a parent share their visit at "{restaurant_name}".

Your job:
1. Invite them to describe the visit in their own words.
2. Gently ask about kid food speed (wait time, what arrived, quality), family-friendly details (high chairs, stroller, noise, kids menu), and tips for other parents.
3. Ask short follow-ups ONLY for details they have not mentioned yet. Do not invent facts.
4. When they seem done, suggest tapping "Preview submission" — you cannot submit data yourself.

Keep replies concise (2-4 sentences). Warm, parent-to-parent tone."""


def _to_gemini_contents(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for message in messages:
        role = "user" if message.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": message.text}]})
    return contents


def generate_reply(restaurant_name: str, messages: list[ChatMessage]) -> str:
    return generate_content(
        model=settings.gemini_chat_model,
        contents=_to_gemini_contents(messages),
        system_instruction=build_chat_system_prompt(restaurant_name),
        temperature=0.7,
        max_output_tokens=512,
    )


def _coerce_attribute(
    metric_key: str, raw: str, schema: dict[str, Any]
) -> bool | int | float | str:
    metric = schema["attributes"]["metrics"].get(metric_key)
    if not metric:
        return raw
    if metric["type"] == "boolean":
        if raw == "true":
            return True
        if raw == "false":
            return False
        return raw.lower() in ("yes", "1", "true")
    if metric["type"] == "numeric":
        try:
            return int(raw) if "." not in raw else float(raw)
        except ValueError:
            return raw
    return raw


def _clean_ttf(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if not raw:
        return None
    cleaned = {k: v for k, v in raw.items() if v is not None}
    return cleaned or None


def _build_summary(draft: ContributionDraft) -> str:
    parts: list[str] = []
    if draft.ttf is not None:
        ttf = draft.ttf
        parts.append(
            f"kid food speed ({ttf.elapsed_minutes or '?'} min, {ttf.item_type or '?'})"
        )
    if draft.attributes:
        n = len(draft.attributes)
        parts.append(f"{n} parent rating{'s' if n != 1 else ''}")
    if draft.note and draft.note.text:
        parts.append("a visit note")
    if not parts:
        return "We couldn't extract structured data yet — try adding a bit more detail."
    return f"Ready to submit: {', '.join(parts)}."


def _merge_missing_required(
    draft: ContributionDraft,
    from_model: list[str],
) -> list[str]:
    merged = list(from_model)
    seen = set(merged)
    if draft.ttf is not None:
        partial = draft.ttf.model_dump(exclude_none=True)
        for field in _ttf_missing_fields(partial):
            key = f"ttf.{field}"
            if key not in seen:
                merged.append(key)
                seen.add(key)
    return merged


def extract_draft(messages: list[ChatMessage]) -> dict[str, Any]:
    with get_conn() as conn:
        schema = build_contribution_schema(conn)

    transcript = "\n\n".join(
        f"{'Parent' if m.role == 'user' else 'Assistant'}: {m.text}" for m in messages
    )
    prompt = f"""Extract structured Little Scout contributions from this review conversation.

Authoritative schema (use exact enum strings and metric_key values):
{json.dumps(schema, indent=2)}

Conversation:
{transcript}

Rules:
- Only include fields clearly stated or strongly implied in the conversation.
- Omit unknown TTF fields rather than guessing.
- For attributes, use exact metric_key strings from the schema; encode value as a string.
- Include a note only for freeform tips not captured in TTF or attributes.
- Keep note.text concise (under 400 characters).
- List missing required TTF fields in missing_required when partial TTF data exists."""

    raw = generate_content(
        model=settings.gemini_extract_model,
        contents=[{"role": "user", "parts": [{"text": prompt}]}],
        temperature=0.1,
        max_output_tokens=1536,
        response_mime_type="application/json",
        response_schema=build_extraction_json_schema(),
        thinking_budget=0,
    )
    parsed = parse_json_response(raw)

    from ttf_api.schemas import (
        AttributeSubmissionRequest,
        NoteSubmissionRequest,
        TtfSubmissionRequest,
    )

    valid_metric_keys = set(schema["attributes"]["metrics"].keys())
    draft = ContributionDraft(
        attributes=[
            AttributeSubmissionRequest(
                metric_key=attr["metric_key"],
                value=_coerce_attribute(
                    attr["metric_key"], str(attr["value"]), schema
                ),
                visit_context=attr.get("visit_context"),
            )
            for attr in parsed.get("attributes") or []
            if attr.get("metric_key") in valid_metric_keys
        ],
    )

    ttf_raw = _clean_ttf(parsed.get("ttf"))
    if ttf_raw:
        try:
            draft.ttf = TtfSubmissionRequest(**ttf_raw)
        except ValidationError:
            pass

    note_raw = parsed.get("note")
    if isinstance(note_raw, dict) and note_raw.get("text", "").strip():
        draft.note = NoteSubmissionRequest(
            text=note_raw["text"].strip(),
            tags=note_raw.get("tags") or [],
        )

    missing_required = _merge_missing_required(
        draft,
        parsed.get("missing_required") or [],
    )

    return {
        "draft": draft,
        "missing_required": missing_required,
        "summary": _build_summary(draft),
    }
