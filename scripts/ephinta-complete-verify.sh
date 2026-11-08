#!/usr/bin/env bash
set -Eeuo pipefail

# EPHINTA integration + quality + release-readiness runner.
# Run from any directory in the repository:
#   bash scripts/ephinta-complete-verify.sh
#
# This script never force-pushes, fabricates credentials, or deletes branches.
# It merges PRs only after GitHub reports every required check successful.
# External provider/device/signing gates are reported, not falsely simulated.

REPO="demtaiwo1-eng/winning-game-"
PR_UI="${EPHINTA_PR_UI:-124}"
PR_SECURITY="${EPHINTA_PR_SECURITY:-123}"
LOG="${TMPDIR:-/tmp}/ephinta-completion-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

step() { printf '\n========== %s ==========\n' "$1"; }
die() { echo "STOP: $*" >&2; exit 1; }
has_script() {
  node -e 'const p=require(require("node:path").resolve(process.argv[1])); process.exit(p.scripts?.[process.argv[2]] ? 0 : 1)' "$1" "$2"
}

command -v git >/dev/null || die "Git is required."
command -v gh >/dev/null || die "GitHub CLI is required. Install gh and run gh auth login."
gh auth status || die "GitHub CLI authentication is required."

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Run this inside a clone of the EPHINTA repository."
cd "$ROOT"
REMOTE="$(git remote get-url origin)"
case "$REMOTE" in
  *demtaiwo1-eng/winning-game*|*demtaiwo1-eng/Winning-game*) ;;
  *) die "Unexpected origin remote: $REMOTE" ;;
esac

step "1. Protect local work and refresh repository"
git status --short --branch
[[ -z "$(git status --porcelain)" ]] || die "Working tree is not clean. Commit or stash your changes first."
git fetch origin --prune
git switch main
git pull --ff-only origin main

# The actual npm workspace lives in this subdirectory in the EPHINTA repo.
APP_ROOT="$ROOT/eventsss123/eventsss-main"
[[ -f "$APP_ROOT/package.json" ]] || APP_ROOT="$ROOT"
[[ -f "$APP_ROOT/package.json" ]] || die "Could not locate the application package.json."
cd "$APP_ROOT"
echo "Application workspace: $APP_ROOT"

step "2. Validate integration PRs"
for pr in "$PR_UI" "$PR_SECURITY"; do
  state="$(gh pr view "$pr" --repo "$REPO" --json state --jq .state)"
  base="$(gh pr view "$pr" --repo "$REPO" --json baseRefName --jq .baseRefName)"
  merged="$(gh pr view "$pr" --repo "$REPO" --json mergedAt --jq '.mergedAt // ""')"
  [[ "$state" == "OPEN" || -n "$merged" ]] || die "PR #$pr is neither open nor merged."
  [[ "$base" == "main" || -n "$merged" ]] || die "PR #$pr does not target main."
  gh pr view "$pr" --repo "$REPO" --json title,state,isDraft,mergeable,headRefName,headRefOid,url
done

step "3. Integrate planner, responsive UI and music (PR #$PR_UI)"
if [[ -z "$(gh pr view "$PR_UI" --repo "$REPO" --json mergedAt --jq '.mergedAt // ""')" ]]; then
  gh pr ready "$PR_UI" --repo "$REPO" || true
  gh pr checks "$PR_UI" --repo "$REPO" --watch
  mergeable="$(gh pr view "$PR_UI" --repo "$REPO" --json mergeable --jq .mergeable)"
  [[ "$mergeable" == "MERGEABLE" ]] || die "PR #$PR_UI is not mergeable."
  head="$(gh pr view "$PR_UI" --repo "$REPO" --json headRefOid --jq .headRefOid)"
  gh pr merge "$PR_UI" --repo "$REPO" --merge --match-head-commit "$head"
else
  echo "PR #$PR_UI is already merged."
fi

step "4. Refresh main and integrate device security + Bytid (PR #$PR_SECURITY)"
git fetch origin --prune
git switch main
git pull --ff-only origin main
if [[ -z "$(gh pr view "$PR_SECURITY" --repo "$REPO" --json mergedAt --jq '.mergedAt // ""')" ]]; then
  gh pr update-branch "$PR_SECURITY" --rebase
  gh pr ready "$PR_SECURITY" --repo "$REPO" || true
  gh pr checks "$PR_SECURITY" --repo "$REPO" --watch
  mergeable="$(gh pr view "$PR_SECURITY" --repo "$REPO" --json mergeable --jq .mergeable)"
  [[ "$mergeable" == "MERGEABLE" ]] || die "PR #$PR_SECURITY is not mergeable."
  head="$(gh pr view "$PR_SECURITY" --repo "$REPO" --json headRefOid --jq .headRefOid)"
  gh pr merge "$PR_SECURITY" --repo "$REPO" --merge --match-head-commit "$head"
