#!/usr/bin/env bash
# EPHINTA one-go launch readiness runner.
# Run from eventsss123/eventsss-main:
#   bash scripts/complete-launch-readiness.sh
#
# Optional environment:
#   VITE_API_URL=https://.../api/v1
#   DATABASE_URL=... RUN_DB_TESTS=1   (must point to a disposable test database)
#   REQUIRE_ANDROID_DEVICE=1          (require adb device and install/launch the APK)
#   ANDROID_KEYSTORE_PATH=... plus ANDROID_KEYSTORE_PASSWORD,
#   ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD (build signed release outputs)
#   ANDROID_CERT_SHA256=...           (verify the release signing certificate)
#
# This script never migrates a production database, processes real payments,
# submits KYC for real people, deploys production, or publishes a store release.
set -Eeuo pipefail

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
pass() { printf '\033[1;32mPASS\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mMANUAL / NOT VERIFIED\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mFAIL\033[0m %s\n' "$*" >&2; exit 1; }

ROOT="$(pwd)"
if [[ -d "$ROOT/eventsss123/eventsss-main/apps/mobile/android" ]]; then
  ROOT="$ROOT/eventsss123/eventsss-main"
elif [[ ! -d "$ROOT/apps/mobile/android" ]]; then
  echo "Run this script from the repository root or eventsss123/eventsss-main." >&2
  exit 2
fi
cd "$ROOT"

: "${VITE_API_URL:=https://ephinta-wss.onrender.com/api/v1}"
: "${ANDROID_ARTIFACT_DIR:=artifacts/complete-launch-readiness}"
mkdir -p "$ANDROID_ARTIFACT_DIR"
REPORT="$ANDROID_ARTIFACT_DIR/launch-readiness-report.txt"
: > "$REPORT"
exec > >(tee -a "$REPORT") 2>&1

say "1/5 — Environment and dependency validation"
command -v node >/dev/null || fail "Node.js is required."
command -v npm >/dev/null || fail "npm is required."
command -v java >/dev/null || fail "Java is required."
node -e 'const major=Number(process.versions.node.split(".")[0]); if(major<20) process.exit(1)' || fail "Node.js 20 or newer is required."
if [[ ! -d node_modules ]]; then npm ci; else pass "Dependencies already installed; using lockfile-installed node_modules."; fi
pass "Node.js, npm and Java are available."

say "2/5 — API, code, database and browser-facing application checks"
case "$VITE_API_URL" in https://*/api/v1) ;; *) fail "VITE_API_URL must be HTTPS and end in /api/v1." ;; esac
API_ORIGIN="${VITE_API_URL%/api/v1}"
curl --fail --silent --show-error --retry 3 --retry-delay 5 --max-time 45 "$API_ORIGIN/health" >/dev/null || fail "Live API health endpoint failed."
curl --fail --silent --show-error --retry 3 --retry-delay 5 --max-time 45 "$API_ORIGIN/ready" >/dev/null || fail "Live API readiness endpoint failed."
pass "Live API health and readiness endpoints passed."

npm run check
pass "Repository API/web/KYC research checks passed."

if [[ "${RUN_DB_TESTS:-0}" == "1" ]]; then
  [[ -n "${DATABASE_URL:-}" ]] || fail "RUN_DB_TESTS=1 requires DATABASE_URL for a disposable test database."
  [[ "${DATABASE_URL}" != *"ephinta_db"* ]] || fail "Refusing to run migrations/tests against the known production database name."
  npm run db:deploy -w apps/api
  npm run test:db -w apps/api
  pass "Disposable database migrations and integration tests passed."
else
  warn "Database integration tests not run: set RUN_DB_TESTS=1 and DATABASE_URL to a disposable CI/test database. Production DB is deliberately never migrated."
fi

say "3/5 — Build web application and Android debug APK"
export VITE_API_URL
export VITE_UPDATE_URL="${VITE_UPDATE_URL:-$VITE_API_URL/app-updates}"
npm run build:web
npm run sync -w apps/mobile
[[ -x apps/mobile/android/gradlew ]] || chmod +x apps/mobile/android/gradlew
(
  cd apps/mobile/android
  ./gradlew --no-daemon --build-cache --parallel lint testDebugUnitTest assembleDebug
)
APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || fail "Android debug APK was not produced."
pass "Web assets and Android debug APK built; Android lint and unit tests passed."

say "4/5 — Android install/launch verification"
if command -v adb >/dev/null && adb devices | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'; then
  DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {n++} END {print n+0}')"
  echo "Detected $DEVICE_COUNT connected Android device(s)."
  adb install -r "$APK"
  adb shell pm path com.ephinta.app | grep -q '^package:' || fail "APK package com.ephinta.app was not installed."
  adb shell am force-stop com.ephinta.app
  adb shell am start -W -n com.ephinta.app/.MainActivity
  sleep 5
  adb shell pidof com.ephinta.app >/dev/null || fail "App process did not remain running after launch."
  pass "Android install and launch smoke test passed on connected device/emulator."
  if [[ "${ANDROID_DEVICE_IS_PHYSICAL:-0}" != "1" ]]; then
    warn "Connected device is not explicitly confirmed as a physical phone. Set ANDROID_DEVICE_IS_PHYSICAL=1 only when testing a real handset."
  fi
