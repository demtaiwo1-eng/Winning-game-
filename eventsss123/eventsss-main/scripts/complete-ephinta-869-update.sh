#!/usr/bin/env bash
# EPHINTA one-command Build 869-compatible Android update.
# Run from the repository root on main in a trusted GitHub Codespace with gh,
# Java 21, Android SDK build-tools, and repository write/Actions permissions.
set -Eeuo pipefail

REPO="demtaiwo1-eng/Winning-game-"
BASELINE_TAG="ephinta-apk-42547397876"
BASELINE_APK="ephinta-869.apk"
WORKFLOW=".github/workflows/ephinta-production-apk.yml"
OUT_DIR="${EPHINTA_OUTPUT_DIR:-$PWD/ephinta-release-output}"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

fail() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"; }
need gh
need java
need keytool
need unzip
need sha256sum
need awk
need sed
need sort
need find
need git
need seq
need sleep
need grep
need cut

gh auth status >/dev/null 2>&1 || fail "Authenticate GitHub CLI first (gh auth login)."
gh repo view "$REPO" >/dev/null 2>&1 || fail "This GitHub identity cannot access $REPO."
CURRENT_BRANCH="$(git -C "$PWD" branch --show-current 2>/dev/null || true)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Run this from the repository's main branch after the workflow/script PR is merged."
  echo "Current branch: ${CURRENT_BRANCH:-not a Git repository}"
  fail "Refusing to dispatch a release from an unmerged working branch."
fi

echo "[1/7] Checking required GitHub Actions signing configuration (names only)..."
SECRETS="$(gh secret list --repo "$REPO" 2>/dev/null | awk 'NR>1 {print $1}')"
for secret in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  grep -Fxq "$secret" <<<"$SECRETS" || fail "Missing repository Actions secret: $secret. Configure it securely in GitHub Settings; never paste it into chat."
done
EXPECTED_CERT="$(gh variable get ANDROID_CERT_SHA256 --repo "$REPO" 2>/dev/null | tr -d '[:space:]' | tr 'A-F' 'a-f')" || fail "Missing repository variable ANDROID_CERT_SHA256."
[[ -n "$EXPECTED_CERT" ]] || fail "ANDROID_CERT_SHA256 is empty."

echo "[2/7] Downloading the known-working Build 869 APK for certificate comparison..."
gh release download "$BASELINE_TAG" --repo "$REPO" --pattern "$BASELINE_APK" --dir "$TMP_DIR" >/dev/null
OLD_APK="$TMP_DIR/$BASELINE_APK"
[[ -s "$OLD_APK" ]] || fail "Could not download the original Build 869 APK."

APKSIGNER="$(find "${ANDROID_HOME:-/nonexistent}/build-tools" -type f -name apksigner 2>/dev/null | sort -V | tail -n 1)"
AAPT="$(find "${ANDROID_HOME:-/nonexistent}/build-tools" -type f -name aapt 2>/dev/null | sort -V | tail -n 1)"
[[ -x "$APKSIGNER" ]] || fail "Android SDK apksigner not found. Install Android SDK build-tools and set ANDROID_HOME."
[[ -x "$AAPT" ]] || fail "Android SDK aapt not found. Install Android SDK build-tools and set ANDROID_HOME."
"$APKSIGNER" verify --verbose "$OLD_APK" >/dev/null || fail "Build 869 APK signature verification failed."
OLD_CERT="$("$APKSIGNER" verify --print-certs "$OLD_APK" | awk '/certificate SHA-256 digest/ {sub(/^.*certificate SHA-256 digest:[[:space:]]*/, ""); print; exit}' | tr -d ':[:space:]' | tr 'A-F' 'a-f')"
EXPECTED_NORMALIZED="$(printf '%s' "$EXPECTED_CERT" | tr -d ':[:space:]' | tr 'A-F' 'a-f')"
[[ -n "$OLD_CERT" ]] || fail "Could not read Build 869 signing certificate."
if [[ "$OLD_CERT" != "$EXPECTED_NORMALIZED" ]]; then
  echo "Build 869 certificate: $OLD_CERT"
  echo "Configured release cert: $EXPECTED_NORMALIZED"
  fail "Signing identity mismatch. The configured private keystore cannot update Build 869. Recover the original signing keystore first; do not generate a replacement."
fi

