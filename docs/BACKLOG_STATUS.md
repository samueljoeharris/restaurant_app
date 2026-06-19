# Backlog status — hygiene snapshot

**Date:** 2026-06-18  
**Canonical queue:** [ROADMAP.md](ROADMAP.md)

Use this when syncing GitHub issue bodies/labels. Cloud bootstrap sets `GH_TOKEN` from `GITHUB_PERSONAL_ACCESS_TOKEN` so `gh issue edit` works (Cursor's default `ghs_` token cannot edit issues).

```bash
gh issue edit 42 --body-file docs/backlog/issue-42.md
gh issue edit 43 --body-file docs/backlog/issue-43.md
gh issue edit 37 --body-file docs/backlog/issue-37.md
gh issue edit 38 --body-file docs/backlog/issue-38.md
gh issue edit 50 --add-label next --remove-label later
```

---

## Label summary

| Label | Issues |
|-------|--------|
| **now** (2) | [#36](https://github.com/samueljoeharris/restaurant_app/issues/36), [#38](https://github.com/samueljoeharris/restaurant_app/issues/38) |
| **next** | [#46](https://github.com/samueljoeharris/restaurant_app/issues/46), [#40](https://github.com/samueljoeharris/restaurant_app/issues/40), [#50](https://github.com/samueljoeharris/restaurant_app/issues/50) *(proposed)*, [#39](https://github.com/samueljoeharris/restaurant_app/issues/39) |
| **later** | [#41](https://github.com/samueljoeharris/restaurant_app/issues/41), [#42](https://github.com/samueljoeharris/restaurant_app/issues/42), [#43](https://github.com/samueljoeharris/restaurant_app/issues/43), [#44](https://github.com/samueljoeharris/restaurant_app/issues/44), [#45](https://github.com/samueljoeharris/restaurant_app/issues/45) |

---

## What changed this hygiene pass

### Shipped (documented, not new code)
- **Map search web core** — fast path, nearby, coverage seed, Google pin sheet ([#42](https://github.com/samueljoeharris/restaurant_app/issues/42) body split into ✅ / 🔲)
- **Caching partial** — ETag middleware + web client revalidation ([#43](https://github.com/samueljoeharris/restaurant_app/issues/43))
- **Account deletion** — closed [#33](https://github.com/samueljoeharris/restaurant_app/issues/33); noted on [#38](https://github.com/samueljoeharris/restaurant_app/issues/38)
- **Web auth** — email/password + Google OAuth on `app.dev` validated ([#37](https://github.com/samueljoeharris/restaurant_app/issues/37) closed)

### Docs updated in repo
- [ROADMAP.md](ROADMAP.md) — #50 → next, recently closed table, accurate summaries
- [MAP_SEARCH_AND_SEEDING.md](MAP_SEARCH_AND_SEEDING.md) — matches live place/radius flow

### Proposed queue move
- **#50** (recency histogram) → `next` — good web+API agent task after hardening

---

## Suggested next picks

1. **You:** [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) ASC secrets → unblocks [#36](https://github.com/samueljoeharris/restaurant_app/issues/36)
2. **Agent:** [#38](https://github.com/samueljoeharris/restaurant_app/issues/38) prod App Check + CSP slice
3. **Agent:** [#50](https://github.com/samueljoeharris/restaurant_app/issues/50) recency histogram
