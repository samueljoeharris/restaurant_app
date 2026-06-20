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
| `brandSoft` | `#D6EDF7` | Sky tint |
| `text` | `#2F3A42` | Body text |

**Typography:** Quicksand (display) + Nunito (body) on web.

**TTF tiers** (`ttfFast`, `ttfOk`, `ttfSlow`, `ttfUnknown`) stay semantic across themes.

**Map pins:** `pinRatings`, `pinNotes`, `pinSearchFocus`; basemap reference colors `mapLand`, `mapWater`, `mapPark` — see [MAP_STYLE.md](./MAP_STYLE.md).

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
