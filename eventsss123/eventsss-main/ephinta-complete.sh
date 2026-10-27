#!/usr/bin/env bash
set -Eeuo pipefail

# EPHINTA COMPLETE FIX + VERIFY + APK + PULL REQUEST
# Run from the EPHINTA repository root.

LOG="$PWD/ephinta-run.log"
CURRENT_STEP="Initial checks"
PAUSE_ON_ERROR=1

exec > >(tee -a "$LOG") 2>&1

pause_if_possible() {
  if [[ "$PAUSE_ON_ERROR" == "1" && -t 0 ]]; then
    echo
    read -r -p "Press ENTER to return to the terminal..." || true
  fi
}

handle_error() {
  local rc=$?
  trap - ERR
  echo
  echo "FAILED STEP: $CURRENT_STEP"
  echo "EXIT CODE: $rc"
  echo "LOG FILE: $LOG"
  echo "Your terminal session has not been intentionally closed."
  pause_if_possible
  exit "$rc"
}
trap handle_error ERR

step() {
  CURRENT_STEP="$1"
  echo
  echo "===================================================="
  echo "$CURRENT_STEP"
  echo "===================================================="
}

# 1. Verify repository.
step "Checking EPHINTA repository"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Open the EPHINTA repository root in Codespaces and retry."
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "Root package.json is missing. Wrong project directory."
  exit 1
fi

echo "Repository: $ROOT"
echo "Current branch: $(git branch --show-current)"

# 2. Verify tools and authentication.
step "Checking required tools"

for cmd in git gh node npm codex; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd"
    echo "Install/authenticate the tool and rerun this script."
    exit 1
  fi
done

gh auth status
codex login status

# 3. Ensure the project's own mobile scripts exist.
step "Checking EPHINTA build commands"

node <<'NODE'
const p = require("./package.json");
const required = ["build:web", "mobile:verify", "mobile:build"];
const missing = required.filter(x => !p.scripts || !p.scripts[x]);

console.log("Detected project scripts:");
for (const x of required) {
  console.log(`${x}: ${p.scripts?.[x] || "MISSING"}`);
}

if (missing.length) {
  console.error("Missing required scripts:", missing.join(", "));
  process.exit(1);
}
NODE

# 4. Use a feature branch; preserve an existing feature branch.
step "Preparing the working branch"

BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  BRANCH="fix/ephinta-auth-onboarding-marketplace"

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git switch "$BRANCH"
  else
    git switch -c "$BRANCH"
  fi
fi

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "Refusing to make changes directly on the main branch."
  exit 1
fi

echo "Working branch: $BRANCH"
git status --short

# 5. Install dependencies if necessary.
step "Checking dependencies"

if [[ ! -d node_modules ]]; then
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    echo "No root package-lock.json. Install dependencies using the"
    echo "repository's documented package manager before continuing."
    exit 1
  fi
else
  echo "Root node_modules exists."
fi

# 6. Give Codex the complete application task.
step "Implementing the EPHINTA corrections"

cat > /tmp/ephinta-complete-prompt.txt <<'PROMPT'
Work directly on the existing EPHINTA monorepo. Implement and test the
requested corrections in the real source files. Do not merely explain
what should be done.

First inspect the repository architecture, existing routes, components,
API endpoints, database models, authentication provider, payment provider,
tests, and CI/CD workflows. Reuse existing implementations.

A. REGISTRATION UI
Find the two overlapping Create Account/Create Your Workspace dialogues.
Remove the redundant component and duplicate event handlers. Preserve one
fully functional, scrollable registration form with working validation,
password visibility, and role selection.

B. AUTHENTICATION
Fix the missing onLoginSuccess handler and all relevant authentication
success paths. Load the authoritative user profile and account status,
then navigate exactly once to the correct next step. Handle expired sessions,
failed authentication, incomplete profiles, and network errors. Never show
a success message without actually completing the corresponding operation.

C. ROLE-BASED ONBOARDING AND KYC
Use the real role definitions. Executive planners must complete their
required questionnaire and KYC before accessing protected executive features.
Save progress and allow users to resume incomplete onboarding. Pending KYC
must remain pending; only authoritative verification can approve an account.
Other roles must follow their own existing onboarding and dashboard flows.
Enforce authorization on the backend as well as in the frontend.

D. EVENT PLANNING
Audit every event-planning CTA, button, card, shortcut, and menu action.
Route it to the existing questionnaire wizard, never the splash/logo screen.
Preserve intended destinations through login, and resume saved drafts when
supported. Do not unnecessarily replace or rebuild the existing wizard.

E. MARKETPLACE, CART AND PAYMENT
Repair the real marketplace-to-cart-to-checkout flow. Preserve cart contents
through login and recoverable payment failures. Validate order prices and
permissions server-side. Use the configured payment provider and trusted
server-side confirmation/webhooks. Handle failed, pending, cancelled, and
successful payments safely. Never fabricate payment success or KYC approval.

