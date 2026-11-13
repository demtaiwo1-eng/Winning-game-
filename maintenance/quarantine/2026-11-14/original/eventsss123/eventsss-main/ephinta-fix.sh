#!/usr/bin/env bash

# EPHINTA: persistent-error-handling update workflow
# Designed for GitHub Codespaces.

set -Eeuo pipefail

CURRENT_STEP="Starting"
PAUSE_ON_EXIT=1

pause_terminal() {
  if [[ "${PAUSE_ON_EXIT}" == "1" ]] && [[ -t 0 ]]; then
    echo
    read -r -p "Press ENTER to close this script and return to the terminal..." \
      || true
  elif [[ -e /dev/tty ]]; then
    echo
    read -r -p "Press ENTER to continue..." </dev/tty || true
  fi
}

on_error() {
  local code=$?
  trap - ERR
  echo
  echo "=================================================="
  echo "EPHINTA STOPPED WITH AN ERROR"
  echo "Step: ${CURRENT_STEP}"
  echo "Exit code: ${code}"
  echo "Line: ${BASH_LINENO[0]:-unknown}"
  echo "The terminal should remain available."
  echo "Fix the reported problem and rerun the script."
  echo "=================================================="
  pause_terminal
  exit "$code"
}

trap on_error ERR

step() {
  CURRENT_STEP="$1"
  echo
  echo "=================================================="
  echo "$CURRENT_STEP"
  echo "=================================================="
}

# 1. Check project and tools.
step "Checking the current project and required tools"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Open the EPHINTA repository in Codespaces first."
  echo "Navigate to the repository directory and run this script again."
  exit 1
fi

for cmd in git gh node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Missing required tool: $cmd"
    exit 1
  fi
done

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: Codex CLI is not installed or is not in PATH."
  echo "Install and authenticate Codex before rerunning."
  exit 1
fi

echo "Repository: $(git rev-parse --show-toplevel)"
echo "Branch: $(git branch --show-current)"
git remote -v

step "Checking GitHub access"

gh auth status

step "Checking Codex authentication"

codex login status

step "Checking source project"

if [[ ! -f package.json ]]; then
  echo "ERROR: package.json was not found in this directory."
  echo "This script expects the EPHINTA web/Capacitor project root."
  echo "Do not run it from a directory containing only the APK."
  exit 1
fi

if [[ ! -f /tmp/ephinta-fix-instructions.md ]]; then
  cat > /tmp/ephinta-fix-instructions.md <<'PROMPT'
Inspect and repair the existing EPHINTA application source code.

1. Remove the duplicate dark Create Your Workspace registration dialogue,
   preserving one complete and functional registration form.
2. Fix the missing onLoginSuccess handler. After authentication, load the
   real user profile and route according to the actual role and account state.
3. Executive planners must complete the required questionnaire and KYC.
   Enforce KYC permissions server-side. Pending users must not be marked
   verified. Other roles must reach their correct dashboards.
4. Audit every event-planning button and route it to the existing event
   questionnaire wizard, not the splash/logo screen. Preserve intended
   destinations through authentication.
5. Repair marketplace, persistent cart, checkout and payment integration
   using the actual configured backend and provider. Verify payments using
   trusted server callbacks/webhooks. Never fake payment success.
6. Improve light-theme contrast to WCAG AA targets while preserving the
   dark theme and brand identity.
7. Prevent route loops, duplicate navigation, unauthorized access and
   KYC bypasses. Reuse existing architecture and APIs.
8. Add appropriate tests. Run available tests, linting and builds.
9. Inspect the real Android build configuration. If Capacitor is used,
   build web assets and sync Android as appropriate, then build the APK
   with the existing Gradle wrapper.
10. Summarize modified files, tests, build results and blockers.

Do not fabricate endpoints, roles, secrets, payment settings or verification
results. Do not remove unrelated functionality. Do not deploy to production.
Make actual source-code changes, not just recommendations.
PROMPT
fi

step "Preparing a feature branch"

BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  BRANCH="fix/ephinta-auth-navigation-accessibility"

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git switch "$BRANCH"
  else
    git switch -c "$BRANCH"
  fi
else
  echo "Keeping existing working branch: $BRANCH"
fi

echo "Changes already in your working tree will be preserved."
git status --short

