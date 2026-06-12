# TTF Submit Timer — Future UX Ideas

Ideas for making the **kid food speed** timer on the submit page feel more alive while parents wait at the table.

**Page:** `/restaurants/:id/submit` (e.g. `https://app.dev.littlescout.app/restaurants/.../submit`)

**Primary implementation:** `web/src/pages/TtfSubmitPage.tsx`

**Related:** `web/src/lib/ttfTier.ts` (speed tier thresholds and colors), `web/src/index.css` (`.timer-card`, `.timer-display`)

---

## Current state

The timer works but is visually static:

- `MM:SS` display in a brand-soft card
- Start / Stop / Reset actions
- 1-second interval updates while running
- Manual minute entry when the timer is not used
- No animation, contextual copy, or comparison to venue data

Restaurant detail (including `ttf.median_minutes` and `sample_size`) is already loaded on this page — useful for live comparisons.

---

## Design goals

1. **Make time feel tangible** — parents are distracted; the UI should communicate wait length at a glance.
2. **Stay on-brand** — warm, parent-first, lightly playful; not gamified or guilt-inducing.
3. **Teach the metric** — reinforce what map pin colors and speed tiers mean.
4. **Work in a restaurant** — readable at arm's length, no sound by default, respect `prefers-reduced-motion`.
5. **Don't block the form** — parents should still pick item type, quality, etc. while the timer runs.

---

## Speed tier reference

Reuse existing tiers from `web/src/lib/ttfTier.ts`:

| Tier | Median threshold | Color | Label |
|------|------------------|-------|-------|
| Fast | ≤ 8 min | `#2d8f4e` | Fast (≤8 min) |
| OK | 9–15 min | `#d4a017` | OK (9–15 min) |
| Slow | > 15 min | `#c0392b` | Slow (>15 min) |

During a live timer, apply the same breakpoints to **elapsed** time (not just aggregated median).

---

## Ideas (easiest → richest)

### 1. Tier-colored progress ring

Wrap the clock in a circular progress bar that fills as minutes pass, shifting color at tier breakpoints.

| Elapsed | Color | Vibe |
|---------|-------|------|
| 0–8 min | Green | Still in the fast zone |
| 9–15 min | Gold | OK territory |
| 16+ min | Red | Hang in there |

**Why:** Motion every second without noise; connects live wait to map pin semantics.

**Implementation sketch:** SVG ring or CSS `conic-gradient`; progress = `timerMs / (15 * 60000)` capped at 100% for the ring, color from `ttfTier`-equivalent logic on elapsed minutes.

---

### 2. Rotating “parent survival” status copy

A single line under the timer, rotating every ~20–30 seconds while running:

| Elapsed | Example copy |
|---------|----------------|
| 0–3 min | Order's in — deep breath. |
| 3–8 min | Coloring-book phase. |
| 8–12 min | Tablet negotiations may begin. |
| 12–18 min | Snack tax territory. |
| 18+ min | You're earning this data point. |

**On stop:** One-liner from final tier, e.g. *"7 min — that's fast-scout territory 🍟"*.

**Why:** Personality without changing core interaction; cheap to ship as a string table keyed by elapsed minute buckets.

---

### 3. “Hungry kid meter”

Four-step emoji strip advancing with time:

😊 → 😐 → 😤 → 🆘

**Why:** Instant emotional read of wait length; works even when parents aren't watching digits.

**A11y:** Advance on minute boundaries only when `prefers-reduced-motion: reduce`.

---

### 4. Food journey lane

Horizontal stepper with timed stages:

**Ordered** → **Kitchen** → **On the way** → **Landed**

Suggested stage advances (tunable):

| Stage | Approx. elapsed |
|-------|-----------------|
| Ordered | 0 min |
| Kitchen | 2 min |
| On the way | 6 min |
| Landed | 10 min (or on Stop) |

