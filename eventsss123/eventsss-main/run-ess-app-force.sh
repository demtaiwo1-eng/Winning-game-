#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export CI=1
export npm_config_yes=true
export npm_config_fund=false
export npm_config_audit=false

function log() {
  echo "[ESS-FORCE] $*"
}

log "Removing stale install state and lock files..."
rm -rf node_modules package-lock.json

log "Installing dependencies with forced non-interactive flags..."
npm install --no-fund --no-audit --include=dev --force

log "Installing Linux Rollup native dependency..."
npm install @rollup/rollup-linux-x64-gnu --save-dev --no-fund --no-audit --force

log "Running source audit and auto-repair pass..."
node scripts/app-audit.mjs --fix || true

log "Starting Vite app on port 4173..."
cd "$ROOT_DIR/apps/web"
exec npx vite --host 0.0.0.0 --port 4173 --strictPort
