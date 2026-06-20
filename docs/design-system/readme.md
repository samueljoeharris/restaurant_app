# Little Scout — Design System

A warm, friendly design system for **Little Scout**, the social restaurant-rating app that helps **parents and caregivers** find kid-friendly places to eat. The flagship metric is **kid food speed** (time-to-food, "TTF" internally) — how fast kid-friendly food reaches the table — alongside crowd-sourced parent signals (high chairs, changing tables, noise, kids-menu quality).

This is the **"Bluebird" whimsical theme**: subtle whimsy on a clean, trustworthy base — sky-blue brand, mango accent, warm-ivory paper, rounded everything, friendly rounded type. The kid-food-speed tiers stay green/amber/red because they carry data meaning.

## Sources

- **App codebase:** `github.com/samueljoeharris/restaurant_app` — web pilot (Vite + React, `web/src`), API (Cloud Run), iOS (SwiftUI + MapKit, planned). Tokens were aligned to `design/tokens.json`.
- **Originating UX exploration:** the low-fi wireframe flows + admin console, preserved in `reference/` (open the `.dc.html` files). The hi-fi system here is their successor.
- Don't assume the reader has access to the repo; key values are captured below.

---

## CONTENT FUNDAMENTALS

**Voice:** warm, encouraging, parent-to-parent — never clinical. Talks *to* the user ("Who are you scouting for?", "Be the first to log speed!"). Short, friendly, second person.

**Casing:** Sentence case everywhere except tracked ALL-CAPS eyebrow labels (e.g. `UPDATES ON YOUR SPOTS`). Titles are Quicksand; never Title Case headlines.

**Numbers first:** the kid-food-speed figure ("6 min") is the loudest thing on any detail surface. Improvements are framed warmly ("now 6 min, was 9 🎉").

**Emoji:** used deliberately as friendly wayfinding — the nav set (🧭 Feed, 🗺️ Explore, 💛 Saved, 🙂 You), and the occasional celebratory 🎉 on genuine improvements. Not decorative confetti; one purposeful glyph at a time. Never stack emoji.

**Scout framing:** light explorer/scout language ("scouting for a 2-year-old", "Trail Scout" badge) — playful, never childish toward the adult user.

---

## VISUAL FOUNDATIONS

- **Color:** sky blue `#3FA7D6` (brand), mango `#FBA63C` (accent), pop `#F08A2E` (new/alert). Warm-ivory neutrals: paper `#FBF6EC`, surface white, ivory borders `#EADFC9`. Ink `#2C2722` (warm) / `#2F3A42` (cool slate, used in map/figure contexts). **TTF tiers are semantic and theme-constant:** fast `#2E8B57`, ok `#E0A52E`, slow `#D6543B`, none `#B4AA98`. See `tokens/colors.css`.
- **Type:** Quicksand (display, headings, big TTF numbers — rounded & optimistic) + Nunito (UI & body — exceptionally legible one-handed). 800-weight tracked uppercase for eyebrow labels. No third family. See `tokens/typography.css`.
- **Shape:** generous rounding — cards 18px, buttons 14px, pills/avatars/toggles full. Nothing sharp.
- **Elevation:** warm-tinted soft shadows (brown/slate, never harsh gray): `--ls-shadow-sm/md/lg`; brand buttons carry a soft sky glow.
- **Backgrounds:** warm-ivory paper, often with a subtle **dot-grid texture** (`radial-gradient(--ls-paper-dot 1.4px …) 26px`). No photographic or gradient-heavy backgrounds; gradients only as a quiet placeholder for imagery.
- **Cards:** white, 1px ivory border, generous radius, soft `sm` shadow. Update/feed cards carry a leading tier dot.
- **Imagery:** real photos drop into rounded slots; never hand-drawn SVG illustration. A geometric **scout-compass emblem** is the logo (sky badge + mango/pop needle); a richer mascot is a supply-the-art placeholder.
- **Maps:** custom basemap in warm-ivory land / sky-blue water / sage parks with POIs & dense labels **off**; locations are teardrop pins in TTF-tier colors. Basemap layer hex in `tokens/colors.css` (`--ls-map-*`) and the `Map basemap palette` card.
- **Motion:** gentle — `--ls-ease-out` `cubic-bezier(.22,1,.36,1)`, 150/250ms. Toggles slide; cards lift subtly. No bounces or springy overshoot.
- **States:** hover/press = slight lift or soft filter darken; active nav/tab in sky blue; one primary action per surface.
- **Don'ts:** no all-over gradients, no cool-gray surfaces (warm only), don't stack accents (sky AND mango fighting on one card), no sharp corners, never let whimsy bury the data parents came for.

---

## ICONOGRAPHY

- **Primary set:** emoji, used sparingly as wayfinding (🧭 🗺️ 💛 🙂 🪑 🚼 🔇 ⏱️ 🎉). This is intentional and brand-consistent — not a placeholder for a drawn icon set. If a stroke-icon set is later needed for denser UI, substitute **Lucide** (rounded, friendly stroke) and flag the change.
- **Logo:** the scout-compass emblem is built from primitives (rounded square badge + two rotated-square "needle" diamonds + center dot) — reproducible at any size, including a 16px favicon and a map pin. See `guidelines/brand-logo.card.html`.
- **No hand-drawn SVG illustration.** Supply real mascot art; don't auto-generate.

---

## INDEX / MANIFEST

- **`styles.css`** — global entry point (link this one file). `@import`s everything below.
- **`tokens/`** — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`.
- **`components/core/`** — reusable React primitives (`.jsx` + `.d.ts` + `.prompt.md`):
  `Button`, `AttributeChip`, `SpeedBadge` (flagship kid-food-speed), `UpdateCard`, `Toggle`, `BottomNav`. Showcase: `components/core/components.card.html`.
- **`ui_kits/app/`** — interactive re-themed consumer app: onboarding → feed → explore (themed map) → restaurant detail → kid-food-speed timer → you. (`index.html`)
- **`ui_kits/admin/`** — re-themed operator console (Overview / moderation / data quality). (`index.html`)
- **`guidelines/`** — foundation specimen cards (colors, type, shape, spacing, brand, map palette) shown in the Design System tab.
- **`reference/`** — the original low-fi wireframe flows + admin console (`.dc.html`) that this system grew out of. Provenance only.
- **Presentation / handoff pages** (project root) — `Little Scout Full Kit.dc.html` (everything in one scroll) and its single-file export `Little Scout Full Kit.html`; plus `Little Scout Theme.dc.html`, `Theme Options.dc.html`, `Map Views.dc.html`.
- **`SKILL.md`** — makes this usable as a downloadable Agent Skill.

---

## CAVEATS

- **Fonts** are loaded from Google Fonts (Quicksand + Nunito) via `@import` — zero-config online, but no local font binaries are bundled. If you need offline/self-hosted fonts, drop the `.woff2` files in and I'll add `@font-face` rules.
- **Mascot** is a placeholder — supply illustrated art.
- **Map basemap** can't be CSS-styled in production; the tokens + `Map Views` page tell agents how to apply it via Google cloud Map Style / Mapbox / MapLibre (one provider needed for a consistent web + iOS look).

**👉 Tell me what to refine:** want more components (Inputs, Dialog, Toast, RestaurantListCard), more app screens (My Contributions, Rate Attributes, Login MFA), or the admin Moderation & Restaurants screens built out? And confirm the emoji-icon direction vs. a stroke set — I'll iterate until it's perfect.
