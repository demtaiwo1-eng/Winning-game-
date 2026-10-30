# Ephinta completion tracker

Updated: 2026-10-30 UTC
Target: main | Hosting: Render Free only
Live web: https://ephinta-web.onrender.com
Live API: https://ephinta-wss.onrender.com

This ledger tracks the phased delivery programme. A phase is not complete merely because code or documentation exists; acceptance tests and required staging/device/provider evidence must pass.

## Guardrails
- Preserve the current PostgreSQL database and migration history. No resets or destructive production operations.
- Keep Render on Free. Current Free DB has a reported expiry of 2026-11-26; verify a no-cost continuity path before then.
- Keep secrets in GitHub/Render secret stores. Never commit or print secret values.
- Do not activate real payments, payouts, paid placements, or AdMob without verified providers, signatures, idempotency, consent, audit trails, and tests.
- Do not claim browser, physical-device, NFC/Bluetooth, restore, or live-payment tests passed unless performed.

## Phase status
| Phase | Scope | Status | Remaining acceptance evidence |
|---|---|---|---|
| 0 | Baseline, backup, restore, DB continuity, health/security | PARTIAL | Backup created, archive readability checked, Drive checksum matched. Restore rehearsal in separate disposable PostgreSQL DB remains open. Free DB continuity before expiry remains open. Broad DB allowlist remains an owner-accepted risk. |
| 1 | Production blockers, API URL, CORS, landing page, Android build | CODE PATCH CI-PASS; LIVE UX OPEN | PR #1 was squash-merged to main as 5807b7da69f2ce19bfe01c72ca07bbe101b0c003. Render frontend deploy is building and API deploy is queued; wait for both to become live. CI run #25 succeeded, but inspect online-readiness artifact; previous audit found GitHub Actions VITE_API_URL empty. Browser auth/planner and physical Android tap-through remain unverified. |
| 2 | Vendor promotions and monetization integrity | PARTIAL | DRAFT-only creation and amount/date/listing checks implemented on feature branch. Payment verification, idempotent callbacks, admin approval, pause/expiry/cancel, audit and tracking tests remain. |
| 3 | Payments, wallet, escrow, booking reliability | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify provider adapters, raw-body signatures, replay/idempotency, ledger invariants, refund/release/dispute permissions, sandbox journeys. No live money. |
| 4 | Event planner completeness | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify create/edit/resume, guests/RSVP, tasks, budgets, booking linkage, exports, and cross-user ownership in isolated E2E tests. |
| 5 | Vendor marketplace and portal | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify vendor isolation, storefront/listings, availability, enquiries, bookings, review eligibility, and source-backed metrics. |
| 6 | Messaging, notifications and trust | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify participant-only messaging, user-scoped notifications, retries, push preferences and account security history. |
| 7 | Mobile, PWA, offline and advertising | BUILD GATE EXISTS; DEVICE SIGN-OFF OPEN | Install/test APK on physical Android; verify offline queue, deep links, permissions, NFC/Bluetooth where supported. Keep AdMob disabled absent owner IDs and consent configuration. |
| 8 | Deployment, database and operations | PARTIAL | Render web/API deployed on Free; /ready was observed returning 200 in logs. Public smoke tests, restore, migration rehearsal, monitoring/rollback and DB continuity remain. |
| 9 | Security, accessibility and performance | SIGN-OFF OPEN | Run authorization regression, dependency/security review, headers/rate limits/upload checks, accessibility/mobile checks, measured performance budgets. |
| 10 | Repository hygiene and release readiness | GATE DOCUMENTED; SIGN-OFF OPEN | Run clean install, API/web tests/build, DB integration, service-worker checks, browser E2E, Android build; review unused-file inventory without unsafe bulk deletion. |
| 11 | PostgreSQL integration CI gate | DOCUMENTED; VERIFY ON MAIN | Confirm workflow runs on main and tests migrations/integration against isolated PostgreSQL 16. |
| 12 | Browser end-to-end testing | PARTIAL | Existing Playwright scope covers public UI and selected validation/error paths. Expand authenticated event, vendor, cart/checkout and role journeys. |
| 13 | Security and financial integrity | TEST GATE EXISTS; COVERAGE OPEN | Prove negative authorization, signed webhook replay rejection, idempotent ledger effects, currency validation, and rejection of demo payment success in production. |
| 14 | Mobile/PWA/offline workflows | PARTIAL | Verify service-worker/outbox behavior and physical device capabilities; never queue/replay financial mutations. |
| 15 | Staging and production release | NOT SIGNED OFF | Verify staging, smoke tests, provider sandbox, backup restore, monitoring, rollback, and explicit release approval. |

## Known CI evidence
- Feature branch: ephinta/full-phased-improvement-patch
- PR #1: https://github.com/demtaiwo1-eng/Winning-game-/pull/1
- Feature head at tracker creation: c101aadb7a9319ceacf121dbc9de3e7843b97b85
- GitHub Actions run #25: https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 — overall success; API/web checks, disposable PostgreSQL migrations/integration tests, web build, Android debug APK build and artifact upload completed.
- CI success does not certify live browser flows, online readiness, physical-device operation, real payments, database restore, or production release.
- PR #1 was squash-merged to main as 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003. Render frontend deployment is building and API deployment is queued at tracker update time.

## Work log
| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-30 | Created Render Free static site; configured Vite API base and SPA rewrite. | https://ephinta-web.onrender.com |
| 2026-10-30 | Added frontend origin to API CORS allowlist; API redeploy completed live. | Render service ephinta_wss |
| 2026-10-30 | Verified PR #1 CI run #25 passed, including isolated DB tests and Android debug APK build. | https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 |
| 2026-10-30 | Added phase statuses and evidence gaps in this tracker on main. | Commit 7082c26b045ba290cfa01c0db3f89e26d1b7f2c4 |\n| 2026-10-30 | Squash-merged the CI-passing Phase 1 patch to main after owner authorization. Render auto-deploys started; live browser acceptance remains open. | Commit 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003; PR #1 |

## Definition of done
A phase is complete only when code review, CI, relevant environment tests, and security/data invariants pass. External dependencies must be recorded as verified or blocked. Overall completion requires evidence for all required phases and owner acceptance of the release checklist.