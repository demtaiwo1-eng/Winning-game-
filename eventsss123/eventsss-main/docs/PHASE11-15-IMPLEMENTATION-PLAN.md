# ESS Phases 11-15 — Release Gates and Implementation Plan

## Scope

This bundle introduces an additive GitHub Actions release-gate workflow and a local validation script. It does not rewrite existing CI workflows, change application runtime code, deploy production, or claim hardware/provider certification.

## Phase 11 — Automated PostgreSQL integration gate

Implemented in `.github/workflows/ess-phase11-15-release-gates.yml`:

- Starts an isolated PostgreSQL 16 service for the job.
- Installs dependencies with `npm ci`.
- Validates the Prisma schema and generates the client.
- Applies migrations using the API workspace's `db:deploy` script.
- Runs `npm run test:db -w apps/api` with `RUN_DB_TESTS=1`.
- Runs web tests and production builds.

Acceptance criteria:

- Workflow completes on pull requests and pushes to `main`.
- Event and messaging database tests execute, not skip.
- Migration or integration failures fail the workflow.

## Phase 12 — End-to-end workflow confidence

The current API database integration tests exercise event creation, retry/idempotency, guest operations, RSVP, budget and access control; messaging has a separate DB integration test. This bundle makes those tests part of the automated gate. Expand these tests as product flows stabilize to cover registration/login, invitations, checkout, order/payment status and organizer/vendor workflows. Do not call these browser end-to-end tests; they are API/database integration tests.

Acceptance criteria:

- Each critical journey has a repeatable test with isolated test data.
- Ownership and cross-user access restrictions are asserted.
- Failure and retry cases assert persisted state, not only HTTP status.

## Phase 13 — Security and financial integrity

The gate runs existing auth, role authorization, escrow policy, payment-provider and webhook verification suites. Add focused regression tests whenever a security defect is fixed. At minimum verify authentication requirements, ownership boundaries, webhook signatures/replay protection, idempotent ledger writes, currency/amount validation, and rejection of demo payment flows in production mode.

Acceptance criteria:

- Negative authorization tests prove another user cannot read or mutate protected resources.
- Duplicate webhook delivery does not duplicate financial effects.
- Production configuration cannot enable test/demo payment success paths.

## Phase 14 — Mobile, PWA and offline workflows

The gate runs the existing web regression suite and production PWA build. Continue validating offline policy/outbox behavior, service-worker caching and installability. Browser-level tests and physical NFC/Bluetooth checks remain follow-up work: browser capability checks and unit tests alone do not prove hardware operation.

Acceptance criteria:

- Offline queue only contains explicitly allowed operations.
- Authentication and financial mutations are not replayed blindly from an offline outbox.
- PWA build and service-worker generation succeed.
- Supported devices are tested manually or in device labs for NFC/Bluetooth.

## Phase 15 — Staging and production release

`scripts/phase15-staging-smoke.sh` checks the staging `/health` and `/ready` endpoints over HTTPS. Set `ESS_STAGING_BASE_URL` to the staging origin before running it. This is a public health smoke test, not an authenticated browser journey.

This patch deliberately does not deploy production. Before release, configure a staging environment with managed PostgreSQL, TLS, secure secrets, payment-provider sandbox credentials, backups and monitoring. Run smoke tests against staging, verify migrations and rollback/restore procedures, then require human approval before production deployment.

Minimum release checklist:

- [ ] Staging deployment succeeds from a pinned commit.
- [ ] `/health` and `/ready` report expected status.
- [ ] Authenticated organizer and guest flows pass in staging.
- [ ] Payment-provider sandbox checkout and signed webhooks pass.
- [ ] Backup restore and migration recovery are rehearsed.
- [ ] Logging and alerting contain no secrets or payment credentials.
- [ ] HTTPS, allowed origins, rate limits and production secrets are verified.
- [ ] Production release has an explicit owner and rollback decision.

## Local use

From the repository root, set a disposable test database `DATABASE_URL`, then run:

```bash
bash scripts/phase11-15-local-gate.sh
```

The script applies migrations to the database named in `DATABASE_URL`. Use only a disposable development/test database, never production.

## Important boundaries

- The workflow tests the application against PostgreSQL in CI; it does not require Docker to be installed in the developer's Codespace.
- CI secrets in the workflow are disposable test-only values, not production credentials.
- A green workflow does not certify live payments, production deployment, load capacity, regulatory compliance, or NFC/Bluetooth hardware.
