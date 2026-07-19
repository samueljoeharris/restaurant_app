#!/usr/bin/env bash
# Regenerate design-token outputs and fail if committed files are stale.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node "$ROOT/scripts/generate-design-tokens.mjs"

# Hex guard: design/tokens.json light-mode colors must match the annotated
# hex values in docs/design-system/tokens/colors.css.
python3 - "$ROOT/design/tokens.json" "$ROOT/docs/design-system/tokens/colors.css" <<'PY'
import json, re, sys

tokens = json.load(open(sys.argv[1]))
css = open(sys.argv[2]).read()

root_m = re.search(r':root\s*\{([\s\S]*?)\}', css)
if not root_m:
    print("::error::Could not find :root block in colors.css", file=sys.stderr)
    sys.exit(1)

mismatches = []
for line in root_m.group(1).splitlines():
    # --var: #HEX;  /* tokenName */
    m = re.search(r':\s*(#[0-9A-Fa-f]{6})\s*;\s*/\*\s*([^*]+?)\s*\*/', line)
    if not m:
        continue
    hex_val = m.group(1).upper()
    token = m.group(2).strip()
    if token not in tokens.get("color", {}):
        continue
    if tokens["color"][token]["light"].upper() != hex_val:
        mismatches.append((token, tokens["color"][token]["light"], hex_val))

if mismatches:
    for token, json_hex, css_hex in mismatches:
        print(f"::error::color.{token}.light ({json_hex}) does not match colors.css ({css_hex})", file=sys.stderr)
    sys.exit(1)

print("✓ design/tokens.json light-mode hexes match colors.css")
PY

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
