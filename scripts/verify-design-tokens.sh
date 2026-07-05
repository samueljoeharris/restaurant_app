#!/usr/bin/env bash
# Regenerate design-token outputs and fail if committed files are stale.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node "$ROOT/scripts/generate-design-tokens.mjs"

if git diff --quiet -- \
  "$ROOT/web/src/styles/tokens.generated.css" \
  "$ROOT/web/src/lib/ttfTier.ts" \
  "$ROOT/web/src/lib/mapPin.ts" \
  "$ROOT/ios/TTF/TTF/Utilities/Theme.swift" \
  "$ROOT/ios/TTF/TTF/Utilities/TtfTier.swift" \
  "$ROOT/ios/TTF/TTF/Resources/Colors.xcassets" \
  "$ROOT/ios/TTF/TTF/Resources/Assets.xcassets/AccentColor.colorset/Contents.json"; then
  echo "✓ design token outputs are fresh"
else
  echo "::error::Design token outputs are stale — run: cd web && npm run tokens:generate && commit" >&2
  git diff --stat -- \
    "$ROOT/web/src/styles/tokens.generated.css" \
    "$ROOT/web/src/lib/ttfTier.ts" \
    "$ROOT/web/src/lib/mapPin.ts" \
    "$ROOT/ios/TTF/TTF/Utilities/Theme.swift" \
    "$ROOT/ios/TTF/TTF/Utilities/TtfTier.swift" \
    "$ROOT/ios/TTF/TTF/Resources/Colors.xcassets" \
    "$ROOT/ios/TTF/TTF/Resources/Assets.xcassets/AccentColor.colorset/Contents.json" >&2 || true
  exit 1
fi
