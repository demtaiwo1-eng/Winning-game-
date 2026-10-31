# Ephinta completion tracker

Updated: 2026-10-31 UTC
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
| 0 | Baseline, backup, restore, DB continuity, health/security | PARTIAL | Owner backup `ephinta_db_20261030.dump` is 103,970 bytes with SHA-256 recorded in `PHASE_0_RESTORE_REHEARSAL.md`; only its `PGDMP` header has been checked, not `pg_restore --list` or a restore. Live PostgreSQL 16.15 has 38 public tables, 16 finished migrations, and existing rows (User 1, Event 1, Wallet 1, Cart 2, EventTask 22, RefreshToken 1). Preserve all records; their test-vs-real status remains unconfirmed. A second Render Free DB was blocked by the one-active-Free-DB limit; no paid resource created. Free DB expiry 2026-11-26 and broad external allowlist remain open risks. |
| 1 | Production blockers, API URL, CORS, landing page, Android build | CODE PATCH CI-PASS; LIVE UX OPEN | Render Free API and web services are live. GitHub Actions online-readiness check against the configured API returned 200 for `/health` and `/ready`. PR #24/#25/#26 CI runs passed web/API checks and Android debug APK builds. Browser auth/planner journeys and physical Android tap-through remain unverified. |
| 2 | Vendor promotions and monetization integrity | PARTIAL | Promotion creation remains DRAFT-only; wallet campaign payments and activation are disabled until readiness sign-off. Paid subscriptions now fail closed until verified checkout; zero-cost plans remain available with account-role matching. End-to-end promotion payment, approval, expiry/refund and provider sandbox evidence remain open. |
| 3 | Payments, wallet, escrow, booking reliability | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify provider adapters, raw-body signatures, replay/idempotency, ledger invariants, refund/release/dispute permissions, sandbox journeys. No live money. |
| 4 | Event planner completeness | IMPLEMENTED + MERGED + DEPLOYED; E2E SIGN-OFF OPEN | PR #15 and PR #16 are merged. Final-head CI run #88 passed API/web checks, disposable PostgreSQL migration/integration tests, web build and Android debug APK build. Render web and API deployments for 90a2f939 are live; production migration 20261030190000_event_guest_checkin_history applied successfully and /health plus /ready returned 200. Still required: isolated browser E2E for create/edit/resume, guests/RSVP, task reminders, budgets, booking linkage, exports and cross-user ownership. Background push/email reminder delivery and pre-migration check-in audit reconstruction remain explicitly unclaimed. |
| 5 | Vendor marketplace and portal | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify vendor isolation, storefront/listings, availability, enquiries, bookings, review eligibility, and source-backed metrics. |
| 6 | Messaging, notifications and trust | IMPLEMENTATION EXTENDED; CI PENDING; PROVIDER SIGN-OFF OPEN | Participant-only event messaging, per-account rate limits, user-scoped in-app notifications, read/pagination controls, preferences, hashed device registration and account security history are implemented on the Phase 6 branch. CI/database tests pending. FCM/APNs delivery and retry execution, web push, physical-device validation, and complete booking/payment timeline evidence remain open. |
| 7 | Mobile, PWA, offline and advertising | BUILD GATE EXISTS; DEVICE SIGN-OFF OPEN | Install/test APK on physical Android; verify offline queue, deep links, permissions, NFC/Bluetooth where supported. Keep AdMob disabled absent owner IDs and consent configuration. |
| 8 | Deployment, database and operations | PARTIAL | Render web/API deployed on Free; /ready was observed returning 200 in logs. Public smoke tests, restore, migration rehearsal, monitoring/rollback and DB continuity remain. |
| 9 | Security, accessibility and performance | SIGN-OFF OPEN | PR #25 hardened event-readiness data access, verifier assignment targets, zone changes and review eligibility; PR #24/#26 hardened subscription entitlement gating and organization role matching. CI policy tests pass. Dependency/security review (npm install reports 19 vulnerabilities including 3 critical), headers/rate limits/upload checks, accessibility/mobile checks and measured performance budgets remain open. |
| 10 | Repository hygiene and release readiness | GATE DOCUMENTED; SIGN-OFF OPEN | Run clean install, API/web tests/build, DB integration, service-worker checks, browser E2E, Android build; review unused-file inventory without unsafe bulk deletion. |
| 11 | PostgreSQL integration CI gate | PR CI-PASS; VERIFY ON MAIN | PR #24/#25/#26 workflow runs passed migrations and API database integration tests against isolated PostgreSQL 16. Confirm the post-merge main workflow remains green; do not treat CI as a production backup restore. |
| 12 | Browser end-to-end testing | PARTIAL | Existing Playwright scope covers public UI and selected validation/error paths. Expand authenticated event, vendor, cart/checkout and role journeys. |
| 13 | Security and financial integrity | TEST GATE EXISTS; COVERAGE OPEN | Readiness access-control regression and subscription payment gating are merged. Remaining evidence: negative authorization across all roles, signed webhook replay rejection, idempotent ledger effects, currency validation, demo-payment rejection in production, and provider sandbox settlement. |
| 14 | Mobile/PWA/offline workflows | PARTIAL | Verify service-worker/outbox behavior and physical device capabilities; never queue/replay financial mutations. |
| 15 | Staging and production release | NOT SIGNED OFF | Verify staging, smoke tests, provider sandbox, backup restore, monitoring, rollback, and explicit release approval. |

