# EPHINTA final acceptance checklist — 2026-11-07

This checklist separates work that can be automated in GitHub from work that requires the repository owner, a provider account, a real device, or an isolated database. Do not mark a gate complete without its evidence.

## GitHub / CI

- [ ] Merge the final acceptance PR only after review and all required checks pass.
- [ ] Confirm the current `main` head has successful API, web, PostgreSQL integration, browser, design-system, Android build, and Android emulator jobs.
- [ ] Confirm the iOS Simulator workflow builds and uploads the unsigned `.app` artifact.
- [ ] Confirm branch cleanup deletes only refs with zero commits ahead of `main`; retain unique work and open-PR branches.
- [ ] Inspect the OPay collection branch's unique commits before any deletion or cherry-pick.

## Provider credentials and payment acceptance

Never send provider secrets in chat or commit them. Add credentials only to the appropriate protected Render environment variables after the official provider contract and sandbox access are confirmed.

- [ ] OPay sandbox: create/confirm sandbox credentials, validate collection, signature verification, duplicate webhook rejection, status reconciliation and ledger idempotency.
- [ ] Cleva: obtain current official API docs, account eligibility, sandbox credentials, webhook signing details and settlement/reference model; then implement and test the adapter.
- [ ] Eversend: obtain current official API docs, account eligibility, sandbox credentials, webhook signing details and settlement/reference model; then implement and test the adapter.
- [ ] Keep payouts, refunds and FX disabled until each specific operation is approved and independently tested.
- [ ] Verify demo/test payment endpoints fail closed in production and that paid subscriptions cannot activate without verified server-side payment.

## Android release

- [ ] Configure a repository-owner-controlled upload keystore or Play App Signing.
- [ ] Store signing material and passwords only as protected GitHub Actions secrets; never commit them.
- [ ] Produce a release-signed APK/AAB and verify its certificate, package ID, version code, checksum and archive integrity.
- [ ] Install on a physical Android phone; test fresh install, upgrade, launcher icon, splash screen, login, role journeys, push permission, camera/file access, deep links, Android Back, offline check-in and supported NFC/Bluetooth hardware.

## iOS release

- [ ] Owner confirms Apple Developer account/team and final bundle ID.
- [ ] Configure Apple signing certificate, provisioning profile and protected CI secrets.
- [ ] Build a signed device archive and validate on a physical iPhone.
- [ ] Test login, push permission, deep links, file/camera permissions, offline flows and payment redirects.
- [ ] Complete App Store privacy, screenshots, review and release requirements.

## Database and operations

- [ ] Verify the owner backup filename, size and SHA-256 against the recorded backup evidence.
- [ ] Run `pg_restore --list` against the backup.
- [ ] Provision a newly created disposable PostgreSQL 16-compatible target; verify it is not production and is empty.
- [ ] Restore only into that disposable target and run migration/API integration checks against it.
- [ ] Compare representative table counts; preserve the live database unchanged.
- [ ] Before the reported 2026-11-26 Render Free database expiry, owner approves and verifies a no-cost continuity destination. Do not create paid resources without approval.
- [ ] Verify current Render web/API deployed commit, health/readiness, error logs, rollback instructions and alerting.

## Security, accessibility and user journeys

- [ ] Run current `npm audit --json` and `npm audit --omit=dev --json`; triage exact advisories and dependency paths.
- [ ] Apply compatible, targeted dependency updates. Avoid `npm audit fix --force`; plan a coordinated Capacitor major upgrade if still necessary.
- [ ] Rerun API tests, web tests, browser tests, build, Android build, iOS simulator build and emulator tests after dependency changes.
- [ ] Run authenticated client, planner and vendor journeys with isolated seeded data.
- [ ] Verify wrong-password and invalid-registration handling, ownership/tenant isolation, messaging, notifications, vendor enquiries, event deposits, part-payment requests and planner-to-group messages.
- [ ] Verify webhook signature, replay protection, idempotency, currency isolation and append-only ledger invariants.
- [ ] Check accessibility, keyboard navigation, contrast, responsive layouts and measured performance budgets.
- [ ] Obtain explicit owner production sign-off only after evidence is recorded.

## Current limitations

- Cleva and Eversend are not implemented in the current provider registry.
- Debug APKs and unsigned iOS simulator builds are not production-signed mobile releases.
- A real device, Apple/Android signing credentials, provider sandbox credentials and a disposable database target are owner-controlled prerequisites.
- A passing CI run does not prove physical-device, provider settlement, restore or production-release acceptance.
