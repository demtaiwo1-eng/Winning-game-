#!/usr/bin/env bash
set -Eeuo pipefail

# Ephinta UI, currency, and contrast patch.
# Run from the repository root: bash apply-ephinta-ui-money-fixes.sh
# Makes a timestamped backup before editing and is safe to re-run.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="apps/web/src/App.tsx"
LANDING="apps/web/src/components/PublicLanding.tsx"
MAIN="apps/web/src/main.tsx"
LIB="apps/web/src/lib/currency.ts"
CSS="apps/web/src/ephinta-accessible-contrast.css"

for file in "$APP" "$LANDING" "$MAIN"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Required file not found: $file"
    echo "Run this script from the Ephinta repository root."
    exit 1
  fi
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".ephinta-backups/ui-money-contrast-$STAMP"
mkdir -p "$BACKUP"
for file in "$APP" "$LANDING" "$MAIN" "$LIB" "$CSS"; do
  if [[ -f "$file" ]]; then
    mkdir -p "$BACKUP/$(dirname "$file")"
    cp -p "$file" "$BACKUP/$file"
  fi
done
echo "Backup saved under: $BACKUP"

python3 <<'PY'
from pathlib import Path
import re
import sys

app_path = Path("apps/web/src/App.tsx")
landing_path = Path("apps/web/src/components/PublicLanding.tsx")
main_path = Path("apps/web/src/main.tsx")
lib_path = Path("apps/web/src/lib/currency.ts")
css_path = Path("apps/web/src/ephinta-accessible-contrast.css")

app = app_path.read_text(encoding="utf-8")
landing = landing_path.read_text(encoding="utf-8")
main = main_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label, required=True):
    count = text.count(old)
    if count == 0:
        if required:
            print(f"ERROR: Could not find expected code for: {label}", file=sys.stderr)
            sys.exit(2)
        return text
    if count > 1:
        print(f"NOTE: Found {count} matches for {label}; replacing all exact matches.")
    return text.replace(old, new)

# App integration and TypeScript fixes.
app = re.sub(r"^\s*import\s+\{\s*CurrencyCode\s*\}\s+from\s+['\"]\./lib/i18n['\"];\s*\n", "", app, flags=re.M)
app = app.replace("import LandingPage from './components/PublicLanding';",
                  "import PublicLanding from './components/PublicLanding';")
app = re.sub(r"<LandingPage(\s|>)", r"<PublicLanding\1", app)
app = app.replace("</LandingPage>", "</PublicLanding>")
app = app.replace("budget: { currency: Number; plannedMinor: string; actualMinor: string };",
                  "budget: { currency: string; plannedMinor: string; actualMinor: string };")

kyc_type = "type KycRequest = { id: string; kind: string; status: string; documentUrl?: string | null; notes?: string | null };"
if kyc_type not in app:
    app = re.sub(
        r"^\s*//\s*type KycRequest = \{ id: string; kind: string; status: string; documentUrl\?: string \| null; notes\?: string \| null \};\s*$",
        kyc_type, app, flags=re.M
    )
if kyc_type not in app and "KycRequest" in app:
    app = replace_once(app, "type Category = { id: string; name: string };",
                       "type Category = { id: string; name: string };\n" + kyc_type,
                       "KycRequest type", required=False)

money_import = "import { formatMoneyInput, formatMinorCurrency, majorToMinorUnits } from './lib/currency';"
if money_import not in app:
    anchor = 'import { initializeEphintaTheme } from "./lib/ephintaTheme";'
    if anchor in app:
        app = app.replace(anchor, anchor + "\n" + money_import, 1)
    else:
        match = re.search(r"^import React[^;]*;\s*$", app, flags=re.M)
        if not match:
            print("ERROR: Cannot safely insert currency helper import in App.tsx", file=sys.stderr)
            sys.exit(2)
        app = app[:match.end()] + "\n" + money_import + app[match.end():]

# API monetary fields are integer minor units; the UI uses major units.
app = app.replace("priceMinor: productPrice,", "priceMinor: majorToMinorUnits(productPrice),")
app = app.replace('placeholder="Price in minor units" inputMode="numeric"',
                  'placeholder="5,000,000.00" inputMode="decimal"')
