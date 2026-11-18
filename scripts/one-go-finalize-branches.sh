#!/usr/bin/env bash
# EPHINTA one-go final consolidation gate.
# Runs on GitHub Actions (no Codespace/local machine required).
# It never force-pushes, merges unreviewed code, deletes branches, changes secrets,
# creates signing keys, deploys production, or touches live customer payments.
set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
APP="$REPO_ROOT/eventsss123/eventsss-main"
OUT="$REPO_ROOT/artifacts/one-go-finalization"
mkdir -p "$OUT"
REPORT="$OUT/branch-readiness.tsv"
SUMMARY="$OUT/one-go-summary.md"
printf 'branch\tclassification\tmerge_tree\topen_pr\tdetail\n' > "$REPORT"

say(){ printf '\n==> %s\n' "$*"; }
die(){ echo "ERROR: $*" >&2; exit 2; }
for cmd in git gh jq node npm java; do command -v "$cmd" >/dev/null || die "Missing required command: $cmd"; done
gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated."
[[ -f "$APP/package-lock.json" ]] || die "Application lockfile not found at $APP/package-lock.json"
[[ "$(git branch --show-current)" == "main" ]] || die "Workflow must check out main."

say "Fetch the complete branch graph"
git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'
MAIN_REF="refs/remotes/origin/main"
git show-ref --verify --quiet "$MAIN_REF" || die "origin/main is missing."
MAIN_TREE="$(git rev-parse "$MAIN_REF^{tree}")"
OPEN_PR_BRANCHES="$(gh pr list --repo "$GITHUB_REPOSITORY" --state open --json headRefName --jq '.[].headRefName' || true)"

safe=0; preserved=0; excluded=0; errors=0
while IFS= read -r branch; do
  [[ -z "$branch" || "$branch" == "main" ]] && continue
  ref="refs/remotes/origin/$branch"
  [[ -e "$(git rev-parse --git-path "$ref")" ]] || true
  pr="no"
  if grep -Fxq -- "$branch" <<<"$OPEN_PR_BRANCHES"; then pr="yes"; fi

  # Permanent policy exclusions: never reintroduce the 100 payment-persona
  # journeys; never discard OAuth or Android signing work without owner review.
  if [[ "$branch" =~ ^qa/payment-notification-100-personas- ]] ||
     [[ "$branch" =~ ^qa/payment-notifications-main- ]] ||
     [[ "$branch" =~ ^qa/payment-personas-wallet-selector-fix- ]] ||
     [[ "$branch" == "integration/selected-payment-persona-navigation-fix-20261117" ]]; then
    printf '%s\tEXCLUDED_BY_POLICY\t-\t%s\t100 payment-persona journey suite is explicitly excluded\n' "$branch" "$pr" >> "$REPORT"
    excluded=$((excluded+1)); continue
  fi
  if [[ "$branch" == *youtube-oauth* || "$branch" == *signing* || "$branch" == "automation/integrate-all-branches-one-go-20261117" ]]; then
    printf '%s\tOWNER_REVIEW_REQUIRED\t-\t%s\tOAuth/signing/unsafe integration automation is not auto-merged or marked disposable\n' "$branch" "$pr" >> "$REPORT"
    preserved=$((preserved+1)); continue
  fi
  if [[ "$pr" == "yes" ]]; then
    printf '%s\tOPEN_PR\t-\tyes\tOpen pull request; preserve branch\n' "$branch" >> "$REPORT"
    preserved=$((preserved+1)); continue
  fi

  # A successful merge-tree identical to main proves this branch contributes
  # no additional resulting file content when merged with current main.
  # Conflicts and any changed resulting tree are preserved for human review.
  set +e
  merge_output="$(git merge-tree --write-tree "$MAIN_REF" "$ref" 2>&1)"
  merge_rc=$?
  set -e
  if [[ "$merge_rc" -ne 0 ]]; then
    printf '%s\tCONFLICT_OR_UNMERGEABLE\t-\t%s\tMerge-tree failed; preserve for review\n' "$branch" "$pr" >> "$REPORT"
    preserved=$((preserved+1)); continue
  fi
  merged_tree="$(printf '%s\n' "$merge_output" | head -n 1 | tr -d '\r')"
  if [[ "$merged_tree" == "$MAIN_TREE" ]]; then
    printf '%s\tREADY_FOR_MANUAL_DELETION\tidentical\t%s\tMerge result tree equals main; no branch-only content remains\n' "$branch" "$pr" >> "$REPORT"
    safe=$((safe+1))
  else
    printf '%s\tUNIQUE_CONTENT_REMAINS\tdifferent\t%s\tMerge result changes main; do not delete or auto-merge\n' "$branch" "$pr" >> "$REPORT"
    preserved=$((preserved+1))
  fi
done < <(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin | sort)

say "Run the complete repository quality/build suite on main"
cd "$APP"
npm ci
quality_status=0
run_gate(){ label="$1"; shift; echo "--- $label"; "$@" || quality_status=1; }
run_gate "API, web, and KYC tests" npm run check
run_gate "API production build" npm run build
run_gate "Web production build" npm run build:web
run_gate "Android lint, unit tests, sync and debug APK verification" npm run mobile:verify

cat > "$SUMMARY" <<EOF
# EPHINTA one-go finalization report

- Repository: $GITHUB_REPOSITORY
- Main commit: $(git -C "$REPO_ROOT" rev-parse "$MAIN_REF")
- Branches ready for manual deletion: $safe
- Branches preserved for review: $preserved
- Branches excluded by explicit policy: $excluded
- Quality/build suite: $([[ "$quality_status" -eq 0 ]] && echo PASS || echo FAIL)
- Branch deletion performed: NO
- Branch merge performed: NO

## Safety boundaries
This run does not merge unique branch changes, delete branches, change branch protection,
replace Android signing keys, use production payment credentials, migrate production data,
or deploy/publish the application. Payment-persona journey branches are explicitly excluded.
A branch is marked READY_FOR_MANUAL_DELETION only when Git's merge-tree result is exactly
the current main tree and there is no open PR.

## Required human/provider gates
Physical-phone testing, real provider sandbox credentials/webhooks, production signing
certificate ownership, Render/Supabase production configuration, and Play Console submission
cannot be truthfully certified by a generic CI run.
EOF

echo "Branch report: $REPORT"
echo "Summary: $SUMMARY"
if [[ "$quality_status" -ne 0 ]]; then
  echo "QUALITY GATE FAILED: do not treat any branch as final release approval."
  exit 1
fi
echo "QUALITY GATE PASSED. Use READY_FOR_MANUAL_DELETION rows only; all other branches remain."
