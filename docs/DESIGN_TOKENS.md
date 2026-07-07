# Design tokens

Little Scout uses a **single canonical token file** for brand colors, surfaces, and TTF map tiers across iOS and web.

## Source of truth

[`design/tokens.json`](../design/tokens.json) — every semantic color has `{ "light": "#...", "dark": "#..." }`.

Edit that file, then regenerate platform outputs. **Do not hand-edit generated files.**

**Palette canon:** the actual hex values in `design/tokens.json` are not decided in this file — they mirror [`docs/design-system/tokens/colors.css`](design-system/tokens/colors.css), which is the canonical Bluebird palette (2026-07 modernization review, see [MODERNIZATION.md](MODERNIZATION.md)). CI (`scripts/verify-design-tokens.sh`) fails the build on any hex drift between `design/tokens.json` and that DS file — when the two disagree, the DS file wins and `tokens.json` must be updated to match.

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

## Bluebird palette (light refresh: white surfaces, warm ink — 2026-07)

| Token | Light | Role |
|-------|-------|------|
| `bg` | `#FFFFFF` | Page background (was warm paper `#FBF6EC`; retired) |
| `brand` | `#3FA7D6` | Sky blue primary |
| `brandHover` | `#2B8CBC` | Sky blue hover/active |
| `accent` | `#FBA63C` | Mango secondary |
| `accentPop` | `#F08A2E` | Alert / “new” pop |
| `brandSoft` | `#D6EDF7` | Sky tint |
| `text` | `#2C2722` | Body text — warm ink |
| `textMuted` | `#837766` | Muted ink |
| `border` | `#EADFC9` | Default border |
| `borderStrong` | `#DCCDAE` | Emphasized border |
| `surfaceMuted` | `#F5F4F3` | Muted surface |

Dark mode `bg`: `#151E27`. `error`/`success`/`warning` are not independent colors — they **reuse the TTF tier hexes** below (one source of truth for semantic data color). Full ramp + dark values: [`docs/design-system/tokens/colors.css`](design-system/tokens/colors.css).

**Typography:** Quicksand (display) + Nunito (body) on web. Scale tokens (`text-display`, `text-number`, etc.) in generated CSS.

**Paper texture:** `--paper-dot-*` vars for a subtle dot-grid — reserved for **large empty-state areas only**, never the whole page `body`. (Previously documented as a `body` background texture; that usage is retired per the 2026-07 modernization review — see [MODERNIZATION.md](MODERNIZATION.md).)

**Shadows:** `--shadow-brand` for primary button glow.

**Dark mode:** canon is **class-based** — `.dark` on the root, toggled by web's `useTheme()` — with a `@media (prefers-color-scheme: dark)` fallback carrying the same values for consumers without the toggle wired up.

**TTF tiers** (`ttfFast` `#2E8B57`, `ttfOk` `#E0A52E`, `ttfSlow` `#D6543B`, `ttfUnknown` `#B4AA98`) stay semantic across themes.

**Map pins:** `pinSearchFocus`; basemap reference colors `mapLand` `#F6EFE1`, `mapWater` `#CDE7F4`, `mapPark` `#DCEAD2` — see [MAP_STYLE.md](./MAP_STYLE.md). `pinRatings` (off-palette purple) and `pinNotes` are **retired** — pins use TTF-tier colors only, no purple in Bluebird.

**Z-index:** `zIndex.sidebar` 30, `dropdown` 100, `toast` 150, `modal` 200 (also in `overlayStack.ts`).

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
