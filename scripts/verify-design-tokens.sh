#!/usr/bin/env bash
# Regenerate design-token outputs and fail if committed files are stale.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CSS_CANON="$ROOT/docs/design-system/tokens/colors.css"
TOKENS_JSON="$ROOT/design/tokens.json"
mismatch=0
while read -r token_name css_hex; do
  json_hex=$(jq -r --arg k "$token_name" '.color[$k].light // empty' "$TOKENS_JSON")
  if [ -z "$json_hex" ]; then
    echo "::error::$CSS_CANON references unknown token '$token_name' (no color.$token_name.light in design/tokens.json)" >&2
    mismatch=1
  elif [ "${json_hex^^}" != "${css_hex^^}" ]; then
    echo "::error::color.$token_name.light mismatch: design/tokens.json=$json_hex docs/design-system/tokens/colors.css=$css_hex" >&2
    mismatch=1
  fi
done < <(sed -nE 's/^[[:space:]]*--ls-[a-zA-Z0-9-]+:[[:space:]]*(#[0-9A-Fa-f]{6});[[:space:]]*\/\*[[:space:]]*([A-Za-z]+)[[:space:]]*\*\/.*/\2 \1/p' "$CSS_CANON")

if [ "$mismatch" -ne 0 ]; then
  echo "::error::design/tokens.json has drifted from the docs/design-system/tokens/colors.css canon" >&2
  exit 1
fi
echo "✓ design/tokens.json matches docs/design-system/tokens/colors.css canon"

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
