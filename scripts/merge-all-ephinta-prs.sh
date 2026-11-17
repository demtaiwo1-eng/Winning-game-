#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${GITHUB_REPOSITORY:-demtaiwo1-eng/Winning-game-}"
BASE="main"
PRS=(213 210 187 178 170)
POLL_SECONDS=15
MAX_POLLS=40
MAX_CHANGED_FILES=500
MAX_DELETIONS=10000

MERGED=()
BLOCKED=()

log() { printf '\n[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
field() { gh pr view "$1" --repo "$REPO" --json "$2" --jq ".$2"; }

require_tools() {
  for cmd in gh jq; do command -v "$cmd" >/dev/null || { echo "Missing $cmd"; exit 2; }; done
  gh auth status >/dev/null
  gh repo view "$REPO" >/dev/null
}

wait_mergeable() {
  local pr="$1" state
  for ((i=1; i<=MAX_POLLS; i++)); do
    state="$(field "$pr" mergeable)"
    case "$state" in
      MERGEABLE) return 0 ;;
      CONFLICTING) return 2 ;;
    esac
    log "PR #$pr mergeability=$state ($i/$MAX_POLLS)"
    sleep "$POLL_SECONDS"
  done
  return 1
}

process_pr() {
  local pr="$1" state merged_at base head draft files deletions
  log "Processing PR #$pr"
  state="$(field "$pr" state)"
  merged_at="$(field "$pr" mergedAt)"
  if [[ "$state" == MERGED ]]; then
    log "Already merged; verifying."
    MERGED+=("$pr")
    return 0
  fi
  [[ "$state" == OPEN ]] || { log "Blocked: PR state is $state"; return 1; }
  base="$(field "$pr" baseRefName)"
  head="$(field "$pr" headRefName)"
  draft="$(field "$pr" isDraft)"
  files="$(field "$pr" changedFiles)"
  deletions="$(field "$pr" deletions)"
  [[ "$base" == "$BASE" ]] || { log "Blocked: base is $base"; return 1; }
  [[ "$draft" == false ]] || { log "Blocked: draft PR"; return 1; }

  # Safety stop: the known oversized PR diffs need human review, not blind merging.
  if (( files > MAX_CHANGED_FILES || deletions > MAX_DELETIONS )); then
    log "Blocked: unusually large diff ($files files, $deletions deletions); refusing destructive auto-merge."
    return 1
  fi

  if ! gh pr update-branch "$pr" --repo "$REPO"; then
    log "Blocked: update-branch failed (conflict or update unavailable)."
    return 1
  fi
  if ! wait_mergeable "$pr"; then
    log "Blocked: PR is conflicting or mergeability timed out."
    return 1
  fi
  if ! gh pr checks "$pr" --repo "$REPO" --watch --fail-fast; then
    log "Blocked: one or more checks failed."
    return 1
  fi
  if ! wait_mergeable "$pr"; then
    log "Blocked: mergeability changed after checks."
    return 1
  fi

  log "Requesting squash merge for PR #$pr."
  if ! gh pr merge "$pr" --repo "$REPO" --squash --delete-branch; then
    log "Blocked: GitHub rejected the merge."
    return 1
  fi

  for ((i=1; i<=MAX_POLLS; i++)); do
    state="$(field "$pr" state)"
    merged_at="$(field "$pr" mergedAt)"
    if [[ "$state" == MERGED && -n "$merged_at" && "$merged_at" != null ]]; then
      log "Verified merged at $merged_at."
      MERGED+=("$pr")
      return 0
    fi
    sleep "$POLL_SECONDS"
  done
  log "Blocked: merge was not verifiable before timeout."
  return 1
}

main() {
  require_tools
  log "Starting sequential integration into $REPO:$BASE"
  for pr in "${PRS[@]}"; do
    if process_pr "$pr"; then
      log "PR #$pr complete."
    else
      BLOCKED+=("$pr")
      log "PR #$pr blocked; continuing safely."
    fi
  done
  log "REPORT: merged/verifiably merged: ${MERGED[*]:-none}"
  log "REPORT: blocked: ${BLOCKED[*]:-none}"
  if (("${#BLOCKED[@]}" > 0)); then
    log "INCOMPLETE: resolve blockers and rerun."
    exit 1
  fi
  log "SUCCESS: all five PRs are merged and verified."
}
main "$@"
