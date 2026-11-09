#!/usr/bin/env bash
# Verify that the protected production keystore is the exact signing identity
# used by the known-working EPHINTA 869 APK. Never creates, replaces, prints,
# or uploads signing credentials. Run only in a trusted GitHub Actions runner.
set -Eeuo pipefail
set +x
umask 077

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

BASELINE_APK="${1:-}"
APKSIGNER="${2:-}"
AAPT="${3:-}"

[[ -n "$BASELINE_APK" && -s "$BASELINE_APK" ]] || fail "Build 869 baseline APK is missing."
[[ -n "$APKSIGNER" && -x "$APKSIGNER" ]] || fail "Android apksigner was not found."
[[ -n "$AAPT" && -x "$AAPT" ]] || fail "Android aapt was not found."
[[ -n "${ANDROID_KEYSTORE_PATH:-}" && -s "$ANDROID_KEYSTORE_PATH" ]] || fail "Protected Android keystore is not available to this workflow."
[[ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ]] || fail "Android keystore password secret is missing."
[[ -n "${ANDROID_KEY_ALIAS:-}" ]] || fail "Android key alias secret is missing."
[[ -n "${ANDROID_KEY_PASSWORD:-}" ]] || fail "Android private-key password secret is missing."
[[ -n "${EXPECTED_CERT:-}" ]] || fail "ANDROID_CERT_SHA256 repository variable is missing."

normalize() { tr -d ':[:space:]' | tr 'A-F' 'a-f'; }

PACKAGE="$("$AAPT" dump badging "$BASELINE_APK" | awk -F"'" '/^package:/ {print $2; exit}')"
[[ "$PACKAGE" == "com.ephinta.app" ]] || fail "Build 869 baseline package is not com.ephinta.app."

"$APKSIGNER" verify --verbose "$BASELINE_APK" >/dev/null || fail "Build 869 APK signature verification failed."
BASELINE_CERT="$("$APKSIGNER" verify --print-certs "$BASELINE_APK" 2>/dev/null | awk '/certificate SHA-256 digest:/ {sub(/^.*certificate SHA-256 digest:[[:space:]]*/, ""); print; exit}' | normalize)"
[[ "$BASELINE_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "Could not read the Build 869 signing certificate fingerprint."

KEY_CERT="$(keytool -list -v -keystore "$ANDROID_KEYSTORE_PATH" -storepass:env ANDROID_KEYSTORE_PASSWORD -alias "$ANDROID_KEY_ALIAS" 2>/dev/null | awk '/SHA256:/ {sub(/^.*SHA256:[[:space:]]*/, ""); print; exit}' | normalize)"
[[ "$KEY_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "Could not validate the protected keystore certificate or alias."

EXPECTED="$(printf '%s' "$EXPECTED_CERT" | normalize)"
[[ "$EXPECTED" =~ ^[0-9a-f]{64}$ ]] || fail "ANDROID_CERT_SHA256 must contain a SHA-256 certificate fingerprint."

[[ "$KEY_CERT" == "$BASELINE_CERT" ]] || fail "Protected keystore does not match the known-working Build 869 APK. Refusing to sign an incompatible update."
[[ "$EXPECTED" == "$BASELINE_CERT" ]] || fail "ANDROID_CERT_SHA256 does not match the known-working Build 869 APK. Refusing to publish."

printf 'PASS: protected keystore, repository fingerprint, and Build 869 APK use the same signing identity.\n'
printf 'PASS: package identity is com.ephinta.app. No signing secret values were displayed.\n'