## Known CI evidence
- Feature branch: ephinta/full-phased-improvement-patch
- PR #1: https://github.com/demtaiwo1-eng/Winning-game-/pull/1
- Feature head at tracker creation: c101aadb7a9319ceacf121dbc9de3e7843b97b85
- GitHub Actions run #25: https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 — overall success; API/web checks, disposable PostgreSQL migrations/integration tests, web build, Android debug APK build and artifact upload completed.
- CI success does not certify live browser flows, online readiness, physical-device operation, real payments, database restore, or production release. Follow-up main commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406 adds a safe public API URL fallback to all four workflow references; GitHub Actions run #27 is pending.
- PR #1 was squash-merged to main as 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003. Phase 1 frontend deployment completed live; API deployment for the merged commit is still being processed. CI fallback commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406 is in progress.

## Work log
| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-30 | Created Render Free static site; configured Vite API base and SPA rewrite. | https://ephinta-web.onrender.com |
| 2026-10-30 | Added frontend origin to API CORS allowlist; API redeploy completed live. | Render service ephinta_wss |
| 2026-10-30 | Verified PR #1 CI run #25 passed, including isolated DB tests and Android debug APK build. | https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 |
| 2026-10-30 | Added phase statuses and evidence gaps in this tracker on main. | Commit 7082c26b045ba290cfa01c0db3f89e26d1b7f2c4 |
| 2026-10-30 | Squash-merged the CI-passing Phase 1 patch to main after owner authorization. Frontend deployment completed live; API deployment is still processing. | Commit 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003; PR #1 |
| 2026-10-30 | Added a default public API URL to GitHub Actions so online readiness is checked even if the repository variable is unset. | Commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406; run #27 pending |

## Latest work log (2026-10-31)
| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-31 | Merged subscription payment gate: only matching zero-cost plans activate; paid plans remain disabled until verified checkout. | PR #24; commit 0f1764b28db325653bd762431442df91e963e504; CI run #116 success; Render API/web deployments live. |
| 2026-10-31 | Merged readiness authorization hardening: event-owner/assigned-verifier access, controlled zone edits, verifier assignment validation, and completed-event review eligibility. | PR #25; commit 847ffbceea02882a8a7a3aff7395503c6029cb4c; CI run #118 success; Render API/web deployments live. |
| 2026-10-31 | Merged organization-mode subscription eligibility using the shared role policy; paid-plan gating unchanged. | PR #26; commit 04c4b9b99ced9ee82cc1fdad3e094bcfbd26b38a; CI run #120 success. |
| 2026-10-31 | Recorded live PostgreSQL preservation baseline and backup checksum; restore rehearsal remains blocked by Free-tier database quota and must not target production. | `PHASE_0_RESTORE_REHEARSAL.md`; no production rows modified. |

## Follow-up risk observed during deployment
- Render dependency installation reported 19 npm audit findings (2 low, 11 moderate, 3 high, 3 critical). No force-upgrade was run during deployment; dependency-level triage and compatible remediation remain open under Phase 9.

