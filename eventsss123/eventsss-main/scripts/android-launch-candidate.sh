#!/usr/bin/env bash
# Ephinta Android launch-candidate builder and verifier.
# Run from eventsss123/eventsss-main: bash scripts/android-launch-candidate.sh
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [[ -d "$ROOT/eventsss123/eventsss-main/apps/mobile/android" ]]; then
  ROOT="$ROOT/eventsss123/eventsss-main"
elif [[ -d "$ROOT/apps/mobile/android" ]]; then
  ROOT="$ROOT"
else
  ROOT="$(pwd)"
fi
cd "$ROOT"
ANDROID_DIR="apps/mobile/android"
GRADLEW="$ANDROID_DIR/gradlew"
VARIABLES="$ANDROID_DIR/variables.gradle"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"

fail() { echo "::error::$*" >&2; exit 1; }
for file in "$GRADLEW" "$VARIABLES" "$APP_GRADLE"; do
  [[ -f "$file" ]] || fail "Required Android project file is missing: $file"
done

grep -Eq 'compileSdkVersion[[:space:]]*=[[:space:]]*36' "$VARIABLES" || fail "compileSdkVersion must be 36."
grep -Eq 'targetSdkVersion[[:space:]]*=[[:space:]]*36' "$VARIABLES" || fail "targetSdkVersion must be 36 for current Google Play submissions."
grep -Eq 'applicationId[[:space:]]+"com\.ephinta\.app"' "$APP_GRADLE" || fail "Unexpected Android applicationId; expected com.ephinta.app."
grep -Eq 'minSdkVersion[[:space:]]*=[[:space:]]*23' "$VARIABLES" || fail "Unexpected minSdkVersion; this project is configured for API 23."

: "${VITE_API_URL:=https://ephinta-wss.onrender.com/api/v1}"
case "$VITE_API_URL" in https://*/api/v1) ;; *) fail "VITE_API_URL must be HTTPS and end in /api/v1." ;; esac
API_ORIGIN="${VITE_API_URL%/api/v1}"
command -v curl >/dev/null || fail "curl is required."
curl --fail --silent --show-error --retry 5 --retry-delay 5 --max-time 60 "$API_ORIGIN/health" >/dev/null || fail "Production API health check failed."
curl --fail --silent --show-error --retry 5 --retry-delay 5 --max-time 60 "$API_ORIGIN/ready" >/dev/null || fail "Production API readiness check failed."

[[ -n "${ANDROID_HOME:-}" ]] || fail "ANDROID_HOME is not configured."
BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d -name '36.*' | sort -V | tail -n 1)"
[[ -n "$BUILD_TOOLS" ]] || fail "Android Build Tools 36.x are missing; install platforms;android-36 and build-tools;36.0.0."
for tool in aapt apksigner; do [[ -x "$BUILD_TOOLS/$tool" ]] || fail "Missing Android tool: $BUILD_TOOLS/$tool"; done

chmod +x "$GRADLEW"
(cd "$ROOT/$ANDROID_DIR" && ./gradlew --no-daemon clean assembleDebug)
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || fail "Gradle did not produce the expected debug APK."

BADGING="$("$BUILD_TOOLS/aapt" dump badging "$APK")"
grep -q "package: name='com.ephinta.app'" <<<"$BADGING" || fail "APK package name is not com.ephinta.app."
grep -q "sdkVersion:'23'" <<<"$BADGING" || fail "APK minimum SDK is not API 23."
grep -q "targetSdkVersion:'36'" <<<"$BADGING" || fail "Built APK does not target API 36."
"$BUILD_TOOLS/apksigner" verify --verbose "$APK" >/dev/null || fail "APK signature verification failed."
unzip -t "$APK" >/dev/null || fail "APK archive integrity check failed."

OUT="${ANDROID_ARTIFACT_DIR:-$ROOT/artifacts/android-launch-candidate}"
mkdir -p "$OUT"
cp "$APK" "$OUT/ephinta-android-debug-api36.apk"
cat > "$OUT/build-info.txt" <<INFO
Application: Ephinta
Package: com.ephinta.app
Minimum Android API: 23
Target Android API: 36
Build type: debug (for owner physical-device testing only; not a Play Store release)
Git commit: ${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}
API base: $VITE_API_URL
API health/readiness: passed
APK signature/archive verification: passed
INFO
cat > "$OUT/device-test-checklist.txt" <<'CHECKS'
EPHINTA REAL-DEVICE TEST — complete before launch sign-off

[ ] Install the APK on a physical Android phone (allow install from this source only if you trust the downloaded artifact).
[ ] Open app; confirm splash/logo, no blank screen, crash, or endless loading.
[ ] Register a fresh test account; verify validation, Back/Next, keyboard, scrolling, and OTP/email/SMS behavior as configured.
[ ] Sign in, sign out, force-close, relaunch, and verify session behavior.
[ ] Navigate every primary tab and use Android system Back.
[ ] Test on mobile data and Wi-Fi; disable network, reopen, restore network, and confirm safe recovery.
[ ] Verify profile and account settings save and persist after relaunch.
[ ] Verify event creation/editing, guest/RSVP, vendor browsing/enquiries, messaging, and notifications if enabled.
[ ] Verify wallet/payment flows only with approved test credentials and low-risk test transactions; never use real customer funds for testing.
[ ] Verify KYC consent, country-specific fields, camera/file upload, retry, and rejection handling using test identities only.
[ ] Test camera/file permissions, notification permission, deep links, NFC/Bluetooth features if shown.
[ ] Rotate screen, use small display/font scaling, and check cutouts/system bars.
[ ] Record phone model, Android version, test date, screenshots, and every failure before reporting back.

This debug APK is not the production-signed release and must not be distributed publicly.
CHECKS
(
  cd "$OUT"
  sha256sum ephinta-android-debug-api36.apk > SHA256SUMS.txt
)
echo "Android launch candidate built and verified: $OUT/ephinta-android-debug-api36.apk"
