#!/usr/bin/env bash
# =============================================================================
# ESS Bright Orange Theme — patch entire web app
# Run from monorepo root:  /workspaces/eventsss
#
#   chmod +x patch-orange-theme.sh
#   ./patch-orange-theme.sh
#   npm run dev
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
WEB="$ROOT/apps/web"
SRC="$WEB/src"
THEME_NAME="ess-bright-orange-theme.css"

echo ""
echo "  ╔════════════════════════════════════════════╗"
echo "  ║  ESS Bright Orange Theme — App-wide patch  ║"
echo "  ╚════════════════════════════════════════════╝"
echo ""

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: apps/web/src not found. Run from monorepo root (eventsss)."
  echo "Current: $ROOT"
  exit 1
fi

# Locate theme file (same folder as script, or cwd, or artifacts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_SRC=""
for c in \
  "$SCRIPT_DIR/$THEME_NAME" \
  "$ROOT/$THEME_NAME" \
  "/home/workdir/artifacts/$THEME_NAME"
do
  if [[ -f "$c" ]]; then
    THEME_SRC="$c"
    break
  fi
done

if [[ -z "$THEME_SRC" ]]; then
  echo "ERROR: $THEME_NAME not found next to this script."
  exit 1
fi

echo "→ Theme source: $THEME_SRC"
echo "→ Installing into $SRC/$THEME_NAME"
cp -f "$THEME_SRC" "$SRC/$THEME_NAME"

# Backup main.tsx once
MAIN="$SRC/main.tsx"
if [[ -f "$MAIN" ]]; then
  [[ -f "${MAIN}.bak-orange" ]] || cp "$MAIN" "${MAIN}.bak-orange"
fi

# Ensure theme is imported AFTER index.css
if grep -q "ess-bright-orange-theme" "$MAIN" 2>/dev/null; then
  echo "→ main.tsx already imports orange theme"
else
  echo "→ Wiring import into main.tsx"
  if grep -q "index.css" "$MAIN"; then
    # Insert after index.css import
    python3 - << PY
from pathlib import Path
p = Path("$MAIN")
text = p.read_text(encoding="utf-8")
line = "import './ess-bright-orange-theme.css';\n"
if "ess-bright-orange-theme" in text:
    print("already present")
else:
    if "import './index.css';" in text:
        text = text.replace("import './index.css';", "import './index.css';\n" + line.rstrip("\n"), 1)
    elif 'import "./index.css";' in text:
        text = text.replace('import "./index.css";', 'import "./index.css";\n' + line.rstrip("\n"), 1)
    else:
        text = line + text
    p.write_text(text, encoding="utf-8")
    print("main.tsx updated")
PY
  else
    # Prepend
    {
      echo "import './ess-bright-orange-theme.css';"
      cat "$MAIN"
    } > "${MAIN}.tmp"
    mv "${MAIN}.tmp" "$MAIN"
    echo "→ Prepended theme import (no index.css found)"
  fi
fi

# Soft-touch index.css :root background so first paint is bright
INDEX="$SRC/index.css"
if [[ -f "$INDEX" ]]; then
  [[ -f "${INDEX}.bak-orange" ]] || cp "$INDEX" "${INDEX}.bak-orange"
  # Only inject a comment marker once; theme file does the real override
  if ! grep -q "ESS Bright Orange Theme active" "$INDEX" 2>/dev/null; then
    {
      echo "/* ESS Bright Orange Theme active — see ess-bright-orange-theme.css */"
      cat "$INDEX"
    } > "${INDEX}.tmp"
    mv "${INDEX}.tmp" "$INDEX"
  fi
fi

# index.html title polish
HTML="$WEB/index.html"
if [[ -f "$HTML" ]]; then
  sed -i 's|<title>.*</title>|<title>EPHINTA<\/title>|' "$HTML" 2>/dev/null || true
fi

echo ""
echo "  ✓ Theme installed: apps/web/src/$THEME_NAME"
echo "  ✓ Imported from main.tsx (after index.css)"
echo ""
echo "  Start the app:"
echo "    cd $ROOT"
echo "    npm run dev"
echo ""
echo "  Web → http://localhost:5173"
echo "  API → http://localhost:5000"
echo ""
echo "  Hard-refresh browser: Ctrl+Shift+R"
echo "  Rollback: cp apps/web/src/main.tsx.bak-orange apps/web/src/main.tsx"
echo ""
