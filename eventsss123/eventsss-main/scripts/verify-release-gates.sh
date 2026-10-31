#!/usr/bin/env bash
# Safe, repeatable local release gate for EPHINTA.
# Never skips failed checks, changes production data, or deploys.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 20+ is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 20) process.exit(1)' \
  || fail "Node.js 20 or newer is required."

[[ -f package-lock.json ]] || fail "Run this from a complete EPHINTA checkout with package-lock.json."
[[ -n "${DATABASE_URL_LOCAL:-}" ]] || fail "Set DATABASE_URL_LOCAL to a disposable local/test PostgreSQL database. Never point this script at production."

export NODE_ENV=test
export DATABASE_MODE=local
export DATABASE_URL="${DATABASE_URL_LOCAL}"
export JWT_SECRET="${JWT_SECRET:-local-only-test-secret-change-this-1234567890}"
export RUN_DB_TESTS=1

printf '\n==> Validate Prisma schema and generate client\n'
npx prisma validate --schema apps/api/prisma/schema.prisma
npm run prisma:generate

printf '\n==> Apply migrations to the configured disposable database\n'
npm run db:deploy -w apps/api

printf '\n==> Run API checks and web unit/regression tests\n'
npm run check

printf '\n==> Run API database integration tests\n'
npm run test:db -w apps/api

printf '\n==> Ensure Playwright Chromium is installed\n'
npx playwright install chromium

printf '\n==> Run browser journeys\n'
npm run test:e2e -w apps/web

printf '\n==> Build web and API production artifacts\n'
npm run build:web
npm run build -w apps/api

printf '\nSUCCESS: every configured EPHINTA verification gate passed. No deploy or merge was performed.\n'
