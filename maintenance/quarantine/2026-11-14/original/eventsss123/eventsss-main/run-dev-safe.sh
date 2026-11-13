#!/usr/bin/env bash
set -Eeuo pipefail

echo "======================================"
echo "   DEVELOPMENT SERVER SAFE LAUNCHER"
echo "======================================"

# Ensure we are in the project directory.
if [ ! -f package.json ]; then
    echo "ERROR: package.json not found."
    echo "Open the project root and run this script again."
    exit 1
fi

echo "[1/4] Checking Node.js and npm..."
node --version
npm --version

echo
echo "[2/4] Checking package.json scripts..."

DEV_SCRIPT=$(node -e '
const p = require("./package.json");
console.log(p.scripts?.dev || "");
')

if [ -n "$DEV_SCRIPT" ]; then
    echo "Found npm dev script."
    echo "Starting with: npm run dev"
    exec npm run dev
fi

echo "No npm script named 'dev' was found."

echo
echo "[3/4] Searching for dev.safe.mjs..."

if [ -f "./dev.safe.mjs" ]; then
    echo "Found ./dev.safe.mjs"
    echo "Starting safe development entry point..."
    exec node ./dev.safe.mjs
fi

if [ -f "./scripts/dev.safe.mjs" ]; then
    echo "Found ./scripts/dev.safe.mjs"
    echo "Starting safe development entry point..."
    exec node ./scripts/dev.safe.mjs
fi

echo
echo "[4/4] Checking common development entry points..."

for file in dev.mjs server.mjs index.mjs; do
    if [ -f "./$file" ]; then
        echo "Found $file"
        echo "Starting with Node.js..."
        exec node "./$file"
    fi
done

echo
echo "ERROR: No usable development entry point was found."
echo
echo "Available package scripts:"
node -e '
const p = require("./package.json");
console.log(JSON.stringify(p.scripts || {}, null, 2));
'

echo
echo "Files matching development entry-point names:"
find . \
    -path './node_modules' -prune -o \
    -path './.git' -prune -o \
    -type f \( -name 'dev.safe.mjs' -o -name 'dev.mjs' \) \
    -print | head -30

echo
echo "No project files were modified except this launcher."
echo "Check the output above before configuring the missing entry point."
exit 1
