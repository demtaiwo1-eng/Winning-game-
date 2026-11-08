#!/usr/bin/env bash
# Create the EPHINTA Android release key inside GitHub Codespaces and save
# the signing material directly to GitHub Actions secrets. Never run with bash -x.
set -euo pipefail
set +x

REPO="${EPHINTA_REPO:-demtaiwo1-eng/winning-game-}"
ALIAS="ephinta-release"
ROOT="$HOME/.ephinta-android-signing"
KEYSTORE="$ROOT/ephinta-release.jks"
BACKUP="$ROOT/ephinta-release.jks.enc"
BACKUP_SHA256="$BACKUP.sha256"
VERIFY_KEYSTORE="$ROOT/ephinta-release.verify.jks"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v gh >/dev/null || fail "GitHub CLI (gh) is required. Run this inside GitHub Codespaces."
command -v keytool >/dev/null || fail "JDK 21 keytool is missing from this Codespace."
command -v openssl >/dev/null || fail "OpenSSL is required for the encrypted keystore backup."
gh auth status >/dev/null 2>&1 || fail "Sign in to GitHub CLI in this Codespace, then rerun."
gh repo view "$REPO" >/dev/null 2>&1 || fail "Cannot access $REPO with the current GitHub account."

SECRET_LIST="$(gh secret list --repo "$REPO" 2>/dev/null)" || fail "This GitHub account cannot manage repository Actions secrets. Ask a repository admin to run this setup from their Codespace."
VARIABLE_LIST="$(gh variable list --repo "$REPO" 2>/dev/null)" || fail "This GitHub account cannot inspect repository Actions variables. Ask a repository admin to run this setup from their Codespace."

# Never create a second signing identity when any part of an earlier setup
# exists. A partial secret set may belong to the permanent release key.
SIGNING_NAMES=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD ANDROID_KEY_ALIAS)
EXISTING_SIGNING_NAMES=()
for name in "${SIGNING_NAMES[@]}"; do
  if printf '%s\n' "$SECRET_LIST" | awk 'NR > 1 {print $1}' | grep -Fxq "$name"; then
    EXISTING_SIGNING_NAMES+=("$name")
  fi
done
if (("${#EXISTING_SIGNING_NAMES[@]}" > 0)); then
  fail "Existing Android signing configuration detected (${EXISTING_SIGNING_NAMES[*]}). Refusing to create or rotate the release key. Recover or complete the existing configuration instead."
fi
if printf '%s\n' "$VARIABLE_LIST" | awk 'NR > 1 {print $1}' | grep -Fxq 'ANDROID_CERT_SHA256'; then
  fail "ANDROID_CERT_SHA256 already exists. Refusing to replace a potentially paired release certificate."
fi
if [[ -e "$KEYSTORE" || -e "$BACKUP" || -e "$BACKUP_SHA256" ]]; then
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

FINGERPRINT="$(keytool -list -v -keystore "$KEYSTORE" -storepass:env EPHINTA_STORE_PASSWORD -alias "$ALIAS" 2>/dev/null | awk '/SHA256:/ {sub(/^.*SHA256:[[:space:]]*/, ""); print; exit}')"
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
sha256sum "$BACKUP" > "$BACKUP_SHA256"
chmod 600 "$BACKUP_SHA256"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$BACKUP" -out "$VERIFY_KEYSTORE" -pass env:EPHINTA_STORE_PASSWORD
cmp -s "$KEYSTORE" "$VERIFY_KEYSTORE" || fail "Encrypted backup verification failed."
rm -f "$VERIFY_KEYSTORE" "$KEYSTORE"

unset STORE_PASSWORD STORE_CONFIRM KEY_PASSWORD EPHINTA_STORE_PASSWORD EPHINTA_KEY_PASSWORD
printf '\nSUCCESS: GitHub Actions signing secrets and certificate variable are configured.\n'
printf 'Certificate SHA-256: %s\n' "$FINGERPRINT"
printf 'Encrypted recovery copy: %s\n' "$BACKUP"
printf 'Backup checksum: %s\n' "$BACKUP_SHA256"
printf 'Download both files using the Codespaces file explorer and keep them private.\n'
printf 'Do not delete this Codespace or the backup until you have safely stored the encrypted copy.\n'
printf 'No signing key, password, or base64 data was written into the repository.\n'
