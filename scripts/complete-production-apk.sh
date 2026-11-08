#!/usr/bin/env bash
# EPHINTA: complete the GitHub-only production APK signing and build handoff.
# Run from the repository root in the dedicated GitHub Codespace:
#   bash scripts/complete-production-apk.sh
#
# This script never prints secrets, commits signing material, or uploads a
# keystore to the repository. It delegates key creation to the reviewed
# setup-android-signing-github.sh script, then dispatches the production build.

set -Eeuo pipefail
set +x

REPO="demtaiwo1-eng/winning-game-"
WORKFLOW=".github/workflows/ephinta-production-apk.yml"
SETUP="scripts/setup-android-signing-github.sh"
BACKUP="$HOME/.ephinta-android-signing/ephinta-release.jks.enc"
BACKUP_SHA256="$BACKUP.sha256"

fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
step() { printf '\n===== %s =====\n' "$*"; }

command -v gh >/dev/null || fail "GitHub CLI is unavailable. Open this repository in GitHub Codespaces."
command -v git >/dev/null || fail "Git is unavailable."
command -v keytool >/dev/null || fail "Java keytool is unavailable in this Codespace."
command -v openssl >/dev/null || fail "OpenSSL is unavailable."
git rev-parse --show-toplevel >/dev/null 2>&1 || fail "Run this script from inside the repository."
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

step "1/5 — Check repository and branch"
CURRENT_REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
[[ "${CURRENT_REPO,,}" == "${REPO,,}" ]] || fail "Wrong repository. Expected $REPO, found $CURRENT_REPO."
CURRENT_BRANCH="$(git branch --show-current)"
[[ -n "$CURRENT_BRANCH" ]] || fail "Could not determine the current Git branch."
[[ -f "$WORKFLOW" ]] || fail "Production workflow is missing: $WORKFLOW"
[[ -z "$(git status --porcelain)" ]] || fail "Commit or discard local changes before dispatching the production workflow."
git ls-remote --exit-code origin "refs/heads/$CURRENT_BRANCH" >/dev/null 2>&1 || fail "The current branch is not available on origin. Push it before dispatching the workflow."
[[ -f "$SETUP" ]] || fail "Signing setup script is missing: $SETUP"
gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated. Run gh auth login and authorize repository access."

step "2/5 — Inspect signing configuration without revealing values"
SECRET_LIST="$(gh api --paginate "repos/$REPO/actions/secrets" --jq '.secrets[].name')"
required=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD ANDROID_KEY_ALIAS)
present=0
missing=()
for name in "${required[@]}"; do
  if grep -Fxq "$name" <<<"$SECRET_LIST"; then
    ((present+=1))
  else
    missing+=("$name")
  fi
done

if (( present == 0 )); then
  step "3/5 — Create the permanent release key and configure GitHub secrets"
  bash "$SETUP"
elif (( present != ${#required[@]} )); then
  fail "Only some signing secrets exist. For safety, this script will not replace or rotate a partially configured key. Ask a repository admin to repair the missing secret names: ${missing[*]}"
else
  printf 'All four signing secret names are present. Values were not read or displayed.\n'
fi

VARIABLES="$(gh api --paginate "repos/$REPO/actions/variables" --jq '.variables[].name')"
grep -Fxq "ANDROID_CERT_SHA256" <<<"$VARIABLES" || fail "ANDROID_CERT_SHA256 repository variable is missing. Run the approved signing setup script or ask a repository admin to configure it."

step "4/5 — Require a recoverable encrypted keystore backup"
[[ -s "$BACKUP" && -s "$BACKUP_SHA256" ]] || fail "Encrypted recovery backup and checksum were not found at $BACKUP. Run the signing setup and download both files before proceeding."
(cd "$(dirname "$BACKUP")" && sha256sum -c "$(basename "$BACKUP_SHA256")" >/dev/null) || fail "Encrypted keystore backup checksum verification failed."
printf 'Encrypted backup exists. Keep it private and retain the keystore password in your password manager.\n'
printf '\nHave you downloaded the encrypted backup from Codespaces and stored it somewhere safe?\n'
read -r -p 'Type YES to confirm: ' backup_confirm
[[ "$backup_confirm" == "YES" ]] || fail "Not confirmed. Stop here, download and safely store the encrypted backup, then rerun."

step "5/5 — Start production APK build"
gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$CURRENT_BRANCH"
sleep 3
RUN_ID="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch "$CURRENT_BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId')"
[[ -n "$RUN_ID" && "$RUN_ID" != "null" ]] || fail "Workflow was dispatched, but its run ID could not be retrieved. Open GitHub Actions and inspect the latest EPHINTA Production-Signed Android APK run."
printf 'Workflow run: %s\n' "$RUN_ID"
printf 'Opening live run status. This may take several minutes.\n'
gh run watch "$RUN_ID" --repo "$REPO" --exit-status

printf '\nSUCCESS: The production workflow completed successfully.\n'
printf 'Open the run in GitHub Actions and download the ephinta-production-signed-apk artifact.\n'
printf 'Confirm the artifact contains ephinta-production.apk, ephinta-production.aab and SHA256SUMS.txt.\n'