echo "[3/7] Confirming package identity and selecting a strictly higher versionCode..."
BADGING="$("$AAPT" dump badging "$OLD_APK")"
OLD_PACKAGE="$(awk -F"'" '/^package:/ {print $2; exit}' <<<"$BADGING")"
OLD_VERSION_CODE="$(awk -F"'" '/^package:/ {for(i=1;i<=NF;i++) if($i ~ /versionCode=/) {print $(i+1); exit}}' <<<"$BADGING")"
[[ "$OLD_PACKAGE" == "com.ephinta.app" ]] || fail "Build 869 package ID is '$OLD_PACKAGE', expected com.ephinta.app."
[[ "$OLD_VERSION_CODE" =~ ^[0-9]+$ ]] || fail "Could not parse Build 869 versionCode."
NEXT_VERSION_CODE="$((OLD_VERSION_CODE + 1))"
(( NEXT_VERSION_CODE <= 2100000000 )) || fail "Next versionCode exceeds Android's supported limit."
echo "Installed baseline: package=$OLD_PACKAGE versionCode=$OLD_VERSION_CODE"
echo "Requested update: versionCode=$NEXT_VERSION_CODE"

echo "[4/7] Confirming the production workflow is available on main..."
gh workflow view "$WORKFLOW" --repo "$REPO" >/dev/null 2>&1 || fail "Workflow $WORKFLOW is not available. Merge the compatibility workflow change first."

echo "[5/7] Dispatching signed build with the original certificate..."
PREVIOUS_RUN_ID="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch main --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
gh workflow run "$WORKFLOW" --repo "$REPO" --ref main -f "minimum_version_code=$NEXT_VERSION_CODE"

echo "[6/7] Waiting for the production APK workflow to finish..."
RUN_ID=""
for attempt in $(seq 1 60); do
  CANDIDATE_RUN_ID="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch main --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
  if [[ -n "$CANDIDATE_RUN_ID" && "$CANDIDATE_RUN_ID" != "null" && "$CANDIDATE_RUN_ID" != "$PREVIOUS_RUN_ID" ]]; then
    RUN_ID="$CANDIDATE_RUN_ID"
    break
  fi
  sleep 5
done
[[ -n "$RUN_ID" && "$RUN_ID" != "null" ]] || fail "Could not identify the dispatched workflow run. Check GitHub Actions manually."
gh run watch "$RUN_ID" --repo "$REPO" --exit-status || fail "The signed APK workflow failed. Inspect: https://github.com/$REPO/actions/runs/$RUN_ID"

echo "[7/7] Downloading and independently checking the signed APK artifact..."
mkdir -p "$OUT_DIR"
gh run download "$RUN_ID" --repo "$REPO" --name ephinta-production-signed-apk --dir "$OUT_DIR"
NEW_APK="$OUT_DIR/ephinta-production.apk"
[[ -s "$NEW_APK" ]] || fail "Workflow succeeded but ephinta-production.apk was not found in the artifact."
"$APKSIGNER" verify --verbose "$NEW_APK" >/dev/null || fail "New APK signature verification failed."
NEW_CERT="$("$APKSIGNER" verify --print-certs "$NEW_APK" | awk '/certificate SHA-256 digest/ {sub(/^.*certificate SHA-256 digest:[[:space:]]*/, ""); print; exit}' | tr -d ':[:space:]' | tr 'A-F' 'a-f')"
[[ "$NEW_CERT" == "$OLD_CERT" ]] || fail "Downloaded APK certificate differs from Build 869."
NEW_BADGING="$("$AAPT" dump badging "$NEW_APK")"
NEW_CODE="$(awk -F"'" '/^package:/ {for(i=1;i<=NF;i++) if($i ~ /versionCode=/) {print $(i+1); exit}}' <<<"$NEW_BADGING")"
[[ "$NEW_CODE" =~ ^[0-9]+$ ]] && (( NEW_CODE > OLD_VERSION_CODE )) || fail "New APK versionCode is not higher than Build 869."
[[ "$(awk -F"'" '/^package:/ {print $2; exit}' <<<"$NEW_BADGING")" == "$OLD_PACKAGE" ]] || fail "New APK package ID changed."
(cd "$OUT_DIR" && sha256sum ephinta-production.apk > ephinta-production.apk.sha256)

echo
echo "SUCCESS: signed APK passed local package, version, and certificate checks."
echo "APK: $NEW_APK"
echo "SHA-256: $(cut -d' ' -f1 "$OUT_DIR/ephinta-production.apk.sha256")"
echo "Workflow: https://github.com/$REPO/actions/runs/$RUN_ID"
echo "The new APK is eligible for an in-place update of Build 869; final confirmation still requires installing it over the existing app on your physical Android device."
