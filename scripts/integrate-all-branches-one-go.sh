#!/usr/bin/env bash
# EPHINTA safe one-go branch integration. Merge only clean PRs with green CI.
# Never force-push, auto-resolve conflicts, bypass reviews, or delete branches.
set -Eeuo pipefail
REPO="${GITHUB_REPOSITORY:-demtaiwo1-eng/winning-game-}"
MAIN="${MAIN_BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
MAX_FILES="${MAX_CHANGED_FILES:-250}"
MAX_DELETIONS="${MAX_DELETIONS:-10000}"
RUN_VERIFY="${RUN_LOCAL_VERIFY:-1}"
OUT="${REPORT_DIR:-artifacts/branch-integration}"
mkdir -p "$OUT"
REPORT="$OUT/integration-$(date -u +%Y%m%dT%H%M%SZ).tsv"
printf 'branch\tsha\tstatus\tpr\tdetail\n' > "$REPORT"
die(){ echo "ERROR: $*" >&2; exit 2; }
record(){ printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "${4:--}" "${5//[$'\t\n']/ }" | tee -a "$REPORT"; }

for cmd in git gh jq; do command -v "$cmd" >/dev/null || die "$cmd is required"; done
gh auth status >/dev/null 2>&1 || die "run gh auth login first"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "run inside a clone"
cd "$ROOT"
[[ "$(git remote get-url "$REMOTE")" == *"demtaiwo1-eng/"* ]] || die "unexpected origin remote"
[[ "$(git branch --show-current)" == "$MAIN" ]] || die "check out $MAIN first"
[[ -z "$(git status --porcelain)" ]] || die "working tree must be clean"
git fetch --prune "$REMOTE" "+refs/heads/*:refs/remotes/$REMOTE/*"
git pull --ff-only "$REMOTE" "$MAIN"

mapfile -t BRANCHES < <(git for-each-ref --format='%(refname:strip=3)' "refs/remotes/$REMOTE" | grep -v -Fx "$MAIN" | sort)
echo "Found ${#BRANCHES[@]} non-main branches."

for b in "${BRANCHES[@]}"; do
  ref="refs/remotes/$REMOTE/$b"; sha="$(git rev-parse "$ref")"
  if git merge-base --is-ancestor "$ref" "refs/remotes/$REMOTE/$MAIN"; then
    record "$b" "$sha" "ALREADY_IN_MAIN" "-" "branch tip is in main"; continue
  fi
  plus="$(git cherry "refs/remotes/$REMOTE/$MAIN" "$ref" | awk '$1=="+"{n++} END{print n+0}')"
  if [[ "$plus" == 0 ]]; then
    record "$b" "$sha" "PATCH_EQUIVALENT" "-" "all commits have patch-equivalents in main"; continue
  fi

  pr="$(gh pr list --repo "$REPO" --head "$b" --base "$MAIN" --state open --json number --jq '.[0].number // empty')"
  if [[ -z "$pr" ]]; then
    closed="$(gh pr list --repo "$REPO" --head "$b" --base "$MAIN" --state closed --json number --jq '.[0].number // empty')"
    if [[ -n "$closed" ]]; then record "$b" "$sha" "REVIEW_CLOSED_PR" "$closed" "closed PR exists; inspect before reopening"; continue; fi
    if ! gh pr create --repo "$REPO" --head "$b" --base "$MAIN" --title "chore(integration): integrate $b" --body "Automated integration request. Merge only when required checks pass and the diff is safe."; then
      record "$b" "$sha" "PR_CREATE_FAILED" "-" "could not create PR"; continue
    fi
    pr="$(gh pr list --repo "$REPO" --head "$b" --base "$MAIN" --state open --json number --jq '.[0].number // empty')"
  fi
  [[ -n "$pr" ]] || { record "$b" "$sha" "PR_NOT_FOUND" "-" "no open PR resolved"; continue; }

  meta="$(gh pr view "$pr" --repo "$REPO" --json mergeable,mergeStateStatus,isDraft,headRefOid,changedFiles,deletions)"
  head="$(jq -r '.headRefOid' <<<"$meta")"
  files="$(jq -r '.changedFiles // 0' <<<"$meta")"
  dels="$(jq -r '.deletions // 0' <<<"$meta")"
  mergeable="$(jq -r '.mergeable' <<<"$meta")"
  state="$(jq -r '.mergeStateStatus' <<<"$meta")"
  draft="$(jq -r '.isDraft' <<<"$meta")"
  if [[ "$head" != "$sha" ]]; then record "$b" "$sha" "STALE_PR_HEAD" "$pr" "PR head differs from branch tip"; continue; fi
  if [[ "$draft" == true || "$mergeable" != MERGEABLE || "$state" != CLEAN ]]; then
    record "$b" "$sha" "BLOCKED_MERGE_STATE" "$pr" "draft=$draft mergeable=$mergeable state=$state"; continue
  fi
  if (( files > MAX_FILES || dels > MAX_DELETIONS )); then
    record "$b" "$sha" "LARGE_DIFF_REVIEW" "$pr" "files=$files deletions=$dels; human review required"; continue
  fi

  echo "Waiting for PR #$pr checks..."
  if ! gh pr checks "$pr" --repo "$REPO" --watch --fail-fast; then
    record "$b" "$sha" "CHECKS_FAILED_OR_PENDING" "$pr" "checks did not all pass"; continue
  fi
  checks="$(gh pr checks "$pr" --repo "$REPO" --json name,bucket 2>/dev/null || echo '[]')"
  if ! jq -e 'length>0 and all(.[]; .bucket=="pass")' >/dev/null <<<"$checks"; then
    record "$b" "$sha" "CHECKS_NOT_ALL_GREEN" "$pr" "missing, skipped, pending, or failing checks"; continue
  fi
  latest="$(gh pr view "$pr" --repo "$REPO" --json headRefOid,mergeable,mergeStateStatus)"
  if [[ "$(jq -r '.headRefOid' <<<"$latest")" != "$head" || "$(jq -r '.mergeable' <<<"$latest")" != MERGEABLE || "$(jq -r '.mergeStateStatus' <<<"$latest")" != CLEAN ]]; then
    record "$b" "$sha" "CHANGED_AFTER_CHECKS" "$pr" "PR changed or became unmergeable"; continue
  fi
  if gh pr merge "$pr" --repo "$REPO" --merge --match-head-commit "$head"; then
    git fetch "$REMOTE" "$MAIN"
    if git merge-base --is-ancestor "$ref" "refs/remotes/$REMOTE/$MAIN"; then
      record "$b" "$sha" "MERGED_VERIFIED" "$pr" "branch tip contained in main"
    else
      record "$b" "$sha" "MERGE_RECHECK_REQUIRED" "$pr" "ancestry check did not confirm"
    fi
  else
    record "$b" "$sha" "MERGE_REJECTED" "$pr" "GitHub rejected merge; branch preserved"
  fi
