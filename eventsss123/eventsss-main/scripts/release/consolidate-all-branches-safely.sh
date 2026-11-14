#!/usr/bin/env bash
# Safely consolidate remote feature branches into the EPHINTA release candidate.
#
# IMPORTANT:
# - Never writes directly to main.
# - Never force-pushes or deletes branches.
# - Merges one branch at a time into an integration branch.
# - Runs the real project checks before accepting each merge commit.
# - Aborts a branch merge on conflict or failing checks and records it.
#
# Run from the repository root:
#   bash scripts/release/consolidate-all-branches-safely.sh
#
# Optional:
#   BASE_BRANCH=main
#   INTEGRATION_BRANCH=integration/ephinta-release-candidate-final-20261114
#   SKIP_ANDROID=true       # only for non-release triage; not a publishable result
#   MAX_BRANCHES=0          # 0 means all remote branches

set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

BASE_BRANCH="${BASE_BRANCH:-main}"
INTEGRATION_BRANCH="${INTEGRATION_BRANCH:-integration/ephinta-release-candidate-final-20261114}"
SKIP_ANDROID="${SKIP_ANDROID:-false}"
MAX_BRANCHES="${MAX_BRANCHES:-0}"
REPORT_DIR="${REPORT_DIR:-$REPO_ROOT/artifacts}"
REPORT_FILE="$REPORT_DIR/branch-consolidation-report.tsv"

die() { echo "::error::$*" >&2; exit 1; }
log() { printf '\n[EPHINTA CONSOLIDATION] %s\n' "$*"; }

command -v git >/dev/null || die "git is required"
command -v npm >/dev/null || die "npm is required"
git diff --quiet && git diff --cached --quiet || die "Working tree has uncommitted changes; commit or stash them first."
git fetch --prune origin

git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" || die "Remote base branch origin/$BASE_BRANCH does not exist."
git show-ref --verify --quiet "refs/remotes/origin/$INTEGRATION_BRANCH" || die "Remote integration branch origin/$INTEGRATION_BRANCH does not exist."

# Work only on a dedicated integration branch. Never checkout or push main.
git switch --create "$INTEGRATION_BRANCH" --track "origin/$INTEGRATION_BRANCH" 2>/dev/null || git switch "$INTEGRATION_BRANCH"
[[ "$(git branch --show-current)" == "$INTEGRATION_BRANCH" ]] || die "Refusing to continue outside $INTEGRATION_BRANCH."

mkdir -p "$REPORT_DIR"
printf 'branch\tresult\tcommit\tdetail\n' > "$REPORT_FILE"

accepted=0
skipped=0
failed=0
processed=0

run_release_checks() {
  log "Installing locked dependencies"
  npm ci || return 1

  log "API checks, database-aware tests, web tests and KYC self-test"
  npm run check || return 1

  log "API production build"
  npm run build || return 1

  log "Web production build"
  npm run build:web || return 1

  log "IP and third-party licence gates"
  npm run ip:verify || return 1
  npm run licence:inventory || return 1

  log "5,000 deterministic payment journeys (mocked; no real money)"
  node scripts/qa/ephinta-5000-payment-functional.mjs || return 1

  log "Device security verification"
  npm run device-security:verify || return 1

  if [[ "$SKIP_ANDROID" != "true" ]]; then
    log "Android lint, unit tests, sync and APK build"
    npm run mobile:verify || return 1
  else
    log "Android checks explicitly skipped; this run cannot approve publication."
  fi
  return 0
}

abort_merge() {
  if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
    git merge --abort || return 1
  fi
}

while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  branch="${ref#origin/}"
  [[ "$branch" == "$BASE_BRANCH" || "$branch" == "$INTEGRATION_BRANCH" ]] && continue
  [[ "$branch" == "HEAD" ]] && continue

  processed=$((processed + 1))
  if [[ "$MAX_BRANCHES" -gt 0 && "$processed" -gt "$MAX_BRANCHES" ]]; then
    break
  fi

  if git merge-base --is-ancestor "$ref" HEAD; then
    skipped=$((skipped + 1))
    printf '%s\t%s\t%s\t%s\n' "$branch" "already-integrated" "$(git rev-parse HEAD)" "No unique commits remain." >> "$REPORT_FILE"
    continue
  fi

  log "Attempting branch $branch"
  if ! git merge --no-commit --no-ff "$ref"; then
    detail="Merge conflict; preserved branch and aborted this merge."
    abort_merge || die "Could not safely abort conflicted merge for $branch."
    skipped=$((skipped + 1))
    printf '%s\t%s\t%s\t%s\n' "$branch" "needs-manual-resolution" "$(git rev-parse HEAD)" "$detail" >> "$REPORT_FILE"
    continue
  fi

  if ! run_release_checks; then
    detail="One or more release checks failed; this branch was not accepted."
    abort_merge || die "Could not safely abort failed-check merge for $branch."
    skipped=$((skipped + 1))
    printf '%s\t%s\t%s\t%s\n' "$branch" "checks-failed" "$(git rev-parse HEAD)" "$detail" >> "$REPORT_FILE"
    continue
  fi

  git commit -m "merge: safely integrate $branch into EPHINTA release candidate"
  accepted=$((accepted + 1))
  printf '%s\t%s\t%s\t%s\n' "$branch" "integrated-and-verified" "$(git rev-parse HEAD)" "All configured checks passed." >> "$REPORT_FILE"
done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin | sort)

log "Final verification of the consolidated candidate"
if ! run_release_checks; then
  failed=$((failed + 1))
  printf '%s\t%s\t%s\t%s\n' "$INTEGRATION_BRANCH" "final-verification-failed" "$(git rev-parse HEAD)" "Candidate must not be merged." >> "$REPORT_FILE"
  cat "$REPORT_FILE"
  exit 1
fi

# A normal push only; no force push and no direct main write.
git push origin "$INTEGRATION_BRANCH"

log "Consolidation report"
cat "$REPORT_FILE"
log "Accepted: $accepted | skipped/needs review: $skipped | failures: $failed"
log "Candidate pushed to $INTEGRATION_BRANCH. Open/update its PR to main and wait for required GitHub checks."
log "This script never merges PRs into main or deletes source branches; those actions occur only after review and green required checks."

if [[ "$skipped" -gt 0 || "$failed" -gt 0 ]]; then
  echo "::warning::Some branches need manual conflict or test review. Do not delete them."
  exit 2
fi
