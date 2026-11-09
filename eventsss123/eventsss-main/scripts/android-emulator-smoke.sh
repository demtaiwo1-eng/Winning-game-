#!/usr/bin/env bash
# Run as one shell process from the repository root inside android-emulator-runner.
set -Eeuo pipefail

APK="${1:-artifacts/android/app-debug.apk}"
API_LEVEL="${2:-unknown}"
PACKAGE="com.ephinta.app"

fail() {
  echo "::error::$*"
  echo "===== Android activity diagnostics ====="
  timeout 10s adb shell dumpsys activity activities 2>&1 | tail -n 180 || true
  echo "===== App crash / ANR log ====="
  timeout 10s adb logcat -d -t 3000 2>&1 | grep -Ei "$PACKAGE|FATAL EXCEPTION|AndroidRuntime|ANR in" | tail -n 240 || true
  exit 1
}

echo "Starting Android API $API_LEVEL install-and-launch smoke test."
command -v adb >/dev/null 2>&1 || fail "adb is not installed"
[[ -s "$APK" ]] || fail "Verified APK is missing: $APK"

timeout 30s adb start-server || fail "adb server did not start within 30 seconds"
timeout 180s adb wait-for-device || fail "Emulator did not become available to adb"

# Emulator-runner performs the boot itself. Confirm Android services are ready.
booted=0
for attempt in $(seq 1 60); do
  value="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$value" == "1" ]]; then booted=1; break; fi
  sleep 5
done
[[ "$booted" == "1" ]] || fail "Android boot did not complete within five minutes"

packages_ready=0
for attempt in $(seq 1 24); do
  if timeout 10s adb shell pm list packages >/dev/null 2>&1; then packages_ready=1; break; fi
  sleep 5
done
[[ "$packages_ready" == "1" ]] || fail "Android package manager did not become ready"

installed=0
for attempt in 1 2 3; do
  if timeout 180s adb install -r "$APK"; then installed=1; break; fi
  sleep 5
done
[[ "$installed" == "1" ]] || fail "APK installation failed after three attempts"
timeout 10s adb shell pm path "$PACKAGE" | grep -q '^package:' || fail "Installed package $PACKAGE was not found"

timeout 10s adb shell am force-stop "$PACKAGE" || true
# Resolve the launchable activity from the installed APK instead of assuming its
# fully-qualified class name. This also validates the packaged MAIN/LAUNCHER intent.
launch_output="$(timeout 30s adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 2>&1)" || {
  echo "$launch_output"
  fail "Android could not launch the installed EPHINTA package"
}
echo "$launch_output"
grep -Eq "Events injected: 1|monkey: finished" <<<"$launch_output" || fail "Android launcher did not dispatch an app launch"

# Require both a live process and the app as the resumed foreground activity.
launched=0
for attempt in $(seq 1 36); do
  pid="$(timeout 10s adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
  foreground="$(timeout 10s adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | grep -F "$PACKAGE" || true)"
  if [[ -n "$pid" && -n "$foreground" ]]; then launched=1; break; fi
  sleep 5
done
[[ "$launched" == "1" ]] || fail "App process did not remain alive in the foreground after launch"

echo "PASS: EPHINTA installed, launched and remained foregrounded on Android API $API_LEVEL."
