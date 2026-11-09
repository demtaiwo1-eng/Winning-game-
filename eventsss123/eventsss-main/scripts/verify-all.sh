#!/usr/bin/env bash
# Repeatable CI verification for the EPHINTA web and Android app.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail(){ echo "::error::$*" >&2; exit 1; }
step(){ echo; echo "===== $* ====="; }
trap 'fail "Command failed at line $LINENO: $BASH_COMMAND"' ERR
command -v node >/dev/null 2>&1 || fail "Node.js is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
[[ -f package-lock.json ]] || fail "package-lock.json is missing"
[[ -f apps/web/package.json ]] || fail "apps/web/package.json is missing"
[[ -f apps/mobile/package.json ]] || fail "apps/mobile/package.json is missing"

step "Install locked dependencies"
npm ci

step "Validate release signing helper shell syntax"
bash -n scripts/setup-android-signing.sh

step "Full-stack local startup smoke test"
npm run dev:smoke

step "Web production build"
npm run build -w @ess/web

step "Web unit tests"
npm run test -w @ess/web

step "Install Playwright Chromium and Linux dependencies"
npm exec --workspace @ess/web -- playwright install --with-deps chromium

step "Browser end-to-end tests"
npm run test:e2e -w @ess/web

step "Strict design quality audit"
npm run design:audit:strict -w @ess/web

if [[ "${EPHINTA_RUN_ANDROID_BUILD:-false}" == "true" ]]; then
step "Android sync, lint, unit tests, and debug APK"
if [[ -x apps/mobile/android/gradlew ]]; then
  npm run sync -w @ess/mobile
  npm run verify:android -w @ess/mobile
else
  echo "::error::Android Gradle wrapper is missing or not executable"
  exit 1
fi

APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || fail "Android debug APK was not produced"
if command -v adb >/dev/null 2>&1 && adb devices | awk 'NR>1 && $2=="device"{ok=1}END{exit !ok}'; then
  step "Install and launch on available Android device"
  adb install -r "$APK"
  adb shell pm path com.ephinta.app | grep -q '^package:' || fail "APK installation was not confirmed"
  adb shell am force-stop com.ephinta.app
  adb shell am start -W -n com.ephinta.app/.MainActivity
  sleep 5
  adb shell pidof com.ephinta.app >/dev/null || fail "App did not remain open after launch"
else
  echo "NOT VERIFIED: no connected Android device; APK build and archive checks still run."
fi
unzip -t "$APK" >/dev/null || fail "APK archive integrity check failed"
echo
echo "PASS: all configured EPHINTA verification stages completed."
echo "APK: $APK"
else
  echo
  echo "SKIP: Android build not required for this change set; run it for Android-native changes or a deliberate release verification."
fi
