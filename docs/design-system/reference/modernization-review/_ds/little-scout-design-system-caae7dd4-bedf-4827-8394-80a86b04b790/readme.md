# Little Scout — Design System

A warm, friendly design system for **Little Scout**, the social restaurant-rating app that helps **parents and caregivers** find kid-friendly places to eat. The flagship metric is **kid food speed** (time-to-food, "TTF" internally) — how fast kid-friendly food reaches the table — alongside crowd-sourced parent signals (high chairs, changing tables, noise, kids-menu quality).

This is the **"Bluebird" whimsical theme**: subtle whimsy on a clean, trustworthy base — sky-blue brand, mango accent, a crisp **white** surface, rounded everything, friendly rounded type. The kid-food-speed tiers stay green/amber/red because they carry data meaning. A full **dark mode** ships in `tokens/colors.css`.

---

## Sources

- **App codebase:** `github.com/samueljoeharris/restaurant_app` — Vite + React web pilot (`web/src`), Cloud Run API, iOS SwiftUI (Phase 3 / planned). Tokens aligned to `design/tokens.json` in that repo. Explore further for production implementation details.
- **Design reference (Whimsical Design folder):** The originating hi-fi whimsical theme — all tokens, component implementations, UI kits, and guidelines cards were developed from this source. Contains `.dc.html` design component files, `reference/` with the original low-fi wireframe flows.
- **Design tokens canonical source:** `design/tokens.json` in the GitHub repo — light/dark values for all color, spacing, shadow, motion, and layout tokens.

> Don't assume the reader has access to either resource; key values are captured throughout this document.

---

## CONTENT FUNDAMENTALS

**Voice:** Warm, encouraging, parent-to-parent — never clinical. Talks *to* the user ("Who are you scouting for?", "Be the first to log speed!"). Short sentences, friendly, always second person.

**Casing:** Sentence case everywhere except tracked ALL-CAPS eyebrow labels (e.g. `UPDATES ON YOUR SPOTS`, `KID FOOD SPEED`). Page titles use Quicksand; never Title Case for headlines.

**Numbers first:** The kid-food-speed figure ("6 min") is the loudest thing on any detail surface. Speed improvements are framed warmly and celebratorily: "now 6 min, was 9 🎉".

**Emoji:** Used deliberately as friendly wayfinding — the nav set (🧭 Feed, 🗺️ Explore, 💛 Saved, 🙂 You), attribute icons (🪑 High chairs, 🚼 Changing table, 🔇 Low noise, ⏱️ Speed), and the occasional celebratory 🎉 on genuine improvements. Not decorative confetti — one purposeful glyph at a time. Never stack emoji.

**Scout framing:** Light explorer/scout language ("scouting for a 2-year-old", "Trail Scout" badge) — playful, never childish toward the adult user.

**Copy examples:**
- "Who are you scouting for?" (onboarding header)
- "Be the first to log speed!" (empty state CTA)
- "Kid food now 6 min (was 9) — 3 new visits 🎉" (feed update)
- "Scouting for age 2" (context label under username)
- "Log a visit" / "Save spot" / "Skip for now" (button hierarchy)

---

## VISUAL FOUNDATIONS

### Color
Sky blue `#3FA7D6` (brand), mango `#FBA63C` (accent), pop `#F08A2E` (new/alert). Clean neutrals: page/surface white `#FFFFFF`, muted surface `#F5F4F3`, warm-ivory borders `#EADFC9`. Ink `#2C2722` (warm) / `#2F3A42` (cool slate, used in map/figure contexts). A **dark mode** (`@media (prefers-color-scheme: dark)`) swaps these for a slate-navy palette — see `guidelines/colors-dark.card.html`.

**TTF tiers are semantic and theme-constant** — never recolor for decoration:
- Fast: `#2E8B57` (green)
- OK: `#E0A52E` (amber)
- Slow: `#D6543B` (red)
- None: `#B4AA98` (gray)

### Typography
- **Quicksand** — display, headings, big TTF numbers. Rounded, optimistic. Weights 600–700.
- **Nunito** — UI body text. Exceptionally legible one-handed. Weights 400–900.
- **800-weight tracked uppercase** for eyebrow labels (letter-spacing 0.14em).
- No third family.

