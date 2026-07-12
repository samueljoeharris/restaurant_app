# Design tokens

Little Scout uses a **single canonical token file** for brand colors, surfaces, and TTF map tiers across iOS and web.

## Source of truth

[`design/tokens.json`](../design/tokens.json) — every semantic color has `{ "light": "#...", "dark": "#..." }`.

Edit that file, then regenerate platform outputs. **Do not hand-edit generated files.**

## Regenerate

```bash
cd web && npm run tokens:generate
```

Or from repo root:

```bash
node scripts/generate-design-tokens.mjs
```

## Generated outputs

| Output | Platform | Purpose |
|--------|----------|---------|
| [`web/src/styles/tokens.generated.css`](../web/src/styles/tokens.generated.css) | Web | Tailwind `@theme` vars + `.dark` overrides |
| [`ios/TTF/TTF/Resources/Colors.xcassets/`](../ios/TTF/TTF/Resources/Colors.xcassets/) | iOS | Asset Catalog color sets (light + dark appearances) |
| [`ios/TTF/TTF/Utilities/Theme.swift`](../ios/TTF/TTF/Utilities/Theme.swift) | iOS | `Color.brand`, `Color.bg`, etc. |
| [`ios/TTF/TTF/Utilities/TtfTier.swift`](../ios/TTF/TTF/Utilities/TtfTier.swift) | iOS | Map tier colors via `Color.ttfFast` |
| [`web/src/lib/ttfTier.ts`](../web/src/lib/ttfTier.ts) | Web | Tier hex constants (light values for map pins) |
| [`web/src/lib/mapPin.ts`](../web/src/lib/mapPin.ts) | Web | `PIN_*` and `SEARCH_FOCUS_PIN_COLOR` patched from tokens |
| `Assets.xcassets/AccentColor` | iOS | Global SwiftUI `.tint` (mirrors `brand`) |

## Bluebird palette (Whimsical theme)

| Token | Light | Role |
|-------|-------|------|
| `bg` | `#FBF6EC` | Warm paper |
| `brand` | `#3FA7D6` | Sky blue primary |
| `accent` | `#FBA63C` | Mango secondary |
| `accentPop` | `#F08A2E` | Alert / “new” pop |
| `brandSoft` | `#D6EDF7` | Sky tint |
| `text` | `#2F3A42` | Body text |

**Typography:** Quicksand (display) + Nunito (body) on web. Scale tokens (`text-display`, `text-number`, etc.) in generated CSS.

**Paper texture:** `--paper-dot-*` vars for subtle dot-grid on `body` (see `globals.css`).

**Shadows:** `--shadow-brand` for primary button glow.

**TTF tiers** (`ttfFast`, `ttfOk`, `ttfSlow`, `ttfUnknown`) stay semantic across themes.

**Map pins:** `pinSearchFocus`; TTF-tier colors render all other pin states (no off-palette pin colors — issue #120). Basemap reference colors `mapLand`, `mapWater`, `mapPark` — see [MAP_STYLE.md](./MAP_STYLE.md).

**Z-index:** `zIndex.sidebar` 30, `dropdown` 100, `toast` 150, `modal` 200 (also in `overlayStack.ts`).

## Web theme strategy — class-based toggle + media-query fallback

The web app uses a **class-based theme toggle** as the primary mechanism, with OS theme preference as a first-load-only fallback.

### How it works

1. **Inline script (first paint):** `index.html` reads `localStorage` for the user's stored theme preference (`ls-theme`). If found and set to `"dark"`, the `.dark` class is added to `<html>` before the page renders. If no stored preference exists, the script checks `prefers-color-scheme: dark` as an initial guess.

2. **`useTheme()` hook (runtime):** The React component `web/src/hooks/useTheme.ts` manages three modes:
   - `"dark"` — explicitly dark (user chose dark)
   - `"light"` — explicitly light (user chose light)
   - `"system"` — follow OS preference (no explicit choice stored)
   
   When a mode is set, it persists to `localStorage` (except `"system"`, which clears the key) and applies the `.dark` class to `document.documentElement` accordingly.

3. **CSS resolution (at render):**
   - `web/src/styles/tokens.generated.css` defines two blocks:
     - `@theme { ... }` — light color tokens (applied by default)
     - `.dark { ... }` — dark color tokens (applied when `.dark` class is present)
   - `web/src/styles/globals.css` registers the custom variant: `@custom-variant dark (&:where(.dark, .dark *))`
   - This makes Tailwind's `dark:` class modifier use the `.dark` selector, not a media query.

### Precedence

1. **Stored preference wins:** If the user has explicitly set a theme (via the app's toggle), `localStorage` is non-empty, and `.dark` is applied or removed to match.
2. **OS preference as fallback:** On first load (no stored preference), the `.dark` class is applied based on `prefers-color-scheme: dark`.
3. **Media query listener:** If mode is `"system"` and the OS theme changes, `useTheme()` re-applies the class automatically.

### Result

The `.dark` class on the root element is the single source of truth for theme state at render time. CSS token variables (`--color-*`) respond to its presence, while the media query serves only as an initial guess before user interaction.

## Platform usage

### iOS (SwiftUI)

```swift
Text("Hello").foregroundStyle(Color.textMuted)
Button("Go") { }.tint(.brand)
```

### Web (Tailwind v4)

```tsx
<div className="bg-bg text-text border-border" />
<button className="bg-brand text-text-inverse hover:bg-brand-hover" />
```

Theme toggle: `useTheme()` hook + inline script in `index.html`.

## CI

If `design/tokens.json` changes, run `npm run tokens:generate` and commit generated files. `ci-check.sh` fails when outputs are stale.

## Live UI audit

[TEST_FLOWS.md](./TEST_FLOWS.md) — theme gate flows after deploy.
