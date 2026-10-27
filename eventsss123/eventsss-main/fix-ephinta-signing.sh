#!/usr/bin/env bash
# Repair Ephinta GitHub Actions Android release signing.
# Run from the repository root: bash fix-ephinta-signing.sh
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: Run this inside the Ephinta Git repository." >&2
  exit 1
}
cd "$ROOT"
WORKFLOW=".github/workflows/ephinta-production-apk.yml"
[[ -f "$WORKFLOW" ]] || {
  echo "ERROR: $WORKFLOW not found. Use the correct repository and branch." >&2
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".ephinta-backups/signing-fix-$STAMP"
mkdir -p "$BACKUP"
cp "$WORKFLOW" "$BACKUP/"

python3 - "$WORKFLOW" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
marker = "      - name: Restore signing keystore\n"
if marker not in s:
    raise SystemExit("Expected Restore signing keystore step not found; no changes made.")
start = s.index(marker)
next_step = s.find("\n      - name:", start + len(marker))
if next_step == -1:
    raise SystemExit("Could not find the next workflow step; no changes made.")
replacement = r'''      - name: Restore and validate signing keystore
        shell: bash
        env:
          KEYSTORE_B64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          STORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          set -euo pipefail
          for name in KEYSTORE_B64 STORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
            if [[ -z "${!name:-}" ]]; then
              echo "::error::Missing required GitHub Actions secret: $name"
              exit 1
            fi
          done

          KEYSTORE_PATH="$RUNNER_TEMP/ephinta-release.keystore"
          printf '%s' "$KEYSTORE_B64" | base64 --decode > "$KEYSTORE_PATH"
          chmod 600 "$KEYSTORE_PATH"
          if [[ ! -s "$KEYSTORE_PATH" ]]; then
            echo "::error::Decoded keystore file is empty."
            exit 1
          fi

          keytool -list -keystore "$KEYSTORE_PATH" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" >/dev/null

          echo "ANDROID_KEYSTORE_PATH=$KEYSTORE_PATH" >> "$GITHUB_ENV"
          echo "ANDROID_KEYSTORE_PASSWORD=$STORE_PASSWORD" >> "$GITHUB_ENV"
          echo "ANDROID_KEY_ALIAS=$KEY_ALIAS" >> "$GITHUB_ENV"
          echo "ANDROID_KEY_PASSWORD=$KEY_PASSWORD" >> "$GITHUB_ENV"
'''
s = s[:start] + replacement + s[next_step:]
p.write_text(s)
print(f"Patched {p}")
PY

echo
echo "Backup: $BACKUP"
echo "Confirm the production workflow's Gradle step runs after the keystore step."
echo "Required GitHub Actions secrets:"
echo "  ANDROID_KEYSTORE_BASE64"
echo "  ANDROID_KEYSTORE_PASSWORD"
echo "  ANDROID_KEY_ALIAS"
echo "  ANDROID_KEY_PASSWORD"
echo
echo "ANDROID_KEYSTORE_BASE64 must encode the SAME keystore as the APK already installed."
echo "Do not commit the keystore or expose passwords in source control."