app = app.replace(
    'value={productPrice} onChange={(event) => setProductPrice(event.target.value)} placeholder="5,000,000.00" inputMode="decimal" required',
    'value={productPrice} onChange={(event) => setProductPrice(formatMoneyInput(event.target.value))} onBlur={() => setProductPrice((current) => formatMoneyInput(current, true))} placeholder="5,000,000.00" inputMode="decimal" aria-label="Price in major currency units" required'
)
app = app.replace(
    'value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="Amount" inputMode="numeric" required',
    'value={budgetAmount} onChange={(event) => setBudgetAmount(formatMoneyInput(event.target.value))} onBlur={() => setBudgetAmount((current) => formatMoneyInput(current, true))} placeholder="5,000,000.00" inputMode="decimal" required'
)
app = app.replace("plannedMinor: budgetAmount || '0'",
                  "plannedMinor: budgetAmount.trim() ? majorToMinorUnits(budgetAmount) : '0'")
app = app.replace("{listing.currency} {listing.priceMinor}",
                  "{formatMinorCurrency(listing.priceMinor, listing.currency)}")
app = app.replace(
    "Planned: {detail.summary.budget.plannedMinor} · Actual: {detail.summary.budget.actualMinor}",
    "Planned: {formatMinorCurrency(detail.summary.budget.plannedMinor, detail.summary.budget.currency)} · Actual: {formatMinorCurrency(detail.summary.budget.actualMinor, detail.summary.budget.currency)}"
)

if not lib_path.exists():
    lib_path.write_text("""/**
 * Shared currency helpers for Ephinta.
 * API fields ending in Minor are integer minor units (kobo/cents).
 * Human-facing inputs are major units, e.g. 5,000,000.00.
 */
export type SupportedCurrencyCode = 'NGN' | 'USD' | (string & {});

const VALID_CURRENCY = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(value?: string | null): string {
  const code = (value || 'NGN').trim().toUpperCase();
  return VALID_CURRENCY.test(code) ? code : 'NGN';
}

export function formatMoneyInput(value: string, fixed = false): string {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const wholeRaw = firstDot < 0 ? cleaned : cleaned.slice(0, firstDot);
  const fractionRaw = firstDot < 0 ? '' : cleaned.slice(firstDot + 1).replace(/\\./g, '');
  const whole = (wholeRaw || '').replace(/^0+(?=\\d)/, '');
  const grouped = whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  if (!fixed && firstDot < 0) return grouped;
  const fraction = fractionRaw.slice(0, 2);
  return fixed
    ? `${grouped || '0'}.${fraction.padEnd(2, '0')}`
    : `${grouped || '0'}.${fraction}`;
}

export function majorToMinorUnits(value: string): string {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned) return '0';
  if (!/^\\d*(\\.\\d{0,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid amount with no more than two decimal places.');
  }
  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const whole = BigInt(wholePart || '0');
  const fraction = BigInt((fractionPart + '00').slice(0, 2));
  return (whole * 100n + fraction).toString();
}

export function formatMinorCurrency(value: string | number | null | undefined, currency?: string): string {
  const raw = String(value ?? '0').trim();
  if (!/^-?\\d+$/.test(raw)) return `${normalizeCurrencyCode(currency)} 0.00`;
  const minor = BigInt(raw);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  const grouped = whole.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  return `${normalizeCurrencyCode(currency)} ${negative ? '-' : ''}${grouped}.${fraction}`;
}
""", encoding="utf-8")

# Preserve saved valid theme preferences, but use colorful for missing/invalid values.
landing = landing.replace(
    "return saved === 'light' || saved === 'colorful' ? saved : 'dark';",
    "return saved === 'dark' || saved === 'light' || saved === 'colorful' ? saved : 'colorful';"
)
landing = landing.replace("} catch { return 'dark'; }", "} catch { return 'colorful'; }")

