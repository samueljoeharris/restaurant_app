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
| `Assets.xcassets/AccentColor` | iOS | Global SwiftUI `.tint` (mirrors `brand`) |

## Platform usage

### iOS (SwiftUI)

```swift
Text("Hello").foregroundStyle(Color.textMuted)
Button("Go") { }.tint(.brand)
```

Dark mode follows system appearance via Asset Catalog luminosity variants — no extra SwiftUI code required for basic support.

### Web (Tailwind v4)

Semantic utilities read CSS variables that flip under `.dark` on `<html>`:

```tsx
<div className="bg-bg text-text border-border" />
<button className="bg-brand text-text-inverse hover:bg-brand-hover" />
```

Theme toggle: `useTheme()` hook (`system` | `light` | `dark`) + inline script in `index.html` to avoid flash of wrong theme.

## Forest palette

Primary brand is forest green; warm amber is secondary accent. TTF map tiers (fast/ok/slow/unknown) are semantic and shared across platforms.

## CI

If `design/tokens.json` changes, run `npm run tokens:generate` and commit generated files. `ci-check.sh` can fail when generated outputs are stale.
