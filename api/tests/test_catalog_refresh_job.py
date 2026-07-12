"""Catalog-only scheduled refresh (#111).

Scheduler and admin "Run refresh now" enqueue a single kind=catalog job, and
successful area seeds no longer self-register in seed_locations. Mocked unit
coverage — no live Postgres required (mirrors tests/test_admin_user_actions.py's
@patch style).
"""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from ttf_api.places_seed import SeedResult
from ttf_api.seed_jobs import create_catalog_refresh_job, run_seed_job


def _conn_cm(mock_conn: MagicMock) -> MagicMock:
    """A get_conn() replacement usable as `with get_conn() as conn:`."""
    cm = MagicMock()
    cm.__enter__.return_value = mock_conn
    cm.__exit__.return_value = False
    return cm


class CreateCatalogRefreshJobTests(unittest.TestCase):
    @patch("ttf_api.seed_jobs.get_refresh_config")
    @patch("ttf_api.seed_jobs.create_seed_job")
    @patch("ttf_api.seed_jobs.get_conn")
    def test_disabled_returns_none(self, mock_get_conn, mock_create_job, mock_config):
        mock_config.return_value = {"enabled": False}

        result = create_catalog_refresh_job()

        self.assertIsNone(result)
        mock_create_job.assert_not_called()
        mock_get_conn.assert_not_called()

    @patch("ttf_api.seed_jobs.get_refresh_config")
    @patch("ttf_api.seed_jobs.create_seed_job")
    @patch("ttf_api.seed_jobs.get_conn")
    def test_enabled_creates_one_catalog_job(
        self, mock_get_conn, mock_create_job, mock_config
    ):
        mock_config.return_value = {"enabled": True}
        job_row = {
            "id": uuid4(),
            "kind": "catalog",
            "refresh": True,
            "status": "pending",
        }
        mock_create_job.return_value = (job_row, False)
        mock_conn = MagicMock()
        mock_get_conn.return_value = _conn_cm(mock_conn)

        result = create_catalog_refresh_job(requested_by="scheduled-refresh")

        self.assertEqual(result, job_row)
        self.assertEqual(result["kind"], "catalog")
        self.assertTrue(result["refresh"])
        mock_create_job.assert_called_once()
        _, kwargs = mock_create_job.call_args
        self.assertEqual(kwargs["kind"], "catalog")
        self.assertTrue(kwargs["refresh"])
        self.assertTrue(kwargs["force"])
        self.assertEqual(kwargs["requested_by"], "scheduled-refresh")
        # last_scheduled_at bump on location_refresh_config — exactly one write.
        mock_conn.execute.assert_called_once()


class RunSeedJobAreaSeedTests(unittest.TestCase):
    @patch("ttf_api.seed_jobs.ensure_seed_location")
    @patch("ttf_api.seed_jobs.seed_restaurants_for_area")
    @patch("ttf_api.seed_jobs.httpx.Client")
    @patch("ttf_api.seed_jobs.require_maps_api_key")
    @patch("ttf_api.seed_jobs.get_conn")
    def test_successful_area_seed_does_not_touch_seed_locations(
        self,
        mock_get_conn,
        mock_require_key,
        mock_http_client,
        mock_seed_area,
        mock_ensure_location,
    ):
        job_id = uuid4()
        job_row = {
            "id": job_id,
            "lat": 42.24,
            "lng": -71.17,
            "radius_m": 8000,
            "query": "Norwood MA",
            "refresh": False,
            "kind": "area",
            "area_key": "42.24:-71.17:8000",
            "requested_by": "user-uid",
        }
        mock_conn = MagicMock()
        mock_conn.execute.return_value.fetchone.return_value = job_row
        mock_get_conn.return_value = _conn_cm(mock_conn)
        mock_require_key.return_value = "fake-maps-key"
        mock_http_client.return_value.__enter__.return_value = MagicMock()
        mock_seed_area.return_value = SeedResult(inserted=2, updated=1)

        run_seed_job(job_id)

        mock_seed_area.assert_called_once()
        mock_ensure_location.assert_not_called()

        executed_sql = " ".join(
            str(call.args[0]) for call in mock_conn.execute.call_args_list
        )
        self.assertNotIn("seed_locations", executed_sql)
        self.assertIn("restaurant_seed_jobs", executed_sql)


if __name__ == "__main__":
    unittest.main()
