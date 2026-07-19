"""Security configuration guards."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from ttf_api.config import Settings
from ttf_api.security_config import assert_safe_auth_config, is_deployed_environment


class SecurityConfigTests(unittest.TestCase):
    def test_local_dev_allows_auth_dev_mode(self) -> None:
        settings = Settings(
            auth_dev_mode=True,
            database_url="postgresql://ttf_app:ttf_local@postgres:5432/ttf",
        )
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("K_SERVICE", None)
            os.environ.pop("TTF_DEPLOYED", None)
            assert_safe_auth_config(settings)

    def test_cloud_run_blocks_auth_dev_mode(self) -> None:
        settings = Settings(auth_dev_mode=True)
        with patch.dict(os.environ, {"K_SERVICE": "ttf-api"}, clear=False):
            with self.assertRaises(RuntimeError):
                assert_safe_auth_config(settings)

    def test_cloud_sql_url_blocks_auth_dev_mode(self) -> None:
        settings = Settings(
            auth_dev_mode=True,
            database_url="postgresql://u:p@/ttf?host=/cloudsql/proj:region:inst",
        )
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("K_SERVICE", None)
            with self.assertRaises(RuntimeError):
                assert_safe_auth_config(settings)

    def test_deployed_flag_blocks_auth_dev_mode(self) -> None:
        settings = Settings(auth_dev_mode=True)
        with patch.dict(os.environ, {"TTF_DEPLOYED": "true"}, clear=False):
            os.environ.pop("K_SERVICE", None)
            with self.assertRaises(RuntimeError):
                assert_safe_auth_config(settings)

    def test_is_deployed_environment(self) -> None:
        local = Settings(database_url="postgresql://ttf_app:ttf_local@postgres:5432/ttf")
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("K_SERVICE", None)
            os.environ.pop("TTF_DEPLOYED", None)
            self.assertFalse(is_deployed_environment(local))

    def test_wildcard_cors_origin_is_rejected(self) -> None:
        from ttf_api.security_config import assert_safe_cors_config

        bad = Settings(cors_origins=["*"])
        with self.assertRaisesRegex(RuntimeError, "Wildcard CORS origin"):
            assert_safe_cors_config(bad)


if __name__ == "__main__":
    unittest.main()