contrast_css = r"""
        /* Ephinta contrast hardening: foreground/background pairs are deliberately distinct. */
        .eph-landing{color:#21162f;background:#fff}
        .eph-landing[data-theme="dark"]{--ink:#f8fafc;--muted:#d5deee;--line:#46536c;--cream:#101626;color:#f8fafc;background:#0b1020}
        .eph-landing[data-theme="dark"] .eph-hero,
        .eph-landing[data-theme="dark"] .eph-section,
        .eph-landing[data-theme="dark"] .eph-strip{color:#f8fafc}
        .eph-landing[data-theme="dark"] .eph-planner,
        .eph-landing[data-theme="dark"] .eph-card,
        .eph-landing[data-theme="dark"] .eph-strip,
        .eph-landing[data-theme="dark"] .eph-modal{background:#151d32!important;color:#f8fafc!important;border-color:#46536c!important}
        .eph-landing[data-theme="dark"] p,
        .eph-landing[data-theme="dark"] li,
        .eph-landing[data-theme="dark"] label,
        .eph-landing[data-theme="dark"] small,
        .eph-landing[data-theme="dark"] .eph-subtitle,
        .eph-landing[data-theme="dark"] .eph-section-head p{color:#d5deee}
        .eph-landing[data-theme="dark"] h1,
        .eph-landing[data-theme="dark"] h2,
        .eph-landing[data-theme="dark"] h3,
        .eph-landing[data-theme="dark"] strong{color:#fff}
        .eph-landing[data-theme="dark"] input,
        .eph-landing[data-theme="dark"] select,
        .eph-landing[data-theme="dark"] textarea{background:#0b1020!important;color:#fff!important;border-color:#687894!important}
        .eph-landing[data-theme="dark"] input::placeholder,
        .eph-landing[data-theme="dark"] textarea::placeholder{color:#b9c5d9!important;opacity:1}
        .eph-landing[data-theme="light"]{--ink:#111827;--muted:#374151;--line:#cbd5e1;color:#111827;background:#f8fafc}
        .eph-landing[data-theme="light"] p,
        .eph-landing[data-theme="light"] li,
        .eph-landing[data-theme="light"] label,
        .eph-landing[data-theme="light"] small,
        .eph-landing[data-theme="light"] .eph-subtitle{color:#374151}
        .eph-landing[data-theme="light"] h1,
        .eph-landing[data-theme="light"] h2,
        .eph-landing[data-theme="light"] h3,
        .eph-landing[data-theme="light"] strong{color:#111827}
        .eph-landing[data-theme="light"] .eph-planner,
        .eph-landing[data-theme="light"] .eph-card,
        .eph-landing[data-theme="light"] .eph-strip,
        .eph-landing[data-theme="light"] .eph-modal{background:#fff!important;color:#111827!important;border-color:#cbd5e1!important}
        .eph-landing[data-theme="light"] input,
        .eph-landing[data-theme="light"] select,
        .eph-landing[data-theme="light"] textarea{background:#fff!important;color:#111827!important;border-color:#64748b!important}
        .eph-landing[data-theme="light"] input::placeholder,
        .eph-landing[data-theme="light"] textarea::placeholder{color:#4b5563!important;opacity:1}
        .eph-landing[data-theme="colorful"]{--ink:#21112b;--muted:#4d3b57;--line:#d8c5df;color:#21112b;background:#fff7fc}
        .eph-landing[data-theme="colorful"] p,
        .eph-landing[data-theme="colorful"] li,
        .eph-landing[data-theme="colorful"] label,
        .eph-landing[data-theme="colorful"] small,
        .eph-landing[data-theme="colorful"] .eph-subtitle{color:#4d3b57}
        .eph-landing[data-theme="colorful"] h1,
        .eph-landing[data-theme="colorful"] h2,
        .eph-landing[data-theme="colorful"] h3,
        .eph-landing[data-theme="colorful"] strong{color:#21112b}
        .eph-landing[data-theme="colorful"] .eph-planner,
        .eph-landing[data-theme="colorful"] .eph-card,
        .eph-landing[data-theme="colorful"] .eph-strip,
        .eph-landing[data-theme="colorful"] .eph-modal{background:#fff!important;color:#21112b!important;border-color:#d8c5df!important}
        .eph-landing[data-theme="colorful"] input,
        .eph-landing[data-theme="colorful"] select,
        .eph-landing[data-theme="colorful"] textarea{background:#fff!important;color:#21112b!important;border-color:#8d719b!important}
        .eph-landing[data-theme="colorful"] input::placeholder,
        .eph-landing[data-theme="colorful"] textarea::placeholder{color:#5f4a68!important;opacity:1}
        .eph-landing :focus-visible{outline:3px solid #0b63ce!important;outline-offset:3px}
        .eph-landing button:disabled{opacity:.65;cursor:not-allowed}
"""
if "Ephinta contrast hardening: foreground/background pairs are deliberately distinct." not in landing:
    marker = "\n      `}</style>"
    if marker in landing:
        landing = landing.replace(marker, "\n" + contrast_css + marker, 1)
    else:
        match = re.search(r"\n\s*`}\s*</style>", landing)
        if not match:
            print("ERROR: Could not locate PublicLanding inline stylesheet closing marker.", file=sys.stderr)
            sys.exit(2)
        landing = landing[:match.start()] + "\n" + contrast_css + landing[match.start():]

app_path.write_text(app, encoding="utf-8")
landing_path.write_text(landing, encoding="utf-8")

