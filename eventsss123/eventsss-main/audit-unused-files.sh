#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${1:-$ROOT_DIR/UNUSED_FILES_AUDIT.md}"
TMP_FILE="$(mktemp)"
CANDIDATES="$(mktemp)"

cleanup() {
  rm -f "$TMP_FILE" "$CANDIDATES"
}
trap cleanup EXIT

find "$ROOT_DIR" \
  \( \
    -path "$ROOT_DIR/.git" -o \
    -path "$ROOT_DIR/node_modules" -o \
    -path "$ROOT_DIR/.next" -o \
    -path "$ROOT_DIR/dist" -o \
    -path "$ROOT_DIR/build" -o \
    -path "$ROOT_DIR/.cache" -o \
    -path "$ROOT_DIR/.venv" -o \
    -path "$ROOT_DIR/.idea" -o \
    -path "$ROOT_DIR/.vscode" \
  \) -prune -o \
  -type f -print > "$TMP_FILE"

while IFS= read -r file; do
  rel_path="${file#"$ROOT_DIR"/}"
  case "$rel_path" in
    "UNUSED_FILES_AUDIT.md"|"EPHINTA_IMPLEMENTATION_REPORT.md"|"audit-unused-files.sh")
      continue
      ;;
  esac

  if ! grep -RIl --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=build --exclude-dir=.cache --exclude-dir=.venv --exclude-dir=.vscode --exclude='*.png' --exclude='*.jpg' --exclude='*.jpeg' --exclude='*.gif' --exclude='*.svg' --exclude='*.ico' --exclude='*.mp3' --exclude='*.wav' --exclude='*.mov' --exclude='*.pdf' --exclude='*.lock' --exclude='*.snap' "$rel_path" "$ROOT_DIR" >/dev/null 2>&1; then
    printf '%s\n' "$rel_path" >> "$CANDIDATES"
  fi
done < "$TMP_FILE"

{
  printf '# Unused Files Audit\n\n'
  printf 'This audit is a heuristic check only. It highlights files that do not appear to be referenced by the repository itself and may be legacy, generated, or intentionally preserved for local tooling.\n\n'
  printf 'Audit date: %s\n\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf 'Repository root: %s\n\n' "$ROOT_DIR"
  printf '## Candidate files\n\n'

  if [[ -s "$CANDIDATES" ]]; then
    while IFS= read -r line; do
      printf '- %s\n' "$line"
    done < "$CANDIDATES"
  else
    printf 'No obvious unused files were detected by this pass.\n'
  fi

  printf '\n## Interpretation\n\n'
  printf '- Legacy support scripts and local-only utilities may be intentionally retained for deployment or troubleshooting workflows.\n'
  printf '- Generated artifacts (for example compiled output and local media) are often excluded from the scan and should not be treated as production code.\n'
  printf '- Files flagged here should be reviewed manually before deletion, especially when they support migration, ad hoc repair, or operational runbooks.\n'
} > "$OUTPUT_FILE"

cat "$OUTPUT_FILE"
