"""Admin contributor disable/delete guards and Firebase-missing tolerance."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from firebase_admin import auth as firebase_auth

from ttf_api.auth import AuthUser
from ttf_api.moderation_service import (
    admin_delete_contributor_account,
    disable_user,
    enable_user,
    guard_admin_not_target_self,
)


def _admin(uid: str = "admin-uid") -> AuthUser:
    return AuthUser(
        firebase_uid=uid,
        display_name="Admin",
        email="admin@example.com",
        role="admin",
    )


class AdminUserActionTests(unittest.TestCase):
    def test_guard_blocks_self_actions(self) -> None:
        admin = _admin("same-uid")
        with self.assertRaises(HTTPException) as ctx:
            guard_admin_not_target_self(admin, "same-uid")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("ttf_api.moderation_service.write_admin_audit")
    @patch("ttf_api.moderation_service.set_user_trust")
    @patch("ttf_api.moderation_service._init_firebase")
    @patch("firebase_admin.auth.update_user")
    def test_disable_user_tolerates_missing_firebase(
        self,
        mock_update: MagicMock,
        mock_init: MagicMock,
        mock_trust: MagicMock,
        mock_audit: MagicMock,
    ) -> None:
        mock_update.side_effect = firebase_auth.UserNotFoundError("missing")
        conn = MagicMock()
        disable_user(conn, "orphan-uid", _admin())
        mock_trust.assert_called_once()
        mock_audit.assert_called_once()

    @patch("ttf_api.moderation_service.write_admin_audit")
    @patch("ttf_api.moderation_service.set_user_trust")
    @patch("ttf_api.moderation_service._init_firebase")
    @patch("firebase_admin.auth.update_user")
    def test_enable_user_tolerates_missing_firebase(
        self,
        mock_update: MagicMock,
        mock_init: MagicMock,
        mock_trust: MagicMock,
        mock_audit: MagicMock,
    ) -> None:
        mock_update.side_effect = firebase_auth.UserNotFoundError("missing")
        conn = MagicMock()
        enable_user(conn, "orphan-uid", _admin())
        mock_trust.assert_called_once()
        mock_audit.assert_called_once()

    @patch("ttf_api.moderation_service.write_admin_audit")
    @patch("ttf_api.moderation_service.delete_user_account")
    def test_admin_delete_blocks_self(
        self,
        mock_delete: MagicMock,
        mock_audit: MagicMock,
    ) -> None:
        admin = _admin("self-uid")
        with self.assertRaises(HTTPException) as ctx:
            admin_delete_contributor_account("self-uid", admin)
        self.assertEqual(ctx.exception.status_code, 403)
        mock_delete.assert_not_called()
        mock_audit.assert_not_called()

    @patch("ttf_api.moderation_service.write_admin_audit")
    @patch("ttf_api.moderation_service.delete_user_account")
    def test_admin_delete_runs_full_delete(
        self,
        mock_delete: MagicMock,
        mock_audit: MagicMock,
    ) -> None:
        admin = _admin()
        admin_delete_contributor_account("target-uid", admin)
        mock_delete.assert_called_once_with("target-uid")
        mock_audit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
