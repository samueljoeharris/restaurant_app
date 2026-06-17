# Roadmap — Little Scout

One-screen north star for what we're building next. **GitHub Issues are the queue**; this doc is the human-readable view.

**Phase 4 gate:** TestFlight pilot — iOS auth + writes, account deletion, web map UX landed.

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

Phase 4 gate — TestFlight pilot. **Max 3 items.**

| Issue | Summary |
|-------|---------|
| [#37](https://github.com/samueljoeharris/restaurant_app/issues/37) | **Web auth:** Google sign-in + production testing (console + manual) |
| [#36](https://github.com/samueljoeharris/restaurant_app/issues/36) | **iOS M6:** TestFlight pipeline (blocked on [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) secrets) |
| [#38](https://github.com/samueljoeharris/restaurant_app/issues/38) | **Pre-launch hardening** — remaining BEST_PRACTICES items (iOS account deletion UI, etc.) |

---

## Next

Queued after Now — pilot launch and hardening.

| Issue | Summary |
|-------|---------|
| [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) | App Store Connect secrets and iOS CI signing (docs/script done; secrets pending) |
| [#40](https://github.com/samueljoeharris/restaurant_app/issues/40) | Phase 4 pilot: invite testers and gather feedback |
| [#39](https://github.com/samueljoeharris/restaurant_app/issues/39) | Prod GCP cutover — scaffold merged; apply pending billing/credentials |

---

## Later / ideas

Parked — not scheduled. Link issues or design docs when picking one up.

| Issue / doc | Summary |
|-------------|---------|
| [#41](https://github.com/samueljoeharris/restaurant_app/issues/41) | AI review chat: server-side Gemini API (in progress on `feature/ttf-review-chat-api`) |
| [#42](https://github.com/samueljoeharris/restaurant_app/issues/42) | Map search and location-based seeding |
| [#43](https://github.com/samueljoeharris/restaurant_app/issues/43) | Caching strategy (BEST_PRACTICES §3) |
| [#44](https://github.com/samueljoeharris/restaurant_app/issues/44) | Ratings trust and moderation |
| [#45](https://github.com/samueljoeharris/restaurant_app/issues/45) | TTF submit timer UX ideas |
| [TTF_SUBMIT_TIMER_IDEAS.md](TTF_SUBMIT_TIMER_IDEAS.md) | Timer UX research (→ [#45](https://github.com/samueljoeharris/restaurant_app/issues/45)) |
| [AI_CONTRIBUTION_RESEARCH.md](AI_CONTRIBUTION_RESEARCH.md) | AI contribution research (→ [#41](https://github.com/samueljoeharris/restaurant_app/issues/41)) |
| [MAP_SEARCH_AND_SEEDING.md](MAP_SEARCH_AND_SEEDING.md) | Map load, seeding, slowness (→ [#42](https://github.com/samueljoeharris/restaurant_app/issues/42)) |
| [DESIGN.md § Roadmap](DESIGN.md#15-open-questions--roadmap) | Long-term product open questions |

---

*Last updated: 2026-06-17. Bump items by changing issue labels (`now` / `next` / `later`) and refreshing this file.*
