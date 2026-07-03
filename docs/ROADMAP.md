# Roadmap — Little Scout

One-screen north star for what we're building next. **GitHub Issues are the queue**; this doc is the human-readable view.

**Phase 4 gate:** TestFlight pilot — iOS auth + writes, account deletion ✅, web map UX largely landed.

**Execution view:** [TESTFLIGHT_EXECUTION_PLAN.md](TESTFLIGHT_EXECUTION_PLAN.md) — critical path, signing/pipeline runbook, and the parent-on-the-go UX bar for the beta.

---

## How we use this

- **GitHub Issues** = backlog. Each item of work should have an issue.
- **Labels:** `now` (active, max **3**), `next` (queued), `later` (parked ideas).
- **Area labels:** `area:ios`, `area:web`, `area:infra`, `area:api`.
- **Type labels:** `type:launch-blocker`, `type:debt`.
- **Research docs** (`AI_CONTRIBUTION_RESEARCH.md`, `MAP_SEARCH_AND_SEEDING.md`, etc.) are design notes — link from issues; they do not compete with this queue.
- Before starting new feature work: check this doc and issues; new work needs a `now` issue or an explicit bump of something out of `now`.

Full checklist context: [GETTING_STARTED.md](GETTING_STARTED.md). iOS milestones: [IOS_DESIGN.md §13](IOS_DESIGN.md#13-milestones).

---

## Now

| Issue | Summary |
|-------|---------|
| [#64](https://github.com/samueljoeharris/restaurant_app/issues/64) | **Whimsical Bluebird rebrand** — design kit integration audit + build ([TEST_FLOWS.md](TEST_FLOWS.md)) |
| [#36](https://github.com/samueljoeharris/restaurant_app/issues/36) | **iOS M6:** TestFlight pipeline (blocked on [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) secrets) |
| [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) | **App Store Connect secrets + iOS CI signing** — the one human-only blocker; see [TESTFLIGHT_EXECUTION_PLAN.md](TESTFLIGHT_EXECUTION_PLAN.md) §2 |

---

## Next

| Issue | Summary |
|-------|---------|
| [#38](https://github.com/samueljoeharris/restaurant_app/issues/38) | Pre-launch hardening — write guards merged; prod smoke + App Check key deferred |
| [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) | App Store Connect secrets and iOS CI signing (prerequisite for #36) |
| [#59](https://github.com/samueljoeharris/restaurant_app/issues/59) | Push delivery — web FCM, real send, scheduler |
| [#60](https://github.com/samueljoeharris/restaurant_app/issues/60) | Web layout a11y remainder (focus trap, FormField) — z-index in tokens ✅ |
| [#61](https://github.com/samueljoeharris/restaurant_app/issues/61) | Watchlist v1 remaining (push, iOS parity) |
| [#62](https://github.com/samueljoeharris/restaurant_app/issues/62) | Admin moderation QA — see [TEST_FLOWS.md](TEST_FLOWS.md) ADM-* |
| [#40](https://github.com/samueljoeharris/restaurant_app/issues/40) | Phase 4 pilot: invite testers and gather feedback (after TestFlight) |
| [#39](https://github.com/samueljoeharris/restaurant_app/issues/39) | Prod GCP cutover — scaffold merged; apply pending billing/credentials |

---

## Later / ideas

Parked — not scheduled. Link issues or design docs when picking one up.

| Issue / doc | Summary |
|-------------|---------|
| [#41](https://github.com/samueljoeharris/restaurant_app/issues/41) | AI review chat: server-side Gemini API (partial on main; polish remaining) |
| [#42](https://github.com/samueljoeharris/restaurant_app/issues/42) | Map search — **web core shipped**; iOS parity, post-seed refresh, PostGIS remain |
| [#43](https://github.com/samueljoeharris/restaurant_app/issues/43) | Caching — ETag + client cache ✅; invalidation + geohash keys remain |
| [#44](https://github.com/samueljoeharris/restaurant_app/issues/44) | Ratings trust and moderation |
| [#45](https://github.com/samueljoeharris/restaurant_app/issues/45) | TTF submit timer UX ideas |
| [MAP_STYLE.md](MAP_STYLE.md) | Bluebird Google Map Style + MapKit POI-off |
| [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | Bluebird token reference |

---

## Recently closed (for context)

| Issue | Summary |
|-------|---------|
| [#50](https://github.com/samueljoeharris/restaurant_app/issues/50) | Recency histogram on restaurant detail ✅ |
| [#37](https://github.com/samueljoeharris/restaurant_app/issues/37) | Public web auth — Google sign-in on `app.dev` ✅ |
| [#33](https://github.com/samueljoeharris/restaurant_app/issues/33) | Account deletion |
| [#34](https://github.com/samueljoeharris/restaurant_app/issues/34) | Map-search sidebar branch merged |
| [#49](https://github.com/samueljoeharris/restaurant_app/issues/49) | Map locate FAB icon |

---

*Last updated: 2026-06-20. Bump items by changing issue labels (`now` / `next` / `later`) and refreshing this file.*
