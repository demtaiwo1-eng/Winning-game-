#!/usr/bin/env bash
# Audit the authenticated EPHINTA event planner and run its web checks.
# Run from any directory; requires Node.js/npm and installed dependencies.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
APP="$ROOT/eventsss123/eventsss-main/apps/web"
PLANNER="$APP/src/components/EventPlannerWorkspace.tsx"
THEME="$APP/src/lib/ephintaTheme.ts"

[[ -f "$PLANNER" ]] || { echo "Missing planner component: $PLANNER" >&2; exit 1; }
[[ -f "$THEME" ]] || { echo "Missing shared theme utility: $THEME" >&2; exit 1; }
[[ -f "$APP/package.json" ]] || { echo "Missing web package manifest: $APP/package.json" >&2; exit 1; }

echo "Planner: $PLANNER"
echo "Shared theme utility: $THEME"
echo
echo "Checking planner/theme integration markers..."
grep -q 'Complete event workspace' "$PLANNER" || { echo "Planner heading not found" >&2; exit 1; }
grep -q 'applyEphintaTheme' "$THEME" || { echo "Shared theme application function not found" >&2; exit 1; }

cd "$APP"
if [[ ! -d node_modules ]]; then
  echo "Dependencies are not installed. Run npm ci in $APP first." >&2
  exit 2
fi

echo
echo "Running web unit tests..."
npm test

echo
echo "Running TypeScript and production build..."
npm run build

echo
echo "Planner audit and web checks completed."