elif [[ "${REQUIRE_ANDROID_DEVICE:-0}" == "1" ]]; then
  fail "REQUIRE_ANDROID_DEVICE=1 but no Android device is connected and authorized through adb."
else
  warn "No Android device connected. Physical-device install, launch, camera, notifications, small-screen and real-network checks remain pending."
fi

say "5/5 — Production signing and release gate"
if [[ -z "${ANDROID_KEYSTORE_PATH:-}" && -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  KEYSTORE_TMP="${RUNNER_TEMP:-/tmp}/ephinta-release.keystore"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$KEYSTORE_TMP"
  chmod 600 "$KEYSTORE_TMP"
  export ANDROID_KEYSTORE_PATH="$KEYSTORE_TMP"
fi
SIGNING_READY=1
for name in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  [[ -n "${!name:-}" ]] || SIGNING_READY=0
done
if [[ "$SIGNING_READY" == "1" ]]; then
  [[ -s "$ANDROID_KEYSTORE_PATH" ]] || fail "ANDROID_KEYSTORE_PATH does not point to a readable keystore."
  [[ -n "${ANDROID_CERT_SHA256:-}" ]] || fail "ANDROID_CERT_SHA256 is required to verify the release signing identity."
  keytool -list -keystore "$ANDROID_KEYSTORE_PATH" -storepass "$ANDROID_KEYSTORE_PASSWORD" -alias "$ANDROID_KEY_ALIAS" >/dev/null || fail "Keystore alias/password validation failed."
  export ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
  (
    cd apps/mobile/android
    ./gradlew --no-daemon --build-cache --parallel assembleRelease bundleRelease
  )
  RELEASE_APK="apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
  RELEASE_AAB="apps/mobile/android/app/build/outputs/bundle/release/app-release.aab"
  [[ -s "$RELEASE_APK" && -s "$RELEASE_AAB" ]] || fail "Signed APK/AAB output missing."
  APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner 2>/dev/null | sort -V | tail -1)"
  [[ -x "$APKSIGNER" ]] || fail "Android apksigner not found; configure Android SDK Build Tools."
  SIGNATURE="$("$APKSIGNER" verify --verbose --print-certs "$RELEASE_APK")"
  ACTUAL_CERT="$(printf '%s\n' "$SIGNATURE" | awk -F': ' '/certificate SHA-256 digest/ {print $2; exit}' | tr -d ':' | tr 'A-Z' 'a-z')"
  EXPECTED_CERT="$(printf '%s' "$ANDROID_CERT_SHA256" | tr -d ': ' | tr 'A-Z' 'a-z')"
  [[ -n "$ACTUAL_CERT" && "$ACTUAL_CERT" == "$EXPECTED_CERT" ]] || fail "Release certificate does not match ANDROID_CERT_SHA256."
  cp "$RELEASE_APK" "$ANDROID_ARTIFACT_DIR/ephinta-production.apk"
  cp "$RELEASE_AAB" "$ANDROID_ARTIFACT_DIR/ephinta-production.aab"
  pass "Production APK/AAB built and signing certificate verified."
else
  if [[ "${REQUIRE_PRODUCTION_SIGNING:-0}" == "1" ]]; then
    fail "Production signing is required for this run, but one or more keystore/certificate settings are missing."
  fi
  warn "Production signing skipped: configure the four ANDROID_KEYSTORE_* environment values and ANDROID_CERT_SHA256. Never commit keystore files or passwords."
fi

cp "$APK" "$ANDROID_ARTIFACT_DIR/ephinta-debug.apk"
(
  cd "$ANDROID_ARTIFACT_DIR"
  sha256sum ephinta-debug.apk *.apk *.aab 2>/dev/null | awk '!seen[$2]++' > SHA256SUMS.txt || true
)
cat >> "$REPORT" <<'SUMMARY'

FINAL HUMAN / EXTERNAL RELEASE GATES
- Owner must complete the physical-phone checklist, capture screenshots and verify real handset behavior.
- Registration, login, OTP/email delivery, country-specific KYC, document capture and review must be tested with approved test identities.
- Wallet and payment provider flows must be tested in provider sandbox only; production credentials and real customer funds are prohibited during QA.
- Confirm production database backup/restore, expiry/billing plan, monitoring, secrets and incident response before launch.
- Confirm Firebase configuration and end-to-end push delivery if notifications are part of launch scope.
- Owner must complete Play Console Data safety, privacy policy, content rating, app access and policy declarations, then submit and monitor review.
- This script does not deploy to Render, migrate a production database, publish a GitHub release, or submit to Google Play.
SUMMARY

echo
pass "Automated launch-readiness run reached the end. Review $REPORT and all MANUAL / NOT VERIFIED items."
echo "Artifacts: $ANDROID_ARTIFACT_DIR"
