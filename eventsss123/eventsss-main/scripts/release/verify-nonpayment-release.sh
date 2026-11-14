#!/usr/bin/env bash
# EPHINTA non-payment release hardening and verification.
# Runs available non-payment release gates and writes artifacts/nonpayment-release-verification.txt.
# Payments (checkout, provider, payout, refund and payment simulations) are intentionally excluded.
# Run from any directory: bash eventsss123/eventsss-main/scripts/release/verify-nonpayment-release.sh
# Optional: EPHINTA_RUN_ANDROID_BUILD=true EPHINTA_INSTALL_ANDROID=true
# Optional triage only: EPHINTA_SKIP_BROWSER=true (result will be PARTIAL, never full PASS).
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$APP_ROOT"
REPORT_DIR="${REPORT_DIR:-$APP_ROOT/artifacts}"
REPORT_FILE="$REPORT_DIR/nonpayment-release-verification.txt"
mkdir -p "$REPORT_DIR"; : > "$REPORT_FILE"
PASS=0; FAIL=0; SKIP=0; WARN=0
log(){ printf '\n[%s] %s\n' "$1" "$2" | tee -a "$REPORT_FILE"; }
pass(){ PASS=$((PASS+1)); log PASS "$1"; }
fail(){ FAIL=$((FAIL+1)); log FAIL "$1"; }
skip(){ SKIP=$((SKIP+1)); log SKIP "$1"; }
warn(){ WARN=$((WARN+1)); log WARN "$1"; }
run(){
  local label="$1"; shift
  log RUN "$label"
  local output rc
  set +e; output="$("$@" 2>&1)"; rc=$?; set -e
  printf '%s\n' "$output" | tee -a "$REPORT_FILE"
  if (( rc == 0 )); then pass "$label"; else fail "$label (exit $rc)"; fi
}
need(){ command -v "$1" >/dev/null 2>&1 || { log FATAL "Required command missing: $1"; exit 2; }; }
trap 'rc=$?; log SUMMARY "PASS=$PASS FAIL=$FAIL SKIP=$SKIP WARN=$WARN EXIT=$rc"; exit "$rc"' EXIT
need node; need npm; need git
[[ -f package.json && -f package-lock.json ]] || { log FATAL "Run from maintained app root; package.json and package-lock.json are required."; exit 2; }
log INFO "EPHINTA non-payment release verification"
log INFO "Commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
log INFO "Payments are excluded by request; this run makes no payment-readiness claim."
run "Install exact locked dependencies" npm ci
run "API, web and KYC test suite" npm run check
run "API production build" npm run build
run "Web production build" npm run build:web
run "Device/session security verification" npm run device-security:verify
run "Source and asset rights technical gate" npm run ip:verify
run "Third-party dependency licence inventory" npm run licence:inventory
run "Local application startup smoke test" npm run dev:smoke
run "Responsive UX audit" npm run ux:audit
if [[ "${EPHINTA_SKIP_BROWSER:-false}" == "true" ]]; then
  skip "Browser E2E explicitly skipped; result cannot be a full release pass."
else
  run "Browser end-to-end suite" npm run test:e2e -w @ess/web
fi
if [[ "${EPHINTA_RUN_ANDROID_BUILD:-false}" == "true" ]]; then
  if [[ -x apps/mobile/android/gradlew ]]; then
    run "Android sync" npm run sync -w @ess/mobile
    run "Android lint, unit tests and debug APK build" npm run verify:android -w @ess/mobile
    APK="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
    if [[ -s "$APK" ]] && command -v unzip >/dev/null 2>&1 && unzip -t "$APK" >/dev/null 2>&1; then
      pass "Debug APK exists and archive integrity is valid"
      if [[ "${EPHINTA_INSTALL_ANDROID:-false}" == "true" ]]; then
        if command -v adb >/dev/null 2>&1 && adb devices | awk 'NR>1 && $2=="device"{ok=1}END{exit !ok}'; then
          run "Install debug APK on connected Android device" adb install -r "$APK"
          run "Launch installed Android app" adb shell am start -W -n com.ephinta.app/.MainActivity
          launched=0
          for attempt in $(seq 1 60); do
            pid="$(adb shell pidof com.ephinta.app 2>/dev/null | tr -d '\r' || true)"
            foreground="$(adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | grep -F com.ephinta.app || true)"
            if [[ -n "$pid" && -n "$foreground" ]]; then launched=1; break; fi
            sleep 5
          done
          if [[ "$launched" == "1" ]]; then pass "Android app process remains alive in the foreground"; else fail "Android app did not remain alive in the foreground after launch"; fi
        else
          warn "No authorized Android device; device install/launch was not verified."
        fi
      else
        skip "Device install/launch not requested; only APK archive was checked."
      fi
    else
      fail "Debug APK missing or archive integrity check failed."
    fi
  else
    fail "Android Gradle wrapper missing or not executable."
  fi
else
  skip "Android build not run; set EPHINTA_RUN_ANDROID_BUILD=true in CI/release environment."
fi
log INFO "Owner-dependent gates remain: production signing credentials, physical-device acceptance, legal chain-of-title and asset creator evidence, deployment secrets, SMTP/push credentials. The script cannot fabricate these proofs."
log INFO "Payment checkout, provider calls, payouts, refunds and payment simulations were not run."
if (( FAIL > 0 )); then log RESULT "BLOCKED: $FAIL non-payment stage(s) failed."; exit 1; fi
if (( SKIP > 0 || WARN > 0 )); then log RESULT "PARTIAL: executed checks passed, but skipped/warned stages remain; not a full release pass."; exit 2; fi
log RESULT "PASS: all enabled non-payment verification stages passed. Payment readiness remains unverified."
