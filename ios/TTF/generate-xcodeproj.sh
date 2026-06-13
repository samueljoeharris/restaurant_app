#!/usr/bin/env bash
# Regenerate TTF.xcodeproj from project.yml (optional — a checked-in project.pbxproj is also provided).
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "Install XcodeGen: brew install xcodegen" >&2
  exit 1
fi
xcodegen generate
echo "Generated TTF.xcodeproj"
