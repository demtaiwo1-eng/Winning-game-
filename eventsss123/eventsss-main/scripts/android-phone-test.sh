#!/usr/bin/env bash
# Build, authenticate against a dedicated NON-PRODUCTION test API, and launch EPHINTA.
# Required: EPHINTA_TEST_API_URL (HTTPS .../api/v1),
# EPHINTA_TEST_ACCOUNT_EMAIL, EPHINTA_TEST_ACCOUNT_PASSWORD.
# Optional: REQUIRE_ANDROID_DEVICE=1, VITE_UPDATE_URL.
set -Eeuo pipefail
fail(){ echo "::error::$*" >&2; exit 1; }
pass(){ echo "PASS: $*"; }
warn(){ echo "NOT VERIFIED: $*"; }

ROOT="$(pwd)"
if [[ -d "$ROOT/eventsss123/eventsss-main/apps/mobile/android" ]]; then ROOT="$ROOT/eventsss123/eventsss-main"; fi
cd "$ROOT"
: "${VITE_API_URL:=https://ephinta-wss.onrender.com/api/v1}"
AUTH_CONFIGURED=0
if [[ -n "${EPHINTA_TEST_API_URL:-}${EPHINTA_TEST_ACCOUNT_EMAIL:-}${EPHINTA_TEST_ACCOUNT_PASSWORD:-}" ]]; then
  for name in EPHINTA_TEST_API_URL EPHINTA_TEST_ACCOUNT_EMAIL EPHINTA_TEST_ACCOUNT_PASSWORD; do
    [[ -n "${!name:-}" ]] || fail "Configure all three staging test secrets to enable real API test-account sign-in."
  done
  case "$EPHINTA_TEST_API_URL" in https://*/api/v1) ;; *) fail "Test API URL must be HTTPS and end in /api/v1";; esac
  case "$EPHINTA_TEST_API_URL" in *ephinta-wss.onrender.com*) fail "Refusing to use the production API for test-account authentication. Configure the staging API URL.";; esac
  AUTH_CONFIGURED=1
fi
command -v node >/dev/null || fail "Node.js missing"
command -v npm >/dev/null || fail "npm missing"
command -v curl >/dev/null || fail "curl missing"
command -v adb >/dev/null || fail "Android adb missing"
[[ -d node_modules ]] || npm ci

