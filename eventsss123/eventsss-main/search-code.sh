
#!/usr/bin/env bash

# Ephinta source-code block and keyword locator
# Usage: bash search-code.sh "keyword one" "keyword two"

ROOT="$(pwd)"
SEARCH_TERMS=("$@")

if [ ${#SEARCH_TERMS[@]} -eq 0 ]; then
  echo 'Usage: bash search-code.sh "keyword one" "keyword two"'
  exit 1
fi

SEARCH_DIRS=(
  "$ROOT/apps"
  "$ROOT/scripts"
)

EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=.backups
  --exclude-dir=.ephinta-backups
  --exclude-dir=.ess-backups
  --exclude='package-lock.json'
  --exclude='*.map'
)

for TERM in "${SEARCH_TERMS[@]}"; do
  echo
  echo "=================================================="
  echo "SEARCH KEYWORD: $TERM"
  echo "=================================================="

  FOUND=0

  for DIR in "${SEARCH_DIRS[@]}"; do
    [ -d "$DIR" ] || continue

    while IFS=: read -r FILE LINE CONTENT; do
      [ -n "$FILE" ] || continue
      FOUND=1

      printf '\nFILE: %s\n' "${FILE#"$ROOT"/}"
      printf 'LINE: %s\n' "$LINE"
      printf 'CODE: %s\n' "$CONTENT"

      # Show surrounding code, three lines before and after.
      START=$((LINE > 3 ? LINE - 3 : 1))
      END=$((LINE + 3))

      echo "--- CONTEXT: lines $START-$END ---"
      sed -n "${START},${END}p" "$FILE" |
        nl -ba -v "$START"
      echo "----------------------------------"

    done < <(
      grep -RniF \
        "${EXCLUDES[@]}" \
        --include='*.tsx' \
        --include='*.ts' \
        --include='*.jsx' \
        --include='*.js' \
        --include='*.css' \
        --include='*.html' \
        -- "$TERM" "$DIR" 2>/dev/null
    )
  done

  if [ "$FOUND" -eq 0 ]; then
    echo "No match found for: $TERM"
  fi
done

echo
echo "Search complete."