### Shape
Generous rounding everywhere — cards `18px`, buttons `14px`, pills/avatars/toggles `9999px` (full). Nothing sharp.

### Elevation
Warm-tinted soft shadows (brown/slate, never harsh gray): `--ls-shadow-sm/md/lg`. Brand buttons carry a soft sky glow (`--ls-shadow-brand`).

### Backgrounds
Clean **white** (`#FFFFFF`) surfaces. A very subtle dot-grid texture (`--ls-paper-dot`) is available for large empty areas but used sparingly. No photographic or gradient-heavy backgrounds; gradients only as a quiet placeholder for imagery.

### Cards
White (`#fff`), 1px ivory border (`#EFE6D3`), generous radius (18px), soft warm shadow. Feed/update cards carry a leading tier dot.

### Imagery
Real photos drop into rounded slots; never hand-drawn SVG illustration for content. The brand has two house illustrations: a **fox-explorer logo** (`assets/logo.svg`, 3/4 view, backpack, pointing at a far-off star) and a **full-body fox mascot** (`assets/mascot.svg`) for onboarding and empty states — same character, two crops.

### Maps
Custom basemap in warm-ivory land / sky-blue water / sage parks, POIs & dense labels **off**. Locations are teardrop pins in TTF-tier colors. See `design/google-map-style.json` and `guidelines/map-palette.card.html`.

### Motion
Gentle — `cubic-bezier(0.22, 1, 0.36, 1)`, 150ms fast / 250ms normal. Toggles slide; cards lift subtly on hover. No bounces or springy overshoot.

### States
Hover/press = slight lift (`translateY(-1px)`) or soft `brightness()` darken. Active nav/tab in sky blue. One primary action per surface.

### Don'ts
No all-over gradients, no cool-gray surfaces (warm only), don't stack accents (sky AND mango fighting on one card), no sharp corners, never let whimsy bury the data parents came for.

---

## ICONOGRAPHY

**Primary set:** Emoji, used sparingly as wayfinding (🧭 🗺️ 💛 🙂 🪑 🚼 🔇 ⏱️ 🎉). This is intentional and brand-consistent — not a placeholder for a drawn icon set. If a stroke-icon set is later needed for denser UI, substitute **Lucide** (rounded, friendly stroke weight) and flag the change.

**Logo & mascot:** The **fox-explorer logo** (`assets/logo.svg`) is a dimensional fox in a rounded sky tile — 3/4 gaze, little sky-blue backpack, raised paw pointing at a far-off mango star. The **mascot** (`assets/mascot.svg`) is the same fox, full-body with a bushy white-tipped tail. Reproducible at any size; the logo reads down to ~24px, the mascot to ~40px. Reference the SVGs directly — never redraw. See `guidelines/brand-logo.card.html`.

**No hand-drawn SVG illustration for content.** The logo and mascot are the only house illustrations; everything else is real photography in rounded slots.

---

## INDEX / MANIFEST

### Tokens (`tokens/`)
| File | Contents |
|------|----------|
| `fonts.css` | Self-hosted `@font-face` rules — Quicksand + Nunito variable fonts from `assets/fonts/` |
| `colors.css` | Full color system: brand, accent, neutrals, TTF tiers, semantic aliases, map layers, **+ dark-mode overrides** |
| `typography.css` | Font families, weight scale, type size scale, tracking, leading |
| `spacing.css` | 4px-base spacing scale, layout constants |
| `effects.css` | Radius, elevation (shadows), motion tokens, paper-dot texture var |

### Components (`components/core/`)
All components are React (JSX), reference CSS custom properties only, no CSS-in-JS libs.

| Component | Description |
|-----------|-------------|
| `Button` | Primary action button — primary/secondary/soft/ghost variants, sm/md/lg sizes |
| `AttributeChip` | Parent-attribute pill — active/default/dashed states; high chairs, changing table, filters |
| `SpeedBadge` | Flagship kid-food-speed badge — large TTF number + tier pill + tier dot |
| `UpdateCard` | Feed card for saved-spot updates — leading tier dot, isNew badge |
| `Toggle` | Branded pill toggle — sky/ivory, with optional label |
| `BottomNav` | Mobile bottom tab bar — active tab in sky blue |
| `Badge` | Inline label pill — neutral/brand/success/warning/error variants |
| `Input` | Branded text input — label, error state, helper text |
| `RestaurantListCard` | Restaurant list item — default (card) and compact (row) densities, TTF tier dot + badges |