F. THEME AND ACCESSIBILITY
Improve light-theme text and control contrast to WCAG AA targets: 4.5:1
for normal text and 3:1 for large text and applicable UI components.
Preserve brand styling and the working dark theme. Fix shared theme tokens
and actual affected components rather than applying a superficial global CSS
override.

G. ROUTING AND SECURITY
Prevent redirect loops, duplicate navigation, stale session routing, and
direct URL bypasses of required onboarding or KYC. Keep secrets out of
client code and logs. Preserve unrelated working functionality.

H. TESTS AND DELIVERY
Add/update tests for the corrected flows. Run the available checks and
inspect all changes. Report actual results and blockers. Fix errors caused
by your changes. Do not claim success for unexecuted tests.

Do not invent API endpoints, credentials, user roles, provider integrations,
database schemas, or production configuration. If a necessary backend
capability is missing, implement what the existing architecture safely
supports and document the precise blocker.

Do not deploy to production, auto-merge, or weaken security to make a test
pass. Make real source-code changes in this repository.
PROMPT

codex exec --full-auto "$(cat /tmp/ephinta-complete-prompt.txt)"

# 7. Review changes and check for accidental secrets.
step "Reviewing implementation changes"

git diff --check
git status --short
git diff --stat

echo
echo "Checking changed files for common secret filenames..."
git status --short --untracked-files=all |
  grep -E '(^|/)\.env($|\.)|\.keystore$|\.jks$|service-account.*\.json$' \
  || true

echo
echo "Inspect the diff before publishing if it contains unrelated changes."

# 8. Run the repository's verification workflow.
step "Running EPHINTA mobile verification"

npm run mobile:verify

# 9. Build the APK using the repository's actual build command.
step "Building EPHINTA Android debug APK"

npm run mobile:build

# 10. Locate the APK.
step "Locating the generated APK"

APK=""

for dir in \
  apps/mobile/android/app/build/outputs/apk/debug \
  apps/mobile/android/app/build/outputs/apk \
  apps/mobile
do
  if [[ -d "$dir" ]]; then
    FOUND="$(find "$dir" -type f -name '*.apk' -print -quit)"
    if [[ -n "$FOUND" ]]; then
      APK="$FOUND"
      break
    fi
  fi
done

if [[ -z "$APK" ]]; then
  echo "No APK found. Review the mobile:build output."
  exit 1
fi

mkdir -p "$ROOT/artifacts"
cp "$APK" "$ROOT/artifacts/ephinta-debug.apk"

echo "APK created: $ROOT/artifacts/ephinta-debug.apk"
ls -lh "$ROOT/artifacts/ephinta-debug.apk"

# 11. Check changes before committing.
step "Preparing changes for GitHub"

git diff --check

# Do not commit APKs, local environment files, signing keys or build output.
git add -A -- . \
  ':!*.apk' \
  ':!**/*.apk' \
  ':!artifacts/**' \
  ':!.env' \
  ':!.env.*' \
  ':!**/.env' \
  ':!**/.env.*' \
  ':!*.jks' \
  ':!*.keystore' \
  ':!**/*.jks' \
  ':!**/*.keystore' \
  ':!apps/mobile/android/app/build/**'

git diff --cached --check

if git diff --cached --quiet; then
  echo "No staged source changes found."
  echo "Review the Codex output and Git status before proceeding."
  exit 1
fi

git diff --cached --stat

# 12. Commit only after checks and APK build have succeeded.
step "Committing verified source changes"

git commit -m \
  "Fix EPHINTA authentication onboarding and event navigation"

# 13. Push and open/reuse the PR.
step "Publishing feature branch and pull request"

git push -u origin "$BRANCH"

if gh pr view "$BRANCH" >/dev/null 2>&1; then
  echo "Pull request already exists:"
  gh pr view "$BRANCH" --json url --jq .url
else
  gh pr create \
    --base main \
    --head "$BRANCH" \
    --title "Fix EPHINTA authentication, onboarding and navigation" \
    --body "$(cat <<'BODY'
## Changes
- Remove duplicate registration dialogue.
- Fix successful-login handling and role-aware routing.
- Enforce questionnaire completion and KYC requirements.
- Route event-planning actions to the questionnaire wizard.
- Repair marketplace/cart/payment behavior where supported.
- Improve light-theme contrast while preserving dark mode.

## Validation
Review the actual mobile verification and APK build results.
Confirm server-side permissions, KYC verification, payment webhooks,
and production configuration before deployment.

## Release
Requires review and passing repository checks before merging.
BODY
)"
fi

# 14. Finish without closing the interactive terminal.
step "WORKFLOW COMPLETED"

echo "Branch: $BRANCH"
echo "APK: $ROOT/artifacts/ephinta-debug.apk"
echo "Pull request:"

gh pr view "$BRANCH" --json url --jq .url || true

echo
echo "Log: $LOG"
echo "Production deployment was not triggered."
echo "Use the repository's approved production release workflow after review."

PAUSE_ON_ERROR=0
echo "All configured steps completed."
