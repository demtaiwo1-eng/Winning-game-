#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-.}"
cd "$ROOT" || { echo "Project folder not found: $ROOT"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".cleanup-backup-$STAMP"
EXCL='(node_modules|\.git|dist|build|\.next|coverage|\.cleanup-backup-)'

# Find old ESS signup/auth modal references.
ESS_PAT='ess[ _-]*auth[ _-]?(modal|modal|dialog)|ESSAuthModal'

mapfile -t FILES < <(
  find . -type f 
    \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' 
       -o -name '*.tsx' -o -name '*.html' -o -name '*.vue' 
       -o -name '*.css' \) 
    -not -path '*/node_modules/*' 
    -not -path '*/.git/*' 
    -print0 |
  xargs -0 -r grep -IlE "$ESS_PAT" 2>/dev/null |
  grep -Ev "$EXCL" |
  sort || true
)

echo "========================================"
echo "ESS Auth Modal Cleanup"
echo "Project: $PWD"
echo "========================================"

if ((${#FILES[@]} == 0)); then
  echo "No matching files found."
  exit 0
fi

echo "Matching files:"
printf '  %s\n' "${FILES[@]}"
echo
echo "This script will NOT automatically edit source files."
echo "Review the matches before deciding what to remove."
echo

read -r -p "Create a backup of the matching files? (y/N): " ANSWER
if [[ "$ANSWER" =~ ^[Yy]$ ]]; then
  mkdir -p "$BACKUP_DIR"
  for FILE in "${FILES[@]}"; do
    mkdir -p "$BACKUP_DIR/$(dirname "$FILE")"
    cp -p "$FILE" "$BACKUP_DIR/$FILE"
  done
  echo "Backup created at: $BACKUP_DIR"
else
  echo "No backup created."
fi

echo
echo "Scan complete. No source files have been modified or deleted."
echo "Review each match before removing the old dialog."
