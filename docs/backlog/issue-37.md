## Goal
Finish public web auth setup from [GETTING_STARTED.md Auth section](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/GETTING_STARTED.md#auth-public-web).

---

## Progress (2026-06-18)

### Done ✅
- [x] Email/password sign-up and sign-in on `/login` (local + `app.dev`)
- [x] Real Firebase JWT verification on API (`firebase-sa.json` / Secret Manager)
- [x] Cloud agent bootstrap: Runtime Secrets, `audit-env.sh`, local full-stack validated
- [x] Test user flow validated in VM browser (`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`)

### Remaining 🔲
- [x] Enable **Google** sign-in in Firebase Console (OAuth flow verified 2026-06-18 — redirects to Google with `littlescout.app` consent)
- [x] Manual test **Continue with Google** on deployed `app.dev` `/login` (OAuth initiates; full round-trip requires a Google account)
- [ ] Optional: **Account → Set up authenticator** for MFA smoke test
- [ ] Confirm production API rejects dev tokens (`AUTH_DEV_MODE=false` on Cloud Run — tracked in [#38](https://github.com/samueljoeharris/restaurant_app/issues/38))

---

## References
- [WEB_AUTH.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/WEB_AUTH.md)
- [FIREBASE_AUTH.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/FIREBASE_AUTH.md)
- [CLOUD_AGENT.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/CLOUD_AGENT.md)