Use the selected **item type** emoji (🍟 🍎 🍞 🧒 🍽️) as a traveler sliding along the lane — links timer to “What arrived?” below.

**Why:** More distinctive visually; reinforces the story of the flagship metric.

---

### 5. Compare to this restaurant's median

While running (only when `ttf.sample_size >= 3`):

- *"Usually here: 9 min — you're at 4 min, ahead of pace."*
- *"You've passed the usual 7 min mark."*

**Why:** Makes the timer feel like scouting, not just counting; uses data already on the page.

**Edge cases:**

- No median / low sample: hide comparison or show *"Be the first to set the pace here."*
- Stopped timer: optional summary vs. median before submit.

---

### 6. Micro-motion on the digits

Light polish:

- Pulse the seconds digit (or whole display) on each tick (~150ms scale)
- Card background warms gradually: `--color-brand-soft` → `--color-warning-soft` after 15 min
- Optional colon blink via CSS (disable under reduced motion)

**Why:** Low scope, makes the clock feel “live” without new components.

---

### 7. Milestone moments (subtle)

At 5 / 10 / 15 min elapsed:

- Single progress-ring pulse
- Status line gets a new emoji prefix
- **No sound** by default

**Why:** Marks passage of time without slot-machine energy.

---

## Recommended first bundle

Ship **progress ring + status copy + median comparison** together:

```
┌─────────────────────────────────┐
│  Time from order to kid food    │
│                                 │
│      ╭─── 4:32 ───╮             │  ← ring fills + tier color
│      │  (green)   │             │
│      ╰─────────────╯             │
│  "Coloring-book phase."         │  ← rotating copy
│  Usually here: 9 min — ahead!   │  ← median compare
│                                 │
│     [ Stop (5 min) ]  [Reset]   │
└─────────────────────────────────┘
```

| Piece | Value |
|-------|--------|
| Ring | Shape + tier color |
| Copy | Personality |
| Median | Product / scouting context |

**Suggested component split:**

- `web/src/components/TtfTimerDisplay.tsx` — ring, digits, status, comparison
- `web/src/lib/ttfTimerStatus.ts` — copy buckets and milestone helpers
- Extend `web/src/index.css` — ring animation, reduced-motion overrides

---

## Defer for now

| Idea | Reason |
|------|--------|
| Flip-clock / heavy animations | Distracting in a loud restaurant |
| Sound effects | Awkward in public |
| Points, streaks, badges | Wrong tone for data collection |
| Blocking the form while timer runs | Parents need to fill fields while waiting |
| Haptics (web) | Limited support; not essential for v1 |

---

## Accessibility

- Honor `prefers-reduced-motion: reduce`: static ring color by tier, no pulse/blink/journey animation
- Status copy in a live region (`aria-live="polite"`) so screen readers get updates without spamming every second
- Ring progress: `role="progressbar"` with `aria-valuenow` / `aria-valuemax` in minutes or seconds
- Tier color is not the only signal — pair with text labels (fast / OK / slow)

---

## Future enhancements (post-bundle)

- **Item-aware copy:** *"Those apple slices are taking their time…"* when `item_type` is selected
- **Daypart hints:** busier lunch copy vs. quiet breakfast
- **Post-stop celebration:** brief success state before navigating back to restaurant detail
- **iOS parity:** mirror patterns in Phase 3 SwiftUI submit flow

---

## Open questions

1. Should journey-lane stage timings be fixed globally or vary by `item_type`?
2. Show median comparison before timer starts (ghost target on ring)?
3. After stop, animate ring to “complete” or freeze immediately?
4. Copy tone: more scout-themed (*"Little Scout is on the clock"*) vs. straight parent humor?

---

## References

- Submit page: `web/src/pages/TtfSubmitPage.tsx`
- Tier logic: `web/src/lib/ttfTier.ts`
- TTF metric spec: `docs/DESIGN.md` §5
- Brand tokens: `web/src/styles/tokens.css`
