"""Optional Playwright browser driver (#89) — the true UI path, covering the
four scenarios already documented for manual/Cursor use in
.cursor/skills/synthetic-user/SKILL.md: signup, search, submit_ttf, update_ttf.

Flag-selected via `--driver browser`; requires:

    pip install playwright && playwright install chromium

`rate_attributes`, `post_note`, and `review_chat` are API-driver only for
now — they raise NotImplementedError with a pointer to `--driver api`.
"""

from __future__ import annotations

from typing import Any

from ..config import TargetConfig


class BrowserDriver:
    def __init__(
        self,
        target: TargetConfig,
        *,
        web_base_url: str | None = None,
        dry_run: bool = False,
        headless: bool = True,
    ):
        self.target = target
        self.web_base_url = web_base_url or target.web_base_url
        self.dry_run = dry_run
        self._playwright = None
        self._browser = None
        self._page = None
        if not dry_run:
            try:
                from playwright.sync_api import sync_playwright
            except ImportError as exc:
                raise RuntimeError(
                    "Playwright is not installed. Run: "
                    "pip install playwright && playwright install chromium"
                ) from exc
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(headless=headless)
            self._page = self._browser.new_page(viewport={"width": 390, "height": 844})

    def close(self) -> None:
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def sign_up(self, email: str, password: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id_token": "dry-run-token", "uid": "dry-run-uid"}
        page = self._page
        page.goto(f"{self.web_base_url}/login")
        page.get_by_text("Need an account? Sign up").click()
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password").fill(password)
        page.get_by_role("button", name="Create account").click()
        page.wait_for_url(f"{self.web_base_url}/map", timeout=15000)
        # UID/idToken come from the admin-tagging step (set_synthetic_claim.py),
        # not from the browser session.
        return {"id_token": "", "uid": ""}

    def sign_in(self, email: str, password: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id_token": "dry-run-token", "uid": "dry-run-uid"}
        page = self._page
        page.goto(f"{self.web_base_url}/login")
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password").fill(password)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url(f"{self.web_base_url}/map", timeout=15000)
        return {"id_token": "", "uid": ""}

    def search_restaurants(self, query: str) -> list[dict[str, Any]]:
        if self.dry_run:
            return [{"id": "dry-run-restaurant", "name": f"Dry Run Cafe ({query})"}]
        page = self._page
        page.goto(f"{self.web_base_url}/map")
        page.get_by_placeholder("Search by name or place…").fill(query)
        page.wait_for_timeout(1000)
        # The browser driver navigates by clicking rather than returning ids;
        # scenarios using it should drive the UI directly instead of relying
        # on this return value.
        return []

    def get_restaurant(self, restaurant_id: str) -> dict[str, Any]:
        raise NotImplementedError(
            "Browser driver navigates via clicks; use --driver api for direct restaurant fetches."
        )

    def list_metrics(self) -> list[dict[str, Any]]:
        raise NotImplementedError("rate_attributes is API-driver only for now — use --driver api.")

    def submit_ttf(self, restaurant_id: str, body: dict[str, Any], token: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id": "dry-run-observation", **body}
        page = self._page
        # ?manual=1 forces the DIY timer/form; the bare /submit route is now the
        # agent-first chat shell (#100).
        page.goto(f"{self.web_base_url}/restaurants/{restaurant_id}/submit?manual=1")
        page.get_by_label("Or enter elapsed minutes").fill(str(body["elapsed_minutes"]))
        page.get_by_role("button", name="Submit observation").click()
        page.wait_for_timeout(1500)
        return {"id": ""}

    def update_ttf(self, observation_id: str, body: dict[str, Any], token: str) -> dict[str, Any]:
        if self.dry_run:
            return {"id": observation_id, **body}
        page = self._page
        page.goto(f"{self.web_base_url}/account/contributions/ttf/{observation_id}/edit")
        page.get_by_label("Elapsed minutes").fill(str(body["elapsed_minutes"]))
        page.get_by_role("button", name="Save changes").click()
        page.wait_for_timeout(1500)
        return {"id": observation_id}

    def submit_attribute(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("rate_attributes is API-driver only for now — use --driver api.")

    def submit_note(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("post_note is API-driver only for now — use --driver api.")

    def review_chat_reply(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("review_chat is API-driver only for now — use --driver api.")

    def review_chat_extract(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("review_chat is API-driver only for now — use --driver api.")

    def submit_contributions(self, *_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise NotImplementedError("review_chat is API-driver only for now — use --driver api.")
