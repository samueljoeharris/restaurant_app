# Modernization review — decisions record

**Date:** 2026-07-07 · **Source:** Claude Design review canvas, validated against `main@988ea9e`
(canvas: [`docs/design-system/reference/modernization-review/Modernization Review.dc.html`](design-system/reference/modernization-review/Modernization%20Review.dc.html) — section ids `1a`–`6d` referenced below).

**Decision bias:** minimal and clear for a parent on the go. Prefer the smallest change that makes the answer obvious one-handed; park bigger rebuilds.

---

## Direction decisions

| Question | Decision | Why |
|----------|----------|-----|
| #90 answer-first explore — `4a` (answer card ON the map) vs `4b` (question-first home) | **4a** | Minimal delta from shipped `/map`; ranker (#92, `family_match.py`) powers one card; map habits and #72 anonymous browse keep working. `4b` parked in *Later* — revisit after TestFlight feedback. |
| #100 log a visit — `3a` (refresh, keep preview step) vs `3b` (live draft, no preview) | **3b, phased** | Live draft removes a whole tap and makes state visible while standing in a restaurant. Phase 1 ships `3a`'s token/interaction fixes (small, safe); Phase 2 ships live extraction. |

## Design-system decisions (canvas `1b`)

| Topic | Decision |
|-------|----------|
| Paper-dot texture on page body | **Strip.** Dot-grid stays reserved for large empty areas only (per DS). Page bodies are plain `bg`. |
| Off-palette pin colors (`pinRatings` purple, `pinNotes`) | **Retire.** Pins use TTF-tier colors + the sanctioned discover/search-focus styles. Remove the tokens; no purple in Bluebird. |
| Dark mode strategy | **Class-based (`.dark`) adopted into the DS.** Web's `useTheme()` toggle is the pattern; DS token CSS carries `.dark` overrides alongside the `prefers-color-scheme` fallback. |
| Radius scale | **DS scale wins:** buttons 14, cards 18, pills full. `radius.lg` 20 → 18 in `design/tokens.json`. |
| Icons | **Keep the SVG sprite** (`web/public/icons.svg`, Lucide-derived) for dense UI; emoji remains the primary wayfinding set. Documented in the DS iconography section. |
| Map palette | **DS canon:** park sage `#DCEAD2`, land warm ivory `#F6EFE1`, water `#CDE7F4`. |

## Token canon (canvas `1a`)

`design/tokens.json` is regenerated to match the DS canon (`docs/design-system/tokens/colors.css`), which is now the light "white surfaces, warm ink" refresh:

- Page bg → `#FFFFFF` · ink → `#2C2722` warm · muted ink → `#837766`
- TTF tiers → fast `#2E8B57` · ok `#E0A52E` · slow `#D6543B` · none `#B4AA98`
- error/success/warning reuse the TTF hexes — **one source of truth for semantic data colors**
- borders `#EADFC9` / `#DCCDAE` · surfaceMuted `#F5F4F3` · brand hover `#2B8CBC` · dark bg `#151E27`

One `npm run tokens:generate` flows this to web CSS **and** the iOS asset catalog / `Theme.swift`, so future iOS inherits the fix for free. CI (`scripts/verify-design-tokens.sh`) additionally fails on any hex diff between `design/tokens.json` and the DS canon.

## Platforms

- **Mobile web (user app)** — primary surface; all §2/§3/§4 issues target it at 390px.
- **Admin web** — §5/§6 issues; desktop 1160px, same tokens.
- **iOS (future, TestFlight Phase 4)** — no separate design work needed now: token regeneration covers theme parity; `IOS_DESIGN.md` notes the canon + decisions. Screen-level parity lands with the existing iOS milestones (#36, #42 parity items).

## Execution

Implementation is broken into small, independently-shippable issues in
[`docs/backlog/modernization/`](backlog/modernization/) — one file per issue, each with route, source files, exact changes, and acceptance criteria.
Run [`scripts/open-modernization-issues.sh`](../scripts/open-modernization-issues.sh) (needs `gh` auth) to create them on GitHub with the standard labels.

Sequencing: tokens first (M01), then the two active-flow issues (M05, M07), then per-screen refreshes in any order.
Label note: ROADMAP caps `now` at 3 — M05 rides under #100's existing `now` slot; M01 is the one new `now` (it gates every visual refresh). Everything else enters as `next`/`later`.
