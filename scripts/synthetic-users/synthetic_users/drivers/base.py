"""Common driver interface implemented by the API and browser drivers (#89).

Scenarios are written against this interface so either driver can run them
(the browser driver may raise NotImplementedError for a subset — see its
docstring).
"""

from __future__ import annotations

from typing import Any, Protocol


class SyntheticDriver(Protocol):
    def sign_up(self, email: str, password: str) -> dict[str, Any]: ...

    def sign_in(self, email: str, password: str) -> dict[str, Any]: ...

    def search_restaurants(self, query: str) -> list[dict[str, Any]]: ...

    def get_restaurant(self, restaurant_id: str) -> dict[str, Any]: ...

    def list_metrics(self) -> list[dict[str, Any]]: ...

    def submit_ttf(self, restaurant_id: str, body: dict[str, Any], token: str) -> dict[str, Any]: ...

    def update_ttf(self, observation_id: str, body: dict[str, Any], token: str) -> dict[str, Any]: ...

    def submit_attribute(
        self, restaurant_id: str, metric_key: str, value: Any, token: str
    ) -> dict[str, Any]: ...

    def submit_note(
        self, restaurant_id: str, text: str, token: str, tags: list[str] | None = None
    ) -> dict[str, Any]: ...

    def review_chat_reply(
        self, restaurant_name: str, messages: list[dict[str, str]], token: str
    ) -> dict[str, Any]: ...

    def review_chat_extract(self, messages: list[dict[str, str]], token: str) -> dict[str, Any]: ...

    def submit_contributions(
        self, restaurant_id: str, draft: dict[str, Any], token: str
    ) -> dict[str, Any]: ...
