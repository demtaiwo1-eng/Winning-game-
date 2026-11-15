#!/usr/bin/env bash
# Fast, safe EPHINTA PR verification and merge coordinator.
# Requires: gh (authenticated), jq, and permission to read Actions and merge PRs.
#
# Usage:
#   PR_NUMBER=192 ./scripts/ephinta-fast-finish.sh
#   PR_NUMBER=192 MAX_WAIT_MINUTES=180 ./scripts/ephinta-fast-finish.sh
#
# This script does not skip checks, alter secrets, deploy manually, or force-push.
# It retries only failed/cancelled jobs once, then waits for all PR checks and
# merges only if the PR head is still the exact SHA that was verified.

set -Eeuo pipefail

REPO="${REPO:-demtaiwo1-eng/Winning-game-}"
PR_NUMBER="${PR_NUMBER:-192}"
POLL_SECONDS="${POLL_SECONDS:-20}"
MAX_WAIT_MINUTES="${MAX_WAIT_MINUTES:-180}"

WORKFLOWS=(
  "EPHINTA Browser E2E and Regression"
  "EPHINTA 7,000-portal-fixture scale QA"
  "App verification suite"
)

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[%s] %s\n' "$(date -u +'%H:%M:%S UTC')" "$*"; }

command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is required."
command -v jq >/dev/null 2>&1 || die "jq is required."
gh auth status >/dev/null 2>&1 || die "Run 'gh auth login' first."

PR_JSON="$(gh pr view "$PR_NUMBER" --repo "$REPO" --json state,isDraft,baseRefName,headRefName,headRefOid)"
[[ "$(jq -r '.state' <<<"$PR_JSON")" == "OPEN" ]] || die "PR #$PR_NUMBER is not open."
[[ "$(jq -r '.baseRefName' <<<"$PR_JSON")" == "main" ]] || die "PR #$PR_NUMBER does not target main."
[[ "$(jq -r '.isDraft' <<<"$PR_JSON")" == "false" ]] || die "PR #$PR_NUMBER is still a draft."

PINNED_SHA="$(jq -r '.headRefOid' <<<"$PR_JSON")"
[[ "$PINNED_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Could not pin the PR head SHA."
DEADLINE=$((SECONDS + MAX_WAIT_MINUTES * 60))
declare -A RETRIED=()

log "Monitoring PR #$PR_NUMBER at $PINNED_SHA"
log "No checks will be skipped. Each failed/cancelled run gets one failed-jobs-only retry."

while (( SECONDS < DEADLINE )); do
  CURRENT_SHA="$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefOid --jq '.headRefOid')"
  [[ "$CURRENT_SHA" == "$PINNED_SHA" ]] || die "PR head changed from $PINNED_SHA to $CURRENT_SHA. Re-pin and verify the new commit."

  RUNS_JSON="$(gh run list --repo "$REPO" --commit "$PINNED_SHA" --limit 100 --json databaseId,name,status,conclusion,headSha)"
  ALL_GREEN=1

  for WF in "${WORKFLOWS[@]}"; do
    RUN_JSON="$(jq -c --arg name "$WF" --arg sha "$PINNED_SHA" '[.[] | select(.name == $name and .headSha == $sha)] | sort_by(.databaseId) | last // empty' <<<"$RUNS_JSON")"
    if [[ -z "$RUN_JSON" ]]; then
      log "Waiting for workflow to appear: $WF"
      ALL_GREEN=0
      continue
    fi

    RUN_ID="$(jq -r '.databaseId' <<<"$RUN_JSON")"
    STATUS="$(jq -r '.status' <<<"$RUN_JSON")"
    CONCLUSION="$(jq -r '.conclusion // ""' <<<"$RUN_JSON")"
    log "$WF — $STATUS ${CONCLUSION:-}"

    if [[ "$STATUS" == "completed" && "$CONCLUSION" == "success" ]]; then
      continue
    fi

    ALL_GREEN=0
    if [[ "$STATUS" == "completed" && ( "$CONCLUSION" == "failure" || "$CONCLUSION" == "cancelled" || "$CONCLUSION" == "timed_out" ) ]]; then
      [[ -z "${RETRIED[$RUN_ID]:-}" ]] || {
        gh run view "$RUN_ID" --repo "$REPO" --log-failed || true
        die "Workflow $WF failed again after its one retry."
      }
      log "Retrying failed/cancelled jobs only for run $RUN_ID"
      gh run rerun "$RUN_ID" --repo "$REPO" --failed
      RETRIED[$RUN_ID]=1
    elif [[ "$STATUS" == "completed" ]]; then
      die "Workflow $WF ended with unexpected conclusion '$CONCLUSION'."
    fi
  done

  if (( ALL_GREEN )); then
    break
  fi
  sleep "$POLL_SECONDS"
done

(( SECONDS < DEADLINE )) || die "Timed out after $MAX_WAIT_MINUTES minutes."

# Wait for every PR check (including branch-protection checks not listed above).
log "All monitored workflows passed. Waiting for all PR checks."
gh pr checks "$PR_NUMBER" --repo "$REPO" --watch --interval "$POLL_SECONDS"

# Recheck state and exact SHA immediately before the merge request.
FINAL_JSON="$(gh pr view "$PR_NUMBER" --repo "$REPO" --json state,isDraft,baseRefName,headRefOid)"
[[ "$(jq -r '.state' <<<"$FINAL_JSON")" == "OPEN" ]] || die "PR is no longer open."
[[ "$(jq -r '.isDraft' <<<"$FINAL_JSON")" == "false" ]] || die "PR became a draft."
[[ "$(jq -r '.baseRefName' <<<"$FINAL_JSON")" == "main" ]] || die "PR base changed."
FINAL_SHA="$(jq -r '.headRefOid' <<<"$FINAL_JSON")"
[[ "$FINAL_SHA" == "$PINNED_SHA" ]] || die "PR head changed before merge."

log "Requesting squash merge pinned to $PINNED_SHA"
MERGE_JSON="$(gh api --method PUT "repos/$REPO/pulls/$PR_NUMBER/merge" -f sha="$PINNED_SHA" -f merge_method=squash)"
[[ "$(jq -r '.merged' <<<"$MERGE_JSON")" == "true" ]] || die "GitHub did not confirm the merge: $MERGE_JSON"

log "Merged successfully: $(jq -r '.sha' <<<"$MERGE_JSON")"
log "Render auto-deploy is expected to deploy main; verify service health in Render."
