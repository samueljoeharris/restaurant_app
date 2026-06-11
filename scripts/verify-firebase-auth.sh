#!/usr/bin/env bash
# Verify Firebase Auth flows locally (emulator + API dev tokens).
# Follows firebase-auth-basics skill workflow — run before deploy or after auth changes.
#
# Usage:
#   ./scripts/verify-firebase-auth.sh              # assumes emulator stack is up
#   ./scripts/verify-firebase-auth.sh --bootstrap  # start emulator profile first
#   ./scripts/verify-firebase-auth.sh --remote     # also check Firebase CLI project (requires login)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${API_URL:-http://localhost:8080}"
EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST:-localhost:9099}"
TEST_EMAIL="${TEST_EMAIL:-verify-auth@ttf.test}"
TEST_PASSWORD="${TEST_PASSWORD:-verifypass123}"
ADMIN_DEV_UID="${ADMIN_DEV_UID:-verify-admin-uid}"
BOOTSTRAP=false
REMOTE=false
PASS=0
FAIL=0

usage() {
  cat <<'EOF'
Usage: ./scripts/verify-firebase-auth.sh [--bootstrap] [--remote]

  --bootstrap   docker compose --profile emulator up -d postgres firebase-emulator api
  --remote      Run firebase-tools project checks (requires firebase login)

Env:
  API_URL                     default http://localhost:8080
  FIREBASE_AUTH_EMULATOR_HOST default localhost:9099
  TEST_EMAIL / TEST_PASSWORD  emulator test user
  ADMIN_DEV_UID               dev: token treated as admin (requires API restart with env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bootstrap) BOOTSTRAP=true; shift ;;
    --remote) REMOTE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL + 1)); }

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

if [[ "$BOOTSTRAP" == "true" ]]; then
  echo "==> Starting emulator stack…"
  docker compose --profile emulator up -d postgres firebase-emulator api
  for _ in $(seq 1 30); do
    if curl -sf "$API_URL/health" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

echo "==> Firebase Auth verification"
echo "    API: $API_URL"
echo "    Emulator: $EMULATOR_HOST"
echo ""

# --- Health ---
echo "1. API health"
if curl -sf "$API_URL/health" | grep -q '"status"'; then
  pass "GET /health"
else
  fail "GET /health — is the API running? (docker compose --profile emulator up -d)"
fi

# --- Emulator email/password → JWT → /v1/me ---
echo ""
echo "2. Email/password (Auth Emulator) → API JWT verify"
TOKEN=""
if TOKEN=$(docker compose run --rm -e "FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099" api \
  python scripts/get_emulator_token.py --email "$TEST_EMAIL" --password "$TEST_PASSWORD" 2>/dev/null \
  | awk -F= '/^idToken=/{print $2}'); then
  if [[ -n "$TOKEN" ]]; then
    pass "Emulator sign-up/sign-in for $TEST_EMAIL"
  else
    fail "Emulator token empty"
  fi
else
  fail "Emulator sign-up/sign-in — is firebase-emulator running?"
fi

if [[ -n "$TOKEN" ]]; then
  ME=$(curl -sf -H "Authorization: Bearer $TOKEN" "$API_URL/v1/me" || true)
  if echo "$ME" | grep -q '"firebase_uid"'; then
    pass "GET /v1/me accepts emulator ID token"
  else
    fail "GET /v1/me rejected emulator token: $ME"
  fi

  ADMIN_CODE=$(http_code -H "Authorization: Bearer $TOKEN" "$API_URL/v1/admin/stats")
  if [[ "$ADMIN_CODE" == "403" ]]; then
    pass "Non-admin token blocked from /v1/admin/stats (403)"
  else
    fail "Expected 403 for non-admin on /v1/admin/stats, got $ADMIN_CODE"
  fi
fi

# --- Dev tokens ---
echo ""
echo "3. Dev tokens (AUTH_DEV_MODE)"
DEV_ME=$(curl -sf -H "Authorization: Bearer dev:pilot-tester-1" "$API_URL/v1/me" || true)
if echo "$DEV_ME" | grep -q '"firebase_uid":"pilot-tester-1"'; then
  pass "Bearer dev:<uid> accepted on /v1/me"
else
  fail "Dev token /v1/me failed: $DEV_ME"
fi

DEV_ADMIN_CODE=$(http_code -H "Authorization: Bearer dev:$ADMIN_DEV_UID" "$API_URL/v1/admin/stats")
if [[ "$DEV_ADMIN_CODE" == "403" ]]; then
  pass "dev: token without AUTH_DEV_ADMIN_UIDS blocked from admin (403)"
elif [[ "$DEV_ADMIN_CODE" == "200" ]]; then
  pass "dev: admin token accepted (AUTH_DEV_ADMIN_UIDS includes $ADMIN_DEV_UID)"
else
  fail "Unexpected admin response for dev token: HTTP $DEV_ADMIN_CODE"
fi

# --- IAP firebase-session guard ---
echo ""
echo "4. Admin IAP → Firebase SSO endpoint"
IAP_CODE=$(http_code "$API_URL/v1/admin/firebase-session")
if [[ "$IAP_CODE" == "501" ]] || [[ "$IAP_CODE" == "401" ]]; then
  pass "GET /v1/admin/firebase-session rejects unauthenticated IAP (HTTP $IAP_CODE)"
else
  fail "Expected 501/401 without IAP header, got HTTP $IAP_CODE"
fi

# --- firebase.json sanity (skill: auth providers + emulators) ---
echo ""
echo "5. firebase.json configuration"
if [[ -f firebase.json ]]; then
  if grep -q '"auth"' firebase.json && grep -q '"port": 9099' firebase.json; then
    pass "firebase.json has auth emulator on port 9099"
  elif grep -q '"port": 9099' firebase.json; then
    pass "firebase.json has auth emulator (no declarative auth providers — Terraform manages Identity Platform)"
  else
    fail "firebase.json missing auth emulator config"
  fi
  if grep -q '"default": "ttf-restaurant-dev"' .firebaserc 2>/dev/null; then
    pass ".firebaserc points to ttf-restaurant-dev"
  else
    fail ".firebaserc project mismatch"
  fi
else
  fail "firebase.json not found"
fi

# --- Remote Firebase CLI (optional) ---
if [[ "$REMOTE" == "true" ]]; then
  echo ""
  echo "6. Remote Firebase project (firebase-tools)"
  if npx -y firebase-tools@latest use 2>/dev/null | grep -q "ttf-restaurant-dev"; then
    pass "firebase login + active project ttf-restaurant-dev"
    echo "    Manual production checks (see docs/AUTH.md):"
    echo "    - Firebase authorized domains: app.dev, admin.dev, localhost"
    echo "    - Google OAuth Web client origins + redirect URI"
    echo "    - IAP OAuth client separate from Firebase Google sign-in"
    echo "    - MFA state ENABLED via Terraform (firebase-auth module)"
  else
    fail "firebase-tools not logged in — run: npx -y firebase-tools@latest login"
  fi
fi

echo ""
echo "==> Results: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  echo "Fix failures above, then re-run. See docs/AUTH.md and docs/FIREBASE_AUTH.md."
  exit 1
fi

echo "All local Firebase Auth checks passed."
echo ""
echo "Production smoke test (manual):"
echo "  1. https://app.dev.littlescout.app/login — Continue with Google"
echo "  2. https://admin.dev.littlescout.app — IAP wall → silent Firebase SSO"
echo "  3. Account → Set up authenticator (TOTP MFA)"
