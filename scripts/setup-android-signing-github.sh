#!/usr/bin/env bash
# Create the EPHINTA Android release key inside GitHub Codespaces and save
# the signing material directly to GitHub Actions secrets. Never run with bash -x.
set -euo pipefail
set +x

REPO="${EPHINTA_REPO:-demtaiwo1-eng/Winning-game-}"
ALIAS="ephinta-release"
ROOT="$HOME/.ephinta-android-signing"
KEYSTORE="$ROOT/ephinta-release.jks"
BACKUP="$ROOT/ephinta-release.jks.enc"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v gh >/dev/null || fail "GitHub CLI (gh) is required. Run this inside GitHub Codespaces."
command -v keytool >/dev/null || fail "JDK 21 keytool is missing from this Codespace."
command -v openssl >/dev/null || fail "OpenSSL is required for the encrypted keystore backup."
gh auth status >/dev/null 2>&1 || fail "Sign in to GitHub CLI in this Codespace, then rerun."
gh repo view "$REPO" >/dev/null 2>&1 || fail "Cannot access $REPO with the current GitHub account."

SECRET_LIST="$(gh secret list --repo "$REPO" 2>/dev/null)" || fail "This GitHub account cannot manage repository Actions secrets. Ask a repository admin to run this setup from their Codespace."
if printf '%s\n' "$SECRET_LIST" | awk '{print $1}' | grep -qx 'ANDROID_KEYSTORE_BASE64'; then
  fail "ANDROID_KEYSTORE_BASE64 already exists. Refusing to replace an existing release key."
fi
if [[ -e "$KEYSTORE" || -e "$BACKUP" ]]; then
  fail "A signing key or backup already exists at $ROOT. Refusing to overwrite it."
fi

mkdir -p "$ROOT"
chmod 700 "$ROOT"

printf 'Create a strong keystore password (save it in your password manager).\n'
read -rsp 'Keystore password: ' STORE_PASSWORD; printf '\n'
read -rsp 'Confirm keystore password: ' STORE_CONFIRM; printf '\n'
[[ ${#STORE_PASSWORD} -ge 12 && "$STORE_PASSWORD" == "$STORE_CONFIRM" ]] || fail "Use a keystore password of at least 12 characters and enter it identically twice."
read -rsp 'Private-key password: ' KEY_PASSWORD; printf '\n'
[[ ${#KEY_PASSWORD} -ge 12 ]] || fail "Use a private-key password of at least 12 characters."
export EPHINTA_STORE_PASSWORD="$STORE_PASSWORD" EPHINTA_KEY_PASSWORD="$KEY_PASSWORD"

keytool -genkeypair -v \
  -keystore "$KEYSTORE" -storetype JKS -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=EPHINTA Android Release, OU=Mobile, O=EPHINTA" \
  -storepass:env EPHINTA_STORE_PASSWORD -keypass:env EPHINTA_KEY_PASSWORD
chmod 600 "$KEYSTORE"

FINGERPRINT="$(keytool -list -v -keystore "$KEYSTORE" -storepass:env EPHINTA_STORE_PASSWORD -alias "$ALIAS" 2>/dev/null | awk -F': ' '/SHA256:/{print $2; exit}')"
[[ -n "$FINGERPRINT" ]] || fail "Could not read the signing certificate SHA-256 fingerprint."

printf 'Saving signing credentials to GitHub Actions secrets...\n'
base64 -w0 "$KEYSTORE" | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$STORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPO"
gh variable set ANDROID_CERT_SHA256 --repo "$REPO" --body "$FINGERPRINT"

# Keep an encrypted recovery copy outside the git working tree. The encryption
# password is the keystore password; retain it in a password manager.
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in "$KEYSTORE" -out "$BACKUP" -pass env:EPHINTA_STORE_PASSWORD
chmod 600 "$BACKUP"

unset STORE_PASSWORD STORE_CONFIRM KEY_PASSWORD EPHINTA_STORE_PASSWORD EPHINTA_KEY_PASSWORD
printf '\nSUCCESS: GitHub Actions signing secrets and certificate variable are configured.\n'
printf 'Certificate SHA-256: %s\n' "$FINGERPRINT"
printf 'Encrypted recovery copy: %s\n' "$BACKUP"
printf 'Download that .enc file using the Codespaces file explorer and keep it private.\n'
printf 'Do not delete this Codespace or the backup until you have safely stored the encrypted copy.\n'
printf 'No signing key, password, or base64 data was written into the repository.\n'
