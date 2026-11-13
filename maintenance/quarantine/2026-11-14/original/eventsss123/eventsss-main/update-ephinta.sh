#!/usr/bin/env bash

set -Eeuo pipefail

echo "========================================"
echo "       EPHINTA BUILD & DEPLOYMENT"
echo "========================================"

# Confirm that we are in the project root.
if [[ ! -f package.json ]]; then
  echo "ERROR: package.json not found."
  echo "Run this script from the Ephinta source-code folder."
  exit 1
fi

# Check required tools.
for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $cmd is not installed."
    exit 1
  fi
done

echo
echo "[1/6] Checking environment..."
node --version
npm --version

# Install dependencies reproducibly when a lockfile exists.
echo
echo "[2/6] Installing dependencies..."

if [[ -f package-lock.json ]]; then
  npm ci
else
  echo "No package-lock.json found; using npm install."
  npm install
fi

# Read available project scripts.
HAS_BUILD=$(node -e \
  "console.log(Boolean(require('./package.json').scripts?.build))")

HAS_TEST=$(node -e \
  "console.log(Boolean(require('./package.json').scripts?.test))")

HAS_LINT=$(node -e \
  "console.log(Boolean(require('./package.json').scripts?.lint))")

echo
echo "[3/6] Running available quality checks..."

if [[ "$HAS_LINT" == "true" ]]; then
  npm run lint
else
  echo "SKIP: No lint script configured."
fi

if [[ "$HAS_TEST" == "true" ]]; then
  npm test
else
  echo "SKIP: No test script configured."
fi

echo
echo "[4/6] Building production application..."

if [[ "$HAS_BUILD" != "true" ]]; then
  echo "ERROR: No build script exists in package.json."
  exit 1
fi

npm run build

# Identify common output directories.
BUILD_DIR=""

for dir in dist build www; do
  if [[ -d "$dir" ]]; then
    BUILD_DIR="$dir"
    break
  fi
done

if [[ -z "$BUILD_DIR" ]]; then
  echo "ERROR: Build completed, but no recognized output directory exists."
  echo "Check the build configuration before deploying."
  exit 1
fi

if [[ -z "$(find "$BUILD_DIR" -type f -print -quit)" ]]; then
  echo "ERROR: The build output directory is empty."
  exit 1
fi

echo "Build output verified: $BUILD_DIR"

echo
echo "[5/6] Checking deployment configuration..."

if [[ -z "${DEPLOY_DIR:-}" ]]; then
  echo "BUILD SUCCESSFUL."
  echo "Deployment skipped because DEPLOY_DIR is not configured."
  echo "Set DEPLOY_DIR to your actual web hosting deployment directory."
  echo
  echo "IMPORTANT: This does not update installed APKs."
  exit 0
fi

if [[ ! -d "$DEPLOY_DIR" ]]; then
  echo "ERROR: Deployment directory does not exist:"
  echo "$DEPLOY_DIR"
  exit 1
fi

# Refuse dangerous deployment targets.
SOURCE="$(cd "$BUILD_DIR" && pwd -P)"
TARGET="$(cd "$DEPLOY_DIR" && pwd -P)"

if [[ "$TARGET" == "/" || "$TARGET" == "$HOME" ||
      "$TARGET" == "$SOURCE" ]]; then
  echo "ERROR: Unsafe or invalid deployment destination."
  exit 1
fi

echo
echo "[6/6] Deploying built web files..."

# Replace only the contents of the explicitly configured target.
find "$TARGET" -mindepth 1 -maxdepth 1 \
  -exec rm -rf -- {} +

cp -a "$SOURCE"/. "$TARGET"/

echo
echo "========================================"
echo "DEPLOYMENT COMPLETED"
echo "========================================"
echo "Build source: $SOURCE"
echo "Deployment:   $TARGET"
echo
echo "Verify the live website and test the app."
echo "Existing APKs update only if they load this"
echo "hosted application and refresh its content."
