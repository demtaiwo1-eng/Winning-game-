# ESS Phase 8 — Production Readiness Gate

## Goal

Add a repeatable release gate for the existing ESS API, web client, Prisma migrations, and Workbox service worker without rewriting application features from earlier phases.

## Delivered

- `scripts/phase8-release-gate.sh`: local checks for Node.js 20+, repository prerequisites, Prisma migration file structure, API checks, web tests, production build, and generated service-worker integrity.
- `.github/workflows/ess-phase8-quality-gate.yml`: CI quality gate on pull requests and pushes to `main`.
- Test-only environment defaults are provided only for the current process; `.env` files are not edited and secrets are not printed.

## Safety boundaries

- The gate does not deploy database migrations.
- The gate does not run destructive database commands.
- Two database-dependent API tests may remain skipped unless a real test database and the project's DB-test configuration are supplied.
- Passing CI does not replace staging verification of authentication, payment providers/webhooks, database migrations, NFC/Bluetooth hardware, or offline synchronization across multiple devices.
- Review Prisma migration SQL and confirm a database backup before deploying migrations in a shared or production environment.

## Run locally

```bash
bash scripts/phase8-release-gate.sh
```

## Acceptance criteria

1. API schema validation, TypeScript checks, and API tests pass.
2. Web tests pass.
3. Production web build succeeds.
4. `apps/web/dist/sw.js` exists, is non-empty and larger than 1,000 bytes, and does not retain the Workbox injection placeholder.
5. Every Prisma migration directory contains a non-empty `migration.sql` file.

## Status

This patch adds a release-quality gate and CI workflow. Its checks must be run in the target Codespace and CI before Phase 8 is marked validated. It does not assert that migrations are deployed or that hardware integration has been physically tested.
