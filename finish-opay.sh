#!/usr/bin/env bash
set -Eeuo pipefail

REPO="demtaiwo1-eng/Winning-game-"
BRANCH="feature/opay-sandbox"
API_DIR="eventsss123/eventsss-main/apps/api"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null || fail "Git is required."
command -v gh  >/dev/null || fail "GitHub CLI (gh) is required."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "Run this script from inside your repository checkout."

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

[[ -d "$API_DIR" ]] || fail "Could not find $API_DIR"
git fetch origin "$BRANCH"
git switch "$BRANCH"
git pull --ff-only origin "$BRANCH"

PROVIDERS="$API_DIR/src/modules/payments/providers.ts"
ROUTES="$API_DIR/src/modules/payments/payments.routes.ts"
ENVFILE="$API_DIR/src/config/env.ts"

# Unrelated local edits are safe: this script only pushes commits. Refuse to
# continue if any payment file it validates has staged, unstaged, or untracked
# local changes, so those changes cannot be mistaken for the checked version.
[[ -z "$(git status --porcelain -- "$PROVIDERS" "$ROUTES" "$ENVFILE")" ]] ||
  fail "Payment files have local changes. Commit or stash those files first."

for file in "$PROVIDERS" "$ROUTES" "$ENVFILE"; do
  [[ -f "$file" ]] || fail "Missing expected file: $file"
done

# These checks intentionally stop before publishing incomplete payment code.
grep -q 'initializeOpay' "$PROVIDERS" ||
  fail "OPay checkout adapter is missing."
grep -q 'initializeOpay' "$ROUTES" ||
  fail "OPay is not wired into payment-intent creation."
grep -q 'verifyOpay' "$PROVIDERS" ||
  fail "OPay provider-side payment verification is missing."
grep -q 'verifyOpay' "$ROUTES" ||
  fail "OPay verification is not used by the webhook/reconciliation flow."
grep -q 'opay' "$ROUTES" ||
  fail "No OPay route handling found."

# Ensure the project can typecheck and pass its API test suite.
cd "$API_DIR"
npm ci
npm run check

cd "$ROOT"

# Only publish the branch and open a PR after every check above succeeds.
git push -u origin "$BRANCH"

gh pr create \
  --repo "$REPO" \
  --base main \
  --head "$BRANCH" \
  --title "Complete OPay sandbox payment integration" \
  --body "$(cat <<'EOF'
## Summary
Completes the OPay sandbox payment integration.

## Safety checklist
- [ ] OPay checkout and payment verification implemented
- [ ] Webhook signature/authenticity validated
- [ ] Amount, currency, and reference matched to the pending intent
- [ ] Settlement is idempotent
- [ ] Reconciliation supports OPay safely
- [ ] API checks pass
- [ ] Sandbox payment tested end-to-end

Do not enable live payments until the checklist is verified.
EOF
)"

printf '\nPR created. Review it and complete the sandbox end-to-end test before merging.\n'
