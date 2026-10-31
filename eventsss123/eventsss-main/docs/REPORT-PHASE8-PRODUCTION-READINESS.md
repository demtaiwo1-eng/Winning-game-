# EPHINTA Phase 8 — Quality Gate

## Delivered

- Canonical executable workflow: repository-root `.github/workflows/ephinta-phase8-quality-gate.yml`.
- Local full release gate: `scripts/verify-release-gates.sh`.
- CI runs in the actual application root, `eventsss123/eventsss-main`, and provisions an isolated PostgreSQL 16 service container.
- The gate validates Prisma, applies migrations only to the disposable CI database, runs API/web tests, database integration tests, Playwright browser journeys, and production builds.

## Run locally

Use a disposable PostgreSQL database only. Never point `DATABASE_URL_LOCAL` at Render production.

```bash
export DATABASE_URL_LOCAL='postgresql://USER:PASSWORD@localhost:5432/ephinta_test?schema=public'
bash scripts/verify-release-gates.sh
unset DATABASE_URL_LOCAL
```

The script requires Node.js 20+, npm dependencies, PostgreSQL client access through the app's Prisma tooling, and Playwright Chromium. It exits on the first failed gate and does not deploy or merge.

## Workflow placement

GitHub Actions discovers workflows only from the repository-root `.github/workflows` directory. The earlier application-nested workflow copy is not an active GitHub workflow. The canonical root workflow now invokes the real project script from the nested application directory and uses a disposable PostgreSQL 16 service.

## Safety and acceptance

- No production database URL is used by CI.
- No production migration, deployment, or destructive operation is performed by the quality gate.
- A passing CI run proves the automated checks for that commit only. It does not prove physical NFC/Bluetooth operation, live payment settlement, a production backup restore, or owner acceptance.
- Phase 8 CI sign-off requires a successful run on the latest main commit.
