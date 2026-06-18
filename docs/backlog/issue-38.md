## Goal
Work through Tier 1 hardening in [BEST_PRACTICES.md §7](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#7-implementation-checklist) before public launch.

**Account deletion:** ✅ shipped ([#33](https://github.com/samueljoeharris/restaurant_app/issues/33) closed).

---

## Progress (2026-06-18)

### Done ✅
- [x] Account deletion (API + web + iOS) — #33
- [x] Write rate limits (`rate_limit.py`, Postgres-backed)
- [x] App Check middleware wired on writes + places + coverage (enforced when `APP_CHECK_ENFORCE=true`)
- [x] `check_revoked=True` on sensitive auth paths (non-emulator)
- [x] Privacy policy page (`/privacy`, [PRIVACY_POLICY.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/PRIVACY_POLICY.md))
- [x] CORS allowlist in API config

### Remaining 🔲
- [ ] Confirm `AUTH_DEV_MODE=false` on **production** Cloud Run (dev/staging audit)
- [ ] App Check **enforced in prod** (reCAPTCHA site key + web client token on all writes)
- [ ] CSP headers on web/admin SPAs
- [ ] Audit all write routes use `secure_write` / rate limit consistently
- [ ] iOS pre-launch checklist items in BEST_PRACTICES §7 (if any still open)

---

## References
- [GETTING_STARTED.md Phase 4](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/GETTING_STARTED.md#phase-4--pilot-launch)
- [SECRETS_MATRIX.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/SECRETS_MATRIX.md)
