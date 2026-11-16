#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GLOBAL_CSS="apps/web/src/styles/ephinta-global.css"
MARKETPLACE_CSS="apps/web/src/styles/ephinta-marketplace-advertising.css"
LANDING="apps/web/src/components/PublicLanding.tsx"

for file in "$GLOBAL_CSS" "$MARKETPLACE_CSS" "$LANDING"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

grep -Fq 'ephinta-marketplace-advertising.css' "$GLOBAL_CSS" || {
  echo "Marketplace stylesheet is not imported by the global CSS entry." >&2
  exit 1
}
grep -Fq 'className="eph-promo-shell eph-marketplace-advertising"' "$LANDING" || {
  echo "Landing marketplace advertisement block is missing its global styling hook." >&2
  exit 1
}

echo "✓ Marketplace advertisement block is wired to the global stylesheet."
echo "→ Running web tests..."
npm run test -w apps/web
echo "→ Building the production web bundle..."
npm run build -w apps/web

echo "✓ Marketplace global-CSS task checks and web build completed."