else
  echo "PR #$PR_SECURITY is already merged."
fi

step "5. Pull integrated main"
git fetch origin --prune
git switch main
git pull --ff-only origin main
echo "Integrated main: $(git rev-parse HEAD)"

step "6. Install dependencies and run API/web checks"
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run check
npm run build
npm run build:web

step "7. Accessibility, responsive UX and browser acceptance"
# Project UX audit checks layout/theme/contrast and responsive design heuristics.
if has_script package.json ux:audit; then
  npm run ux:audit
else
  echo "NOTICE: ux:audit script is not defined in this checkout."
fi

WEB_PACKAGE="apps/web/package.json"
if [[ -f "$WEB_PACKAGE" ]]; then
  if has_script "$WEB_PACKAGE" test:e2e; then
    npm run test:e2e -w apps/web
  else
    echo "NOTICE: apps/web does not expose test:e2e; browser E2E remains a release gate."
  fi
  if has_script "$WEB_PACKAGE" test:a11y; then
    npm run test:a11y -w apps/web
  elif has_script "$WEB_PACKAGE" test:accessibility; then
    npm run test:accessibility -w apps/web
  else
    echo "NOTICE: no dedicated automated accessibility test script found; complete keyboard, screen-reader and contrast review manually."
  fi
fi

step "8. Android verification"
if [[ -d apps/mobile/android ]]; then
  if [[ -x apps/mobile/android/gradlew ]]; then
    if [[ -d /usr/lib/jvm/java-21-openjdk-amd64 ]]; then
      export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
      export PATH="$JAVA_HOME/bin:$PATH"
    fi
    npm run mobile:verify
  else
    echo "NOTICE: Android Gradle wrapper is not executable. Run chmod +x apps/mobile/android/gradlew and rerun."
    exit 2
  fi
else
  echo "NOTICE: Android project not present; native verification remains a release gate."
fi

step "9. Confirm PR merge state and final GitHub checks"
for pr in "$PR_UI" "$PR_SECURITY"; do
  gh pr view "$pr" --repo "$REPO" --json number,state,mergedAt,mergeCommit,url
done
git fetch origin --prune
git switch main
git pull --ff-only origin main
gh run list --repo "$REPO" --branch main --limit 15

step "10. Safe branch audit (report only; no deletion)"
main_tree="$(git rev-parse 'origin/main^{tree}')"
while IFS= read -r branch; do
  [[ -z "$branch" || "$branch" == "origin/main" || "$branch" == "origin/HEAD" ]] && continue
  local_branch="${branch#origin/}"
  if git show-ref --verify --quiet "refs/remotes/$branch"; then
    tree="$(git rev-parse "$branch^{tree}")"
    if [[ "$tree" == "$main_tree" ]]; then
      echo "IDENTICAL TO MAIN; candidate for controlled cleanup: $local_branch"
    else
      echo "PRESERVE; branch differs from main: $local_branch"
    fi
  fi
done < <(git branch -r --format='%(refname:short)')

step "11. External production acceptance gates"
cat <<'GATES'
These cannot be proven by CI or a shell script alone:
[ ] Bytid sandbox key and webhook secret set privately in Render.
[ ] Real Bytid sandbox request tested; signed webhook delivery confirmed.
[ ] Verified, rejected, expired and failed KYC outcomes tested.
[ ] OPay sandbox collection, payout, refund and reconciliation tested.
[ ] Cleva and Eversend merchant credentials and sandbox transactions tested.
[ ] Physical Android: PIN, biometric, five-minute lock, recovery, NFC and Bluetooth.
[ ] Android production signing key securely configured; signed APK installed/launched.
[ ] Database backup restored into an isolated test database and validated.
[ ] Registration/login/wrong-password/reset and full planner/vendor/customer journeys.
[ ] Keyboard-only navigation, screen-reader labels, focus order and color contrast.
[ ] Tablet/mobile/desktop and supported communication-channel acceptance.
GATES

step "12. Final status"
git status --short --branch
git log -5 --oneline
echo "Log saved to: $LOG"
echo "EPHINTA automated verification completed. External gates above still require real-world acceptance."