if not css_path.exists():
    css_path.write_text(r"""/* Ephinta app-wide high-contrast tokens for authenticated workspaces. */
:root,
html[data-ephinta-theme="light"] {
  --ess-page-bg: #f8fafc;
  --ess-surface: #ffffff;
  --ess-ink: #111827;
  --ess-muted: #374151;
  --ess-line: #cbd5e1;
  --ess-accent: #4338ca;
  --ess-accent-ink: #ffffff;
}
html[data-ephinta-theme="dark"] {
  --ess-page-bg: #0b1020;
  --ess-surface: #151d32;
  --ess-ink: #f8fafc;
  --ess-muted: #d5deee;
  --ess-line: #46536c;
  --ess-accent: #c4b5fd;
  --ess-accent-ink: #17112b;
}
html[data-ephinta-theme="colorful"] {
  --ess-page-bg: #fff7fc;
  --ess-surface: #ffffff;
  --ess-ink: #21112b;
  --ess-muted: #4d3b57;
  --ess-line: #d8c5df;
  --ess-accent: #a51668;
  --ess-accent-ink: #ffffff;
}
body { color: var(--ess-ink); background: var(--ess-page-bg); }
.workspace-shell,
.workspace-shell .workspace-card,
.workspace-shell .detail-section-card,
.workspace-shell .listing-card,
.workspace-shell .cart-summary,
.workspace-shell .empty-marketplace,
.workspace-shell .vendor-hero-card { color: var(--ess-ink); }
.workspace-shell .workspace-card,
.workspace-shell .detail-section-card,
.workspace-shell .listing-card,
.workspace-shell .cart-summary,
.workspace-shell .empty-marketplace {
  background-color: var(--ess-surface);
  border-color: var(--ess-line);
}
.workspace-shell p,
.workspace-shell label,
.workspace-shell small,
.workspace-shell .workspace-subtitle,
.workspace-shell .vendor-metric-row span,
.workspace-shell .listing-card footer span { color: var(--ess-muted); }
.workspace-shell h1,
.workspace-shell h2,
.workspace-shell h3,
.workspace-shell strong,
.workspace-shell .section-header,
.workspace-shell .eyebrow { color: var(--ess-ink); }
.workspace-shell input,
.workspace-shell select,
.workspace-shell textarea {
  color: var(--ess-ink);
  background-color: var(--ess-surface);
  border-color: var(--ess-line);
}
.workspace-shell input::placeholder,
.workspace-shell textarea::placeholder { color: var(--ess-muted); opacity: 1; }
.workspace-shell .primary-button,
.workspace-shell .continue-action,
.workspace-shell .select-listing {
  color: #ffffff;
  background-color: #4338ca;
  border-color: #4338ca;
}
html[data-ephinta-theme="dark"] .workspace-shell .primary-button,
html[data-ephinta-theme="dark"] .workspace-shell .continue-action,
html[data-ephinta-theme="dark"] .workspace-shell .select-listing {
  color: #111827;
  background-color: #c4b5fd;
  border-color: #c4b5fd;
}
html[data-ephinta-theme="colorful"] .workspace-shell .primary-button,
html[data-ephinta-theme="colorful"] .workspace-shell .continue-action,
html[data-ephinta-theme="colorful"] .workspace-shell .select-listing {
  color: #ffffff;
  background-color: #a51668;
  border-color: #a51668;
}
.workspace-shell :focus-visible { outline: 3px solid #0b63ce; outline-offset: 3px; }
""", encoding="utf-8")

if "ephinta-accessible-contrast.css" not in main:
    css_import = "import './ephinta-accessible-contrast.css';"
    index_match = re.search(r"^import\s+['\"][^'\"]*index\.css['\"];\s*$", main, flags=re.M)
    if index_match:
        main = main[:index_match.end()] + "\n" + css_import + main[index_match.end():]
    else:
        first_import = re.search(r"^import .*?;\s*$", main, flags=re.M)
        if not first_import:
            print("ERROR: Could not safely insert contrast stylesheet import in main.tsx", file=sys.stderr)
            sys.exit(2)
        main = main[:first_import.end()] + "\n" + css_import + main[first_import.end():]
    main_path.write_text(main, encoding="utf-8")

print("Applied App.tsx, PublicLanding.tsx, currency helper, and contrast stylesheet changes.")
PY

echo
echo "Patch applied. Review the changes before committing:"
git status --short 2>/dev/null || true
echo
echo "Next checks (run scripts defined in package.json):"
echo "  npm run typecheck   # if defined"
echo "  npm run lint        # if defined"
echo "  npm run build       # if defined"
echo
echo "This script does not commit or push anything."
