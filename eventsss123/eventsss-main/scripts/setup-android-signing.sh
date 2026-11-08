#!/usr/bin/env bash
# Generate an owner-controlled Android upload key in Codespaces and store it
# directly as protected GitHub Actions secrets. Never prints or commits secrets.
set -Eeuo pipefail
umask 077

REPO="demtaiwo1-eng/Winning-game-"
ALIAS="ephinta-upload"
KEY_DIR="${HOME}/.ephinta-signing"
KEYSTORE="${KEY_DIR}/ephinta-upload.jks"
BASE64_FILE="${KEY_DIR}/ephinta-upload.jks.base64"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v keytool >/dev/null 2>&1 || fail "Java keytool is required in this Codespace."
command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) is required in this Codespace."
gh auth status >/dev/null 2>&1 || fail "Authenticate GitHub CLI with repository administration access first."

mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"
[[ ! -e "$KEYSTORE" && ! -e "$BASE64_FILE" ]] || fail "A key file already exists in $KEY_DIR. Refusing to overwrite it."

EXISTING_SECRETS="$(gh secret list --repo "$REPO" --json name --jq '.[].name')"
for secret in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if grep -Fxq "$secret" <<<"$EXISTING_SECRETS"; then
    fail "The repository already has $secret. Refusing to mix or overwrite an existing signing identity."
  fi
done

cat <<'NOTICE'
This creates a NEW Android upload key for EPHINTA.
Keep the Codespace open until all four GitHub secrets are configured.
At the key-password prompt, press Enter to reuse the keystore password.
The private key remains in your Codespace home directory; copy it to two secure
owner-controlled backups after this script completes. Never commit it.
NOTICE

keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -storetype JKS \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

chmod 600 "$KEYSTORE"
base64 -w0 "$KEYSTORE" > "$BASE64_FILE"
chmod 600 "$BASE64_FILE"

read -rsp "Enter the keystore password you just created: " STORE_PASSWORD
printf '\n'
read -rsp "Confirm the keystore password: " CONFIRM_PASSWORD
printf '\n'
[[ "$STORE_PASSWORD" == "$CONFIRM_PASSWORD" ]] || fail "Passwords did not match. No GitHub secrets were written."

# gh secret set reads each secret from stdin; values never appear in shell args or logs.
gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" < "$BASE64_FILE"
printf '%s' "$STORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPO"
printf '%s' "$STORE_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD --repo "$REPO"
unset STORE_PASSWORD CONFIRM_PASSWORD

printf '\nConfigured secret names (values are never readable):\n'
gh secret list --repo "$REPO" --json name --jq '.[] | select(.name | startswith("ANDROID_KEY")) | .name'
printf '\nPrivate keystore: %s\n' "$KEYSTORE"
printf 'Base64 backup: %s\n' "$BASE64_FILE"
printf 'Store both files securely outside the repository. Do not delete the only copy of the keystore.\n'
