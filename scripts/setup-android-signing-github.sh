#!/usr/bin/env bash
# Import the EXISTING Build 869 Android signing key into GitHub Actions.
# This script never generates/rotates a key and never writes secrets to git.
set -Eeuo pipefail
set +x
umask 077

REPO="${EPHINTA_REPO:-demtaiwo1-eng/Winning-game-}"
BASELINE_TAG="ephinta-apk-42547397876"
BASELINE_APK_URL="https://github.com/${REPO}/releases/download/${BASELINE_TAG}/ephinta-869.apk"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) is required. Install it and run: gh auth login"
command -v keytool >/dev/null 2>&1 || fail "Java keytool is required (JDK 17 or 21 recommended)."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v awk >/dev/null 2>&1 || fail "awk is required."
gh auth status >/dev/null 2>&1 || fail "Not authenticated. Run: gh auth login"
gh api "repos/$REPO" >/dev/null || fail "Cannot access $REPO."

# GitHub CLI must be authenticated as a repository administrator, or with a
# fine-grained token granting Actions: Read and write + Variables: Read and write.
SECRET_LIST="$(gh secret list --repo "$REPO" 2>/dev/null)" \
  || fail "Cannot manage repository Actions secrets. Use a repository admin account/token with Actions: Read and write."
VARIABLE_LIST="$(gh variable list --repo "$REPO" 2>/dev/null)" \
  || fail "Cannot manage repository Actions variables. Grant Variables: Read and write."

SIGNING_NAMES=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD)
EXISTING=()
for name in "${SIGNING_NAMES[@]}"; do
  if printf '%s\n' "$SECRET_LIST" | awk 'NR > 1 {print $1}' | grep -Fxq "$name"; then
    EXISTING+=("$name")
  fi
done
VARIABLE_EXISTS=false
if printf '%s\n' "$VARIABLE_LIST" | awk 'NR > 1 {print $1}' | grep -Fxq ANDROID_CERT_SHA256; then
  VARIABLE_EXISTS=true
fi

cat <<'NOTICE'
SECURITY CHECK:
- Supply the original keystore that signed the working ephinta-869.apk.
- Do NOT generate a replacement keystore.
- A different signing certificate will not update Build 869 in place.
- Passwords are entered silently and piped directly to GitHub CLI.
- This script checks the certificate against the published Build 869 APK
  before it changes any GitHub secret.
NOTICE

KEYSTORE_FILE=""
while [[ -z "$KEYSTORE_FILE" || ! -f "$KEYSTORE_FILE" ]]; do
  read -r -p "Path to the ORIGINAL Build 869 keystore (.jks/.keystore): " KEYSTORE_FILE
  [[ -f "$KEYSTORE_FILE" ]] || printf 'File not found. Try again.\n' >&2
done
read -r -p "Key alias: " KEY_ALIAS
[[ -n "$KEY_ALIAS" ]] || fail "Key alias cannot be empty."
read -r -s -p "Keystore password: " STORE_PASSWORD; printf '\n'
read -r -s -p "Private-key password: " KEY_PASSWORD; printf '\n'
[[ -n "$STORE_PASSWORD" && -n "$KEY_PASSWORD" ]] || fail "Both passwords are required."

TMP_DIR="$(mktemp -d)"
trap 'unset STORE_PASSWORD KEY_PASSWORD KEYSTORE_B64; rm -rf "$TMP_DIR"' EXIT
export EPHINTA_STORE_PASSWORD="$STORE_PASSWORD"
export EPHINTA_KEY_PASSWORD="$KEY_PASSWORD"

# Validate the keystore, alias and private-key password without printing them.
keytool -list -keystore "$KEYSTORE_FILE" -storepass:env EPHINTA_STORE_PASSWORD \
  -alias "$KEY_ALIAS" >/dev/null 2>&1 \
  || fail "Keystore password or alias is invalid."
keytool -certreq -alias "$KEY_ALIAS" -keystore "$KEYSTORE_FILE" \
  -storepass:env EPHINTA_STORE_PASSWORD -keypass:env EPHINTA_KEY_PASSWORD \
  -file "$TMP_DIR/key-check.csr" -noprompt >/dev/null 2>&1 \
  || fail "Private-key password is invalid."

KEY_CERT="$(keytool -list -v -keystore "$KEYSTORE_FILE" \
  -storepass:env EPHINTA_STORE_PASSWORD -alias "$KEY_ALIAS" 2>/dev/null |
  awk '/SHA256:/ {sub(/^.*SHA256:[[:space:]]*/, ""); print; exit}' |
  tr -d ':[:space:]' | tr 'A-F' 'a-f')"
