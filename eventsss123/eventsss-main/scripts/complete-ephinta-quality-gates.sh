#!/usr/bin/env bash
# Full EPHINTA engineering + frontend completion gate.
# Runs every available automated check; never suppresses or converts failures to passes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REPORT_DIR="${EPHINTA_QA_REPORT_DIR:-$ROOT/artifacts/quality-gate}"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/quality-gate.txt"
: > "$REPORT"
FAILURES=0
TOTAL=0

record() { printf '%s\n' "$*" | tee -a "$REPORT"; }
run_gate() {
  local label="$1"; shift
  TOTAL=$((TOTAL + 1))
  record ""
  record "===== $label ====="
  if "$@" 2>&1 | tee -a "$REPORT"; then
    record "PASS: $label"
  else
    local status=${PIPESTATUS[0]:-1}
    FAILURES=$((FAILURES + 1))
    record "FAIL: $label (exit $status)"
  fi
}

record "EPHINTA COMPLETE ENGINEERING AND FRONTEND QUALITY GATE"
record "UTC: $(date -u +%FT%TZ)"
record "Commit: ${GITHUB_SHA:-local}"
record "This report records actual command outcomes. No skipped or unavailable check is counted as a pass."

if [[ ! -f package-lock.json ]]; then
  record "FATAL: package-lock.json missing; run from eventsss123/eventsss-main."
  exit 2
fi

run_gate "Install locked workspace dependencies" npm ci
# The API startup runs ensureReferenceData(), which requires the migrated schema.
# Browser suites need the same disposable PostgreSQL schema as the dedicated E2E workflow.
run_gate "Apply Prisma migrations to disposable CI database" npm run db:deploy
run_gate "API, frontend unit tests and KYC research checks" npm run check
run_gate "Frontend static design-system audit" npm run design:audit:strict -w apps/web
run_gate "Responsive UX browser audit" npm run ux:audit
run_gate "Audio platform and consent verification" npm run audio:verify -w apps/web
run_gate "Device security full verification" npm run device-security:verify:full
run_gate "Production web build" npm run build:web

# Exercise all configured Playwright projects (desktop and mobile).
run_gate "Full browser user journeys (desktop + mobile)" npm run test:e2e -w apps/web

# Build, lint and unit-test Android. This is a debug/test artifact, not a release-signed APK.
run_gate "Android mobile verification (lint, unit tests, debug APK)" npm run mobile:verify

record ""
record "===== SUMMARY ====="
record "Gates attempted: $TOTAL"
record "Failures: $FAILURES"
if (( FAILURES > 0 )); then
  record "RESULT: FAILED — fix each FAIL entry and rerun. No production-ready claim is permitted."
  exit 1
fi
record "RESULT: ALL AUTOMATED REPOSITORY GATES PASSED."
record "External production requirements (live payments, database restore/durability, DSP revenue and rights-owner payouts, original-key release signing, physical-device testing) remain separately gated by the production finalizer."
