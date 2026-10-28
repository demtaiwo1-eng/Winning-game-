#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/scripts/app-audit.mjs" ]; then
  echo "[ESS] Running application audit and automatic repair checks..."
  node "$ROOT_DIR/scripts/app-audit.mjs" --fix
fi

echo "[ESS] Clearing stale install state for rollup compatibility..."
rm -rf node_modules package-lock.json

echo "[ESS] Installing dependencies..."
npm install

if ! node -e "require.resolve('@rollup/rollup-linux-x64-gnu')" >/dev/null 2>&1; then
  echo "[ESS] Installing Linux Rollup native dependency..."
  npm install @rollup/rollup-linux-x64-gnu --save-dev
fi

echo "[ESS] Starting EPHINTA app..."
cd "$ROOT_DIR/apps/web"
exec npx vite --host 0.0.0.0 --port 4173 --strictPort
