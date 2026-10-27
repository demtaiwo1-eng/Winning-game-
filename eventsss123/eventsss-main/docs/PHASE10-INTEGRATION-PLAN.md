# ESS Phase 10 — Integration Hardening and Regression Gate

## Goal

Create a repeatable gate for the current ESS API, web tests, production web build, and generated service worker. The gate is additive: it does not change API routes, business rules, Prisma schema, or migrations.

## Run locally

```bash
bash scripts/phase10-integration-gate.sh
```

The script requires Node.js 20+, npm dependencies already installed, and the existing workspace scripts. API checks run through `npm run check -w apps/api`; web tests run through `npm run test -w apps/web`; the web production build runs through `npm run build -w apps/web`. It then verifies that `apps/web/dist/sw.js` exists, is non-empty/plausibly sized, and does not contain an unfilled `__WB_MANIFEST` placeholder.

To also call the deployed staging endpoints, set real public staging URLs and enable the optional Phase 9 smoke test:

```bash
PHASE10_RUN_STAGING_SMOKE=1 \
API_BASE_URL="https://YOUR-STAGING-API" \
WEB_BASE_URL="https://YOUR-STAGING-WEB" \
bash scripts/phase10-integration-gate.sh
```

Do not use example domains. Do not put credentials or secrets in URLs. The staging option checks only `/health`, `/ready`, and the web root; it does not sign in or create financial transactions.

## CI

`.github/workflows/ess-phase10-integration-gate.yml` runs on pushes and pull requests to `main`, plus manual dispatch. It uses a placeholder `DATABASE_URL` for Prisma tooling. It does not start PostgreSQL and must not enable DB-dependent tests unless a real disposable test database is configured.

## Business-flow tap-through checklist

Automated checks do not replace staging/device testing. Record pass/fail and a redacted issue reference for each applicable flow:

- [ ] Sign up and sign in; verify each role sees only permitted screens and actions.
- [ ] Create an event, edit tasks, reload, and confirm saved data persists.
- [ ] Send and receive an event message; confirm notifications and authorization.
- [ ] Marketplace cart: add/update/remove items and verify server-side price/status revalidation.
- [ ] Checkout in provider test mode: success, pending, failure, cancellation, refresh/retry, and duplicate-click behavior.
- [ ] Verify webhook signature/replay handling and reconcile provider reference with ledger state.
- [ ] Booking escrow: hold, delivery confirmation, release/refund/dispute rules, and append-only ledger entries.
- [ ] Go offline, make eligible event/task/cart changes, reconnect, and verify ordered sync/conflict handling; confirm payment/checkout calls are never queued or cached.
- [ ] Guest check-in: online, offline pending state, reconnect, duplicate/replay behavior, and server confirmation.
- [ ] NFC/Bluetooth on supported hardware; test QR/manual fallback on unsupported hardware.
- [ ] Android/Capacitor app launch, login, offline resume, deep links, and PWA/service-worker update behavior.

Never use live payment credentials or real money for these tests. Do not record tokens, personal data, full payment payloads, or secrets in logs.

## Acceptance criteria

- API check succeeds; report exact passed/skipped counts.
- Web test suite succeeds.
- Web production build succeeds.
- Service worker artifact checks succeed.
- Optional staging smoke checks return 2xx when enabled.
- Business-flow checklist is completed in staging by a tester before claiming full end-to-end readiness.

## Explicit limits

This gate runs the existing automated tests and build; it does not create new authenticated browser-level tests and does not prove live payment, migration, database recovery, or physical-device behavior. Database-dependent API tests remain skipped unless a dedicated test database is provisioned and the project's DB-test switch is explicitly enabled.
