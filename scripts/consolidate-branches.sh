#!/usr/bin/env bash
# Safely consolidate every remote branch into main, verify preservation, and
# optionally delete only branches proven safe. This script never guesses.
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: run this inside a Git checkout." >&2; exit 2;
}
cd "$ROOT"

MAIN_BRANCH="${MAIN_BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
MANIFEST="${MANIFEST:-docs/branch-consolidation-manifest.tsv}"
REPORT_DIR="${REPORT_DIR:-artifacts/branch-consolidation}"
APPLY=0
PUSH=0
DELETE_READY=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/consolidate-branches.sh                 # audit only (safe default)
  scripts/consolidate-branches.sh --apply         # merge approved MERGE rows locally
  scripts/consolidate-branches.sh --apply --push  # merge and push main
  scripts/consolidate-branches.sh --apply --push --delete-ready
                                                  # then delete verified remote branches

Manifest columns (tab-separated):
  branch<TAB>disposition<TAB>expected_sha<TAB>rationale

Allowed dispositions:
  REVIEW          blocks completion; investigate and decide
  MERGE           merge this exact remote tip into main
  ALREADY_MERGED  require the remote tip to be an ancestor of main
  PATCH_EQUIVALENT require all unique commits to have patch-equivalents in main

Rules:
- A clean working tree and checked-out main branch are required.
- Every remote branch except main must have exactly one manifest row.
- MERGE requires an expected_sha matching the fetched remote tip.
- Conflicts stop the process immediately; no conflict is auto-resolved.
- No tests are run between merges. Run the final acceptance suite only after
  this script reports all branches integrated.
- Deletion requires --apply --push --delete-ready and a second verification
  against freshly fetched remote refs. main is never deleted.
USAGE
}

while (($#)); do
  case "$1" in
    --apply) APPLY=1 ;;
    --push) PUSH=1 ;;
    --delete-ready) DELETE_READY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if (( DELETE_READY && (!APPLY || !PUSH) )); then
  echo "ERROR: --delete-ready requires both --apply and --push." >&2; exit 2
fi
if (( PUSH && !APPLY )); then
  echo "ERROR: --push requires --apply." >&2; exit 2
fi
if [[ "$(git branch --show-current)" != "$MAIN_BRANCH" ]]; then
  echo "ERROR: check out '$MAIN_BRANCH' first." >&2; exit 2
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean; commit or stash changes first." >&2; exit 2
fi
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest not found: $MANIFEST" >&2; exit 2
fi
git remote get-url "$REMOTE" >/dev/null
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/report-$(date -u +%Y%m%dT%H%M%SZ).tsv"
printf 'branch\tremote_sha\tdisposition\tresult\tdetail\n' > "$REPORT"

echo "Fetching all refs from $REMOTE..."
git fetch --prune "$REMOTE" "+refs/heads/*:refs/remotes/$REMOTE/*"
git show-ref --verify --quiet "refs/remotes/$REMOTE/$MAIN_BRANCH" || {
  echo "ERROR: remote main ref is missing." >&2; exit 2;
}
git pull --ff-only "$REMOTE" "$MAIN_BRANCH"
BASE_SHA="$(git rev-parse HEAD)"
echo "Main baseline: $BASE_SHA"

