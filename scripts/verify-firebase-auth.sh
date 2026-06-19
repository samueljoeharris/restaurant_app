#!/usr/bin/env bash
# Verify Firebase Auth flows locally (emulator + API dev tokens).
# Follows firebase-auth-basics skill workflow — run before deploy or after auth changes.
#
# Usage:
#   ./scripts/verify-firebase-auth.sh              # assumes emulator stack is up
#   ./scripts/verify-firebase-auth.sh --bootstrap  # start emulator profile first
#   ./scripts/verify-firebase-auth.sh --remote     # also check Firebase CLI project (requires login)
#   ./scripts/verify-firebase-auth.sh --app-dev    # smoke test app.dev Google OAuth prerequisites (#37)
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
APP_DEV=false
PASS=0
FAIL=0
APP_DEV_URL="${APP_DEV_URL:-https://app.dev.littlescout.app}"
API_DEV_URL="${API_DEV_URL:-https://api.dev.littlescout.app}"

usage() {
  cat <<'EOF'
Usage: ./scripts/verify-firebase-auth.sh [--bootstrap] [--remote] [--app-dev]

  --bootstrap   docker compose --profile emulator up -d postgres firebase-emulator api
  --remote      Run firebase-tools project checks (requires firebase login)
  --app-dev     Smoke test deployed app.dev login + Firebase auth handler (#37)

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
    --app-dev) APP_DEV=true; shift ;;
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
if [[ "$APP_DEV" == "true" && "$BOOTSTRAP" == "false" ]]; then
  echo "    Mode: app.dev smoke test only"
else
  echo "    API: $API_URL"
  echo "    Emulator: $EMULATOR_HOST"
fi
echo ""

if [[ "$APP_DEV" != "true" || "$BOOTSTRAP" == "true" ]]; then
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
fi

# --- Deployed app.dev Google sign-in prerequisites (#37) ---
if [[ "$APP_DEV" == "true" ]]; then
  echo ""
  echo "6. Deployed app.dev Google sign-in smoke test"
  echo "    URL: $APP_DEV_URL"

  LOGIN_CODE=$(http_code "$APP_DEV_URL/login")
  if [[ "$LOGIN_CODE" == "200" ]]; then
    pass "GET $APP_DEV_URL/login (HTTP 200)"
  else
    fail "GET $APP_DEV_URL/login — expected 200, got $LOGIN_CODE"
  fi

  LOGIN_HTML=$(curl -sf "$APP_DEV_URL/login" || true)
  if echo "$LOGIN_HTML" | grep -qi '<div id="root"'; then
    pass "Login route serves SPA shell"
  else
    fail "Login page missing SPA root element"
  fi

  JS_PATH=$(echo "$LOGIN_HTML" | grep -oE 'src="/assets/[^"]+\.js"' | head -1 | sed 's/src="//;s/"//')
  if [[ -n "$JS_PATH" ]]; then
    BUNDLE=$(curl -sf "$APP_DEV_URL$JS_PATH" || true)
    if [[ -n "$BUNDLE" ]] && grep -q "Continue with Google" <<< "$BUNDLE"; then
      pass "Web bundle includes Continue with Google"
    else
      fail "Web bundle missing Continue with Google (public build regression?)"
    fi
  else
    fail "Could not find main JS bundle on login page"
  fi

  HANDLER_CODE=$(http_code "$APP_DEV_URL/__/auth/handler")
  if [[ "$HANDLER_CODE" == "200" ]]; then
    pass "GET $APP_DEV_URL/__/auth/handler (HTTP 200 — nginx proxy to Firebase)"
  else
    fail "Auth handler returned HTTP $HANDLER_CODE (expected 200; see docs/WEB_AUTH.md)"
  fi

  API_HEALTH=$(http_code "$API_DEV_URL/health")
  if [[ "$API_HEALTH" == "200" ]]; then
    pass "GET $API_DEV_URL/health (HTTP 200)"
  else
    fail "API health returned HTTP $API_HEALTH"
  fi

  FIREBASE_KEY=""
  if [[ -f web/.env.local ]]; then
    FIREBASE_KEY="$(grep -E '^VITE_FIREBASE_API_KEY=' web/.env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true)"
    FIREBASE_KEY="${FIREBASE_KEY#\"}"; FIREBASE_KEY="${FIREBASE_KEY%\"}"
  fi
  if [[ -n "$FIREBASE_KEY" ]]; then
    PROJECT_CFG=$(curl -sf \
      "https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${FIREBASE_KEY}" \
      || true)
    if echo "$PROJECT_CFG" | grep -q 'app.dev.littlescout.app'; then
      pass "Firebase authorized domains include app.dev.littlescout.app"
    else
      fail "Firebase authorized domains missing app.dev.littlescout.app"
    fi
  else
    fail "VITE_FIREBASE_API_KEY not found in web/.env.local — cannot verify authorized domains"
  fi

  echo ""
  echo "    Browser OAuth round-trip (account picker → redirect back to /):"
  echo "    Open $APP_DEV_URL/login → Continue with Google (manual or DEV_TEST Google account)"
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

echo "All Firebase Auth checks passed."
echo ""
echo "Production smoke test (manual):"
echo "  ./scripts/verify-firebase-auth.sh --app-dev"
echo "  1. https://app.dev.littlescout.app/login — Continue with Google (OAuth account picker)"
echo "  2. https://admin.dev.littlescout.app — IAP wall → silent Firebase SSO"
echo "  3. Account → Set up authenticator (TOTP MFA)"