if [[ "$AUTH_CONFIGURED" == "1" ]]; then
  API_ORIGIN="${EPHINTA_TEST_API_URL%/api/v1}"
  curl --fail --silent --show-error --retry 3 --max-time 45 "$API_ORIGIN/health" >/dev/null || fail "Staging API health check failed"
  curl --fail --silent --show-error --retry 3 --max-time 45 "$API_ORIGIN/ready" >/dev/null || fail "Staging API database readiness failed"
  pass "Dedicated staging API is healthy"
  
  # Provision the dedicated CLIENT test account if it does not exist yet.
  # HTTP 409 means it already exists; all other registration failures stop the run.
  # Credentials are never printed, written to artifacts, or passed to Gradle.
  LOGIN_JSON="$(node -e 'process.stdout.write(JSON.stringify({email:process.env.EPHINTA_TEST_ACCOUNT_EMAIL,password:process.env.EPHINTA_TEST_ACCOUNT_PASSWORD}))')"
  LOGIN_CODE="$(curl --silent --show-error --max-time 45 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "$LOGIN_JSON" "$EPHINTA_TEST_API_URL/auth/login")" || fail "Staging login endpoint could not be reached"
  if [[ "$LOGIN_CODE" == "401" ]]; then
    REGISTER_JSON="$(node -e 'process.stdout.write(JSON.stringify({email:process.env.EPHINTA_TEST_ACCOUNT_EMAIL,password:process.env.EPHINTA_TEST_ACCOUNT_PASSWORD,name:"Ephinta QA Test",role:"CLIENT",country:"NG",currency:"NGN",locale:"en"}))')"
    REGISTER_CODE="$(curl --silent --show-error --max-time 45 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d "$REGISTER_JSON" "$EPHINTA_TEST_API_URL/auth/register")" || fail "Could not provision the staging test account"
    [[ "$REGISTER_CODE" == "201" || "$REGISTER_CODE" == "409" ]] || fail "Staging test-account registration returned HTTP $REGISTER_CODE"
    unset REGISTER_JSON
  elif [[ "$LOGIN_CODE" != "200" ]]; then
    fail "Staging login returned HTTP $LOGIN_CODE; refusing to create or use another account"
  fi
  LOGIN_RESPONSE="$(curl --fail --silent --show-error --max-time 45 -H 'Content-Type: application/json' -d "$LOGIN_JSON" "$EPHINTA_TEST_API_URL/auth/login")" || fail "Test account login failed after provisioning"
  ACCESS_TOKEN="$(printf '%s' "$LOGIN_RESPONSE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(!j.accessToken)process.exit(2);process.stdout.write(j.accessToken)}catch{process.exit(2)}})')" || fail "Login response did not contain an access token"
  ME="$(curl --fail --silent --show-error --max-time 45 -H "Authorization: Bearer $ACCESS_TOKEN" "$EPHINTA_TEST_API_URL/auth/me")" || fail "Authenticated /auth/me request failed"
  EXPECTED_EMAIL="$(printf '%s' "$EPHINTA_TEST_ACCOUNT_EMAIL" | tr '[:upper:]' '[:lower:]')"
  ACTUAL_EMAIL="$(printf '%s' "$ME" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).user.email).toLowerCase())}catch{process.exit(2)}})')" || fail "Could not verify authenticated user identity"
  [[ "$ACTUAL_EMAIL" == "$EXPECTED_EMAIL" ]] || fail "Authenticated account email did not match the configured test account"
  unset LOGIN_JSON LOGIN_RESPONSE ACCESS_TOKEN ME EPHINTA_TEST_ACCOUNT_PASSWORD
  pass "Dedicated test account login and authenticated profile check passed"
else
  warn "Staging API account sign-in skipped: test secrets are absent. Browser E2E separately signs into every portal using isolated test fixtures."
fi

export VITE_API_URL="${EPHINTA_TEST_API_URL:-$VITE_API_URL}"
export VITE_UPDATE_URL="${VITE_UPDATE_URL:-$VITE_API_URL/app-updates}"
npm run build:web
npm run sync -w apps/mobile
chmod +x apps/mobile/android/gradlew
(cd apps/mobile/android && ./gradlew --no-daemon --build-cache lint testDebugUnitTest assembleDebug)
APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || fail "Debug APK missing"
BT="$(find "${ANDROID_HOME:-/opt/android-sdk}/build-tools" -type f -name aapt 2>/dev/null | sort -V | tail -1)"
if [[ -n "$BT" ]]; then "$BT" dump badging "$APK" | grep -q "package: name='com.ephinta.app'" || fail "Unexpected Android package ID"; fi
unzip -t "$APK" >/dev/null || fail "APK archive integrity check failed"
mkdir -p artifacts/android-phone-test
cp "$APK" artifacts/android-phone-test/ephinta-test.apk
sha256sum artifacts/android-phone-test/ephinta-test.apk > artifacts/android-phone-test/SHA256SUMS.txt

if adb devices | awk 'NR>1 && $2=="device"{ok=1}END{exit !ok}'; then
  adb install -r "$APK"
  adb shell pm path com.ephinta.app | grep -q '^package:' || fail "APK installation not confirmed"
  adb shell am force-stop com.ephinta.app
  adb shell am start -W -n com.ephinta.app/.MainActivity
  sleep 5
  adb shell pidof com.ephinta.app >/dev/null || fail "App did not remain open after launch"
  pass "Android app installed and remained open on the connected emulator/device"
else
  [[ "${REQUIRE_ANDROID_DEVICE:-0}" != "1" ]] || fail "No authorized Android device found"
  warn "No connected Android device; emulator/physical install step was not run"
fi
echo "APK: artifacts/android-phone-test/ephinta-test.apk"
echo "The app opens to its normal sign-in screen. Sign in with the configured test account; no auth bypass is built into the APK."