declare -A disposition expected rationale seen
while IFS= read -r line || [[ -n "$line" ]]; do
  b="$(printf '%s' "$line" | cut -f1)"
  [[ -z "$b" || "$b" == branch || "$b" == \#* ]] && continue
  d="$(printf '%s' "$line" | cut -f2)"
  sha="$(printf '%s' "$line" | cut -f3)"
  why="$(printf '%s' "$line" | cut -f4-)"
  if [[ -n "${seen[$b]+x}" ]]; then
    echo "ERROR: duplicate manifest entry for $b" >&2; exit 2
  fi
  seen["$b"]=1
  disposition["$b"]="${d:-REVIEW}"
  expected["$b"]="${sha:-}"
  rationale["$b"]="${why:-}"
done < "$MANIFEST"

mapfile -t branches < <(git for-each-ref --format='%(refname:strip=3)' "refs/remotes/$REMOTE" | grep -v -E "^$MAIN_BRANCH$" | sort)
if (("${#branches[@]}" == 0)); then echo "No non-main remote branches found."; fi

failures=0
for b in "${branches[@]}"; do
  tip="refs/remotes/$REMOTE/$b"
  sha="$(git rev-parse "$tip")"
  d="${disposition[$b]:-REVIEW}"
  detail="${rationale[$b]:-No rationale supplied}"

  case "$d" in
    MERGE)
      approved="${expected[$b]:-}"
      if [[ -z "$approved" || "$approved" != "$sha" ]]; then
        result="BLOCKED"; detail="expected_sha missing or stale; current=$sha"
        failures=$((failures+1))
      elif git merge-base --is-ancestor "$tip" HEAD; then
        result="ALREADY_IN_MAIN"
      elif (( APPLY )); then
        echo "Merging $b ($sha)..."
        if git merge --no-ff --no-edit "$tip"; then
          if git merge-base --is-ancestor "$tip" HEAD; then result="MERGED"
          else result="BLOCKED"; detail="merge completed but branch tip is not an ancestor"; failures=$((failures+1)); fi
        else
          git merge --abort || true
          result="CONFLICT"; detail="merge conflict; manual resolution and review required"
          failures=$((failures+1))
          printf '%s\t%s\t%s\t%s\t%s\n' "$b" "$sha" "$d" "$result" "$detail" >> "$REPORT"
          echo "STOP: conflict while merging $b. No later branches were touched." >&2
          exit 1
        fi
      else
        result="READY_TO_MERGE"
      fi
      ;;
    ALREADY_MERGED)
      if git merge-base --is-ancestor "$tip" HEAD; then result="ALREADY_IN_MAIN"
      else result="BLOCKED"; detail="manifest says ALREADY_MERGED but tip is not an ancestor"; failures=$((failures+1)); fi
      ;;
    PATCH_EQUIVALENT)
      if git merge-base --is-ancestor "$tip" HEAD; then
        result="ALREADY_IN_MAIN"
      else
        plus="$(git cherry HEAD "$tip" | awk '$1 == "+" {n++} END {print n+0}')"
        if [[ "$plus" == "0" ]]; then result="PATCHES_IN_MAIN"
        else result="BLOCKED"; detail="$plus commit(s) have no patch-equivalent in main"; failures=$((failures+1)); fi
      fi
      ;;
    REVIEW|*)
      result="REVIEW_REQUIRED"; detail="${detail}; disposition=$d"
      failures=$((failures+1))
      ;;
  esac
  printf '%s\t%s\t%s\t%s\t%s\n' "$b" "$sha" "$d" "$result" "$detail" >> "$REPORT"
done

# Manifest entries for branches that no longer exist are stale and need review.
for b in "${!seen[@]}"; do
  if ! git show-ref --verify --quiet "refs/remotes/$REMOTE/$b"; then
    echo "WARNING: manifest branch no longer exists remotely: $b" >&2
  fi
done

if (( failures )); then
  echo "NOT COMPLETE: $failures branch(es) are blocked or require review."
  echo "Resolve the manifest/review issues, then rerun. Report: $REPORT"
  exit 1
fi

if (( APPLY )); then
  git merge-base --is-ancestor "$BASE_SHA" HEAD || {
    echo "ERROR: main history changed unexpectedly during consolidation." >&2; exit 1;
  }
fi

if (( PUSH )); then
  echo "Pushing consolidated main..."
  git push "$REMOTE" "$MAIN_BRANCH"
  git fetch "$REMOTE" "$MAIN_BRANCH"
  git merge-base --is-ancestor HEAD "refs/remotes/$REMOTE/$MAIN_BRANCH" || {
    echo "ERROR: pushed remote main is not contained in local main." >&2; exit 1;
  }
fi

if (( DELETE_READY )); then
  echo "Re-fetching remote branch tips before deletion..."
  git fetch "$REMOTE" "+refs/heads/*:refs/remotes/$REMOTE/*"
  while IFS=$'\t' read -r b sha d result detail; do
    [[ "$b" == branch || -z "$b" ]] && continue
    current_ref="refs/remotes/$REMOTE/$b"
    git show-ref --verify --quiet "$current_ref" || continue
    current_sha="$(git rev-parse "$current_ref")"
    if [[ "$current_sha" != "$sha" ]]; then
      echo "SKIP deletion: $b moved since audit ($sha -> $current_sha)" >&2
      failures=$((failures+1)); continue
    fi
    if ! git merge-base --is-ancestor "$current_ref" "refs/remotes/$REMOTE/$MAIN_BRANCH"; then
      plus="$(git cherry "refs/remotes/$REMOTE/$MAIN_BRANCH" "$current_ref" | awk '$1 == "+" {n++} END {print n+0}')"
      if [[ "$plus" != "0" ]]; then
        echo "SKIP deletion: $b has unpreserved commits." >&2
        failures=$((failures+1)); continue
      fi
    fi
    echo "Deleting verified branch $b..."
    git push "$REMOTE" --delete "$b"
  done < "$REPORT"
fi

if (( failures )); then
  echo "PARTIAL: $failures issue(s) remain. Report: $REPORT" >&2; exit 1
fi

echo "CONSOLIDATION VERIFIED."
echo "All discovered non-main remote branches are integrated or patch-equivalent to main."
if (( DELETE_READY )); then echo "Verified remote branch deletion pass completed."; else echo "Branches are verified; no remote branches were deleted."; fi
echo "Report: $REPORT"