[[ "$KEY_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "Could not read a valid SHA-256 certificate fingerprint."

# Verify that this key is the exact signing identity of the known-working APK.
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
APKSIGNER="${APKSIGNER:-}"
AAPT="${AAPT:-}"
if [[ -z "$APKSIGNER" && -d "$ANDROID_HOME/build-tools" ]]; then
  APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner 2>/dev/null | sort -V | tail -n 1)"
fi
if [[ -z "$AAPT" && -d "$ANDROID_HOME/build-tools" ]]; then
  AAPT="$(find "$ANDROID_HOME/build-tools" -type f -name aapt 2>/dev/null | sort -V | tail -n 1)"
fi
[[ -x "$APKSIGNER" ]] || fail "Android apksigner not found. Install Android SDK build-tools or set APKSIGNER=/path/to/apksigner."
[[ -x "$AAPT" ]] || fail "Android aapt not found. Install Android SDK build-tools or set AAPT=/path/to/aapt."

curl --fail --silent --show-error --location --retry 3 "$BASELINE_APK_URL" \
  --output "$TMP_DIR/ephinta-869.apk" \
  || fail "Could not download the known-working Build 869 APK for signer verification."
"$APKSIGNER" verify --verbose "$TMP_DIR/ephinta-869.apk" >/dev/null \
  || fail "The published Build 869 APK signature is invalid."
BASELINE_PACKAGE="$("$AAPT" dump badging "$TMP_DIR/ephinta-869.apk" | awk -F"'" '/^package:/ {print $2; exit}')"
[[ "$BASELINE_PACKAGE" == "com.ephinta.app" ]] || fail "Baseline APK package is not com.ephinta.app."
BASELINE_CERT="$("$APKSIGNER" verify --print-certs "$TMP_DIR/ephinta-869.apk" 2>/dev/null |
  awk '/certificate SHA-256 digest:/ {sub(/^.*certificate SHA-256 digest:[[:space:]]*/, ""); print; exit}' |
  tr -d ':[:space:]' | tr 'A-F' 'a-f')"
[[ "$BASELINE_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "Could not read Build 869's signing certificate."
[[ "$KEY_CERT" == "$BASELINE_CERT" ]] || fail "The supplied keystore does NOT match Build 869. No GitHub secrets were changed."

if (( ${#EXISTING[@]} > 0 )) || [[ "$VARIABLE_EXISTS" == true ]]; then
  printf '\nExisting signing configuration names detected: %s\n' "${EXISTING[*]:-none}"
  [[ "$VARIABLE_EXISTS" == true ]] && printf 'ANDROID_CERT_SHA256 variable already exists.\n'
  read -r -p "Replace these configuration values with the verified Build 869 key? Type REPLACE to continue: " CONFIRM
  [[ "$CONFIRM" == "REPLACE" ]] || fail "Cancelled. Existing GitHub configuration was left unchanged."
fi

KEYSTORE_B64="$(base64 < "$KEYSTORE_FILE" | tr -d '\r\n')"
[[ -n "$KEYSTORE_B64" ]] || fail "Could not encode keystore."
printf '%s' "$KEYSTORE_B64" | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" \
  || fail "Failed setting ANDROID_KEYSTORE_BASE64."
printf '%s' "$STORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO" \
  || fail "Failed setting ANDROID_KEYSTORE_PASSWORD."
printf '%s' "$KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPO" \
  || fail "Failed setting ANDROID_KEY_ALIAS."
printf '%s' "$KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD --repo "$REPO" \
  || fail "Failed setting ANDROID_KEY_PASSWORD."
gh variable set ANDROID_CERT_SHA256 --repo "$REPO" --body "$KEY_CERT" \
  || fail "Secrets were saved, but the certificate variable failed. Rerun after granting Variables: Read and write."

unset STORE_PASSWORD KEY_PASSWORD KEYSTORE_B64 EPHINTA_STORE_PASSWORD EPHINTA_KEY_PASSWORD
printf '\nSUCCESS: GitHub Actions received all four signing secrets.\n'
printf 'SUCCESS: ANDROID_CERT_SHA256 repository variable was set.\n'
printf 'SUCCESS: supplied keystore fingerprint matches the Build 869 APK.\n'
printf 'No passwords or keystore contents were displayed or committed.\n'
printf '\nThe production workflow already declares contents: write for publishing releases.\n'
printf 'Repository policy/token must permit that workflow permission; this script does not\n'
printf 'broaden default GITHUB_TOKEN permissions for every workflow in the repository.\n'
printf '\nNext: Actions > EPHINTA Production-Signed Android APK > Run workflow.\n'
