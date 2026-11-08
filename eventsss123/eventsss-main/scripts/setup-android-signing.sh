#!/usr/bin/env bash
# Compatibility entrypoint for the repository-root, protected signing setup.
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf 'ERROR: Run this from inside the Git repository.\n' >&2
  exit 1
}
exec bash "$ROOT/scripts/setup-android-signing-github.sh"
