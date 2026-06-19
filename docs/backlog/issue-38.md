## Goal
Work through Tier 1 hardening in [BEST_PRACTICES.md §7](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#7-implementation-checklist) before public launch.

**Account deletion:** ✅ shipped ([#33](https://github.com/samueljoeharris/restaurant_app/issues/33) closed).

---

## Progress (2026-06-19)

### Done ✅
- [x] Account deletion (API + web + iOS) — #33
- [x] Write rate limits (`rate_limit.py`, Postgres-backed)
- [x] App Check middleware wired on writes + places + coverage (enforced when `APP_CHECK_ENFORCE=true`)
- [x] `check_revoked=True` on sensitive auth paths (non-emulator)
- [x] Privacy policy page (`/privacy`, [PRIVACY_POLICY.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/PRIVACY_POLICY.md))
- [x] CORS allowlist in API config
- [x] CSP headers on web/admin SPAs (`web/nginx.conf`, `web/nginx.admin.conf`)
- [x] `AUTH_DEV_MODE=false` in Terraform dev/prod + startup guard (`security_config.py`)
- [x] Write-route audit — all user-facing writes use `require_write_access` (or documented allowlist); regression test `api/tests/test_write_guards.py`
- [x] `POST /v1/places/{id}/materialize` now uses `require_write_access` (was missing rate limit)

### Remaining 🔲
- [ ] Set `app_check_recaptcha_site_key` in prod `terraform.tfvars` and apply (enables `APP_CHECK_ENFORCE=true` on prod API)
- [ ] Post-deploy smoke: confirm no CSP violations on `app.littlescout.app` / `admin.littlescout.app` ([PROD_CUTOVER_RUNBOOK.md](PROD_CUTOVER_RUNBOOK.md))
- [ ] iOS pre-launch checklist items in BEST_PRACTICES §7 (if any still open)

---

## References
- [GETTING_STARTED.md Phase 4](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/GETTING_STARTED.md#phase-4--pilot-launch)
- [SECRETS_MATRIX.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/SECRETS_MATRIX.md)
