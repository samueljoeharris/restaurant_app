## Goal
Work through Tier 1 hardening in [BEST_PRACTICES.md §7](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#7-implementation-checklist) before public launch.

**Account deletion:** ✅ shipped ([#33](https://github.com/samueljoeharris/restaurant_app/issues/33) closed).

---

## Open PR / branch status (2026-06-19)

**Branch (ready to merge):** [`cursor-cloud-prelaunch-hardening-bacf`](https://github.com/samueljoeharris/restaurant_app/compare/main...cursor-cloud-prelaunch-hardening-bacf)

No PR opened yet — open from the compare link above when ready.

**In that branch:**
- `POST /v1/places/{id}/materialize` → `require_write_access` (closes rate-limit gap)
- `_row_to_detail` duplicate `google_place_id` fix (500 on restaurant detail)
- `api/tests/test_write_guards.py` regression test + CI wiring
- `docs/backlog/issue-38.md` progress update

**CI:** `./scripts/ci-check.sh --all` passed on branch.

---

## Progress

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
- [x] `POST /v1/places/{id}/materialize` now uses `require_write_access` (was missing rate limit) — **on branch above, pending merge**

### Deferred (not needed for current pilot) ⏸️
- [ ] **`app_check_recaptcha_site_key` in prod tfvars** — infra is ready (`app-check.tf`, `APP_CHECK_ENFORCE` toggles when key set). Skip until prod App Check enforcement is wanted. See [FIREBASE_AUTH.md § App Check](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/FIREBASE_AUTH.md) when needed.

### Remaining 🔲
- [ ] Merge `cursor-cloud-prelaunch-hardening-bacf` → `main` and confirm API deploy green
- [ ] Post-deploy smoke: confirm no CSP violations on `app.littlescout.app` / `admin.littlescout.app` ([PROD_CUTOVER_RUNBOOK.md](PROD_CUTOVER_RUNBOOK.md)) — at prod cutover
- [ ] iOS pre-launch checklist items in BEST_PRACTICES §7 (if any still open)

---

## References
- [GETTING_STARTED.md Phase 4](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/GETTING_STARTED.md#phase-4--pilot-launch)
- [SECRETS_MATRIX.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/SECRETS_MATRIX.md)
