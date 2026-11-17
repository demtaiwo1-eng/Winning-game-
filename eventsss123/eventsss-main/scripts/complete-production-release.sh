#!/usr/bin/env bash
# EPHINTA one-command production finalizer.
# Run only from a trusted GitHub Actions runner or secure release workstation.
# Never print secret values. External confirmations below must be backed by evidence.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REPORT_DIR="${EPHINTA_REPORT_DIR:-$ROOT/artifacts/production-finalization}"
APK_DIR="$ROOT/apps/mobile/android/app/build/outputs/apk/release"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/production-readiness.txt"
: > "$REPORT"

pass(){ printf 'PASS  %s\n' "$1" | tee -a "$REPORT"; }
block(){ printf 'BLOCK %s\n' "$1" | tee -a "$REPORT"; }
need(){ local name="$1" value="${!1:-}"; if [[ -n "$value" ]]; then pass "$name is configured"; else block "$name is missing"; fi; }

echo "EPHINTA production finalization — $(date -u +%FT%TZ)" | tee -a "$REPORT"
echo "Repository: ${GITHUB_REPOSITORY:-local}" | tee -a "$REPORT"
echo "Commit: ${GITHUB_SHA:-unknown}" | tee -a "$REPORT"

# Confirm deployed web/API endpoints before packaging an online mobile client.
API_ORIGIN="${EPHINTA_API_ORIGIN:-https://ephinta-wss.onrender.com}"
WEB_ORIGIN="${EPHINTA_WEB_ORIGIN:-https://ephinta-web.onrender.com}"
for endpoint in "$API_ORIGIN/health" "$API_ORIGIN/ready" "$WEB_ORIGIN"; do
  if curl --fail --silent --show-error --location --max-time 30 "$endpoint" >/dev/null; then
    pass "Endpoint responds: $endpoint"
  else
    block "Endpoint unavailable: $endpoint"
  fi
done

# A durable DB and commercial integrations cannot be manufactured by a build.
# These flags are evidence-backed attestations, not automated provider verification.
for item in EPHINTA_DB_BACKUP_RESTORE_VERIFIED EPHINTA_DB_DURABLE_BEFORE_EXPIRY \
  EPHINTA_LIVE_PAYMENT_SETTLEMENT_VERIFIED EPHINTA_DSP_AD_SPONSOR_RECONCILIATION_VERIFIED \
  EPHINTA_DSP_RIGHTS_OWNER_PAYOUTS_VERIFIED EPHINTA_ANDROID_PHYSICAL_DEVICE_TESTED; do
  if [[ "${!item:-}" == "true" ]]; then pass "$item evidence attested"; else block "$item is not confirmed"; fi
done

# Original signing certificate is mandatory to update existing installations.
for item in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD ANDROID_CERT_SHA256; do
  need "$item"
done

if [[ -z "${ANDROID_KEYSTORE_BASE64:-}" || -z "${ANDROID_KEYSTORE_PASSWORD:-}" || -z "${ANDROID_KEY_ALIAS:-}" || -z "${ANDROID_KEY_PASSWORD:-}" || -z "${ANDROID_CERT_SHA256:-}" ]]; then
  block "Signed Android release skipped: original signing credentials/certificate are incomplete"
else
  KEYSTORE="$RUNNER_TEMP/ephinta-release.jks"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$KEYSTORE"
  export ANDROID_KEYSTORE_PATH="$KEYSTORE"
  pass "Original Android keystore restored to ephemeral runner storage"

  npm ci
  export VITE_API_URL="${EPHINTA_API_URL:-$API_ORIGIN/api/v1}"
  export VITE_UPDATE_URL="${EPHINTA_UPDATE_URL:-$API_ORIGIN/api/v1/app-updates}"
  npm run build:web
  npx cap sync android --config apps/mobile/capacitor.config.ts
  chmod +x apps/mobile/android/gradlew
  (cd apps/mobile/android && ./gradlew --no-daemon assembleRelease)

  APK="$(find "$APK_DIR" -maxdepth 1 -type f -name '*.apk' -print -quit)"
  if [[ -z "$APK" ]]; then block "Release APK was not produced"; else
    APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort -V | tail -1)"
    ACTUAL="$( "$APKSIGNER" verify --print-certs "$APK" | sed -n 's/.*SHA-256 digest: //p' | head -1 | tr -d ':' | tr '[:lower:]' '[:upper:]')"
    EXPECTED="$(printf '%s' "$ANDROID_CERT_SHA256" | tr -d ':' | tr '[:lower:]' '[:upper:]')"
    if [[ -z "$ACTUAL" || "$ACTUAL" != "$EXPECTED" ]]; then
      block "APK signing certificate does not match ANDROID_CERT_SHA256"
      exit 1
    fi
    pass "Release APK signature matches the configured original certificate"
    cp "$APK" "$REPORT_DIR/EPHINTA-release.apk"
  fi
fi

# Production can only be declared complete when every external gate is evidenced.
if grep -q '^BLOCK ' "$REPORT"; then
  echo "RESULT: BUILD/READINESS WORK COMPLETED WHERE POSSIBLE; COMMERCIAL PRODUCTION GATES REMAIN." | tee -a "$REPORT"
  exit 2
fi

echo "RESULT: ALL DECLARED PRODUCTION GATES PASSED." | tee -a "$REPORT"
