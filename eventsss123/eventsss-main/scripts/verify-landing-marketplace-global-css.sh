#!/usr/bin/env bash
set -euo pipefail

# Run from any working directory; this script verifies the landing marketplace
# advertisement is styled by the shared global stylesheet and builds the web app.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WEB_ROOT="$APP_ROOT/apps/web"
LANDING="$WEB_ROOT/src/components/PublicLanding.tsx"
GLOBAL_CSS="$WEB_ROOT/src/styles/ephinta-global.css"

for file in "$LANDING" "$GLOBAL_CSS"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

grep -q 'eph-marketplace-advertising' "$LANDING" || {
  echo "Marketplace advertisement block is missing its styling hook." >&2
  exit 1
}
grep -q 'Public landing marketplace advertisement block' "$GLOBAL_CSS" || {
  echo "Marketplace advertisement global CSS is missing." >&2
  exit 1
}
grep -q 'eph-marketplace-advertising .eph-ad-card' "$GLOBAL_CSS" || {
  echo "Global marketplace card rules are missing." >&2
  exit 1
}

echo "Landing marketplace global CSS checks passed."
npm --prefix "$WEB_ROOT" run build
#!/usr/bin/env bash
set -euo pipefail

# Run from any working directory; this script verifies the landing marketplace
# advertisement is styled by the shared global stylesheet and builds the web app.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WEB_ROOT="$APP_ROOT/apps/web"
LANDING="$WEB_ROOT/src/components/PublicLanding.tsx"
GLOBAL_CSS="$WEB_ROOT/src/styles/ephinta-global.css"

for file in "$LANDING" "$GLOBAL_CSS"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

grep -q 'eph-marketplace-advertising' "$LANDING" || {
  echo "Marketplace advertisement block is missing its styling hook." >&2
  exit 1
}
grep -q 'Public landing marketplace advertisement block' "$GLOBAL_CSS" || {
  echo "Marketplace advertisement global CSS is missing." >&2
  exit 1
}
grep -q 'eph-marketplace-advertising .eph-ad-card' "$GLOBAL_CSS" || {
  echo "Global marketplace card rules are missing." >&2
  exit 1
}

echo "Landing marketplace global CSS checks passed."
npm --prefix "$WEB_ROOT" run build