Showcase card: `components/core/components.card.html`

### UI Kits
| Kit | Path | Description |
|-----|------|-------------|
| App | `ui_kits/app/index.html` | Interactive mobile app — login → onboarding → feed → explore (themed map) → detail → speed timer → rate attributes → my contributions → account (9 screens) |
| Admin | `ui_kits/admin/index.html` | Operator web console — sidebar + Overview, Moderation queue (approve/reject/escalate), Restaurants table + detail drawer, Contributors table + trust tiers |

### Templates (`templates/`)
Starting points consuming projects can copy. Each is a `.dc.html` that loads this system via `ds-base.js`.
| Template | Path | Description |
|----------|------|-------------|
| App Screen — Restaurant Detail | `templates/app-screen/` | iOS detail screen with speed badge, attributes, notes |
| Admin Console — Overview | `templates/admin-console/` | Operator console shell with sidebar + dashboard |

### Guidelines (`guidelines/`)
Foundation specimen cards shown in the Design System tab.

| Card | Group | Contents |
|------|-------|----------|
| `brand-logo.card.html` | Brand | Fox-explorer logo + mascot, sizes & lockups |
| `mascot.card.html` | Brand | Full-body fox mascot specimen |
| `colors-brand.card.html` | Colors | Sky blue + mango + pop swatches |
| `colors-neutral.card.html` | Colors | Neutral surfaces + ink |
| `colors-ttf.card.html` | Colors | TTF tier semantic colors |
| `colors-dark.card.html` | Colors | Dark-mode palette |
| `map-palette.card.html` | Colors | Map basemap layer palette |
| `type-display.card.html` | Type | Quicksand display specimens |
| `type-body.card.html` | Type | Nunito body specimens |
| `spacing.card.html` | Spacing | Spacing scale visual |
| `shape-radius.card.html` | Spacing | Radius scale + elevation/shadows |
| `motion.card.html` | Spacing | Easing + duration tokens |
| `map-render.card.html` | App | Re-themed basemap — mobile + web views |

### Assets (`assets/`)
| File | Contents |
|------|----------|
| `logo.svg` | Fox-explorer logo (3/4 view, backpack, pointing at the far-off star) |
| `logo-wordmark.svg` | Logo + "Little Scout" wordmark |
| `mascot.svg` | Full-body fox mascot |
| `fonts/` | Self-hosted variable fonts — Quicksand + Nunito (TTF) |

### Repo handoff package (`docs/design-system/`)
A self-contained snapshot built to drop into the app repo at `docs/` so code agents can reference the brand. Contains README, `INTEGRATION.md` (font self-hosting steps), SKILL.md, token CSS, assets, and per-component `.prompt.md` files. See `docs/design-system/INTEGRATION.md`.

### Reference
Provenance for this system lives in the attached **Whimsical Design** folder and the
`samueljoeharris/restaurant_app` repo (see Sources). Not bundled here.

### Entry point
**`styles.css`** at the project root — link this one file. `@import`s all tokens and font-face rules.

---

## CAVEATS

- **Fonts** are self-hosted variable TTFs in `assets/fonts/` (Quicksand + Nunito), declared as `@font-face` in `tokens/fonts.css`. For the production app, copy them to `web/public/fonts/` — see `docs/design-system/INTEGRATION.md`.
- **Map basemap** cannot be CSS-styled in production; the `design/google-map-style.json` file and the map-palette / map-render cards tell agents how to apply the palette via Google Cloud Map Style, Mapbox, or MapLibre.
- **Dark mode** ships as `@media (prefers-color-scheme: dark)` overrides in `tokens/colors.css`. There is no manual toggle yet — it follows the OS setting.
- **iOS** is Phase 3 — the font names (`iosDisplay: "Quicksand"`, `iosSans: "Nunito"`) are in `design/tokens.json` for reference.

---

**👉 To iterate:** want more components (Dialog, Toast, Skeleton, StarRating), more app screens, more admin screens (Location seeding, Security), a manual dark-mode toggle, or favicon/app-icon specs? Flag any gaps and I'll fill them.