step "Running Codex to implement the requested corrections"

codex exec --full-auto "$(cat /tmp/ephinta-fix-instructions.md)"

step "Installing dependencies"

if [[ -f pnpm-lock.yaml ]]; then
  command -v pnpm >/dev/null 2>&1 || {
    echo "Install pnpm, then rerun this script."
    exit 1
  }
  pnpm install --frozen-lockfile
  PM="pnpm"
elif [[ -f yarn.lock ]]; then
  command -v yarn >/dev/null 2>&1 || {
    echo "Install the Yarn version required by this project."
    exit 1
  }
  yarn install --frozen-lockfile
  PM="yarn"
elif [[ -f package-lock.json ]]; then
  npm ci
  PM="npm"
else
  echo "No recognized lockfile. Inspect dependencies before installing."
  exit 1
fi

step "Running available project checks"

if node -e "process.exit(require('./package.json').scripts?.lint ? 0 : 1)"
then
  "$PM" run lint
else
  echo "No lint script configured; skipping."
fi

if node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)"
then
  echo "Running the configured test command."
  "$PM" test
else
  echo "No test script configured; skipping."
fi

if node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"
then
  "$PM" run build
else
  echo "ERROR: No build script is configured."
  exit 1
fi

step "Synchronizing Capacitor if this project uses it"

if [[ -d android ]] &&
   node -e "process.exit(require('./package.json').dependencies?.['@capacitor/core'] || require('./package.json').devDependencies?.['@capacitor/core'] ? 0 : 1)"
then
  if node -e "process.exit(require('./package.json').scripts?.['cap:sync'] ? 0 : 1)"
  then
    "$PM" run cap:sync
  elif node -e "process.exit(require('./package.json').scripts?.['android:sync'] ? 0 : 1)"
  then
    "$PM" run android:sync
  elif [[ -x node_modules/.bin/cap ]]; then
    npx cap sync android
  else
    echo "ERROR: Capacitor sync command is unavailable."
    exit 1
  fi
fi

step "Building Android debug APK"

if [[ -x android/gradlew ]]; then
  (
    cd android
    ./gradlew assembleDebug
  )
elif [[ -f android/gradlew ]]; then
  chmod +x android/gradlew
  (
    cd android
    ./gradlew assembleDebug
  )
elif [[ -x gradlew ]]; then
  ./gradlew assembleDebug
else
  echo "ERROR: No Gradle wrapper found."
  echo "Inspect the project's actual Android build configuration."
  exit 1
fi

APK=""
for candidate in \
  android/app/build/outputs/apk/debug/app-debug.apk \
  app/build/outputs/apk/debug/app-debug.apk
do
  if [[ -f "$candidate" ]]; then
    APK="$candidate"
    break
  fi
done

if [[ -z "$APK" ]]; then
  echo "ERROR: Build completed but the expected APK was not found."
  exit 1
fi

APK="$(realpath "$APK")"
echo "APK successfully located: $APK"
ls -lh "$APK"

step "Reviewing changes before creating a pull request"

git diff --check

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No changes detected. Review the Codex output."
  exit 1
fi

git status --short
git diff --stat

echo
echo "Inspect the changed files for secrets or unrelated changes."
echo "The APK will not be committed to the source repository."

git add -u
git add .

git diff --cached --check

git commit -m "Fix EPHINTA authentication, onboarding and navigation"

step "Pushing the feature branch"

BRANCH="$(git branch --show-current)"
git push -u origin "$BRANCH"

step "Creating or reusing the pull request"

if gh pr view "$BRANCH" >/dev/null 2>&1; then
  gh pr view "$BRANCH" --web
else
  gh pr create \
    --base main \
    --head "$BRANCH" \
    --title "Fix EPHINTA authentication, onboarding and navigation" \
    --body "Fix registration UI, authentication routing, role-specific onboarding, KYC gating, event-planning navigation, marketplace/payment flows, and light-theme contrast. Review CI results and backend configuration before merging."
fi

step "EPHINTA workflow finished"

echo "Source branch: $BRANCH"
echo "APK: $APK"
echo "Pull request: check the URL printed above."
echo
echo "Production deployment has NOT been triggered."
echo "Merge only after review and required CI checks."
echo "Configure the approved production deployment workflow separately."

pause_terminal