## Definition of done
A phase is complete only when code review, CI, relevant environment tests, and security/data invariants pass. External dependencies must be recorded as verified or blocked. Overall completion requires evidence for all required phases and owner acceptance of the release checklist.
| 2026-10-31 | Merged PR #16 after final-head CI run #88 passed; Render web and API deployments for commit 90a2f939 are live. Additive guest check-in history migration applied; /health and /ready returned 200. | PR #16; commit 90a2f93900073d74d69f8aa09371392a18ca94c0; Render deploys dep-dbij1tbm8hqs73etkmj0 and dep-dbij1tbm8hqs73etkmdg |

## Phase 4 operations delivery (2026-10-31)

The separate Phase 4 operations plan in `PHASE_4_OPERATIONS_FOUNDATION.md` has now had its implementation sequence delivered and merged:

| Workstream | Merged PR | Main commit | CI evidence |
|---|---:|---|---|
| Finance CSV numeric integrity | #31 | `e96da05893d1ff8d3f86125036fbe689d431a541` | Run [41188847594](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41188847594) passed |
| Maker-checker approval records | #32 | `477da113bb2df03ee24cab2bfcca7ae17a8e9773` | Run [41189056341](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189056341) passed |
| Prevent offline replay of privileged admin mutations | #33 | `3664219cbfb2de727e76cd043eeabb2590d0b7b6` | Run [41189114897](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189114897) passed |
| Durable payment reconciliation and dead-letter replay | #34 | `6908e49370b883c395181a8bed060edc18b4a10f` | Run [41189609281](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189609281) passed |
| Currency-aware wallet idempotency | #35 | `2a0aac9df99a0307be5775896ed22c4f4caf1da1` | Run [41190026407](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41190026407) passed |
| Admin approval/reconciliation console | #36 | `2e9036e03904a468cb07758ade6d917f6f284dce` | Run [41191143640](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41191143640) passed |
| Admin authorization regression tests and Phase 4.5 runbook | #37 | `9dba60df064592ff24c5ccc9cbe4a5ab5a6025af` | Run [41191519256](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41191519256) passed |

These are implementation/CI completion claims, not production activation claims. Still open before a production release: staging sign-off, authenticated browser journeys, physical Android accessibility/viewport review, provider sandbox evidence, backup restore rehearsal, Render database continuity, and dependency/security remediation. Live payouts, refunds, FX, and campaign billing remain disabled/deferred.

| 2026-10-31 | Added shared database-backed per-provider reconciliation throttling (250 ms minimum spacing, 15-second bounded slot wait) to close the remaining Phase 4.3 acceptance gap. | PR #39; commit `a305ee54c95188892b20a5c448040bb76e3f3c0c`; CI run #41192052203 success. |
| 2026-10-31 | Completed Phase 4.5 admin approval/reconciliation UI and authorization regression coverage. | PR #36 commit `2e9036e03904a468cb07758ade6d917f6f284dce`; PR #37 commit `9dba60df064592ff24c5ccc9cbe4a5ab5a6025af`; CI runs #41191143640 and #41191519256 success. |
| 2026-10-31 | Updated the operations completion tracker with PR/CI evidence and explicit remaining release gates. | PR #38; commit `ddea6435d4227caf6bd90d3629a41778aad61840`; CI run #41191858110 success. |
| 2026-10-31 | Verified automatic Render deployment of Phase 4.3 provider throttle commit. API and static site deploys are live; API runtime returned HTTP 200 for /health and /ready. Production DB migration `20261031123000_provider_reconciliation_rate_limits` is finished with no rollback, and the new `PaymentProviderThrottle` table exists. | Render API deploy `dep-dbis1h3bc2fs73cppurg` and web deploy `dep-dbis1h3bc2fs73cppv10`; PostgreSQL read-only verification. No manual deploy or destructive DB operation was performed. |




## Phase 6 work log (2026-10-31)

| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-31 | Started Phase 6 messaging/notifications trust increment on `feat/phase6-messaging-notifications-trust`. Added notification delivery metadata, per-user push preferences, hashed device registration, per-account message throttling, message notifications, account security history, and client/vendor notification UI. | Validation pending in GitHub Actions; see `docs/PHASE6_MESSAGING_NOTIFICATIONS_TRUST.md`. Push provider and physical-device delivery remain unconfigured/unverified. |