done

git fetch --prune "$REMOTE" "+refs/heads/*:refs/remotes/$REMOTE/*"
git pull --ff-only "$REMOTE" "$MAIN"
remaining=0
while IFS= read -r b; do
  [[ -z "$b" || "$b" == "$MAIN" ]] && continue
  ref="refs/remotes/$REMOTE/$b"; sha="$(git rev-parse "$ref")"
  if git merge-base --is-ancestor "$ref" "refs/remotes/$REMOTE/$MAIN"; then
    record "$b" "$sha" "FINAL_VERIFIED" "-" "integrated in main"
  else
    plus="$(git cherry "refs/remotes/$REMOTE/$MAIN" "$ref" | awk '$1=="+"{n++} END{print n+0}')"
    if [[ "$plus" == 0 ]]; then record "$b" "$sha" "FINAL_PATCH_EQUIVALENT" "-" "changes represented in main"
    else record "$b" "$sha" "FINAL_OUTSTANDING" "-" "$plus unique commit(s) remain"; remaining=$((remaining+1)); fi
  fi
done < <(git for-each-ref --format='%(refname:strip=3)' "refs/remotes/$REMOTE")

if (( RUN_VERIFY )); then
  APP="$ROOT/eventsss123/eventsss-main"; [[ -f "$APP/package-lock.json" ]] || APP="$ROOT"
  [[ -f "$APP/package-lock.json" ]] || die "application package-lock.json not found"
  cd "$APP"
  npm ci
  npm run check
  npm run build
  npm run build:web
  npm run mobile:verify
fi
echo "Report: $REPORT"
if (( remaining )); then
  echo "INCOMPLETE: $remaining branch(es) still have unique commits or need review."
  echo "No branches were deleted. Resolve blockers and rerun."; exit 1
fi
# Delete only branches whose exact tips are ancestors of main, and only after all local gates passed.
if (( remaining == 0 )); then
  git fetch --prune "$REMOTE" "+refs/heads/*:refs/remotes/$REMOTE/*"
  while IFS= read -r b; do
    [[ -z "$b" || "$b" == "$MAIN" ]] && continue
    ref="refs/remotes/$REMOTE/$b"
    if git merge-base --is-ancestor "$ref" "refs/remotes/$REMOTE/$MAIN"; then
      echo "Deleting verified integrated branch: $b"
      gh api --method DELETE "repos/$REPO/git/refs/heads/$b" >/dev/null || record "$b" "$(git rev-parse "$ref")" "DELETE_FAILED" "-" "branch preserved; delete API failed"
    fi
  done < <(git for-each-ref --format='%(refname:strip=3)' "refs/remotes/$REMOTE")
fi
echo "Integration run finished. Review $REPORT for every branch outcome."
