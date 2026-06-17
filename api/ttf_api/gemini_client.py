"""Server-side Gemini Developer API client (key never sent to browsers)."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ttf_api.config import settings

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def gemini_configured() -> bool:
    return bool(settings.gemini_api_key.strip())


def _require_key() -> str:
    key = settings.gemini_api_key.strip()
    if not key:
        raise GeminiError("Review chat is not configured on the server.")
    return key


def generate_content(
    *,
    model: str | None = None,
    contents: list[dict[str, Any]],
    system_instruction: str | None = None,
    temperature: float = 0.7,
    max_output_tokens: int = 1024,
    response_mime_type: str | None = None,
    response_schema: dict[str, Any] | None = None,
    thinking_budget: int | None = None,
) -> str:
    key = _require_key()
    model_name = model or settings.gemini_extract_model
    url = f"{_GEMINI_BASE}/models/{model_name}:generateContent"

    generation_config: dict[str, Any] = {
        "temperature": temperature,
        "maxOutputTokens": max_output_tokens,
    }
    if response_mime_type:
        generation_config["responseMimeType"] = response_mime_type
    if response_schema:
        generation_config["responseSchema"] = response_schema
    if thinking_budget is not None:
        generation_config["thinkingConfig"] = {"thinkingBudget": thinking_budget}

    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": generation_config,
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    try:
        response = httpx.post(
            url,
            params={"key": key},
            json=body,
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise GeminiError("Review assistant is temporarily unavailable.") from exc

    if response.status_code >= 400:
        detail = response.text[:500]
        raise GeminiError(
            f"Review assistant request failed ({response.status_code}).",
            status_code=response.status_code,
        ) from None

    data = response.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        texts = [part["text"] for part in parts if "text" in part]
        if not texts:
            raise KeyError("no text parts")
        return "".join(texts)
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Review assistant returned an empty response.") from exc


def parse_json_response(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise GeminiError(
            "Could not parse structured review data. Try Preview again."
        ) from exc
