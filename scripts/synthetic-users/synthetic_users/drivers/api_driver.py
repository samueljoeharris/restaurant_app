"""API-first driver (#89): Firebase email/password sign-in -> ID token -> real
/v1 endpoints. This is the primary driver — fast, reliable, and covers the
full data path without a browser.

Every real call needs FIREBASE_API_KEY (or VITE_FIREBASE_API_KEY, already
synced to web/.env.local) in the environment; pass dry_run=True to log
intended calls with no network access at all — used for local smoke-testing
the CLI/orchestration wiring without secrets.
"""

from __future__ import annotations

import os
from typing import Any

from .. import http_client as http
from ..config import TargetConfig

IDENTITY_TOOLKIT_BASE = "https://identitytoolkit.googleapis.com/v1/accounts"


class ApiDriver:
    def __init__(
        self,
        target: TargetConfig,
        *,
        firebase_api_key: str | None = None,
        dry_run: bool = False,
    ):
        self.target = target
        self.firebase_api_key = (
            firebase_api_key
            or os.environ.get("FIREBASE_API_KEY")
            or os.environ.get("VITE_FIREBASE_API_KEY")
        )
        self.dry_run = dry_run
        if not dry_run and not self.firebase_api_key:
            raise RuntimeError(
                "FIREBASE_API_KEY is required for a real run "
                "(set it, or pass --dry-run to test without secrets)."
            )

    def _api_url(self, path: str) -> str:
        return f"{self.target.api_base_url}{path}"

    def _identity_toolkit(self, action: str, email: str, password: str) -> dict[str, Any]:
        if self.dry_run:
            return {"idToken": "dry-run-token", "localId": "dry-run-uid"}
        url = f"{IDENTITY_TOOLKIT_BASE}:{action}?key={self.firebase_api_key}"
        return http.request_json(
            "POST",
            url,
            json_body={"email": email, "password": password, "returnSecureToken": True},
        )

    def sign_up(self, email: str, password: str) -> dict[str, Any]:
        result = self._identity_toolkit("signUp", email, password)
        return {"id_token": result["idToken"], "uid": result["localId"]}

    def sign_in(self, email: str, password: str) -> dict[str, Any]:
        result = self._identity_toolkit("signInWithPassword", email, password)
        return {"id_token": result["idToken"], "uid": result["localId"]}

    def search_restaurants(self, query: str) -> list[dict[str, Any]]:
        if self.dry_run:
            return [{"id": "dry-run-restaurant", "name": f"Dry Run Cafe ({query})"}]
        return http.request_json("GET", self._api_url(f"/v1/restaurants?q={query}"))

    def get_restaurant(self, restaurant_id: str) -> dict[str, Any]:
        if self.dry_run:
            return {"restaurant": {"id": restaurant_id, "name": "Dry Run Cafe"}}
        return http.request_json("GET", self._api_url(f"/v1/restaurants/{restaurant_id}"))

    def list_metrics(self) -> list[dict[str, Any]]:
        if self.dry_run:
            return [
                {"key": "high_chair_availability", "metric_type": "enum",
                 "enum_values": ["always", "usually", "sometimes", "never"]},
            ]
        return http.request_json("GET", self._api_url("/v1/metrics"))

    def submit_ttf(self, restaurant_id: str, body: dict[str, Any], token: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id": "dry-run-observation", **body}
        return http.request_json(
            "POST", self._api_url(f"/v1/restaurants/{restaurant_id}/ttf"), json_body=body, token=token
        )

    def update_ttf(self, observation_id: str, body: dict[str, Any], token: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id": observation_id, **body}
        return http.request_json(
            "PATCH", self._api_url(f"/v1/me/ttf/{observation_id}"), json_body=body, token=token
        )

    def submit_attribute(
        self, restaurant_id: str, metric_key: str, value: Any, token: str
    ) -> dict[str, Any]:
        if self.dry_run:
            return {"metric_key": metric_key, "value": value}
        return http.request_json(
            "POST",
            self._api_url(f"/v1/restaurants/{restaurant_id}/attributes"),
            json_body={"metric_key": metric_key, "value": value},
            token=token,
        )

    def submit_note(
        self, restaurant_id: str, text: str, token: str, tags: list[str] | None = None
    ) -> dict[str, Any]:
        if self.dry_run:
            return {"id": "dry-run-note", "text": text, "tags": tags or []}
        return http.request_json(
            "POST",
            self._api_url(f"/v1/restaurants/{restaurant_id}/notes"),
            json_body={"text": text, "tags": tags or []},
            token=token,
        )

    def review_chat_reply(
        self, restaurant_name: str, messages: list[dict[str, str]], token: str
    ) -> dict[str, Any]:
        if self.dry_run:
            return {"reply": "Sounds like a great trip — tell me more about the food!"}
        return http.request_json(
            "POST",
            self._api_url("/v1/review-chat/reply"),
            json_body={"restaurant_name": restaurant_name, "messages": messages},
            token=token,
        )

    def review_chat_extract(self, messages: list[dict[str, str]], token: str) -> dict[str, Any]:
        if self.dry_run:
            return {"draft": {}, "missing_required": [], "summary": "dry run"}
        return http.request_json(
            "POST", self._api_url("/v1/review-chat/extract"), json_body={"messages": messages}, token=token
        )

    def submit_contributions(
        self, restaurant_id: str, draft: dict[str, Any], token: str
    ) -> dict[str, Any]:
        if self.dry_run:
            return {"pending_review": False}
        return http.request_json(
            "POST", self._api_url(f"/v1/restaurants/{restaurant_id}/contributions"), json_body=draft, token=token
        )
