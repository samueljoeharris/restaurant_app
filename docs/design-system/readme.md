# Little Scout — Design System

A warm, friendly design system for **Little Scout**, the social restaurant-rating app that helps **parents and caregivers** find kid-friendly places to eat. The flagship metric is **kid food speed** (time-to-food, "TTF" internally) — how fast kid-friendly food reaches the table — alongside crowd-sourced parent signals (high chairs, changing tables, noise, kids-menu quality).

This is the **"Bluebird" whimsical theme**: subtle whimsy on a clean, trustworthy base — sky-blue brand, mango accent, crisp **white** surfaces with warm ink, rounded everything, friendly rounded type. The kid-food-speed tiers stay green/amber/red because they carry data meaning. A full **dark mode** ships alongside it (see Dark mode, below).

> **2026-07 modernization review:** this DS was refreshed from a warm-ivory-paper theme to the "light refresh: white surfaces, warm ink" canon recorded here. See [`../MODERNIZATION.md`](../MODERNIZATION.md) for the full decision record.

## Sources

- **This DS is canonical.** `docs/design-system/tokens/*.css` (starting with [`tokens/colors.css`](tokens/colors.css)) is the source-of-truth palette. `design/tokens.json` in the app codebase **mirrors** these values — it does not set them. CI (`scripts/verify-design-tokens.sh`) fails the build on any hex drift between the two; see [DESIGN_TOKENS.md](../DESIGN_TOKENS.md).
- **App codebase:** `github.com/samueljoeharris/restaurant_app` — web pilot (Vite + React, `web/src`), API (Cloud Run), iOS (SwiftUI + MapKit). Token regeneration (`scripts/generate-design-tokens.mjs`) flows this DS's values into web CSS and the iOS asset catalog / `Theme.swift`.
- **Originating UX exploration:** the low-fi wireframe flows + admin console, preserved in `reference/` (open the `.dc.html` files). The hi-fi system here is their successor; the 2026-07 modernization review canvas is also under `reference/modernization-review/`.
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

- **Color:** sky blue `#3FA7D6` (brand, hover `#2B8CBC`), mango `#FBA63C` (accent), pop `#F08A2E` (new/alert). Clean neutrals: page/surface **white** `#FFFFFF`, muted surface `#F5F4F3`, borders `#EADFC9` / `#DCCDAE` (strong). Ink `#2C2722` (warm) / muted ink `#837766` / `#2F3A42` (cool slate, used in map/figure contexts). **TTF tiers are semantic and theme-constant** — and error/success/warning reuse the same hexes, one source of truth for semantic data color: fast `#2E8B57`, ok `#E0A52E`, slow `#D6543B`, none `#B4AA98`. See `tokens/colors.css`.
- **Dark mode:** class-based — `.dark` on the root element (web toggles it via `useTheme()`) — with a `@media (prefers-color-scheme: dark)` fallback for consumers that haven't wired the toggle. Both blocks carry identical values (dark page bg `#151E27`). See `tokens/colors.css`.
- **Type:** Quicksand (display, headings, big TTF numbers — rounded & optimistic) + Nunito (UI & body — exceptionally legible one-handed). 800-weight tracked uppercase for eyebrow labels. No third family. See `tokens/typography.css`.
- **Shape:** generous rounding — cards 18px, buttons 14px, pills/avatars/toggles full. Nothing sharp. (`tokens.json radius.lg` is being aligned from 20 → 18 to match; tracked as a separate code issue.)
- **Elevation:** warm-tinted soft shadows (brown/slate, never harsh gray): `--ls-shadow-sm/md/lg`; brand buttons carry a soft sky glow.
- **Backgrounds:** clean **white** surfaces. The **dot-grid texture** (`--ls-paper-dot`) is reserved for large empty areas only (e.g. empty states) — **never the whole page body**. Page bodies are plain `bg`. No photographic or gradient-heavy backgrounds; gradients only as a quiet placeholder for imagery.
- **Cards:** white, 1px border (`--ls-border`), generous radius, soft `sm` shadow. Update/feed cards carry a leading tier dot.
- **Imagery:** real photos drop into rounded slots; never hand-drawn SVG illustration. A geometric **scout-compass emblem** is the logo (sky badge + mango/pop needle); a richer mascot is a supply-the-art placeholder.
- **Maps:** custom basemap in warm land `#F6EFE1` / sky-blue water `#CDE7F4` / sage parks `#DCEAD2` with POIs & dense labels **off**; locations are teardrop pins in TTF-tier colors — the off-palette `pinRatings` (purple) and `pinNotes` tokens are **retired**; there is no purple in Bluebird. Basemap layer hex in `tokens/colors.css` (`--ls-map-*`) and the `Map basemap palette` card.
- **Motion:** gentle — `--ls-ease-out` `cubic-bezier(.22,1,.36,1)`, 150/250ms. Toggles slide; cards lift subtly. No bounces or springy overshoot.
- **States:** hover/press = slight lift or soft filter darken; active nav/tab in sky blue; one primary action per surface.
- **Don'ts:** no all-over gradients, no cool-gray surfaces (warm only), don't stack accents (sky AND mango fighting on one card), no sharp corners, no off-palette pin colors, never let whimsy bury the data parents came for.

---

## ICONOGRAPHY

- **Primary set:** emoji, used sparingly as wayfinding (🧭 🗺️ 💛 🙂 🪑 🚼 🔇 ⏱️ 🎉). This is intentional and brand-consistent — not a placeholder for a drawn icon set.
- **Dense-UI set:** the web SVG sprite `web/public/icons.svg` (Lucide-derived rounded stroke icons) is the sanctioned set for dense UI — table rows, admin console controls, inline action buttons — where an emoji would be too loud or imprecise. Not hypothetical; already in use, not just a fallback to reach for later.
- **Logo:** the scout-compass emblem is built from primitives (rounded square badge + two rotated-square "needle" diamonds + center dot) — reproducible at any size, including a 16px favicon and a map pin. See `guidelines/brand-logo.card.html`.
- **No hand-drawn SVG illustration.** Supply real mascot art; don't auto-generate.

---

## INDEX / MANIFEST

- **`styles.css`** — global entry point (link this one file). `@import`s everything below.
- **`tokens/`** — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`.
- **`components/core/`** — reusable React primitives (`.jsx` + `.d.ts` + `.prompt.md`):
  `Button`, `AttributeChip`, `SpeedBadge` (flagship kid-food-speed), `UpdateCard`, `Toggle`, `BottomNav`. Showcase: `components/core/components.card.html`.
- **`ui_kits/app/`** — interactive re-themed consumer app: onboarding → feed → explore (themed map) → restaurant detail → kid-food-speed timer → you. (`index.html`)
- **`screens/account.md`** — canonical **Account / You** page spec (`AccountPage`, `/account`).
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
