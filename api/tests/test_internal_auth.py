"""Tests for internal endpoint caller verification."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from ttf_api.config import Settings
from ttf_api.routers.internal import _verify_internal_caller


def _request(url: str = "https://api.dev.littlescout.app/v1/internal/pubsub/seed-jobs"):
    request = MagicMock()
    request.url = url
    return request


class InternalAuthTests(unittest.TestCase):
    def test_secret_token_allows_call(self) -> None:
        settings = Settings(internal_job_secret="shh")
        with patch("ttf_api.routers.internal.settings", settings):
            result = _verify_internal_caller(
                _request(),
                x_internal_job_token="shh",
            )
        self.assertIsNone(result)

    def test_oidc_allow_listed_email_and_audience_passes(self) -> None:
        settings = Settings(
            internal_job_secret="",
            cloud_scheduler_service_account_email="",
            pubsub_service_account_email="scheduler@example.iam.gserviceaccount.com",
        )
        with patch("ttf_api.routers.internal.settings", settings):
            with patch(
                "ttf_api.routers.internal.id_token.verify_oauth2_token",
                return_value={"email": "scheduler@example.iam.gserviceaccount.com"},
            ) as mock_verify:
                result = _verify_internal_caller(
                    _request(),
                    authorization="Bearer fake",
                )
                self.assertIsNone(result)
                mock_verify.assert_called_once_with(
                    "fake",
                    unittest.mock.ANY,
                    audience="https://api.dev.littlescout.app/v1/internal/pubsub/seed-jobs",
                )

    def test_oidc_wrong_email_is_rejected(self) -> None:
        settings = Settings(
            internal_job_secret="",
            cloud_scheduler_service_account_email="allowed@example.iam.gserviceaccount.com",
            pubsub_service_account_email="",
        )
        with patch("ttf_api.routers.internal.settings", settings):
            with patch(
                "ttf_api.routers.internal.id_token.verify_oauth2_token",
                return_value={"email": "other@example.iam.gserviceaccount.com"},
            ):
                with self.assertRaises(HTTPException) as ctx:
                    _verify_internal_caller(_request(), authorization="Bearer fake")
                self.assertEqual(ctx.exception.status_code, 401)

    def test_dev_mode_without_secret_allows_call(self) -> None:
        settings = Settings(
            internal_job_secret="",
            auth_dev_mode=True,
        )
        with patch("ttf_api.routers.internal.settings", settings):
            result = _verify_internal_caller(_request())
        self.assertIsNone(result)

    def test_no_secret_no_auth_no_dev_rejects(self) -> None:
        settings = Settings(
            internal_job_secret="",
            auth_dev_mode=False,
        )
        with patch("ttf_api.routers.internal.settings", settings):
            with self.assertRaises(HTTPException) as ctx:
                _verify_internal_caller(_request())
            self.assertEqual(ctx.exception.status_code, 401)
