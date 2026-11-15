#!/usr/bin/env bash
# Signing-key creation is intentionally disabled for existing EPHINTA installs.
# A newly generated certificate cannot update the Build 869 app already installed.
set -Eeuo pipefail
set +x
printf '%s\n' "ERROR: Refusing to generate a replacement Android signing key." >&2
printf '%s\n' "Recover the original private keystore that signed the installed EPHINTA app." >&2
printf '%s\n' "Then register that exact keystore and its matching SHA-256 fingerprint in GitHub Actions." >&2
printf '%s\n' "Do not rotate the key; doing so prevents in-place Android updates." >&2
exit 1
