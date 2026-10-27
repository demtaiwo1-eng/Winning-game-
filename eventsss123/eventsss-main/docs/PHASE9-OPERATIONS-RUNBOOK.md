# ESS Phase 9 — Production Operations and Release Smoke Tests

## Purpose

Phase 9 adds a small, safe operational layer around the existing ESS application: a deployed-service smoke test, a manual staging smoke-test workflow, and a practical release/rollback runbook. It does not alter business routes, payment logic, Prisma schema, or existing migrations.

## Required staging variables

Configure these GitHub repository **Variables** (not secrets) before running the manual workflow:

- `ESS_STAGING_API_URL` — HTTPS base URL for the API, without `/health` or `/ready` suffixes.
- `ESS_STAGING_WEB_URL` — HTTPS base URL for the web app.

Do not put credentials, tokens, database URLs, or payment-provider secrets in these variables. The smoke test does not require authentication and must only be run against public health endpoints.

## Run from a terminal

```bash
API_BASE_URL="https://api.example.com" \
WEB_BASE_URL="https://app.example.com" \
bash scripts/phase9-production-smoke-test.sh
```

The script checks three endpoints:

1. `GET /health` — process liveness.
2. `GET /ready` — application/database readiness (the current API implementation executes `SELECT 1`).
3. `GET /` — web application root.

All endpoints must return HTTP 2xx. Redirects are followed, TLS verification remains enabled, request bodies are discarded, and no secrets are printed. The default request timeout is 15 seconds; set `SMOKE_TIMEOUT_SECONDS` to an integer from 1 to 120 to override it.

## Release sequence

1. Confirm the release commit and CI checks are green.
2. Confirm staging variables point to the intended staging deployment.
3. Review pending Prisma migrations and their SQL. Confirm a verified database backup and a tested restore procedure before applying production migrations.
4. Deploy the application artifact and migration using the platform's approved release procedure. This patch does not deploy either one automatically.
5. Run the smoke test against staging, then run the same check against production after release.
6. Verify login and role/ownership authorization, event creation, messaging, checkout with provider test keys in staging, webhook signature/replay handling, wallet/escrow invariants, offline sync, and NFC/Bluetooth on supported hardware.
7. Observe application logs and provider dashboards. Never paste access tokens, payment payloads, personal data, or environment values into issue logs.

## Rollback and incident handling

- If `/health` fails, check process/container status, deployment logs, and recent application changes.
- If `/health` passes but `/ready` fails, investigate database reachability, credentials, connection limits, and migration compatibility before retrying.
- If only the web check fails, verify the deployed web artifact, CDN/origin configuration, and service-worker asset paths.
- Roll back the application to the last known-good immutable artifact using the hosting platform's documented procedure. Do not run `git reset`, `git clean`, or destructive database commands as a production rollback.
- Database rollback is not automatically safe. Prefer a forward fix unless the migration has a reviewed, tested reversal and a verified backup/restore plan.
- For suspected payment inconsistency, stop repeated manual retries, preserve provider references and redacted logs, and reconcile against the provider before changing ledger state.

## Limits and acceptance criteria

- The smoke test confirms only reachability and 2xx responses from three endpoints; it is not an end-to-end test.
- A passing `/ready` check does not prove migration correctness or transaction integrity.
- Automated tests and staging checks do not replace a real backup restore drill, payment-provider verification, or supported-device NFC/Bluetooth testing.
- Acceptance: shell syntax check passes; API liveness, API readiness, and web root all return 2xx in staging; release owner records the commit, deployment artifact, migration state, smoke-test result, and rollback reference.
